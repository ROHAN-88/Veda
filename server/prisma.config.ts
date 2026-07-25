import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, env } from 'prisma/config';

/**
 * Prisma 7 CLI configuration.
 *
 * Prisma 7 no longer auto-loads `.env`, so we load it explicitly before
 * `env('DATABASE_URL')` reads it. This file lives in `server/`, so the repo
 * root `.env` is `../.env`; we fall back to a local `.env` if present. Used by
 * `prisma migrate` / `prisma generate` only — not by the runtime app.
 */
const rootEnv = resolve(__dirname, '../.env');
loadEnv({ path: existsSync(rootEnv) ? rootEnv : resolve(process.cwd(), '.env') });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
});
