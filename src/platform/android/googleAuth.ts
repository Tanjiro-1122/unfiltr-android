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
  | 'developer_error'
  | 'unknown';

// GoogleSignInStatusCodes.DEVELOPER_ERROR (== the underlying Play Services
// CommonStatusCodes value 10). Not exported by this library's own
// `statusCodes` object (see errorCodes.ts -- it only wraps SIGN_IN_CANCELLED,
// IN_PROGRESS, PLAY_SERVICES_NOT_AVAILABLE, SIGN_IN_REQUIRED), so it has to
// be matched on the raw numeric-as-string code the native module actually
// sends: ErrorDto.kt sets `this.code = codeInt.toString()` for any
// ApiException, meaning this arrives as the literal string "10", not a
// named constant.
const GOOGLE_PLAY_SERVICES_DEVELOPER_ERROR_CODE = '10';

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
  if (candidate?.code === GOOGLE_PLAY_SERVICES_DEVELOPER_ERROR_CODE) {
    // Means the calling app's package name + signing certificate SHA-1
    // don't match any Android OAuth client registered for this project in
    // Google Cloud Console -- never a transient condition, and never
    // something retrying fixes. Safe to state plainly: this code is a
    // Google Play Services status constant, not account data.
    return new AndroidGoogleAuthError(
      'developer_error',
      'Google Sign In is not configured correctly for this build.',
      { cause: error },
    );
  }

  return new AndroidGoogleAuthError(
    'unknown',
    candidate?.message || 'Google sign-in failed.',
    { cause: error },
  );
}
