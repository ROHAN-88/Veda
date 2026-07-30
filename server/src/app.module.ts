import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { minutes, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { ThrottlerProxyGuard } from './common/guards/throttler-proxy.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { SecurityModule } from './common/security/security.module';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { CardsModule } from './cards/cards.module';
import { ConnectionsModule } from './connections/connections.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { ShareModule } from './share/share.module';
import { UploadsModule } from './uploads/uploads.module';

/**
 * Root module. `ConfigModule` validates the environment at boot (fail-fast).
 * A proxy-aware ThrottlerGuard and a body-free LoggingInterceptor are applied
 * globally.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      envFilePath: ['../.env', '.env'],
      ignoreEnvFile: process.env.NODE_ENV === 'production',
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: minutes(1), limit: 100 }],
      // Lets the e2e suite disable throttling for most tests while still
      // asserting 429 in a dedicated rate-limit test. Never set in prod.
      skipIf: () => process.env.SB_DISABLE_THROTTLE === '1',
    }),
    PrismaModule,
    SecurityModule,
    AuthModule,
    ProjectsModule,
    CardsModule,
    ConnectionsModule,
    ShareModule,
    UploadsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerProxyGuard },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
