import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type SecureStorageKey =
  | 'auth.accessToken'
  | 'auth.accessTokenExpiresAt'
  | 'auth.appleEmail'
  | 'auth.appleIdentityToken'
  | 'auth.appleUserId'
  | 'auth.displayName'
  | 'auth.googleIdentityToken'
  | 'auth.profileId'
  | 'auth.refreshToken'
  | 'auth.userId'
  | 'chat.currentSessionId'
  | 'chat.dailyUsage'
  | 'chat.draft'
  | 'chat.messages'
  | 'chat.privateSession'
  | 'device.pushToken'
  | 'onboarding.companionId'
  | 'onboarding.companionNickname'
  | 'onboarding.companionPayload'
  | 'onboarding.displayName'
  | 'onboarding.matchMode'
  | 'onboarding.personalityEmpathy'
  | 'onboarding.personalityHumor'
  | 'onboarding.personalityStyle'
  | 'onboarding.personalityVibe'
  | 'revenueCat.appUserId'
  | 'onboarding.ageVerified'
  | 'onboarding.isTesterAccount'
  | 'onboarding.pendingProfileId'
  | 'onboarding.privacyConsentAccepted'
  | 'onboarding.privacyConsentVersion'
  | 'onboarding.quizCompanionId'
  | 'onboarding.relationshipMode'
  | 'onboarding.selectedCompanionId'
  | 'profile.userProfileId'
  | 'unfiltr_effective_tier'
  | 'unfiltr_family_unlock'
  | 'unfiltr_family_unlimited'
  | 'unfiltr_is_premium'
  | 'unfiltr_msg_usage'
  | 'unfiltr_revenuecat_premium'
  | 'unfiltr_revenuecat_tier'
  | 'unfiltr_unlimited';

const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

const webPrefix = 'unfiltr.secure.';

function getWebStorage(): Storage | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return window.localStorage;
}

export async function getSecureItem(key: SecureStorageKey): Promise<string | null> {
  const webStorage = getWebStorage();
  if (webStorage) {
    return webStorage.getItem(`${webPrefix}${key}`);
  }

  return SecureStore.getItemAsync(key, options);
}

export async function setSecureItem(key: SecureStorageKey, value: string): Promise<void> {
  const webStorage = getWebStorage();
  if (webStorage) {
    webStorage.setItem(`${webPrefix}${key}`, value);
    return;
  }

  await SecureStore.setItemAsync(key, value, options);
}

export async function deleteSecureItem(key: SecureStorageKey): Promise<void> {
  const webStorage = getWebStorage();
  if (webStorage) {
    webStorage.removeItem(`${webPrefix}${key}`);
    return;
  }

  await SecureStore.deleteItemAsync(key, options);
}
