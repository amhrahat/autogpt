/**
 * Typed API client. Plain fetch, no libraries.
 * On a 401 it tries /auth/refresh exactly once, retries the original
 * request, and throws a SessionExpired error if that also fails.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api/v1';

export class SessionExpiredError extends Error {
  constructor() {
    super('Session expired');
    this.name = 'SessionExpiredError';
  }
}

// set by AuthContext so the client can rotate tokens without a circular import
let getRefreshToken: () => string | null = () => null;
let onTokensRefreshed: (access: string, refresh: string) => void = () => {};
let onSessionExpired: () => void = () => {};

export function bindAuthCallbacks(callbacks: {
  getRefreshToken: () => string | null;
  onTokensRefreshed: (access: string, refresh: string) => void;
  onSessionExpired: () => void;
}) {
  getRefreshToken = callbacks.getRefreshToken;
  onTokensRefreshed = callbacks.onTokensRefreshed;
  onSessionExpired = callbacks.onSessionExpired;
}

export function getAccessToken(): string | null {
  return sessionStorage.getItem('echogpt.access');
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error: string;
}

export function errorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    const apiErr = err as ApiError;
    return Array.isArray(apiErr.message) ? apiErr.message.join(', ') : apiErr.message;
  }
  return err instanceof Error ? err.message : 'Something went wrong';
}

async function parseError(response: Response): Promise<ApiError> {
  try {
    return (await response.json()) as ApiError;
  } catch {
    return { statusCode: response.status, message: response.statusText, error: 'Error' };
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean; // default true: attach the access token
  retryAfterRefresh?: boolean; // internal: guards against refresh loops
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, retryAfterRefresh = false } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  const token = getAccessToken();
  if (auth && token) headers.authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the API — is the backend running?');
  }

  if (response.status === 401 && auth && !retryAfterRefresh) {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      const refreshed = await tryRefresh(refreshToken);
      if (refreshed) {
        return api<T>(path, { ...options, retryAfterRefresh: true });
      }
    }
    onSessionExpired();
    throw new SessionExpiredError();
  }

  if (!response.ok) {
    throw await parseError(response);
  }
  return (await response.json()) as T;
}

async function tryRefresh(refreshToken: string): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) return false;
    const data = (await response.json()) as { accessToken: string; refreshToken: string };
    sessionStorage.setItem('echogpt.access', data.accessToken);
    localStorage.setItem('echogpt.refresh', data.refreshToken);
    onTokensRefreshed(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

// ---- endpoint-specific helpers ----

export interface AuthResponse {
  user: SafeUser;
  accessToken: string;
  refreshToken: string;
}

export interface SafeUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
}

export interface Provider {
  id: string;
  name: string;
  type: 'openai' | 'anthropic' | 'custom';
  baseUrl: string;
  model: string;
  isDefault: boolean;
  isEnabled: boolean;
  lastHealthStatus: string | null;
  lastHealthCheckedAt: string | null;
}

export interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
  _count?: { messages: number };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model: string | null;
  createdAt: string;
}

export interface ChatSendResponse {
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
  content: string;
  model: string;
}

export const apiClient = {
  register: (email: string, password: string, name: string) =>
    api<AuthResponse>('/auth/register', { method: 'POST', body: { email, password, name }, auth: false }),
  login: (email: string, password: string) =>
    api<AuthResponse>('/auth/login', { method: 'POST', body: { email, password }, auth: false }),
  me: () => api<SafeUser>('/auth/me'),
  logoutAll: () => api<{ message: string }>('/auth/logout-all', { method: 'POST' }),

  updateProfile: (data: { name?: string; email?: string }) =>
    api<SafeUser>('/user/me', { method: 'PATCH', body: data }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api<{ message: string }>('/user/me/password', { method: 'POST', body: { currentPassword, newPassword } }),
  deleteAccount: () => api<{ message: string }>('/user/me', { method: 'DELETE' }),

  listProviders: () => api<Provider[]>('/providers'),
  createProvider: (data: { name: string; type: string; baseUrl: string; apiKey: string; model: string; isDefault?: boolean }) =>
    api<Provider>('/providers', { method: 'POST', body: data }),
  updateProvider: (id: string, data: Partial<{ name: string; type: string; baseUrl: string; apiKey: string; model: string; isEnabled: boolean; isDefault: boolean }>) =>
    api<Provider>(`/providers/${id}`, { method: 'PATCH', body: data }),
  deleteProvider: (id: string) => api<{ message: string }>(`/providers/${id}`, { method: 'DELETE' }),
  healthCheck: (id: string) => api<{ status: string; detail?: string }>(`/providers/${id}/health`, { method: 'POST' }),

  listConversations: () => api<{ items: Conversation[] }>('/chat/conversations'),
  getMessages: (conversationId: string) =>
    api<{ items: ChatMessage[] }>(`/chat/conversations/${conversationId}/messages`),
  sendMessage: (content: string, conversationId?: string, providerId?: string) =>
    api<ChatSendResponse>('/chat/messages', {
      method: 'POST',
      body: { content, ...(conversationId && { conversationId }), ...(providerId && { providerId }) },
    }),
  renameConversation: (id: string, title: string) =>
    api<Conversation>(`/chat/conversations/${id}`, { method: 'PATCH', body: { title } }),
  deleteConversation: (id: string) => api<{ message: string }>(`/chat/conversations/${id}`, { method: 'DELETE' }),
};
