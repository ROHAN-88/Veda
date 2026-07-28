import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { HEX_COLOR, LABEL_MAX } from './connection-bounds';

/**
 * Payload to update a connection: the arrow's colour and/or its midpoint label.
 * The endpoints are fixed at creation. Hand-written mirror DTO (not PartialType),
 * matching the cards/projects convention.
 */
export class UpdateConnectionDto {
  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR, { message: 'color must be a #rrggbb hex string' })
  color?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(LABEL_MAX)
  label?: string;
}
