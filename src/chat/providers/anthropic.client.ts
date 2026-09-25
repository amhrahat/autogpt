import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AiProviderClient, ChatCompletionOptions, ChatCompletionResult } from './ai-provider.client';

@Injectable()
export class AnthropicClient implements AiProviderClient {
  async complete(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    const url = `${options.baseUrl.replace(/\/$/, '')}/v1/messages`;
    // anthropic takes system messages separately from the conversation
    const system = options.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n');
    const messages = options.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    let response: Response;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'x-api-key': options.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: options.model,
          max_tokens: 4096,
          ...(system && { system }),
          messages,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
    } catch (err) {
      throw new ServiceUnavailableException(
        `Provider request failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new ServiceUnavailableException(
        `Provider responded with HTTP ${response.status}: ${body.slice(0, 500)}`,
      );
    }

    const data = (await response.json()) as {
      model?: string;
      content?: { type: string; text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const content = (data.content ?? [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('');
    if (!content) {
      throw new ServiceUnavailableException('Provider returned no message content');
    }
    return {
      content,
      model: data.model ?? options.model,
      promptTokens: data.usage?.input_tokens,
      completionTokens: data.usage?.output_tokens,
    };
  }
}
