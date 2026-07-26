import { IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { HEX_COLOR } from './connection-bounds';

/**
 * Payload to create a relation arrow between two cards. Both endpoint ids are
 * required and must be UUIDs; the service additionally verifies each card lives
 * in the URL's project and belongs to the caller (per-user + per-project IDOR).
 * `color` is optional and falls back to the Prisma schema default.
 */
export class CreateConnectionDto {
  @IsUUID()
  sourceCardId!: string;

  @IsUUID()
  targetCardId!: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR, { message: 'color must be a #rrggbb hex string' })
  color?: string;
}
