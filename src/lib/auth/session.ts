import { env } from '@/config';
import { deleteSecureItem, getSecureItem, setSecureItem } from '@/lib/storage';

type AppleSessionResponse = {
  accessToken: string;
  appleUserId: string;
  expiresAt?: number;
};

type GoogleSessionResponse = {
  accessToken: string;
  googleUserId: string;
  expiresAt?: number;
};

export type BackendSession = {
  accessToken: string;
  appleUserId: string;
  expiresAt: number;
};

export type SessionRecoveryResult =
  | {
      accessToken: string;
      authenticated: true;
      recovered: boolean;
      status: 'authenticated';
    }
  | {
      accessToken: null;
      authenticated: false;
      error?: string;
      recovered: false;
      status: 'unauthenticated';
    };

const TOKEN_EXPIRY_SKEW_SECONDS = 30;

let exchangePromise: Promise<BackendSession | null> | null = null;

type ExchangeAppleIdentityTokenOptions = {
  persist?: boolean;
};

export async function exchangeAppleIdentityToken(
  identityToken: string,
  { persist = true }: ExchangeAppleIdentityTokenOptions = {},
): Promise<BackendSession> {
  if (!env.apiBaseUrl) throw new Error('API base URL is not configured.');

  const response = await fetch(`${env.apiBaseUrl}/api/auth/apple`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ identityToken }),
  });

  const body = (await response.json().catch(() => null)) as AppleSessionResponse | null;
  if (!response.ok || !body?.accessToken) {
    throw new Error('Apple session exchange failed.');
  }

  const expiresAt = normalizeExpiry(body.expiresAt, body.accessToken);

  if (persist) {
    await Promise.all([
      setSecureItem('auth.accessToken', body.accessToken),
      setSecureItem('auth.userId', body.appleUserId),
      setSecureItem('auth.appleUserId', body.appleUserId),
      setSecureItem('auth.accessTokenExpiresAt', String(expiresAt)),
    ]);
  }

  return {
    accessToken: body.accessToken,
    appleUserId: body.appleUserId,
    expiresAt,
  };
}

type ExchangeGoogleIdentityTokenOptions = {
  persist?: boolean;
};

// `auth.appleUserId` is written here too even though this is the Google path:
// accountCache, startupRestoration, and RevenueCat all resolve the device's
// identity via `appleUserId || userId`, so a Google account must populate
// the same key to flow through that existing (well-tested) chain unchanged.
export async function exchangeGoogleIdentityToken(
  idToken: string,
  { persist = true }: ExchangeGoogleIdentityTokenOptions = {},
): Promise<BackendSession> {
  if (!env.apiBaseUrl) throw new Error('API base URL is not configured.');

  const response = await fetch(`${env.apiBaseUrl}/api/auth/google`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ idToken }),
  });

  const body = (await response.json().catch(() => null)) as GoogleSessionResponse | null;
  if (!response.ok || !body?.accessToken) {
    throw new Error('Google session exchange failed.');
  }

  const expiresAt = normalizeExpiry(body.expiresAt, body.accessToken);

  if (persist) {
    await Promise.all([
      setSecureItem('auth.accessToken', body.accessToken),
      setSecureItem('auth.userId', body.googleUserId),
      setSecureItem('auth.appleUserId', body.googleUserId),
      setSecureItem('auth.accessTokenExpiresAt', String(expiresAt)),
    ]);
  }

  return {
    accessToken: body.accessToken,
    appleUserId: body.googleUserId,
    expiresAt,
  };
}

export async function getValidAccessToken(): Promise<string | null> {
  const [accessToken, rawExpiresAt] = await Promise.all([
    getSecureItem('auth.accessToken'),
    getSecureItem('auth.accessTokenExpiresAt'),
  ]);
  if (!accessToken) return null;

  const expiresAt = normalizeStoredExpiry(rawExpiresAt, accessToken);
  if (!expiresAt || isExpired(expiresAt)) {
    await clearBackendSession();
    return null;
  }

  if (!rawExpiresAt) {
    await setSecureItem('auth.accessTokenExpiresAt', String(expiresAt));
  }

  return accessToken;
}

