import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AiProvider } from '@prisma/client';
import { CryptoService } from '../common/crypto/crypto.service';
import { PrismaService } from '../prisma/prisma.module';
import { CreateProviderDto, UpdateProviderDto } from './dto/provider.dto';

/** Provider shape returned to clients — never includes the encrypted key. */
export type SafeProvider = Omit<AiProvider, 'apiKeyEnc'>;

@Injectable()
export class AiProviderService {
  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
  ) {}

  private toSafe(provider: AiProvider): SafeProvider {
    const { apiKeyEnc: _k, ...safe } = provider;
    return safe;
  }

  async list(userId: string): Promise<SafeProvider[]> {
    const providers = await this.prisma.aiProvider.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return providers.map((p) => this.toSafe(p));
  }

  async findOne(userId: string, id: string): Promise<SafeProvider> {
    const provider = await this.getOwned(userId, id);
    return this.toSafe(provider);
  }

  async create(userId: string, dto: CreateProviderDto): Promise<SafeProvider> {
    const provider = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.aiProvider.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.aiProvider.create({
        data: {
          userId,
          name: dto.name,
          type: dto.type,
          baseUrl: dto.baseUrl,
          apiKeyEnc: this.crypto.encrypt(dto.apiKey),
          model: dto.model,
          isDefault: dto.isDefault ?? false,
        },
      });
    });
    return this.toSafe(provider);
  }

  async update(userId: string, id: string, dto: UpdateProviderDto): Promise<SafeProvider> {
    await this.getOwned(userId, id);
    const provider = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.aiProvider.updateMany({
          where: { userId, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }
      return tx.aiProvider.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.type !== undefined && { type: dto.type }),
          ...(dto.baseUrl !== undefined && { baseUrl: dto.baseUrl }),
          ...(dto.model !== undefined && { model: dto.model }),
          ...(dto.isEnabled !== undefined && { isEnabled: dto.isEnabled }),
          ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
          ...(dto.apiKey !== undefined && { apiKeyEnc: this.crypto.encrypt(dto.apiKey) }),
        },
      });
    });
    return this.toSafe(provider);
  }

  async remove(userId: string, id: string): Promise<{ message: string }> {
    await this.getOwned(userId, id);
    await this.prisma.aiProvider.delete({ where: { id } });
    return { message: 'Provider deleted' };
  }

  /** Verifies credentials by issuing a tiny completion request to the provider. */
  async healthCheck(userId: string, id: string): Promise<{ status: string; detail?: string }> {
    const provider = await this.getOwned(userId, id);
    const apiKey = this.crypto.decrypt(provider.apiKeyEnc);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      let response: Response;
      if (provider.type === 'anthropic') {
        response = await fetch(`${provider.baseUrl.replace(/\/$/, '')}/v1/messages`, {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: provider.model,
            max_tokens: 1,
            messages: [{ role: 'user', content: 'ping' }],
          }),
          signal: controller.signal,
        });
      } else {
        // openai + custom (openai-compatible)
        response = await fetch(`${provider.baseUrl.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: provider.model,
            max_tokens: 1,
            messages: [{ role: 'user', content: 'ping' }],
          }),
          signal: controller.signal,
        });
      }
      clearTimeout(timeout);
      const ok = response.status < 400;
      await this.prisma.aiProvider.update({
        where: { id },
        data: {
          lastHealthStatus: ok ? 'ok' : 'error',
          lastHealthCheckedAt: new Date(),
        },
      });
      return {
        status: ok ? 'ok' : 'error',
        detail: ok ? undefined : `Provider responded with HTTP ${response.status}`,
      };
    } catch (err) {
      await this.prisma.aiProvider.update({
        where: { id },
        data: {
          lastHealthStatus: 'error',
          lastHealthCheckedAt: new Date(),
        },
      });
      return {
        status: 'error',
        detail: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /** Fetches the provider row and verifies ownership; throws if missing or foreign. */
  async getOwned(userId: string, id: string): Promise<AiProvider> {
    const provider = await this.prisma.aiProvider.findUnique({ where: { id } });
    if (!provider) {
      throw new NotFoundException('Provider not found');
    }
    if (provider.userId !== userId) {
      throw new ForbiddenException('Not your provider');
    }
    return provider;
  }
}
