import Constants from 'expo-constants';

type AppEnv = {
  apiBaseUrl: string;
  revenueCatAppleApiKey: string;
  revenueCatGoogleApiKey: string;
  googleClientId: string;
};

const extra = Constants.expoConfig?.extra ?? {};

function readPublicValue(fromProcess: string | undefined, extraKey: keyof AppEnv): string {
  const fromExpo = extra[extraKey];
  return typeof fromProcess === 'string'
    ? fromProcess.trim()
    : typeof fromExpo === 'string'
      ? fromExpo.trim()
      : '';
}

export const env: AppEnv = {
  apiBaseUrl: readPublicValue(process.env.EXPO_PUBLIC_API_BASE_URL, 'apiBaseUrl'),
  revenueCatAppleApiKey: readPublicValue(
    process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY,
    'revenueCatAppleApiKey',
  ),
  revenueCatGoogleApiKey: readPublicValue(
    process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY,
    'revenueCatGoogleApiKey',
  ),
  googleClientId: readPublicValue(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID, 'googleClientId'),
};

export function requireEnvValue(key: keyof AppEnv): string {
  const value = env[key];
  if (!value) {
    throw new Error(`Missing required environment value: ${key}`);
  }
  return value;
}
