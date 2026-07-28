import {
  GoogleSignin,
  isCancelledResponse,
  isSuccessResponse,
  statusCodes,
  type User,
} from '@react-native-google-signin/google-signin';

export type AndroidGoogleAccount = {
  googleUserId: string;
  email: string | null;
  displayName: string;
  idToken: string | null;
  photoUrl: string | null;
};

export type AndroidGoogleAuthErrorCode =
  | 'cancelled'
  | 'in_progress'
  | 'play_services_unavailable'
  | 'unknown';

export class AndroidGoogleAuthError extends Error {
  constructor(
    public readonly code: AndroidGoogleAuthErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'AndroidGoogleAuthError';
  }
}

let configuredClientId: string | null = null;

export function configureAndroidGoogleAuth(webClientId: string): void {
  const normalized = webClientId.trim();
  if (!normalized) throw new Error('Google OAuth web client ID is not configured.');
  if (configuredClientId === normalized) return;

  GoogleSignin.configure({
    webClientId: normalized,
    offlineAccess: true,
    scopes: ['profile', 'email'],
  });
  configuredClientId = normalized;
}

export async function signInWithGoogleAndroid(): Promise<AndroidGoogleAccount> {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();

    if (isCancelledResponse(response)) {
      throw new AndroidGoogleAuthError('cancelled', 'Google sign-in was cancelled.');
    }
    if (!isSuccessResponse(response)) {
      throw new AndroidGoogleAuthError('unknown', 'Google Sign-In returned no user profile.');
    }

    return mapGoogleUser(response.data);
  } catch (error) {
    if (error instanceof AndroidGoogleAuthError) throw error;
    throw normalizeGoogleAuthError(error);
  }
}

export async function signOutGoogleAndroid(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch (error) {
    throw normalizeGoogleAuthError(error);
  }
}

export function getCurrentGoogleAccountAndroid(): AndroidGoogleAccount | null {
  const user = GoogleSignin.getCurrentUser();
  return user ? mapGoogleUser(user) : null;
}

function mapGoogleUser(user: User): AndroidGoogleAccount {
  return {
    googleUserId: user.user.id,
    email: user.user.email || null,
    displayName: user.user.name || user.user.givenName || 'Friend',
    idToken: user.idToken ?? null,
    photoUrl: user.user.photo || null,
  };
}

function normalizeGoogleAuthError(error: unknown): AndroidGoogleAuthError {
  const candidate = error as { code?: string; message?: string };
  if (candidate?.code === statusCodes.IN_PROGRESS) {
    return new AndroidGoogleAuthError('in_progress', 'Google sign-in is already in progress.', {
      cause: error,
    });
  }
  if (candidate?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
    return new AndroidGoogleAuthError(
      'play_services_unavailable',
      'Google Play Services is unavailable or needs an update.',
      { cause: error },
    );
  }

  return new AndroidGoogleAuthError(
    'unknown',
    candidate?.message || 'Google sign-in failed.',
    { cause: error },
  );
}
