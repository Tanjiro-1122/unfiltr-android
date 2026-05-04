import { useEffect, useRef, useState } from 'react';
import { WebView } from 'react-native-webview';
import {
  StyleSheet, View, ActivityIndicator, StatusBar,
  Text, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import type { PurchasesOfferings } from 'react-native-purchases';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import * as Crypto from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

// ─── RevenueCat public SDK key for Android ────────────────────────────────────
// Injected at EAS build time via the EXPO_PUBLIC_RC_KEY environment variable.
// In development / preview builds without the variable set, purchases will not work.
const RC_API_KEY = process.env.EXPO_PUBLIC_RC_KEY ?? '';
if (!RC_API_KEY) {
  console.error('[RC] EXPO_PUBLIC_RC_KEY is not set — in-app purchases will not work.');
}

// ─── Google OAuth Web Client ID (from Google Cloud Console) ──────────────────
// Must be the WEB client ID (not Android), used for idToken generation
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '1033825374489-l6l27elju2n2i0k5fug6jf0kb0rvvguh.apps.googleusercontent.com';

const APP_URL    = 'https://unfiltrbyjavier2.vercel.app';
const APP_ORIGIN = 'https://unfiltrbyjavier2.vercel.app';

// ─── AsyncStorage keys (match iOS wrapper exactly so data is consistent) ──────
const STORAGE_KEY_GOOGLE_ID    = 'unfiltr_google_user_id';
const STORAGE_KEY_ONBOARDING   = 'unfiltr_onboarding_complete';
const STORAGE_KEY_DISPLAY_NAME = 'unfiltr_display_name';
const STORAGE_KEY_COMPANION_ID = 'unfiltr_companion_id';
const STORAGE_KEY_IS_PREMIUM   = 'unfiltr_is_premium';
const STORAGE_KEY_PLAN         = 'unfiltr_plan';
const STORAGE_KEY_AGE_VERIFIED = 'unfiltr_age_verified';
const STORAGE_KEY_EMAIL        = 'unfiltr_user_email';
const STORAGE_KEY_PUSH_TOKEN   = 'unfiltr_push_token';

// ─── Bridge init JS ────────────────────────────────────────────────────────────
const BRIDGE_INIT_JS = `(function() {
  if (window.__rnBridgeReady) return;
  window.__rnBridgeReady = true;
  if (!window.__nativeBus) { window.__nativeBus = function(msg) {}; }
  window.onMessageFromRN = function(raw) {
    try {
      var parsed = (typeof raw === 'string') ? JSON.parse(raw) : raw;
      if (typeof window.__nativeBus === 'function') window.__nativeBus(parsed);
    } catch(e) {}
  };
  // Tell web app we are running inside the Android wrapper
  window.__isAndroid = true;
  window.__isNativeApp = true;
})();`;

async function registerForPushNotifications(): Promise<string | null> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;
    const projectId: string = Constants.expoConfig?.extra?.eas?.projectId ?? '';
    if (!projectId) return null;
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenData.data || null;
  } catch (e: any) {
    console.log('[PUSH] Registration failed:', e.message);
    return null;
  }
}

