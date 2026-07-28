import { env } from '@/config';
import { apiClient } from '@/lib/api/client';
import { fetchWithTimeout } from '@/lib/api/fetchWithTimeout';

export type ProfileDiagnosticStatus =
  'ambiguous' | 'found' | 'not_found' | 'ok' | 'unavailable' | string;

export type ProfileDiagnosticResult = {
  chatHistoryCount: number;
  identifierHash: string | null;
  journalCount: number;
  memoryCount: number;
  profileCount: number;
  status: ProfileDiagnosticStatus;
};

export type ProfileDiagnosticDecision = 'allow' | 'ambiguous' | 'not_found' | 'unavailable';

export async function runProfileDiagnostic(accessToken?: string): Promise<ProfileDiagnosticResult> {
  const body = accessToken
    ? await postDiagnosticWithToken(accessToken)
    : await apiClient.post<unknown>('/api/profile-diagnostic');

  return normalizeDiagnosticResponse(body);
}

export function classifyProfileDiagnostic(
  result: ProfileDiagnosticResult,
): ProfileDiagnosticDecision {
  if ((result.status === 'found' || result.status === 'ok') && result.profileCount === 1) {
    return 'allow';
  }

  if (result.status === 'not_found' || result.profileCount === 0) {
    return 'not_found';
  }

  if (result.status === 'unavailable') return 'unavailable';
  return 'ambiguous';
}

export function unavailableProfileDiagnostic(): ProfileDiagnosticResult {
  return {
    chatHistoryCount: 0,
    identifierHash: null,
    journalCount: 0,
    memoryCount: 0,
    profileCount: 0,
    status: 'unavailable',
  };
}

async function postDiagnosticWithToken(accessToken: string): Promise<unknown> {
  if (!env.apiBaseUrl) throw new Error('API base URL is not configured.');

  const response = await fetchWithTimeout(`${env.apiBaseUrl}/api/profile-diagnostic`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const text = await response.text();
  const body = text ? parseJson(text) : null;
  if (!response.ok) throw new Error('Account diagnostic failed.');
  return body;
}

function normalizeDiagnosticResponse(body: unknown): ProfileDiagnosticResult {
  const record = isRecord(body) ? body : {};
  const matches = isRecord(record.matches) ? record.matches : {};
  const counts = isRecord(record.counts) ? record.counts : {};

  return {
    chatHistoryCount:
      readCount(record.chatHistoryCount) ??
      readCount(record.chatHistory) ??
      readCount(matches.chatHistory) ??
      readCount(counts.chatHistory) ??
      0,
    identifierHash: typeof record.identifierHash === 'string' ? record.identifierHash : null,
    journalCount:
      readCount(record.journalCount) ??
      readCount(record.journalEntries) ??
      readCount(matches.journalEntries) ??
      readCount(counts.journalEntries) ??
      readCount(counts.journal) ??
      0,
    memoryCount:
      readCount(record.memoryCount) ??
      readCount(record.memory) ??
      readCount(matches.memory) ??
      readCount(counts.memory) ??
      0,
    profileCount:
      readCount(record.profileCount) ??
      readCount(record.profiles) ??
      readCount(matches.profiles) ??
      readCount(counts.profiles) ??
      0,
    status: typeof record.status === 'string' ? record.status : 'unavailable',
  };
}

function readCount(value: unknown): number | null {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return null;
  return Math.max(0, Math.floor(numberValue));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
