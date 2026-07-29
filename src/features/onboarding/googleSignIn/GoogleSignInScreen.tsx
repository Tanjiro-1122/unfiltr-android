import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { env } from '@/config';
import { exchangeGoogleIdentityToken, GoogleSessionExchangeError } from '@/lib/auth/session';
import { recordRestorationStage } from '@/lib/diagnostics/restorationDiagnostics';
import { setSecureItem } from '@/lib/storage';
import {
  AndroidGoogleAuthError,
  configureAndroidGoogleAuth,
  signInWithGoogleAndroid,
} from '@/platform/android/googleAuth';

type GoogleSignInScreenProps = {
  initialError?: string | null;
  onAuthenticated: () => void;
};

function GoogleSignInBackground({ children }: PropsWithChildren) {
  return (
    <LinearGradient
      colors={['#2D0A6E', '#120428', '#06020F', '#020008']}
      locations={[0, 0.39, 0.74, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.root}
    >
      {children}
    </LinearGradient>
  );
}

const MISSING_CLIENT_ID_ERROR = 'Google Sign In is not configured for this build.';

// Server-side codes from api/auth/google.js (see restorationDiagnostics.ts
// for the equivalent client-side stage names). Any code not listed here
// still shows -- appended to the generic message -- rather than being
// swallowed into an unactionable "check your connection" dead end.
const GOOGLE_EXCHANGE_ERROR_MESSAGES: Record<string, string> = {
  MISSING_TOKEN: 'Google did not return an identity token. Please try signing in again.',
  INVALID_AUDIENCE: 'This build is not authorized for Google Sign In. Please contact support.',
  INVALID_ISSUER: 'Google Sign In returned an unrecognized response. Please try again.',
  TOKEN_EXPIRED: 'Your Google sign-in expired before it reached Unfiltr. Please try again.',
  GOOGLE_VERIFICATION_FAILED: 'Could not verify your Google sign-in. Please try again.',
  GOOGLE_AUTH_UNAVAILABLE: 'Google Sign In is temporarily unavailable. Please try again shortly.',
  SERVER_NOT_CONFIGURED: 'Unfiltr is not ready to accept sign-ins right now. Please try again shortly.',
  SESSION_ISSUANCE_FAILED: 'Could not start your Unfiltr session. Please try again.',
  MALFORMED_RESPONSE: 'Unfiltr returned an unexpected response. Please try again.',
};

function describeGoogleExchangeError(error: GoogleSessionExchangeError): string {
  const known = GOOGLE_EXCHANGE_ERROR_MESSAGES[error.code];
  if (known) return `${known} (${error.code})`;
  return `Could not verify your Google sign-in with Unfiltr. Check your connection and try again. (${error.code})`;
}

export function GoogleSignInScreen({ initialError, onAuthenticated }: GoogleSignInScreenProps) {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [isConfigured, setIsConfigured] = useState(false);

  // Whether the client ID is present is knowable synchronously from static
  // config, so it's derived at render time rather than set from an effect.
  // Actually configuring the native SDK is a genuine external side effect
  // and does belong in the effect below.
  const missingClientIdError = env.googleClientId ? null : MISSING_CLIENT_ID_ERROR;

  useEffect(() => {
    if (!env.googleClientId) return undefined;
    let mounted = true;

    Promise.resolve()
      .then(() => configureAndroidGoogleAuth(env.googleClientId))
      .then(() => {
        if (mounted) setIsConfigured(true);
      })
      .catch(() => {
        if (mounted) setError(MISSING_CLIENT_ID_ERROR);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const displayedError = error ?? missingClientIdError;

  const handleGoogleSignIn = useCallback(async () => {
    if (isSigningIn || !isConfigured) return;

    setIsSigningIn(true);
    setError(null);
    recordRestorationStage('auth-started');

    try {
      const account = await signInWithGoogleAndroid();
      if (!account.idToken) {
        setError('Google did not return an identity token. Please try signing in again.');
        return;
      }
      recordRestorationStage('provider-token-received');

      let session;
      try {
        session = await exchangeGoogleIdentityToken(account.idToken, { persist: false });
      } catch (exchangeError) {
        setError(
          exchangeError instanceof GoogleSessionExchangeError
            ? describeGoogleExchangeError(exchangeError)
            : 'Could not verify your Google sign-in with Unfiltr. Check your connection and try again.',
        );
        return;
      }

      await Promise.all([
        setSecureItem('auth.accessToken', session.accessToken),
        setSecureItem('auth.accessTokenExpiresAt', String(session.expiresAt)),
        setSecureItem('auth.appleUserId', session.appleUserId),
        setSecureItem('auth.userId', session.appleUserId),
        setSecureItem('auth.googleIdentityToken', account.idToken),
        account.email ? setSecureItem('auth.appleEmail', account.email) : Promise.resolve(),
        account.displayName
          ? setSecureItem('auth.displayName', account.displayName)
          : Promise.resolve(),
      ]);

      onAuthenticated();
    } catch (cause) {
      if (cause instanceof AndroidGoogleAuthError && cause.code === 'cancelled') {
        setIsSigningIn(false);
        return;
      }
      if (cause instanceof AndroidGoogleAuthError && cause.code === 'play_services_unavailable') {
        setError('Google Play Services is unavailable or needs an update.');
        return;
      }

      setError('Google Sign In failed. Please try again.');
    } finally {
      setIsSigningIn(false);
    }
  }, [isConfigured, isSigningIn, onAuthenticated]);

  return (
    <GoogleSignInBackground>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Image
            accessibilityLabel="Unfiltr by Javier Triquetra logo"
            resizeMode="contain"
            source={require('../../../../assets/brand/unfiltr-triquetra-logo.png')}
            style={styles.logo}
          />
          <Text style={styles.brand}>Unfiltr by Javier</Text>
          <Text accessibilityRole="header" style={styles.title}>
            Sign in to Continue
          </Text>
          <Text style={styles.copy}>
            Use your Google Account to keep your companion, memories, journal, chat history, and
            settings connected securely.
          </Text>

          <View style={styles.accountCard}>
            <Text style={styles.cardTitle}>Your account stays with you</Text>
            <Text style={styles.cardText}>
              Unfiltr uses your Google identity anchor to restore your profile if you reinstall or
              switch devices.
            </Text>
          </View>

          <View style={styles.features}>
            <FeatureRow icon="♡" label="AI companions that remember you" />
            <FeatureRow icon="✎" label="Private journaling with mood tracking" />
            <FeatureRow icon="◌" label="Guided meditation and breathing" />
          </View>

          <Pressable
            accessibilityLabel="Continue with Google"
            accessibilityRole="button"
            accessibilityState={{ busy: isSigningIn, disabled: !isConfigured }}
            disabled={!isConfigured || isSigningIn}
            onPress={() => void handleGoogleSignIn()}
            style={({ pressed }) => [
              styles.googleButton,
              !isConfigured && styles.googleButtonDisabled,
              pressed && styles.pressed,
            ]}
          >
            {isSigningIn ? (
              <>
                <ActivityIndicator color="#000000" size="small" />
                <Text style={styles.googleButtonText}>Signing in...</Text>
              </>
            ) : (
              <>
                <View style={styles.googleMark}>
                  <Text style={styles.googleMarkText}>G</Text>
                </View>
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </>
            )}
          </Pressable>

          {displayedError ? <Text style={styles.error}>{displayedError}</Text> : null}

          <Text style={styles.note}>
            By continuing you agree to Unfiltr&apos;s <Text style={styles.noteLink}>Terms</Text>{' '}
            and <Text style={styles.noteLink}>Privacy Policy</Text>.
          </Text>
        </View>
      </SafeAreaView>
    </GoogleSignInBackground>
  );
}

function FeatureRow({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.featureRow}>
      <View style={styles.featureIcon}>
        <Text style={styles.featureIconText}>{icon}</Text>
      </View>
      <Text style={styles.featureLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#06020F',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 58,
    paddingTop: 22,
  },
  logo: {
    width: 70,
    height: 70,
    marginBottom: 22,
    borderRadius: 16,
  },
  brand: {
    marginBottom: 18,
    color: '#D8B4FE',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.44,
    lineHeight: 16,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  title: {
    marginBottom: 10,
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 34,
    textAlign: 'center',
    textShadowColor: 'rgba(168,85,247,0.42)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 20,
  },
  copy: {
    maxWidth: 318,
    marginBottom: 22,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 23,
    textAlign: 'center',
  },
  accountCard: {
    width: '100%',
    maxWidth: 320,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.18)',
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.045)',
    padding: 16,
  },
  cardTitle: {
    marginBottom: 6,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  cardText: {
    color: 'rgba(255,255,255,0.56)',
    fontSize: 12.5,
    fontWeight: '400',
    lineHeight: 19,
  },
  features: {
    width: '100%',
    maxWidth: 320,
    gap: 8,
    marginBottom: 22,
  },
  featureRow: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.18)',
    borderRadius: 14,
    backgroundColor: 'rgba(139,92,246,0.09)',
    paddingHorizontal: 14,
  },
  featureIcon: {
    width: 24,
    height: 24,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(168,85,247,0.16)',
  },
  featureIconText: {
    color: '#D8B4FE',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 16,
  },
  featureLabel: {
    flex: 1,
    color: 'rgba(255,255,255,0.68)',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  googleButton: {
    width: '100%',
    maxWidth: 320,
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 14,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.1,
    shadowRadius: 34,
  },
  googleButtonDisabled: {
    opacity: 0.55,
  },
  googleMark: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#4285F4',
  },
  googleMarkText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  googleButtonText: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    textAlign: 'center',
  },
  error: {
    maxWidth: 302,
    marginBottom: 10,
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
    textAlign: 'center',
  },
  note: {
    maxWidth: 302,
    color: 'rgba(255,255,255,0.24)',
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 18,
    textAlign: 'center',
  },
  noteLink: {
    color: 'rgba(216,180,254,0.72)',
    fontWeight: '500',
  },
  pressed: {
    opacity: 0.82,
  },
});
