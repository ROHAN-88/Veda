import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * Notes-view background: a six-digit hex, or the empty string meaning "no choice
 * made" (the view then follows the OS light/dark theme). Allowlist by construction
 * — the value is interpolated into a `style` attribute client-side, so anything
 * that is not exactly one of these two shapes must be rejected here.
 */
export const NOTES_BG = /^(#[0-9a-fA-F]{6})?$/;

export class UpdateProjectDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(NOTES_BG, { message: 'notesBg must be #rrggbb or empty' })
  notesBg?: string;

  /** Show this project in the combined all-projects notes view. */
  @IsOptional()
  @IsBoolean()
  notesIncluded?: boolean;
}
