import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AiProviderClient, ChatCompletionOptions, ChatCompletionResult } from './ai-provider.client';

@Injectable()
export class OpenAiCompatibleClient implements AiProviderClient {
  async complete(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    const url = `${options.baseUrl.replace(/\/$/, '')}/chat/completions`;
    let response: Response;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: options.model,
          messages: options.messages,
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
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new ServiceUnavailableException('Provider returned no message content');
    }
    return {
      content,
      model: data.model ?? options.model,
      promptTokens: data.usage?.prompt_tokens,
      completionTokens: data.usage?.completion_tokens,
    };
  }
}
