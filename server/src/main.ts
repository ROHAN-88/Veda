import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

/** Boots the API with the shared security baseline (see {@link configureApp}). */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);

  const config = app.get(ConfigService);
  const nodeEnv = config.getOrThrow<string>('NODE_ENV');
  const port = Number(config.get<string>('PORT') ?? 3000) || 3000;
  // Bind all interfaces so the container is reachable via its published port.
  await app.listen(port, '0.0.0.0');
  Logger.log(`API listening on http://localhost:${port} (${nodeEnv})`, 'Bootstrap');
}

void bootstrap();
