import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import type { SafeUser } from '../common/types/authenticated-request';
import { ImportProjectDto } from './dto/transfer.dto';
import { ProjectTransferService } from './transfer.service';

/**
 * JSON export/import of a whole project. Both routes require a session; export is
 * owner-scoped (404 for a project the caller doesn't own) and import always
 * creates a project owned by the caller. Static `import` and the deeper
 * `:id/export` path never collide with the CRUD `:id` routes on ProjectsController.
 */
@Controller('projects')
@UseGuards(SessionAuthGuard)
export class ProjectTransferController {
  constructor(private readonly transfer: ProjectTransferService) {}

  @Post('import')
  @HttpCode(HttpStatus.CREATED)
  import(@CurrentUser() user: SafeUser, @Body() dto: ImportProjectDto) {
    return this.transfer.importProject(user.id, dto);
  }

  @Get(':id/export')
  export(@CurrentUser() user: SafeUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.transfer.exportProject(user.id, id);
  }
}
