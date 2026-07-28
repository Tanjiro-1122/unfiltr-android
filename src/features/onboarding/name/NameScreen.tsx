import { LinearGradient } from 'expo-linear-gradient';
import { type PropsWithChildren, useCallback, useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/BackButton';
import { env } from '@/config';
import { getSecureItem, setSecureItem } from '@/lib/storage';

type NameScreenProps = {
  onBack: () => void;
  onComplete: () => void;
};

type SyncProfileResponse = {
  data?: {
    id?: string;
    profileId?: string;
  };
};

const PROGRESS = 0.34;

function NameBackground({ children }: PropsWithChildren) {
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

export function NameScreen({ onBack, onComplete }: NameScreenProps) {
  const [fade] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(12));
  const [displayName, setDisplayName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const canAdvance = displayName.trim().length > 0 && !isSaving;

  useEffect(() => {
    let mounted = true;

    async function loadName() {
      const storedName =
        (await getSecureItem('onboarding.displayName')) ?? readWebStorage('unfiltr_display_name');
      if (mounted && storedName) setDisplayName(storedName);
    }

    void loadName();

    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    return () => {
      mounted = false;
    };
  }, [fade, translateY]);

  const handleNameChange = useCallback((value: string) => {
    setDisplayName(value);
    void setSecureItem('onboarding.displayName', value);
    writeWebStorage('unfiltr_display_name', value);
  }, []);

  const handleNext = useCallback(async () => {
    const trimmed = displayName.trim();
    if (!trimmed || isSaving) return;

    Keyboard.dismiss();
    setIsSaving(true);

    const isTesterAccount = isTesterName(trimmed);

    await Promise.all([
      setSecureItem('onboarding.displayName', displayName),
      setSecureItem('auth.displayName', trimmed),
      setSecureItem('onboarding.isTesterAccount', isTesterAccount ? 'true' : 'false'),
    ]);
    writeWebStorage('unfiltr_display_name', displayName);

    await syncDisplayName(displayName, trimmed);

    setIsSaving(false);
    onComplete();
  }, [displayName, isSaving, onComplete]);

  return (
    <NameBackground>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoiding}
        >
          <View style={styles.content}>
            <View style={styles.topRow}>
              <BackButton accessibilityLabel="Go back to Apple Sign In" onPress={onBack} />
            </View>

            <View style={styles.progressTrack}>
              <LinearGradient
                colors={['#7C3AED', '#A855F7', '#DB2777']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${PROGRESS * 100}%` }]}
              />
            </View>

            <Animated.View
              style={[
                styles.form,
                {
                  opacity: fade,
                  transform: [{ translateY }],
                },
              ]}
            >
              <Image
                accessibilityLabel="Unfiltr by Javier Triquetra logo"
                resizeMode="contain"
                source={require('../../../../assets/brand/unfiltr-triquetra-logo.png')}
                style={styles.logo}
              />
              <Text style={styles.brand}>Unfiltr by Javier</Text>
              <Text accessibilityRole="header" style={styles.title}>
                What&apos;s your name?
              </Text>
              <Text style={styles.copy}>This is what your companion will call you.</Text>
              <TextInput
                accessibilityLabel="Display name"
                autoCapitalize="words"
                autoCorrect={false}
                enablesReturnKeyAutomatically
                onChangeText={handleNameChange}
                onSubmitEditing={() => void handleNext()}
                placeholder="Enter display name"
                placeholderTextColor="rgba(255,255,255,0.38)"
                returnKeyType="next"
                selectionColor="#A855F7"
                style={styles.input}
                textContentType="name"
                value={displayName}
              />
            </Animated.View>

            <View style={styles.spacer} />

            <Pressable
              accessibilityLabel="Next"
              accessibilityRole="button"
              accessibilityState={{ busy: isSaving, disabled: !canAdvance }}
              disabled={!canAdvance}
              onPress={handleNext}
              style={({ pressed }) => [
                styles.nextButton,
                canAdvance && styles.nextButtonEnabled,
                pressed && styles.pressed,
              ]}
            >
              {canAdvance ? (
                <LinearGradient
                  colors={['#7C3AED', '#A855F7', '#DB2777']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.nextGradient}
                >
                  <Text style={styles.nextText}>{isSaving ? '...' : 'Next →'}</Text>
                </LinearGradient>
              ) : (
                <Text style={styles.nextTextDisabled}>Next →</Text>
              )}
            </Pressable>
            <Text style={styles.hint}>Required before matching you with a companion.</Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </NameBackground>
  );
}

async function syncDisplayName(displayName: string, trimmedName: string) {
  try {
    const storedProfileId =
      (await getSecureItem('onboarding.pendingProfileId')) ??
      (await getSecureItem('profile.userProfileId')) ??
      readWebStorage('userProfileId');
    const appleId =
      (await getSecureItem('auth.appleUserId')) ?? readWebStorage('unfiltr_apple_user_id');

    if (!env.apiBaseUrl) return;

    if (storedProfileId) {
      await postSyncProfile({
        action: 'update',
        profileId: storedProfileId,
        updateData: { display_name: displayName },
      });
      await setPendingProfileId(storedProfileId);
      return;
    }

    if (appleId && !appleId.startsWith('anonymous')) {
      const result = await postSyncProfile<SyncProfileResponse>({
        action: 'sync',
        appleUserId: appleId,
        fullName: displayName,
      });
      const profileId = result.data?.profileId ?? result.data?.id;
      if (!profileId) return;

      await postSyncProfile({
        action: 'update',
        profileId,
        updateData: { display_name: displayName },
      });
      await setPendingProfileId(profileId);
      return;
    }

    await postSyncProfile({
      action: 'create',
      updateData: {
        display_name: trimmedName,
        companion_id: 'pending',
        background_id: 'pending',
      },
    });
  } catch {
    // Profile sync remains non-blocking for onboarding progress.
  }
}

async function postSyncProfile<T = unknown>(body: unknown): Promise<T> {
  const response = await fetch(`${env.apiBaseUrl}/api/syncProfile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) throw new Error('Profile sync failed.');

  return (await response.json()) as T;
}

async function setPendingProfileId(profileId: string) {
  await Promise.all([
    setSecureItem('onboarding.pendingProfileId', profileId),
    setSecureItem('profile.userProfileId', profileId),
  ]);
  writeWebStorage('userProfileId', profileId);
}

function isTesterName(name: string) {
  const trimmedLower = name.trim().toLowerCase();
  return trimmedLower === 'demo' || trimmedLower === 'javier 1122';
}

function readWebStorage(key: string): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return window.localStorage.getItem(key);
}

function writeWebStorage(key: string, value: string) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  window.localStorage.setItem(key, value);
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
  keyboardAvoiding: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingBottom: 24,
    paddingTop: 24,
  },
  topRow: {
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(216,180,254,0.22)',
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.055)',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  backIcon: {
    marginTop: -2,
    color: '#F5EEFF',
    fontSize: 31,
    fontWeight: '400',
    lineHeight: 32,
  },
  progressTrack: {
    height: 5,
    marginBottom: 48,
    overflow: 'hidden',
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  progressFill: {
    height: '100%',
    borderRadius: 99,
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
  },
  form: {
    alignItems: 'center',
  },
  logo: {
    width: 66,
    height: 66,
    marginBottom: 18,
    borderRadius: 16,
  },
  brand: {
    marginBottom: 16,
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
    lineHeight: 34,
    textAlign: 'center',
    textShadowColor: 'rgba(168,85,247,0.42)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 20,
  },
  copy: {
    maxWidth: 318,
    marginBottom: 24,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    maxWidth: 320,
    minHeight: 60,
    borderWidth: 1.5,
    borderColor: 'rgba(139,92,246,0.25)',
    borderRadius: 20,
    backgroundColor: 'rgba(139,92,246,0.12)',
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  spacer: {
    flex: 1,
    minHeight: 22,
  },
  nextButton: {
    width: '100%',
    maxWidth: 320,
    minHeight: 58,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  nextButtonEnabled: {
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.46,
    shadowRadius: 34,
  },
  nextGradient: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 17,
  },
  nextText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
    textAlign: 'center',
  },
  nextTextDisabled: {
    color: 'rgba(255,255,255,0.28)',
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
    textAlign: 'center',
  },
  hint: {
    maxWidth: 302,
    marginTop: 10,
    alignSelf: 'center',
    color: 'rgba(255,255,255,0.22)',
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.82,
  },
});
