import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  Equals,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { HEX_COLOR } from '../../cards/dto/card-bounds';
import { CreateCardDto } from '../../cards/dto/create-card.dto';
import { CreateProjectDto } from './create-project.dto';

/**
 * Project transfer (Phase 9): the on-disk JSON contract for export/import.
 *
 * The document is **id-free** — cards carry a local `ref` string (export uses the
 * card id, but a reader treats it as an opaque key), and connections point at
 * cards by `sourceRef`/`targetRef`. Import mints fresh server ids and remaps the
 * refs, so a file never carries — or trusts — a real database id.
 */
export const TRANSFER_VERSION = 1;

/** Bounds the import request (CWE-400 / DoS): a single file can't be unbounded. */
export const IMPORT_CARDS_MAX = 2000;
export const IMPORT_CONNECTIONS_MAX = 8000;
/** A ref is an opaque local key, not a UUID — bound its length. */
export const REF_MAX = 64;

/** The serialized (export) shape — the exact JSON the client downloads. */
export interface TransferCard {
  ref: string;
  x: number;
  y: number;
  w: number;
  h: number;
  content: string;
  shape: string;
  color: string;
  rotation: number;
  fontSize: number;
}

export interface TransferConnection {
  sourceRef: string;
  targetRef: string;
  color: string;
}

export interface TransferDocument {
  version: number;
  project: { name: string };
  cards: TransferCard[];
  connections: TransferConnection[];
}

/** One card in an import payload: every validated `CreateCardDto` field + its ref. */
export class ImportCardDto extends CreateCardDto {
  @IsString()
  @MaxLength(REF_MAX)
  ref!: string;
}

/** One arrow in an import payload, addressing its endpoints by card ref. */
export class ImportConnectionDto {
  @IsString()
  @MaxLength(REF_MAX)
  sourceRef!: string;

  @IsString()
  @MaxLength(REF_MAX)
  targetRef!: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR, { message: 'color must be a #rrggbb hex string' })
  color?: string;
}

/**
 * Full import payload. `version` is pinned so an incompatible format is rejected
 * up front; the nested arrays are bounded and each element is validated. The
 * global `whitelist`/`forbidNonWhitelisted` pipe strips/rejects anything else.
 */
export class ImportProjectDto {
  @Equals(TRANSFER_VERSION)
  version!: number;

  @ValidateNested()
  @Type(() => CreateProjectDto)
  project!: CreateProjectDto;

  @IsArray()
  @ArrayMaxSize(IMPORT_CARDS_MAX)
  @ValidateNested({ each: true })
  @Type(() => ImportCardDto)
  cards!: ImportCardDto[];

  @IsArray()
  @ArrayMaxSize(IMPORT_CONNECTIONS_MAX)
  @ValidateNested({ each: true })
  @Type(() => ImportConnectionDto)
  connections!: ImportConnectionDto[];
}
