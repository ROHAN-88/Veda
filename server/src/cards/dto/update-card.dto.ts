import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CONTENT_MAX,
  COORD_MAX,
  COORD_MIN,
  FINITE,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  HEX_COLOR,
  ROTATION_MAX,
  ROTATION_MIN,
  SHAPES,
  SIZE_MAX,
  SIZE_MIN,
} from './card-bounds';

/**
 * Partial card update (mirror DTO, matching the Projects convention — not
 * PartialType). Covers drag-move (`x`/`y`), resize (`w`/`h`), content, style, and
 * text size. `zIndex` is deliberately NOT accepted — stacking order is
 * server-owned via `POST :id/bring-to-front` (Phase 6), so it can't be tampered
 * with (`forbidNonWhitelisted` 400s any client `zIndex`).
 */
export class UpdateCardDto {
  @IsOptional()
  @IsNumber(FINITE)
  @Min(COORD_MIN)
  @Max(COORD_MAX)
  x?: number;

  @IsOptional()
  @IsNumber(FINITE)
  @Min(COORD_MIN)
  @Max(COORD_MAX)
  y?: number;

  @IsOptional()
  @IsNumber(FINITE)
  @Min(SIZE_MIN)
  @Max(SIZE_MAX)
  w?: number;

  @IsOptional()
  @IsNumber(FINITE)
  @Min(SIZE_MIN)
  @Max(SIZE_MAX)
  h?: number;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(CONTENT_MAX)
  content?: string;

  @IsOptional()
  @IsIn(SHAPES)
  shape?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR, { message: 'color must be a #rrggbb hex string' })
  color?: string;

  @IsOptional()
  @IsNumber(FINITE)
  @Min(ROTATION_MIN)
  @Max(ROTATION_MAX)
  rotation?: number;

  @IsOptional()
  @IsInt()
  @Min(FONT_SIZE_MIN)
  @Max(FONT_SIZE_MAX)
  fontSize?: number;
}
