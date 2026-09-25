import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ChatService } from './chat.service';
import { AiProviderService } from '../ai-provider/ai-provider.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { PrismaService } from '../prisma/prisma.module';
import { CryptoService } from '../common/crypto/crypto.service';
import { AnthropicClient } from './providers/anthropic.client';
import { OpenAiCompatibleClient } from './providers/openai-compatible.client';

const provider = {
  id: 'p1',
  userId: 'u1',
  name: 'OpenAI',
  type: 'openai',
  baseUrl: 'https://api.openai.com/v1',
  apiKeyEnc: 'iv:tag:data',
  model: 'gpt-4o-mini',
  isDefault: true,
  isEnabled: true,
  lastHealthStatus: null,
  lastHealthCheckedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('ChatService', () => {
  let service: ChatService;
  let prisma: {
    conversation: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    chatMessage: { create: jest.Mock; findMany: jest.Mock };
    aiProvider: { findFirst: jest.Mock };
    apiUsageLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let subscription: { assertWithinQuota: jest.Mock; incrementUsage: jest.Mock };
  let providerService: { getOwned: jest.Mock };
  let openAiClient: { complete: jest.Mock };

  beforeEach(async () => {
    prisma = {
      conversation: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      chatMessage: { create: jest.fn(), findMany: jest.fn() },
      aiProvider: { findFirst: jest.fn() },
      apiUsageLog: { create: jest.fn() },
      $transaction: jest.fn(),
    };
    subscription = { assertWithinQuota: jest.fn().mockResolvedValue({}), incrementUsage: jest.fn() };
    providerService = { getOwned: jest.fn().mockResolvedValue(provider) };
    openAiClient = { complete: jest.fn().mockResolvedValue({ content: 'hi there', model: 'gpt-4o-mini' }) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: CryptoService,
          useValue: { decrypt: jest.fn().mockReturnValue('sk-plain') },
        },
        { provide: AiProviderService, useValue: providerService },
        { provide: SubscriptionService, useValue: subscription },
        { provide: AnthropicClient, useValue: {} },
        { provide: OpenAiCompatibleClient, useValue: openAiClient },
      ],
    }).compile();
    service = moduleRef.get(ChatService);
  });

  it('blocks chat when the quota is exhausted', async () => {
    subscription.assertWithinQuota.mockRejectedValue(
      new ForbiddenException('Monthly request quota exhausted.'),
    );
    await expect(service.send('u1', { content: 'hi' })).rejects.toThrow(ForbiddenException);
    expect(openAiClient.complete).not.toHaveBeenCalled();
  });

  it('fails fast when no provider is configured', async () => {
    prisma.aiProvider.findFirst.mockResolvedValue(null);
    await expect(service.send('u1', { content: 'hi' })).rejects.toThrow(NotFoundException);
  });

  it('sends a prompt, persists both messages, and counts usage', async () => {
    prisma.aiProvider.findFirst.mockResolvedValue(provider);
    prisma.conversation.create.mockResolvedValue({ id: 'c1', userId: 'u1' });
    prisma.chatMessage.create
      .mockResolvedValueOnce({ id: 'm1' }) // user message
      .mockResolvedValueOnce({ id: 'm2' }); // assistant message
    prisma.chatMessage.findMany.mockResolvedValue([{ role: 'user', content: 'hi' }]);
    prisma.conversation.update.mockResolvedValue({});

    const result = await service.send('u1', { content: 'hi' });

    expect(result.conversationId).toBe('c1');
    expect(result.content).toBe('hi there');
    expect(prisma.chatMessage.create).toHaveBeenCalledTimes(2);
    expect(subscription.incrementUsage).toHaveBeenCalledWith('u1');
    expect(prisma.apiUsageLog.create).toHaveBeenCalled();
    // the decrypted key never appears in the outbound call record
    expect(openAiClient.complete).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'sk-plain', messages: [{ role: 'user', content: 'hi' }] }),
    );
  });

  it('rejects a conversation owned by another user', async () => {
    prisma.aiProvider.findFirst.mockResolvedValue(provider);
    prisma.conversation.findUnique.mockResolvedValue({ id: 'cX', userId: 'someone-else' });
    await expect(
      service.send('u1', { content: 'hi', conversationId: 'cX' }),
    ).rejects.toThrow(ForbiddenException);
  });
});
