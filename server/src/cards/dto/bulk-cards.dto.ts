import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID, ValidateNested } from 'class-validator';
import { BULK_MAX } from './card-bounds';
import { UpdateCardDto } from './update-card.dto';

/**
 * One entry in a bulk update: the target card id plus any updatable card fields
 * (inherits every validated, optional field from `UpdateCardDto`).
 */
export class BulkCardUpdateItem extends UpdateCardDto {
  @IsUUID()
  id!: string;
}

/** Atomic multi-card update (group move / recolor / reshape / resize). */
export class BulkUpdateCardsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BULK_MAX)
  @ValidateNested({ each: true })
  @Type(() => BulkCardUpdateItem)
  updates!: BulkCardUpdateItem[];
}

/** A bounded list of card ids — bulk soft-delete / restore. */
export class BulkCardIdsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BULK_MAX)
  @IsUUID('all', { each: true })
  ids!: string[];
}
