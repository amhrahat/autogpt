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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ListMessagesDto, SendMessageDto, UpdateConversationDto } from './dto/chat.dto';
import { ChatService } from './chat.service';

interface RequestWithUser extends Request {
  user?: { sub: string; email: string; role: string };
}

@ApiTags('chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('messages')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 20 } }) // chat is expensive — tighter limit
  @ApiOperation({ summary: 'Send a prompt and get the assistant reply' })
  send(@Req() req: RequestWithUser, @Body() dto: SendMessageDto) {
    return this.chatService.send(req.user!.sub, dto);
  }

  @Get('conversations')
  @ApiOperation({ summary: 'List own conversations' })
  listConversations(
    @Req() req: RequestWithUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chatService.listConversations(
      req.user!.sub,
      Number(page) || 1,
      Math.min(Number(limit) || 20, 100),
    );
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Get messages of a conversation' })
  getMessages(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListMessagesDto,
  ) {
    return this.chatService.getMessages(req.user!.sub, id, query.page, query.limit);
  }

  @Patch('conversations/:id')
  @ApiOperation({ summary: 'Rename a conversation' })
  rename(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConversationDto,
  ) {
    return this.chatService.renameConversation(req.user!.sub, id, dto.title);
  }

  @Delete('conversations/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a conversation and its messages' })
  remove(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.chatService.deleteConversation(req.user!.sub, id);
  }
}
