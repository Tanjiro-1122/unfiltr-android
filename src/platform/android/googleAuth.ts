import {
  GoogleSignin,
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
    const user = response.data?.user;
    if (!user) throw new Error('Google Sign-In returned no user profile.');

    return mapGoogleUser(user, response.data?.idToken ?? null);
  } catch (error) {
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

export async function getCurrentGoogleAccountAndroid(): Promise<AndroidGoogleAccount | null> {
  const response = GoogleSignin.getCurrentUser();
  const user = response?.user;
  if (!user) return null;
  return mapGoogleUser(user, response.idToken ?? null);
}

function mapGoogleUser(user: User, idToken: string | null): AndroidGoogleAccount {
  return {
    googleUserId: user.id,
    email: user.email || null,
    displayName: user.name || user.givenName || 'Friend',
    idToken,
    photoUrl: user.photo || null,
  };
}

function normalizeGoogleAuthError(error: unknown): AndroidGoogleAuthError {
  const candidate = error as { code?: string; message?: string };
  if (candidate?.code === statusCodes.SIGN_IN_CANCELLED) {
    return new AndroidGoogleAuthError('cancelled', 'Google sign-in was cancelled.', {
      cause: error,
    });
  }
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
