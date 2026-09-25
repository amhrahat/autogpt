export interface ChatMessageInput {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatCompletionOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessageInput[];
}

export interface ChatCompletionResult {
  content: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
}

/**
 * Shared contract for AI providers — the one interface that earns its keep.
 * One class per provider type (openai-compatible, anthropic).
 */
export interface AiProviderClient {
  complete(options: ChatCompletionOptions): Promise<ChatCompletionResult>;
}
