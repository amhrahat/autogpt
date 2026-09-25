import { Module } from '@nestjs/common';
import { AiProviderModule } from '../ai-provider/ai-provider.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { AnthropicClient } from './providers/anthropic.client';
import { OpenAiCompatibleClient } from './providers/openai-compatible.client';

@Module({
  imports: [AiProviderModule, SubscriptionModule],
  controllers: [ChatController],
  providers: [ChatService, AnthropicClient, OpenAiCompatibleClient],
})
export class ChatModule {}
