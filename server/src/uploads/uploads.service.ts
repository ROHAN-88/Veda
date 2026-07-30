import {
  Injectable,
  NotFoundException,
  type OnModuleInit,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { createReadStream, mkdirSync, type ReadStream } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { sniffImageMime } from './upload-sniff';

/** The one-time result returned to the client after a successful upload. */
export interface StoredUpload {
  id: string;
  url: string;
  mimeType: string;
}

/**
 * Image uploads (DBA note: BYTES on disk, metadata in Postgres). The file is
 * validated by its magic bytes, written under a random UUID key in `UPLOAD_DIR`,
 * and recorded as an `Upload` row owned by the caller. Files are read back by that
 * unguessable id (a capability URL), so they also load in read-only share views.
 */
@Injectable()
export class UploadsService implements OnModuleInit {
  private readonly dir: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.dir = config.get<string>('UPLOAD_DIR') ?? join(process.cwd(), 'uploads');
  }

  onModuleInit(): void {
    mkdirSync(this.dir, { recursive: true });
  }

  /** Validate by CONTENT, persist to disk under a random id, record metadata. */
  async store(userId: string, buffer: Buffer): Promise<StoredUpload> {
    const mimeType = sniffImageMime(buffer);
    if (!mimeType) {
      throw new UnsupportedMediaTypeException('Only PNG, JPEG, GIF, or WEBP images are allowed');
    }
    const id = randomUUID();
    await writeFile(join(this.dir, id), buffer);
    await this.prisma.upload.create({
      data: { id, ownerId: userId, mimeType, sizeBytes: buffer.length },
    });
    return { id, url: `/api/uploads/${id}`, mimeType };
  }

  /**
   * Metadata + a read stream for an upload (404 if unknown). `id` is a validated
   * UUID that also exists as a row, so the on-disk path can't be attacker-chosen.
   */
  async read(id: string): Promise<{ mimeType: string; stream: ReadStream }> {
    const upload = await this.prisma.upload.findUnique({
      where: { id },
      select: { mimeType: true },
    });
    if (!upload) {
      throw new NotFoundException('Upload not found');
    }
    return { mimeType: upload.mimeType, stream: createReadStream(join(this.dir, id)) };
  }
}
