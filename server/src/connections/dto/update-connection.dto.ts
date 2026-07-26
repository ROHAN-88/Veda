import { IsOptional, IsString, Matches } from 'class-validator';
import { HEX_COLOR } from './connection-bounds';

/**
 * Payload to update a connection. Only the arrow's colour is mutable — the
 * endpoints are fixed at creation. Hand-written mirror DTO (not PartialType),
 * matching the cards/projects convention.
 */
export class UpdateConnectionDto {
  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR, { message: 'color must be a #rrggbb hex string' })
  color?: string;
}
