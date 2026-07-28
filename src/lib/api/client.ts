import { env } from '@/config';
import { getValidAccessToken, recoverBackendSession } from '@/lib/auth/session';
import {
  loadVoicePersonalityPreferences,
  relationshipModeForPersonality,
} from '@/lib/personality/preferences';
import { resolvePremiumAccess } from '@/lib/purchases/access';
import { getSecureItem, setSecureItem } from '@/lib/storage';
import { loadTopicPreferences } from '@/lib/topics/preferences';

type ApiClientOptions = {
  baseUrl?: string;
};

type RequestOptions = RequestInit & {
  authenticated?: boolean;
};

type DailyUsage = {
  count: number;
  date: string;
};

type ServerUsage = {
  count?: number;
  limit?: number | null;
  remaining?: number | null;
  tier?: string;
};

const MESSAGE_USAGE_KEY = 'chat.dailyUsage';

export type LastApiDiagnostics = {
  lastRequestId: string | null;
  lastSafeErrorCode: string | null;
};

let lastApiDiagnostics: LastApiDiagnostics = {
  lastRequestId: null,
  lastSafeErrorCode: null,
};

export function getLastApiDiagnostics(): LastApiDiagnostics {
  return lastApiDiagnostics;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ApiAuthenticationError extends ApiError {
  constructor(message = 'Backend session is not authenticated.', body: unknown = null) {
    super(message, 401, body);
    this.name = 'ApiAuthenticationError';
  }
}

export function createApiClient({ baseUrl = env.apiBaseUrl }: ApiClientOptions = {}) {
  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    if (!baseUrl) {
      throw new Error('API base URL is not configured.');
    }

    const isChatPost = path === '/api/chat' && (options.method ?? 'GET').toUpperCase() === 'POST';
    const resolvedOptions = isChatPost ? await enrichChatRequest(options) : options;
    const shouldRecordMessage = isChatPost ? await enforceChatTierLimit() : false;

    const requiresAuth = resolvedOptions.authenticated !== false;
    let accessToken: string | null = null;

    if (requiresAuth) {
      accessToken = await getValidAccessToken();
      if (!accessToken) {
        const recovered = await recoverBackendSession();
        accessToken = recovered.authenticated ? recovered.accessToken : null;
      }

      if (!accessToken) {
        throw new ApiAuthenticationError();
      }
    }

    let result = await sendRequest(baseUrl, path, resolvedOptions, accessToken);

    if (requiresAuth && result.response.status === 401) {
      const recovered = await recoverBackendSession();
      if (!recovered.authenticated) {
        throw new ApiAuthenticationError('Backend session recovery failed.', result.body);
      }

      result = await sendRequest(baseUrl, path, resolvedOptions, recovered.accessToken);
      if (result.response.status === 401) {
        throw new ApiAuthenticationError(
          'Backend session was rejected after recovery.',
          result.body,
        );
      }
    }

    if (!result.response.ok) {
      throw new ApiError(
        `Request failed with status ${result.response.status}`,
        result.response.status,
        result.body,
      );
    }

    if (isChatPost) {
      const serverUsage = readServerUsage(result.body);
      if (serverUsage) await persistServerUsage(serverUsage);
      else if (shouldRecordMessage) await recordSuccessfulMessage();
    }

    return result.body as T;
  }

  return {
    get: <T>(path: string, options?: RequestOptions) =>
      request<T>(path, { ...options, method: 'GET' }),
    post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
      request<T>(path, withJsonBody({ ...options, method: 'POST' }, body)),
    put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
      request<T>(path, withJsonBody({ ...options, method: 'PUT' }, body)),
    delete: <T>(path: string, options?: RequestOptions) =>
      request<T>(path, { ...options, method: 'DELETE' }),
  };
}

async function enrichChatRequest(options: RequestOptions): Promise<RequestOptions> {
  if (!options.body || typeof options.body !== 'string') return options;

  try {
    const parsed = JSON.parse(options.body) as Record<string, unknown>;
    const [topics, voicePersonality] = await Promise.all([
      loadTopicPreferences(),
      loadVoicePersonalityPreferences(),
    ]);

    return {
      ...options,
      body: JSON.stringify({
        ...parsed,
        customTopic: topics.customTopic,
        personality: voicePersonality.personality,
        relationshipMode: relationshipModeForPersonality(voicePersonality.personality),
        selectedTopics: topics.selected,
        voice: voicePersonality.voice,
      }),
    };
  } catch {
    return options;
  }
}

async function sendRequest(
  baseUrl: string,
  path: string,
  options: RequestOptions,
  accessToken: string | null,
): Promise<{ body: unknown; response: Response }> {
  const headers = new Headers(options.headers);
  const requestId = createRequestId();
  lastApiDiagnostics = { ...lastApiDiagnostics, lastRequestId: requestId };
  headers.set('Accept', 'application/json');
  headers.set('X-Unfiltr-Request-Id', requestId);

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  } else {
    headers.delete('Authorization');
  }

  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const text = await response.text();
  const body = text ? parseJson(text) : null;
  if (!response.ok) {
    lastApiDiagnostics = {
      lastRequestId: requestId,
      lastSafeErrorCode: readSafeErrorCode(body),
    };
  }
  return { body, response };
}

async function enforceChatTierLimit(): Promise<boolean> {
  const access = await resolvePremiumAccess();
  const limit = access.dailyMessageLimit;
  if (limit === null) return false;

  const usage = parseDailyUsage(await getSecureItem(MESSAGE_USAGE_KEY));
  if (usage.count >= limit) {
    throw new ApiError('Daily message limit reached.', 429, {
      code: 'DAILY_MESSAGE_LIMIT_REACHED',
      limit,
      remaining: 0,
      tier: access.tier,
    });
  }

  return true;
}

async function recordSuccessfulMessage(): Promise<void> {
  const usage = parseDailyUsage(await getSecureItem(MESSAGE_USAGE_KEY));
  await persistDailyUsage({ ...usage, count: usage.count + 1 });
}

async function persistServerUsage(usage: ServerUsage): Promise<void> {
  await persistDailyUsage({
    count: Math.max(0, Number(usage.count) || 0),
    date: getTodayKey(),
  });
}

async function persistDailyUsage(usage: DailyUsage): Promise<void> {
  const serialized = JSON.stringify(usage);
  await Promise.all([
    setSecureItem(MESSAGE_USAGE_KEY, serialized),
    setSecureItem('unfiltr_msg_usage', serialized),
  ]);
}

function readServerUsage(body: unknown): ServerUsage | null {
  if (!body || typeof body !== 'object' || !('usage' in body)) return null;
  const usage = (body as { usage?: unknown }).usage;
  if (!usage || typeof usage !== 'object') return null;
  return usage as ServerUsage;
}

function parseDailyUsage(raw: string | null): DailyUsage {
  const today = getTodayKey();
  if (!raw) return { count: 0, date: today };

  try {
    const value = JSON.parse(raw) as Partial<DailyUsage>;
    if (value.date !== today) return { count: 0, date: today };
    return { count: Math.max(0, Number(value.count) || 0), date: today };
  } catch {
    return { count: 0, date: today };
  }
}

function getTodayKey(): string {
  return new Date().toISOString().split('T')[0] ?? '';
}

function withJsonBody(options: RequestOptions, body?: unknown): RequestOptions {
  if (body === undefined) return options;
  return { ...options, body: JSON.stringify(body) };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function readSafeErrorCode(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const code = (body as { code?: unknown }).code;
  return typeof code === 'string' ? code.slice(0, 80) : null;
}

function createRequestId(): string {
  return `native-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const apiClient = createApiClient();
