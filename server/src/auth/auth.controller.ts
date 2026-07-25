import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { minutes, Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import { requestMeta } from '../common/request-meta';
import { CsrfService } from '../common/security/csrf.service';
import type { SafeUser } from '../common/types/authenticated-request';
import {
  buildSessionCookieOptions,
  isProduction,
  sessionCookieName,
} from '../config/security.config';
import { SESSION_SLIDING_TTL_MS } from './auth.constants';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  private readonly isProd: boolean;

  constructor(
    private readonly auth: AuthService,
    private readonly csrf: CsrfService,
    config: ConfigService,
  ) {
    this.isProd = isProduction(config.getOrThrow<string>('NODE_ENV'));
  }

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: minutes(1) } })
  async register(@Body() dto: RegisterDto): Promise<{ user: SafeUser }> {
    const user = await this.auth.register(dto);
    return { user };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: minutes(1) } })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: SafeUser }> {
    const { user, token } = await this.auth.login(dto, requestMeta(req));
    this.setSessionCookie(res, token);
    return { user };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    const raw = this.readSessionCookie(req);
    const token = raw ? await this.auth.refresh(raw, requestMeta(req)) : null;
    if (!token) {
      throw new UnauthorizedException();
    }
    this.setSessionCookie(res, token);
    return { ok: true };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    const raw = this.readSessionCookie(req);
    if (raw) {
      await this.auth.logout(raw);
    }
    res.clearCookie(sessionCookieName(this.isProd), buildSessionCookieOptions(this.isProd, 0));
    return { ok: true };
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  me(@CurrentUser() user: SafeUser): { user: SafeUser } {
    return { user };
  }

  @Get('csrf')
  getCsrfToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): { csrfToken: string } {
    return { csrfToken: this.csrf.issueToken(req, res) };
  }

  private readSessionCookie(req: Request): string | undefined {
    return (req.cookies as Record<string, string> | undefined)?.[sessionCookieName(this.isProd)];
  }

  private setSessionCookie(res: Response, token: string): void {
    res.cookie(
      sessionCookieName(this.isProd),
      token,
      buildSessionCookieOptions(this.isProd, SESSION_SLIDING_TTL_MS),
    );
  }
}
