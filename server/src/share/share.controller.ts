import {
  Controller,
  Delete,
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
import { ShareService } from './share.service';

/**
 * Owner-only management of a project's share link. Every route requires a session
 * and is scoped to the caller's own project (404 otherwise). Creating returns the
 * raw token exactly once; status never exposes it; deleting revokes it.
 */
@Controller('projects/:projectId/share')
@UseGuards(SessionAuthGuard)
export class ShareController {
  constructor(private readonly share: ShareService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: SafeUser, @Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.share.create(user.id, projectId);
  }

  @Get()
  status(@CurrentUser() user: SafeUser, @Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.share.getStatus(user.id, projectId);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(
    @CurrentUser() user: SafeUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ): Promise<void> {
    return this.share.revoke(user.id, projectId);
  }
}
