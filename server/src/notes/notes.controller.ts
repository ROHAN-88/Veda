import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import type { SafeUser } from '../common/types/authenticated-request';
import { NotesService } from './notes.service';

/**
 * The combined all-projects notes read: `GET /api/notes`.
 *
 * Deliberately its own controller rather than a route on `ProjectsController` —
 * a `@Get('notes')` sitting beside `@Get(':id')` there would resolve by
 * declaration order, which is a footgun waiting for the next person to reorder
 * the file.
 *
 * One request regardless of how many projects the caller has. A per-project
 * fan-out would share a single 100-requests-per-minute-per-IP throttle bucket
 * with every other card read, so a large account could rate-limit itself.
 */
@Controller('notes')
@UseGuards(SessionAuthGuard)
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Get()
  list(@CurrentUser() user: SafeUser) {
    return this.notes.list(user.id);
  }
}