export async function recoverBackendSession(): Promise<SessionRecoveryResult> {
  const existing = await getValidAccessToken();
  if (existing) {
    return {
      accessToken: existing,
      authenticated: true,
      recovered: false,
      status: 'authenticated',
    };
  }

  const [appleIdentityToken, googleIdentityToken] = await Promise.all([
    getSecureItem('auth.appleIdentityToken'),
    getSecureItem('auth.googleIdentityToken'),
  ]);
  const identityToken = appleIdentityToken || googleIdentityToken;
  if (!identityToken) {
    await clearBackendSession();
    return {
      accessToken: null,
      authenticated: false,
      recovered: false,
      status: 'unauthenticated',
    };
  }

  if (!exchangePromise) {
    exchangePromise = (async () => {
      try {
        return appleIdentityToken
          ? await exchangeAppleIdentityToken(appleIdentityToken)
          : await exchangeGoogleIdentityToken(googleIdentityToken!);
      } catch {
        await clearBackendSession();
        return null;
      }
    })().finally(() => {
      exchangePromise = null;
    });
  }

  const session = await exchangePromise;
  if (!session) {
    return {
      accessToken: null,
      authenticated: false,
      error: 'Backend session recovery failed.',
      recovered: false,
      status: 'unauthenticated',
    };
  }

  return {
    accessToken: session.accessToken,
    authenticated: true,
    recovered: true,
    status: 'authenticated',
  };
}

export async function isBackendSessionValid(): Promise<boolean> {
  return (await getValidAccessToken()) !== null;
}

export async function clearAuthenticatedSession(): Promise<void> {
  await Promise.all([
    deleteSecureItem('auth.accessToken'),
    deleteSecureItem('auth.accessTokenExpiresAt'),
    deleteSecureItem('auth.appleIdentityToken'),
    deleteSecureItem('auth.googleIdentityToken'),
    deleteSecureItem('auth.refreshToken'),
  ]);
}

export async function clearRememberedAccountIdentity(): Promise<void> {
  await Promise.all([
    deleteSecureItem('auth.appleUserId'),
    deleteSecureItem('auth.userId'),
    deleteSecureItem('auth.appleEmail'),
    deleteSecureItem('auth.displayName'),
    deleteSecureItem('auth.profileId'),
  ]);
}

export async function ensureBackendSession(): Promise<string | null> {
  return getValidAccessToken();
}

export async function clearAuthSession(): Promise<void> {
  await clearAuthenticatedSession();
}

async function clearBackendSession(): Promise<void> {
  await Promise.all([
    deleteSecureItem('auth.accessToken'),
    deleteSecureItem('auth.accessTokenExpiresAt'),
  ]);
}

function normalizeExpiry(expiresAt: number | undefined, token: string): number {
  return expiresAt && Number.isFinite(expiresAt) ? expiresAt : readJwtExpiry(token);
}

function normalizeStoredExpiry(rawExpiresAt: string | null, token: string): number | null {
  const stored = rawExpiresAt ? Number(rawExpiresAt) : NaN;
  if (Number.isFinite(stored) && stored > 0) return stored;

  try {
    return readJwtExpiry(token);
  } catch {
    return null;
  }
}

function isExpired(expiresAt: number): boolean {
  return expiresAt <= Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_SKEW_SECONDS;
}

function readJwtExpiry(token: string): number {
  const payload = decodeJwtPayload(token);
  const expiresAt = Number(payload.exp);
  if (!Number.isFinite(expiresAt) || expiresAt <= 0) {
    throw new Error('Backend session token is missing an expiry.');
  }
  return expiresAt;
}

function decodeJwtPayload(token: string): { exp?: unknown } {
  const [, payload] = token.split('.');
  if (!payload) throw new Error('Backend session token is malformed.');

  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  if (typeof atob !== 'function') {
    throw new Error('Backend session token cannot be decoded in this runtime.');
  }
  const decoded = atob(padded);
  return JSON.parse(decoded) as { exp?: unknown };
}
