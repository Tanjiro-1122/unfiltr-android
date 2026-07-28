import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const secureOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

function getWebStorage(): Storage | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return window.localStorage;
}

export async function getAppStorageItem(key: string): Promise<string | null> {
  const webStorage = getWebStorage();
  if (webStorage) return webStorage.getItem(key);
  return SecureStore.getItemAsync(key, secureOptions);
}

export async function setAppStorageItem(key: string, value: string): Promise<void> {
  const webStorage = getWebStorage();
  if (webStorage) {
    webStorage.setItem(key, value);
    return;
  }

  await SecureStore.setItemAsync(key, value, secureOptions);
}

export async function deleteAppStorageItem(key: string): Promise<void> {
  const webStorage = getWebStorage();
  if (webStorage) {
    webStorage.removeItem(key);
    return;
  }

  await SecureStore.deleteItemAsync(key, secureOptions);
}

export async function getJsonItem<T>(key: string, fallback: T): Promise<T> {
  const raw = await getAppStorageItem(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function setJsonItem<T>(key: string, value: T): Promise<void> {
  await setAppStorageItem(key, JSON.stringify(value));
}
