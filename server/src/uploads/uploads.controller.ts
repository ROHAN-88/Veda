import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  StreamableFile,
  UnsupportedMediaTypeException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import type { SafeUser } from '../common/types/authenticated-request';
import { ALLOWED_IMAGE_MIME } from './upload-sniff';
import { UploadsService } from './uploads.service';

/** 5 MB — bounds request size (CWE-400) before the magic-byte check in the service. */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Minimal shape of the multer file we consume (no hard `@types/multer` dependency). */
interface UploadedImage {
  buffer: Buffer;
  size: number;
  mimetype: string;
}

/**
 * Image uploads. `POST` requires a session (+ CSRF via the global middleware) and
 * is size- and type-limited; `GET /:id` is PUBLIC (share views + the SPA load
 * images) and streamed via `StreamableFile` — no `res.sendFile`, and the id is a
 * validated UUID so the on-disk path can't be traversed.
 */
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post()
  @UseGuards(SessionAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
      // Coarse pre-filter on the declared type; the service re-checks magic bytes.
      fileFilter: (_req: unknown, file: { mimetype: string }, cb: FileFilterCb) => {
        cb(null, (ALLOWED_IMAGE_MIME as readonly string[]).includes(file.mimetype));
      },
    }),
  )
  upload(@CurrentUser() user: SafeUser, @UploadedFile() file?: UploadedImage) {
    if (!file) {
      // Also the path for a type `fileFilter` rejected (it uses `cb(null, false)`,
      // which drops the file rather than raising) — so name the accepted types.
      throw new UnsupportedMediaTypeException(
        'An image file is required (PNG, JPEG, GIF, or WEBP)',
      );
    }
    return this.uploads.store(user.id, file.buffer);
  }

  @Get(':id')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Content-Disposition', 'inline')
  async serve(@Param('id', ParseUUIDPipe) id: string): Promise<StreamableFile> {
    const { mimeType, stream } = await this.uploads.read(id);
    return new StreamableFile(stream, { type: mimeType });
  }
}

type FileFilterCb = (error: Error | null, acceptFile: boolean) => void;
