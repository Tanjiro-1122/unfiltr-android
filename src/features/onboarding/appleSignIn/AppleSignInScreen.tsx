import * as AppleAuthentication from 'expo-apple-authentication';
import { LinearGradient } from 'expo-linear-gradient';
import { type PropsWithChildren, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { exchangeAppleIdentityToken } from '@/lib/auth/session';
import { setSecureItem } from '@/lib/storage';

type AppleSignInScreenProps = {
  initialError?: string | null;
  onAuthenticated: () => void;
};

const APPLE_MARK_DATA_URI =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 22"><path fill="black" d="M14.7 11.5c0-2.4 2-3.6 2.1-3.7-1.1-1.6-2.8-1.8-3.4-1.9-1.5-.1-2.8.8-3.6.8-.7 0-1.9-.8-3.1-.8-1.6 0-3.1.9-3.9 2.3-1.7 2.9-.4 7.2 1.2 9.6.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8 1.5 0 1.9.8 3.2.8 1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8 0-.1-2.9-1.2-2.9-3.5ZM12.4 4.4c.7-.8 1.1-1.9 1-3-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.9-1 3 .9.1 2-.5 2.7-1.4Z"/></svg>',
  );

function AppleSignInBackground({ children }: PropsWithChildren) {
  if (Platform.OS === 'web') {
    return <View style={[styles.root, styles.webGradient]}>{children}</View>;
  }

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

export function AppleSignInScreen({ initialError, onAuthenticated }: AppleSignInScreenProps) {
  const [isAvailable, setIsAvailable] = useState(Platform.OS !== 'android');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);

  useEffect(() => {
    let mounted = true;

    if (Platform.OS !== 'ios') return;

    AppleAuthentication.isAvailableAsync()
      .then((available) => {
        if (mounted) setIsAvailable(available);
      })
      .catch(() => {
        if (mounted) setIsAvailable(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const unavailableMessage = useMemo(() => {
    if (Platform.OS === 'android') {
      return 'Google Sign In will be connected for Android before release.';
    }

    return 'Apple Sign In is not available on this device.';
  }, []);

  const handleAppleSignIn = useCallback(async () => {
    if (isSigningIn) return;

    setIsSigningIn(true);
    setError(null);

    try {
      if (Platform.OS === 'web') {
        await Promise.all([
          setSecureItem('auth.appleUserId', 'preview-apple-user'),
          setSecureItem('auth.userId', 'preview-apple-user'),
        ]);
        onAuthenticated();
        return;
      }

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const displayName = [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean)
        .join(' ');

      if (!credential.identityToken) {
        setError('Apple did not return an identity token. Please try signing in again.');
        return;
      }

      let session;
      try {
        session = await exchangeAppleIdentityToken(credential.identityToken, { persist: false });
      } catch {
        setError(
          'Could not verify your Apple sign-in with Unfiltr. Check your connection and try again.',
        );
        return;
      }

      await Promise.all([
        setSecureItem('auth.accessToken', session.accessToken),
        setSecureItem('auth.accessTokenExpiresAt', String(session.expiresAt)),
        setSecureItem('auth.appleUserId', session.appleUserId || credential.user),
        setSecureItem('auth.userId', session.appleUserId || credential.user),
        credential.email ? setSecureItem('auth.appleEmail', credential.email) : Promise.resolve(),
        setSecureItem('auth.appleIdentityToken', credential.identityToken),
        displayName ? setSecureItem('auth.displayName', displayName) : Promise.resolve(),
      ]);

      onAuthenticated();
    } catch (cause) {
      if (
        cause &&
        typeof cause === 'object' &&
        'code' in cause &&
        cause.code === 'ERR_REQUEST_CANCELED'
      ) {
        setIsSigningIn(false);
        return;
      }

      setError('Apple Sign In failed. Please try again.');
    } finally {
      setIsSigningIn(false);
    }
  }, [isSigningIn, onAuthenticated]);

  return (
    <AppleSignInBackground>
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
            Use your Apple ID to keep your companion, memories, journal, chat history, and settings
            connected securely.
          </Text>

          <View style={styles.accountCard}>
            <Text style={styles.cardTitle}>Your account stays with you</Text>
            <Text style={styles.cardText}>
              Unfiltr uses your Apple identity anchor to restore your profile if you reinstall or
              switch devices.
            </Text>
          </View>

          <View style={styles.features}>
            <FeatureRow icon="♡" label="AI companions that remember you" />
            <FeatureRow icon="✎" label="Private journaling with mood tracking" />
            <FeatureRow icon="◌" label="Guided meditation and breathing" />
          </View>

          {Platform.OS === 'ios' && isAvailable ? (
            <AppleAuthentication.AppleAuthenticationButton
              accessibilityLabel="Continue with Apple"
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              cornerRadius={20}
              onPress={() => void handleAppleSignIn()}
              style={styles.nativeAppleButton}
            />
          ) : (
            <Pressable
              accessibilityLabel={isAvailable ? 'Continue with Apple' : 'Apple Sign In unavailable'}
              accessibilityRole="button"
              accessibilityState={{ busy: isSigningIn, disabled: !isAvailable }}
              disabled={!isAvailable || isSigningIn}
              onPress={handleAppleSignIn}
              style={({ pressed }) => [
                styles.appleButton,
                !isAvailable && styles.appleButtonDisabled,
                pressed && styles.pressed,
              ]}
            >
              {isSigningIn ? (
                <>
                  <ActivityIndicator color="#000000" size="small" />
                  <Text style={styles.appleButtonText}>Signing in...</Text>
                </>
              ) : (
                <>
                  {Platform.OS === 'web' ? (
                    <View style={[styles.appleMark, styles.appleMarkWeb]} />
                  ) : (
                    <Image
                      accessibilityIgnoresInvertColors
                      resizeMode="contain"
                      source={{ uri: APPLE_MARK_DATA_URI }}
                      style={styles.appleMark}
                    />
                  )}
                  <Text style={styles.appleButtonText}>Continue with Apple</Text>
                </>
              )}
            </Pressable>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!isAvailable ? <Text style={styles.unavailable}>{unavailableMessage}</Text> : null}

          <Text style={styles.note}>
            By continuing you agree to Unfiltr&apos;s <Text style={styles.noteLink}>Terms</Text> and{' '}
            <Text style={styles.noteLink}>Privacy Policy</Text>.
          </Text>
        </View>
      </SafeAreaView>
    </AppleSignInBackground>
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
  webGradient: {
    backgroundImage: 'linear-gradient(180deg, #2D0A6E 0%, #120428 39%, #06020F 74%, #020008 100%)',
  } as unknown as ViewStyle,
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
  nativeAppleButton: {
    width: '100%',
    maxWidth: 320,
    height: 60,
    marginBottom: 14,
  },
  appleButton: {
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
  appleButtonDisabled: {
    opacity: 0.55,
  },
  appleMark: {
    width: 18,
    height: 22,
  },
  appleMarkWeb: {
    backgroundImage: `url("${APPLE_MARK_DATA_URI}")`,
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'contain',
  } as unknown as ViewStyle,
  appleButtonText: {
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
  unavailable: {
    maxWidth: 302,
    marginBottom: 10,
    color: 'rgba(255,255,255,0.36)',
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 17,
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