export default function App() {
  const webViewRef         = useRef<WebView | null>(null);
  const rcInitPromiseRef   = useRef<Promise<void>>(Promise.resolve());
  const cachedOfferingsRef = useRef<PurchasesOfferings | null>(null);
  const googleSignInActiveRef = useRef<boolean>(false);
  const rcInitStateRef     = useRef<{ ok: boolean; error?: string } | null>(null);
  const rcReadySentRef     = useRef<boolean>(false);

  const [loading, setLoading]       = useState(true);
  const [loadError, setLoadError]   = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<Record<string, string> | null>(null);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Clear load timeout on unmount ──────────────────────────────────────
  useEffect(() => {
    return () => {
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    };
  }, []);

  // ─── Load persisted session ──────────────────────────────────────────────
  useEffect(() => {
    const loadSession = async () => {
      try {
        const keys = [
          STORAGE_KEY_GOOGLE_ID, STORAGE_KEY_ONBOARDING, STORAGE_KEY_DISPLAY_NAME,
          STORAGE_KEY_COMPANION_ID, STORAGE_KEY_IS_PREMIUM, STORAGE_KEY_PLAN,
          STORAGE_KEY_AGE_VERIFIED, STORAGE_KEY_EMAIL, STORAGE_KEY_PUSH_TOKEN,
        ];
        const pairs = await AsyncStorage.multiGet(keys);
        const stored: Record<string, string | null> = {};
        pairs.forEach(([k, v]) => { stored[k] = v; });

        const data: Record<string, string> = {};
        if (stored[STORAGE_KEY_GOOGLE_ID])    data['unfiltr_google_user_id']       = stored[STORAGE_KEY_GOOGLE_ID]!;
        if (stored[STORAGE_KEY_ONBOARDING])   data['unfiltr_onboarding_complete']  = stored[STORAGE_KEY_ONBOARDING]!;
        if (stored[STORAGE_KEY_DISPLAY_NAME]) data['unfiltr_display_name']         = stored[STORAGE_KEY_DISPLAY_NAME]!;
        if (stored[STORAGE_KEY_COMPANION_ID]) {
          data['unfiltr_companion_id'] = stored[STORAGE_KEY_COMPANION_ID]!;
          data['companionId']          = stored[STORAGE_KEY_COMPANION_ID]!;
        }
        if (stored[STORAGE_KEY_IS_PREMIUM])   data['unfiltr_is_premium']           = stored[STORAGE_KEY_IS_PREMIUM]!;
        if (stored[STORAGE_KEY_PLAN])         data['unfiltr_plan']                 = stored[STORAGE_KEY_PLAN]!;
        if (stored[STORAGE_KEY_AGE_VERIFIED]) data['unfiltr_age_verified']         = stored[STORAGE_KEY_AGE_VERIFIED]!;
        if (stored[STORAGE_KEY_EMAIL]) {
          data['unfiltr_user_email']  = stored[STORAGE_KEY_EMAIL]!;
          data['unfiltr_apple_email'] = stored[STORAGE_KEY_EMAIL]!; // web app checks this key too
        }
        if (stored[STORAGE_KEY_PUSH_TOKEN])   data['unfiltr_push_token']           = stored[STORAGE_KEY_PUSH_TOKEN]!;

        setSessionData(data);
      } catch (e) {
        console.warn('[NATIVE] AsyncStorage read failed:', e);
        setSessionData({});
      }
    };
    loadSession();
  }, []);

  // ─── Init RevenueCat ─────────────────────────────────────────────────────
  useEffect(() => {
    rcInitPromiseRef.current = (async () => {
      try {
        if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
        await Purchases.configure({ apiKey: RC_API_KEY });
        rcInitStateRef.current = { ok: true };
        console.log('[RC] Configured for Android');
      } catch (e: any) {
        rcInitStateRef.current = { ok: false, error: e.message };
        console.error('[RC] Init error:', e.message);
      }
    })();
  }, []);

  // ─── Init Google Sign-In ──────────────────────────────────────────────────
  useEffect(() => {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      offlineAccess: true,
      scopes: ['profile', 'email'],
    });
    console.log('[GOOGLE] Sign-In configured');
  }, []);

  // ─── Persist session ──────────────────────────────────────────────────────
  const persistSession = async (data: {
    googleUserId?: string;
    email?: string | null;
    pushToken?: string | null;
    onboardingComplete?: boolean;
    displayName?: string;
    companionId?: string;
    isPremium?: boolean;
    plan?: string | null;
    ageVerified?: boolean;
  }) => {
    try {
      const toSet: [string, string][] = [];
      const toRemove: string[] = [];

      if (data.googleUserId !== undefined)       toSet.push([STORAGE_KEY_GOOGLE_ID, data.googleUserId]);
      if (data.email)                            toSet.push([STORAGE_KEY_EMAIL, data.email]);
      if (data.pushToken)                        toSet.push([STORAGE_KEY_PUSH_TOKEN, data.pushToken]);
      if (data.displayName !== undefined)        toSet.push([STORAGE_KEY_DISPLAY_NAME, data.displayName]);
      if (data.companionId !== undefined)        toSet.push([STORAGE_KEY_COMPANION_ID, data.companionId]);
      if (data.plan)                             toSet.push([STORAGE_KEY_PLAN, data.plan]);
      else if (data.plan === null)               toRemove.push(STORAGE_KEY_PLAN);
      if (data.onboardingComplete === true)      toSet.push([STORAGE_KEY_ONBOARDING, 'true']);
      else if (data.onboardingComplete === false) toRemove.push(STORAGE_KEY_ONBOARDING);
      if (data.isPremium === true)               toSet.push([STORAGE_KEY_IS_PREMIUM, 'true']);
      else if (data.isPremium === false)         toRemove.push(STORAGE_KEY_IS_PREMIUM);
      if (data.ageVerified === true)             toSet.push([STORAGE_KEY_AGE_VERIFIED, 'true']);
      else if (data.ageVerified === false)       toRemove.push(STORAGE_KEY_AGE_VERIFIED);

      if (toSet.length > 0)    await AsyncStorage.multiSet(toSet);
      if (toRemove.length > 0) await AsyncStorage.multiRemove(toRemove);
    } catch (e) {
      console.warn('[NATIVE] AsyncStorage write failed:', e);
    }
  };

  // ─── Safe send to WebView ─────────────────────────────────────────────────
  const sendToWeb = (payload: object) => {
    try {
      const serialized = JSON.stringify(payload);
      const safe = JSON.stringify(serialized);
      const js = `(function(){try{var p=JSON.parse(${safe});if(typeof window.__nativeBus==='function'){window.__nativeBus(p);}else if(typeof window.onMessageFromRN==='function'){window.onMessageFromRN(p);}}catch(e){}})();true;`;
      webViewRef.current?.injectJavaScript(js);
    } catch (e) {
      console.warn('[NATIVE] sendToWeb failed:', e);
    }
  };

  // ─── Google Sign-In handler ───────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    if (googleSignInActiveRef.current) return;
    googleSignInActiveRef.current = true;

    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const userInfo = await GoogleSignin.signIn();

      const googleUser = userInfo.data?.user;
      if (!googleUser) throw new Error('No user data returned from Google');

      const googleUserId = googleUser.id;
      const email        = googleUser.email ?? null;
      const displayName  = googleUser.name ?? googleUser.givenName ?? 'Friend';
      const idToken      = userInfo.data?.idToken ?? null;

      console.log('[GOOGLE] Signed in:', googleUserId);

      // Sync with Vercel backend
      try {
        const syncRes = await fetch(`${APP_URL}/api/syncProfile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            google_user_id: googleUserId,
            email,
            display_name: displayName,
            platform: 'android',
          }),
        });
        if (syncRes.ok) {
          console.log('[GOOGLE] Profile synced to backend');
        }
      } catch (syncErr: any) {
        console.warn('[GOOGLE] Backend sync failed (non-fatal):', syncErr.message);
      }

      // RC identify
      try {
        await rcInitPromiseRef.current;
        await Purchases.logIn(googleUserId);
        const offerings = await Purchases.getOfferings();
        cachedOfferingsRef.current = offerings;
      } catch (rcErr: any) {
        console.warn('[RC] logIn failed:', rcErr.message);
      }

      // Push notifications
      const pushToken = await registerForPushNotifications();

      // Persist locally
      await persistSession({ googleUserId, email, displayName, pushToken });

      // Tell web app
      sendToWeb({
        type: 'GOOGLE_SIGN_IN_SUCCESS',
        googleUserId,
        email,
        displayName,
        idToken,
        platform: 'android',
      });

    } catch (err: any) {
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log('[GOOGLE] User cancelled sign-in');
        sendToWeb({ type: 'GOOGLE_SIGN_IN_CANCELLED' });
      } else if (err.code === statusCodes.IN_PROGRESS) {
        console.log('[GOOGLE] Sign-in already in progress');
      } else if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        console.error('[GOOGLE] Play Services not available');
        sendToWeb({ type: 'GOOGLE_SIGN_IN_ERROR', error: 'Google Play Services not available on this device.' });
      } else {
        console.error('[GOOGLE] Sign-in error:', err.message);
        sendToWeb({ type: 'GOOGLE_SIGN_IN_ERROR', error: err.message ?? 'Sign-in failed. Please try again.' });
      }
    } finally {
      googleSignInActiveRef.current = false;
    }
  };

  // ─── Handle Google Sign-Out ───────────────────────────────────────────────
  const handleGoogleSignOut = async () => {
    try {
      await GoogleSignin.signOut();
      await AsyncStorage.multiRemove([
        STORAGE_KEY_GOOGLE_ID, STORAGE_KEY_EMAIL, STORAGE_KEY_IS_PREMIUM,
        STORAGE_KEY_PLAN, STORAGE_KEY_ONBOARDING,
      ]);
      // Reset RevenueCat to anonymous so the next sign-in gets a clean identity
      try {
        await rcInitPromiseRef.current;
        await Purchases.logOut();
      } catch (rcErr: any) {
        console.warn('[RC] logOut failed (non-fatal):', rcErr.message);
      }
      sendToWeb({ type: 'GOOGLE_SIGN_OUT_SUCCESS' });
    } catch (e: any) {
      console.warn('[GOOGLE] Sign-out error:', e.message);
    }
  };

  // ─── Handle purchases ─────────────────────────────────────────────────────
  const handlePurchase = async (productId: string) => {
    try {
      await rcInitPromiseRef.current;
      let offerings = cachedOfferingsRef.current;
      if (!offerings) {
        offerings = await Purchases.getOfferings();
        cachedOfferingsRef.current = offerings;
      }

      // Find the package by product ID across all offerings
      let targetPackage = null;
      const allOfferings = Object.values(offerings.all);
      for (const offering of allOfferings) {
        for (const pkg of offering.availablePackages) {
          if (pkg.product.identifier === productId) {
            targetPackage = pkg;
            break;
          }
        }
        if (targetPackage) break;
      }

      if (!targetPackage && offerings.current) {
        for (const pkg of offerings.current.availablePackages) {
          if (pkg.product.identifier === productId) {
            targetPackage = pkg;
            break;
          }
        }
      }

      if (!targetPackage) {
        sendToWeb({ type: 'PURCHASE_ERROR', error: `Product ${productId} not found in offerings` });
        return;
      }

      const { customerInfo } = await Purchases.purchasePackage(targetPackage);
      const isPremium = typeof customerInfo.entitlements.active['unfiltr by javier Pro'] !== 'undefined';
      const plan = isPremium ? (productId.includes('annual') || productId.includes('yearly') ? 'annual' : 'monthly') : null;

      await persistSession({ isPremium, plan });
      sendToWeb({ type: 'PURCHASE_SUCCESS', isPremium, plan, productId, customerInfo });

    } catch (err: any) {
      if (err.userCancelled) {
        sendToWeb({ type: 'PURCHASE_CANCELLED' });
      } else {
        console.error('[RC] Purchase error:', err.message);
        sendToWeb({ type: 'PURCHASE_ERROR', error: err.message });
      }
    }
  };

  // ─── Restore purchases ────────────────────────────────────────────────────
  const handleRestorePurchases = async () => {
    try {
      await rcInitPromiseRef.current;
      const customerInfo = await Purchases.restorePurchases();
      const isPremium = typeof customerInfo.entitlements.active['unfiltr by javier Pro'] !== 'undefined';
      await persistSession({ isPremium, plan: isPremium ? 'restored' : null });
      sendToWeb({ type: 'RESTORE_SUCCESS', isPremium, customerInfo });
    } catch (err: any) {
      console.error('[RC] Restore error:', err.message);
      sendToWeb({ type: 'RESTORE_ERROR', error: err.message });
    }
  };

  // ─── Get offerings ────────────────────────────────────────────────────────
  const handleGetOfferings = async () => {
    try {
      await rcInitPromiseRef.current;
      const offerings = await Purchases.getOfferings();
      cachedOfferingsRef.current = offerings;
      sendToWeb({ type: 'OFFERINGS_RESULT', offerings });
    } catch (err: any) {
      sendToWeb({ type: 'OFFERINGS_ERROR', error: err.message });
    }
  };

  // ─── Message router — handles all messages from the web app ──────────────
  const handleWebMessage = async (event: any) => {
    let msg: any;
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }

    console.log('[BRIDGE] Message from web:', msg.type);

    switch (msg.type) {
      // ── Auth ──
      case 'SIGN_IN_WITH_GOOGLE':
        handleGoogleSignIn();
        break;
      case 'SIGN_OUT':
        handleGoogleSignOut();
        break;

      // ── Purchases ──
      case 'PURCHASE':
        handlePurchase(msg.productId);
        break;
      case 'RESTORE_PURCHASES':
        handleRestorePurchases();
        break;
      case 'GET_OFFERINGS':
        handleGetOfferings();
        break;

      // ── Session persistence ──
      case 'SAVE_SESSION':
        await persistSession({
          googleUserId: msg.googleUserId,
          email: msg.email,
          displayName: msg.displayName,
          companionId: msg.companionId,
          onboardingComplete: msg.onboardingComplete,
          isPremium: msg.isPremium,
          plan: msg.plan,
          ageVerified: msg.ageVerified,
        });
        break;

      // ── Customer info ──
      case 'GET_CUSTOMER_INFO':
        try {
          await rcInitPromiseRef.current;
          const customerInfo = await Purchases.getCustomerInfo();
          const isPremium = typeof customerInfo.entitlements.active['unfiltr by javier Pro'] !== 'undefined';
          sendToWeb({ type: 'CUSTOMER_INFO_RESULT', isPremium, customerInfo });
        } catch (e: any) {
          sendToWeb({ type: 'CUSTOMER_INFO_ERROR', error: e.message });
        }
        break;

      // ── Session clear (sign-out / reset) ──
      case 'CLEAR_DATA':
        try {
          const allKeys = [
            STORAGE_KEY_GOOGLE_ID, STORAGE_KEY_ONBOARDING, STORAGE_KEY_DISPLAY_NAME,
            STORAGE_KEY_COMPANION_ID, STORAGE_KEY_IS_PREMIUM, STORAGE_KEY_PLAN,
            STORAGE_KEY_AGE_VERIFIED, STORAGE_KEY_EMAIL, STORAGE_KEY_PUSH_TOKEN,
          ];
          await AsyncStorage.multiRemove(allKeys);
          console.log('[NATIVE] 🗑️ Native session cleared (sign-out)');
        } catch (e: any) {
          console.warn('[NATIVE] CLEAR_DATA failed:', e.message);
        }
        break;

      default:
        console.warn('[BRIDGE] Unhandled message type:', msg.type, msg);
    }
  };

  // ─── Build session-restore injected JS ───────────────────────────────────
  const buildInjectedJS = () => {
    if (!sessionData || Object.keys(sessionData).length === 0) return BRIDGE_INIT_JS;
    const safeData = JSON.stringify(sessionData);
    const restoreBlock = `
(function() {
  try {
    var session = ${safeData};
    for (var key in session) {
      if (session[key] !== null && session[key] !== undefined) {
        localStorage.setItem(key, session[key]);
      }
    }
    console.log('[BRIDGE] Android session restored to localStorage');
  } catch(e) {
    console.warn('[BRIDGE] Session restore failed:', e.message);
  }
})();`;
    return BRIDGE_INIT_JS + restoreBlock;
  };

  if (sessionData === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#a855f7" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0f0f1a" />

      <WebView
        ref={webViewRef}
        source={{ uri: APP_URL }}
        onLoadStart={() => {
          if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
          loadTimeoutRef.current = setTimeout(() => {
            setLoading(false);
            setLoadError('Connection timed out. Please check your internet.');
          }, 20000);
        }}
        style={styles.webview}
        injectedJavaScriptBeforeContentLoaded={buildInjectedJS()}
        onMessage={handleWebMessage}
        onLoadEnd={async () => {
          setLoading(false);
          if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
          // Signal RevenueCat billing readiness to the web app once after the initial
          // page load. rcReadySentRef prevents duplicate signals if onLoadEnd fires
          // again (e.g. for in-page navigations in some WebView versions).
          if (!rcReadySentRef.current) {
            rcReadySentRef.current = true;
            await rcInitPromiseRef.current;
            if (rcInitStateRef.current?.ok) {
              sendToWeb({ type: 'RC_READY' });
            } else if (rcInitStateRef.current) {
              sendToWeb({ type: 'RC_INIT_FAILED', error: rcInitStateRef.current.error });
            }
          }
        }}
        onError={(e) => {
          setLoadError(e.nativeEvent.description);
          setLoading(false);
        }}
        onHttpError={(e) => {
          // Only surface 5xx server errors — 4xx are client errors the SPA handles
          const code = e.nativeEvent.statusCode;
          if (code >= 500) {
            setLoadError(`Server error (${code}). Please try again later.`);
            setLoading(false);
          }
        }}
        onRenderProcessGone={() => {
          // Android killed the WebView renderer (OOM etc.) — reload to recover
          setLoadError('The page crashed. Tap Retry to reload.');
          setLoading(false);
        }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        startInLoadingState={true}
        originWhitelist={['https://*', 'http://*']}
        allowsBackForwardNavigationGestures={false}
        userAgent="UnfiltrAndroid/1.0"
        onShouldStartLoadWithRequest={(request) => {
          const url = request.url;
          // Allow app origin, blank, data URIs, and Google auth flows
          if (url.startsWith(APP_ORIGIN)) return true;
          if (url === 'about:blank') return true;
          if (url.startsWith('data:')) return true;
          if (url.startsWith('https://accounts.google.com')) return true;
          if (url.startsWith('https://oauth2.googleapis.com')) return true;
          if (url.startsWith('https://www.googleapis.com')) return true;
          // Allow Google Pay and Play Billing redirect URLs.
          // Use anchored regex to prevent prefix-matching attacks like
          // https://pay.google.com.evil.com — the path component must start with /
          // or the URL must be exactly the origin.
          if (/^https:\/\/pay\.google\.com(\/|$)/.test(url)) return true;
          if (/^https:\/\/checkout\.google\.com(\/|$)/.test(url)) return true;
          // Block everything else (external links etc)
          console.warn('[BRIDGE] Blocked navigation to:', url);
          return false;
        }}
      />

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#a855f7" />
        </View>
      )}

      {loadError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Couldn't connect. Check your internet.</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setLoadError(null);
              setLoading(true);
              rcReadySentRef.current = false;
              webViewRef.current?.reload();
            }}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  webview: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f0f1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0f0f1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0f0f1a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#a855f7',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});


