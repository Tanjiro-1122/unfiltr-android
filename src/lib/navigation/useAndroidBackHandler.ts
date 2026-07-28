import { useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';

/**
 * Registers a hardware back-press handler on Android only. Return true from
 * `handler` to consume the press (stay in-app); return false to fall through
 * to the default behavior (e.g. minimize the app from Home).
 */
export function useAndroidBackHandler(handler: () => boolean, enabled = true): void {
  useEffect(() => {
    if (Platform.OS !== 'android' || !enabled) return undefined;

    const subscription = BackHandler.addEventListener('hardwareBackPress', handler);
    return () => subscription.remove();
  }, [handler, enabled]);
}
