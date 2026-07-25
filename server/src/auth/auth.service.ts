import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { RequestMeta } from '../common/request-meta';
import { type SafeUser, toSafeUser } from '../common/types/authenticated-request';
import { PrismaService } from '../prisma/prisma.service';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import { LockoutService } from './lockout.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';

/** Generic message for every failed-login reason (anti user-enumeration). */
const INVALID_CREDENTIALS = 'Invalid email or password';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly lockout: LockoutService,
  ) {}

  async register(dto: RegisterDto): Promise<SafeUser> {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Registration inherently reveals email existence via the unique
      // constraint; rate-limited here. Full mitigation (email verification)
      // is out of MVP scope.
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await this.passwords.hash(dto.password);
    const user = await this.prisma.user.create({ data: { email, passwordHash } });
    return toSafeUser(user);
  }

  async login(dto: LoginDto, meta: RequestMeta): Promise<{ user: SafeUser; token: string }> {
    const user = await this.validateCredentials(dto);
    const token = await this.sessions.create(user.id, meta);
    return { user, token };
  }

  refresh(rawToken: string, meta: RequestMeta): Promise<string | null> {
    return this.sessions.rotate(rawToken, meta);
  }

  async logout(rawToken: string): Promise<void> {
    await this.sessions.revoke(rawToken);
  }

  private async validateCredentials(dto: LoginDto): Promise<SafeUser> {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Spend argon2 time anyway so timing doesn't leak account existence.
      await this.passwords.verifyDummy(dto.password);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    if (this.lockout.isLocked(user)) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    const ok = await this.passwords.verify(user.passwordHash, dto.password);
    if (!ok) {
      await this.lockout.recordFailure(user.id, user.failedLoginCount);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    if (user.failedLoginCount > 0) {
      await this.lockout.reset(user.id);
    }
    return toSafeUser(user);
  }
}
