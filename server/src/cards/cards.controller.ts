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
import { CardsService } from './cards.service';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';

/**
 * Cards live under a project: `/api/projects/:projectId/cards`. Every route
 * requires a session and is scoped to the caller's own project — a card that
 * isn't the caller's, or isn't in the URL's project, returns 404.
 */
@Controller('projects/:projectId/cards')
@UseGuards(SessionAuthGuard)
export class CardsController {
  constructor(private readonly cards: CardsService) {}

  @Post()
  create(
    @CurrentUser() user: SafeUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateCardDto,
  ) {
    return this.cards.create(user.id, projectId, dto);
  }

  @Get()
  list(@CurrentUser() user: SafeUser, @Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.cards.list(user.id, projectId);
  }

  @Get(':id')
  getOne(
    @CurrentUser() user: SafeUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cards.getOwned(user.id, projectId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: SafeUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCardDto,
  ) {
    return this.cards.update(user.id, projectId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: SafeUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.cards.remove(user.id, projectId, id);
  }
}
