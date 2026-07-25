import { Injectable, type OnModuleInit } from '@nestjs/common';
import { hash as argon2Hash, verify as argon2Verify } from '@node-rs/argon2';
import { ARGON2_OPTIONS } from './auth.constants';

const DUMMY_PASSWORD = 'timing-equalizer-not-a-real-password';

/**
 * argon2id password hashing (@node-rs/argon2, prebuilt — no node-gyp).
 * Exposes a `verifyDummy` used on the unknown-email path so login timing is
 * uniform whether or not the account exists (anti user-enumeration).
 */
@Injectable()
export class PasswordService implements OnModuleInit {
  private dummyHash = '';

  async onModuleInit(): Promise<void> {
    this.dummyHash = await argon2Hash(DUMMY_PASSWORD, ARGON2_OPTIONS);
  }

  hash(password: string): Promise<string> {
    return argon2Hash(password, ARGON2_OPTIONS);
  }

  verify(passwordHash: string, password: string): Promise<boolean> {
    return argon2Verify(passwordHash, password);
  }

  async verifyDummy(password: string): Promise<void> {
    if (!this.dummyHash) {
      this.dummyHash = await argon2Hash(DUMMY_PASSWORD, ARGON2_OPTIONS);
    }
    await argon2Verify(this.dummyHash, password);
  }
}
