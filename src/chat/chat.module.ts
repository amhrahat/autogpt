import { Module } from '@nestjs/common';
import { AiProviderModule } from '../ai-provider/ai-provider.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { AnthropicClient } from './providers/anthropic.client';
import { OpenAiCompatibleClient } from './providers/openai-compatible.client';

@Module({
  imports: [AiProviderModule],
  controllers: [ChatController],
  providers: [ChatService, AnthropicClient, OpenAiCompatibleClient],
})
export class ChatModule {}
