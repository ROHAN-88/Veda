import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import type { SafeUser } from '../common/types/authenticated-request';
import { ConnectionsService } from './connections.service';
import { BulkConnectionIdsDto } from './dto/bulk-connections.dto';
import { CreateConnectionDto } from './dto/create-connection.dto';
import { UpdateConnectionDto } from './dto/update-connection.dto';

/**
 * Relation arrows live under a project: `/api/projects/:projectId/connections`.
 * Every route requires a session and is scoped to the caller's own project — a
 * connection that isn't the caller's, or isn't in the URL's project, returns 404.
 */
@Controller('projects/:projectId/connections')
@UseGuards(SessionAuthGuard)
export class ConnectionsController {
  constructor(private readonly connections: ConnectionsService) {}

  @Post()
  create(
    @CurrentUser() user: SafeUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateConnectionDto,
  ) {
    return this.connections.create(user.id, projectId, dto);
  }

  // Static paths — never collide with the `:id` routes.
  @Post('bulk-delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  bulkDelete(
    @CurrentUser() user: SafeUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: BulkConnectionIdsDto,
  ): Promise<void> {
    return this.connections.bulkDelete(user.id, projectId, dto.ids);
  }

  @Post('bulk-restore')
  @HttpCode(HttpStatus.NO_CONTENT)
  bulkRestore(
    @CurrentUser() user: SafeUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: BulkConnectionIdsDto,
  ): Promise<void> {
    return this.connections.bulkRestore(user.id, projectId, dto.ids);
  }

  @Get()
  list(@CurrentUser() user: SafeUser, @Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.connections.list(user.id, projectId);
  }

  @Get(':id')
  getOne(
    @CurrentUser() user: SafeUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.connections.getOwned(user.id, projectId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: SafeUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConnectionDto,
  ) {
    return this.connections.update(user.id, projectId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: SafeUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.connections.remove(user.id, projectId, id);
  }
}
