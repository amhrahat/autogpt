import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AiProvider, Conversation } from '@prisma/client';
import { CryptoService } from '../common/crypto/crypto.service';
import { PrismaService } from '../prisma/prisma.module';
import { AiProviderService } from '../ai-provider/ai-provider.service';
import { SendMessageDto } from './dto/chat.dto';
import { AiProviderClient, ChatCompletionResult } from './providers/ai-provider.client';
import { AnthropicClient } from './providers/anthropic.client';
import { OpenAiCompatibleClient } from './providers/openai-compatible.client';

const HISTORY_WINDOW = 20; // messages of context sent to the provider

@Injectable()
export class ChatService {
  private clients: Record<string, AiProviderClient>;

  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
    private providerService: AiProviderService,
    anthropicClient: AnthropicClient,
    openAiCompatibleClient: OpenAiCompatibleClient,
  ) {
    this.clients = {
      anthropic: anthropicClient,
      openai: openAiCompatibleClient,
      custom: openAiCompatibleClient, // custom = openai-compatible base URL
    };
  }

  async listConversations(userId: string, page: number, limit: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.conversation.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { messages: true } } },
      }),
      this.prisma.conversation.count({ where: { userId } }),
    ]);
    return { items, total, page, limit };
  }

  async getMessages(userId: string, conversationId: string, page: number, limit: number) {
    await this.getOwnedConversation(userId, conversationId);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.chatMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.chatMessage.count({ where: { conversationId } }),
    ]);
    return { items, total, page, limit };
  }

  async renameConversation(userId: string, conversationId: string, title: string) {
    await this.getOwnedConversation(userId, conversationId);
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { title },
    });
  }

  async deleteConversation(userId: string, conversationId: string) {
    await this.getOwnedConversation(userId, conversationId);
    await this.prisma.conversation.delete({ where: { id: conversationId } });
    return { message: 'Conversation deleted' };
  }

  /**
   * Core flow: resolve provider → persist user message → call provider with
   * recent history → persist assistant reply → return both.
   */
  async send(userId: string, dto: SendMessageDto): Promise<ChatCompletionResult & { conversationId: string }> {
    const provider = await this.resolveProvider(userId, dto.providerId);
    const client = this.clients[provider.type];
    if (!client) {
      throw new ServiceUnavailableException(`Unsupported provider type: ${provider.type}`);
    }

    // find or create the conversation
    let conversation: Conversation;
    if (dto.conversationId) {
      conversation = await this.getOwnedConversation(userId, dto.conversationId);
    } else {
      conversation = await this.prisma.conversation.create({
        data: {
          userId,
          providerId: provider.id,
          title: dto.content.slice(0, 60),
        },
      });
    }

    const userMessage = await this.prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        userId,
        role: 'user',
        content: dto.content,
        providerId: provider.id,
      },
    });

    // recent history (including the just-saved user message) for context
    const recent = await this.prisma.chatMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_WINDOW,
    });
    const history = recent.reverse().map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));

    const apiKey = this.crypto.decrypt(provider.apiKeyEnc);
    const result = await client.complete({
      baseUrl: provider.baseUrl,
      apiKey,
      model: provider.model,
      messages: history,
    });

    const assistantMessage = await this.prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        userId,
        role: 'assistant',
        content: result.content,
        providerId: provider.id,
        model: result.model,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    await this.prisma.apiUsageLog.create({
      data: {
        userId,
        providerId: provider.id,
        conversationId: conversation.id,
        endpoint: '/api/v1/chat/messages',
        method: 'POST',
        statusCode: 200,
      },
    });

    return {
      conversationId: conversation.id,
      userMessageId: userMessage.id,
      assistantMessageId: assistantMessage.id,
      content: result.content,
      model: result.model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
    } as ChatCompletionResult & {
      conversationId: string;
      userMessageId: string;
      assistantMessageId: string;
    };
  }

  private async resolveProvider(userId: string, providerId?: string): Promise<AiProvider> {
    if (providerId) {
      const provider = await this.providerService.getOwned(userId, providerId);
      if (!provider.isEnabled) {
        throw new ForbiddenException('Provider is disabled');
      }
      return provider;
    }
    const fallback =
      (await this.prisma.aiProvider.findFirst({
        where: { userId, isDefault: true, isEnabled: true },
      })) ??
      (await this.prisma.aiProvider.findFirst({
        where: { userId, isEnabled: true },
        orderBy: { createdAt: 'asc' },
      }));
    if (!fallback) {
      throw new NotFoundException('No enabled AI provider configured. Add one first.');
    }
    return fallback;
  }

  private async getOwnedConversation(userId: string, conversationId: string): Promise<Conversation> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    if (conversation.userId !== userId) {
      throw new ForbiddenException('Not your conversation');
    }
    return conversation;
  }
}
