import { Platform } from 'react-native';

import {
  clearAuthenticatedSession,
  exchangeAppleIdentityToken,
  exchangeGoogleIdentityToken,
  getValidAccessToken,
} from '@/lib/auth/session';
import { recordRestorationStage } from '@/lib/diagnostics/restorationDiagnostics';
import { getSecureItem } from '@/lib/storage';

export type StartupAuthStatus = 'authenticated' | 'offline' | 'unauthenticated';

export type StartupAuthResult = {
  error?: string;
  recovered: boolean;
  status: StartupAuthStatus;
};

export async function restoreStartupAuthSession(): Promise<StartupAuthResult> {
  try {
    const currentToken = await getValidAccessToken();
    if (currentToken) return { recovered: false, status: 'authenticated' };

    const [appleIdentityToken, googleIdentityToken] = await Promise.all([
      getSecureItem('auth.appleIdentityToken'),
      getSecureItem('auth.googleIdentityToken'),
    ]);
    if (!appleIdentityToken && !googleIdentityToken) {
      return { recovered: false, status: 'unauthenticated' };
    }

    recordRestorationStage('auth-recovery-start', 'startup');
    if (appleIdentityToken) {
      await exchangeAppleIdentityToken(appleIdentityToken);
    } else {
      await exchangeGoogleIdentityToken(googleIdentityToken!);
    }
    recordRestorationStage('auth-recovery-success', 'startup');
    return { recovered: true, status: 'authenticated' };
  } catch (error) {
    recordRestorationStage(
      isTemporaryNetworkError(error) ? 'auth-recovery-timeout' : 'auth-recovery-failed',
      'startup',
    );
    if (isTemporaryNetworkError(error)) {
      return {
        error:
          'Could not reach the Unfiltr access server. Check your connection and sign in again.',
        recovered: false,
        status: 'offline',
      };
    }

    await clearAuthenticatedSession();
    return {
      error: `Your saved session could not be restored. Please sign in with ${
        Platform.OS === 'android' ? 'Google' : 'Apple'
      } again.`,
      recovered: false,
      status: 'unauthenticated',
    };
  }
}

function isTemporaryNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /network request failed|failed to fetch|networkerror|timed out|could not connect/i.test(
    message,
  );
}
