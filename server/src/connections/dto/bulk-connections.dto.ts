import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';
import { BULK_MAX } from './connection-bounds';

/** A bounded list of connection ids — bulk soft-delete / restore (undo/redo). */
export class BulkConnectionIdsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BULK_MAX)
  @IsUUID('all', { each: true })
  ids!: string[];
}
