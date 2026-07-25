import { Transform } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import {
  CONTENT_MAX,
  COORD_MAX,
  COORD_MIN,
  FINITE,
  SIZE_MAX,
  SIZE_MIN,
  ZINDEX_MAX,
} from './card-bounds';

/**
 * Partial card update (mirror DTO, matching the Projects convention — not
 * PartialType). Covers drag-move (`x`/`y`), resize (`w`/`h`), content edits, and
 * client-driven bring-to-front (`zIndex`).
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
  @IsInt()
  @Min(0)
  @Max(ZINDEX_MAX)
  zIndex?: number;
}
