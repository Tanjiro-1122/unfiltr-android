import { LinearGradient } from 'expo-linear-gradient';
import { type PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInput as TextInputRef,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/BackButton';
import {
  COMPANION_PERSONALITY,
  getCompanionMeta,
  type CompanionId,
  type CompanionMeta,
} from '@/features/onboarding/companionQuiz';
import { apiClient } from '@/lib/api/client';
import { getSecureItem, setSecureItem } from '@/lib/storage';

type CompanionNamingScreenProps = {
  companionId: CompanionId;
  onBack: () => void;
  onComplete: () => void;
};

const TOTAL_STEPS = 7;
const STEP = 5;
const MAX_NICKNAME_LENGTH = 20;
const NAME_COPY_LINE_ONE = "This is how they'll introduce themselves.";
const DEFAULT_BACKGROUND = {
  bg: 'https://hvvrbpvsgjxiicigkwhu.supabase.co/storage/v1/object/public/companion-avatars/a07a13ca6_e94aaa131_generated_image.png',
  id: 'living_room',
  label: 'Cozy Living Room',
};

function NamingBackground({ children }: PropsWithChildren) {
  if (Platform.OS === 'web') {
    return <View style={[styles.root, styles.webGradient]}>{children}</View>;
  }

  return (
    <LinearGradient
      colors={['#2D0A6E', '#120428', '#05020D']}
      locations={[0, 0.42, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.root}
    >
      {children}
    </LinearGradient>
  );
}

export function CompanionNamingScreen({
  companionId,
  onBack,
  onComplete,
}: CompanionNamingScreenProps) {
  const companion = getCompanionMeta(companionId);
  const inputRef = useRef<TextInputRef>(null);
  const insets = useSafeAreaInsets();
  const [nickname, setNickname] = useState('');
  const [focused, setFocused] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  const placeholders = useMemo(
    () => [
      `Keep it as ${companion.name}`,
      'e.g. "Star"',
      `e.g. "My ${companion.name}"`,
      'Whatever feels right',
    ],
    [companion.name],
  );
  const trimmedNickname = nickname.trim();
  const displayName = trimmedNickname || companion.name;

  useEffect(() => {
    if (focused) return undefined;

    const timer = setInterval(
      () => setPlaceholderIndex((current) => (current + 1) % placeholders.length),
      2500,
    );
    return () => clearInterval(timer);
  }, [focused, placeholders.length]);

  const handleSave = useCallback(
    async (forceDefault = false) => {
      if (saving) return;

      const finalName = forceDefault ? companion.name : nickname.trim() || companion.name;
      setSaving(true);
      try {
        await persistCompanionNaming({ companion, displayName: finalName });
        void syncProfile({ companionId: companion.id, nickname: finalName });
        onComplete();
      } finally {
        setSaving(false);
      }
    },
    [companion, nickname, onComplete, saving],
  );

  return (
    <NamingBackground>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
          style={styles.keyboardView}
        >
          <ScrollView
            bounces={false}
            contentContainerStyle={[
              styles.content,
              { paddingBottom: Math.max(24, insets.bottom + 18) },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.top}>
              <BackButton accessibilityLabel="Go back to companion selection" onPress={onBack} />
              <View style={styles.topSpacer} />
            </View>

            <View
              accessibilityLabel={`Onboarding progress, step ${STEP} of ${TOTAL_STEPS}`}
              accessibilityRole="progressbar"
              style={styles.progressTrack}
            >
              <LinearGradient
                colors={['#7C3AED', '#A855F7', '#DB2777']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${(STEP / TOTAL_STEPS) * 100}%` }]}
              />
            </View>

            <View style={styles.companionStage}>
              <View style={styles.portraitHalo} />
              <Image
                accessibilityLabel={`${companion.name} production avatar`}
                resizeMode="contain"
                source={{ uri: companion.avatar }}
                style={styles.portrait}
              />
            </View>
            <View style={styles.identityRow}>
              <Text style={styles.identityEmoji}>{companion.emoji}</Text>
              <Text numberOfLines={1} style={styles.identityText}>
                {companion.name} - {companion.tagline}
              </Text>
            </View>

            <View style={styles.header}>
              <Text accessibilityRole="header" style={styles.title}>
                What do you want{`\n`}to call them?
              </Text>
              <Text style={styles.copy}>
                {NAME_COPY_LINE_ONE}
                {`\n`}
                Make it yours.
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Focus companion name input"
              onPress={() => inputRef.current?.focus()}
              style={[styles.inputCard, focused && styles.inputCardFocused]}
            >
              <Text style={styles.inputLabel}>Companion name</Text>
              <TextInput
                accessibilityLabel="Companion name"
                autoCapitalize="words"
                blurOnSubmit={false}
                maxLength={MAX_NICKNAME_LENGTH}
                onBlur={() => setFocused(false)}
                onChangeText={setNickname}
                onFocus={() => setFocused(true)}
                onSubmitEditing={() => void handleSave(false)}
                placeholder={placeholders[placeholderIndex]}
                placeholderTextColor="rgba(255,255,255,0.26)"
                ref={inputRef}
                returnKeyType="done"
                selectionColor="#A855F7"
                style={styles.input}
                value={nickname}
              />
            </Pressable>
            <Text accessibilityLiveRegion="polite" style={styles.previewText}>
              {trimmedNickname
                ? `They'll go by "${trimmedNickname}"`
                : `They'll go by "${companion.name}" by default`}
            </Text>

            <View style={styles.spacer} />

            <Pressable
              accessibilityLabel={`Continue with ${displayName}`}
              accessibilityRole="button"
              disabled={saving}
              onPress={() => {
                Keyboard.dismiss();
                void handleSave(false);
              }}
              style={({ pressed }) => [
                styles.primaryButton,
                saving && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <LinearGradient
                colors={['#7C3AED', '#A855F7', '#DB2777']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryGradient}
              >
                <Text style={styles.primaryText}>Continue</Text>
              </LinearGradient>
            </Pressable>

            <Pressable
              accessibilityLabel={`Keep ${companion.name} as companion name`}
              accessibilityRole="button"
              disabled={saving}
              onPress={() => {
                Keyboard.dismiss();
                void handleSave(true);
              }}
              style={({ pressed }) => [
                styles.secondaryButton,
                saving && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.secondaryText}>Keep {companion.name}</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </NamingBackground>
  );
}

async function persistCompanionNaming({
  companion,
  displayName,
}: {
  companion: CompanionMeta;
  displayName: string;
}) {
  const personality = COMPANION_PERSONALITY[companion.id] ?? COMPANION_PERSONALITY.luna;
  const companionPayload = JSON.stringify({
    id: companion.id,
    name: companion.name,
    displayName,
    systemPrompt: `You are ${displayName}, a supportive AI companion. ${companion.tagline || ''}`,
  });

  await Promise.all([
    setSecureItem('onboarding.companionId', companion.id),
    setSecureItem('onboarding.companionNickname', displayName),
    setSecureItem('onboarding.companionPayload', companionPayload),
    setSecureItem('onboarding.selectedCompanionId', companion.id),
    setSecureItem('onboarding.personalityVibe', personality.vibe),
    setSecureItem('onboarding.personalityStyle', personality.style),
    setSecureItem('onboarding.personalityHumor', personality.humor),
    setSecureItem('onboarding.personalityEmpathy', personality.empathy),
  ]);

  writeWebStorage('unfiltr_companion_nickname', displayName);
  writeWebStorage('unfiltr_companion_id', companion.id);
  writeWebStorage('companionId', companion.id);
  writeWebStorage('unfiltr_companion', companionPayload);
  writeWebStorage('unfiltr_selected_companion_id', companion.id);
  writeWebStorage('unfiltr_personality_vibe', personality.vibe);
  writeWebStorage('unfiltr_personality_style', personality.style);
  writeWebStorage('unfiltr_personality_humor', personality.humor);
  writeWebStorage('unfiltr_personality_empathy', personality.empathy);
  ensureDefaultEnvironment();
}

async function syncProfile({
  companionId,
  nickname,
}: {
  companionId: CompanionId;
  nickname: string;
}) {
  const profileId =
    (await getSecureItem('onboarding.pendingProfileId')) ||
    (await getSecureItem('profile.userProfileId')) ||
    readWebStorage('userProfileId');

  if (!profileId) return;

  const displayName =
    (await getSecureItem('onboarding.displayName')) || readWebStorage('unfiltr_display_name') || '';

  try {
    await apiClient.post('/api/syncProfile', {
      action: 'update',
      profileId,
      updateData: {
        companion_id: companionId,
        display_name: displayName,
        last_active: new Date().toISOString(),
        nickname,
      },
    });
  } catch (error) {
    console.warn('[CompanionNaming] DB save failed:', error);
  }
}

function ensureDefaultEnvironment() {
  if (readWebStorage('unfiltr_env')) return;

  const value = JSON.stringify(DEFAULT_BACKGROUND);
  writeWebStorage('unfiltr_env', value);
  writeWebStorage('unfiltr_background', DEFAULT_BACKGROUND.id);
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
    backgroundColor: '#05020D',
  },
  webGradient: {
    backgroundImage:
      'radial-gradient(circle at 50% -8%, rgba(90,26,183,.52), transparent 42%), radial-gradient(circle at 50% 56%, rgba(168,85,247,.10), transparent 34%), linear-gradient(180deg,#2d0a6e 0%, #120428 42%, #05020d 100%)',
  } as unknown as ViewStyle,
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 48,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.045)',
  },
  backIcon: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 30,
    fontWeight: '600',
    lineHeight: 32,
  },
  stepLabel: {
    color: 'rgba(216,180,254,0.9)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.44,
    lineHeight: 16,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  topSpacer: {
    width: 44,
  },
  progressTrack: {
    height: 5,
    marginBottom: 18,
    overflow: 'hidden',
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  progressFill: {
    height: '100%',
    borderRadius: 99,
  },
  companionStage: {
    height: 176,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(216,180,254,0.18)',
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  portraitHalo: {
    position: 'absolute',
    bottom: 20,
    left: '50%',
    width: 178,
    height: 28,
    borderRadius: 99,
    backgroundColor: 'rgba(168,85,247,0.22)',
    transform: [{ translateX: -89 }],
  },
  portrait: {
    width: 172,
    height: 170,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 10,
  },
  identityEmoji: {
    fontSize: 16,
    lineHeight: 20,
  },
  identityText: {
    maxWidth: 278,
    color: 'rgba(255,255,255,0.48)',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  header: {
    alignItems: 'center',
    marginBottom: 14,
    marginTop: 18,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 34,
    textAlign: 'center',
    textShadowColor: 'rgba(168,85,247,0.38)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 22,
  },
  copy: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.48)',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    textAlign: 'center',
  },
  inputCard: {
    borderWidth: 1.5,
    borderColor: 'rgba(139,92,246,0.22)',
    borderRadius: 18,
    backgroundColor: 'rgba(139,92,246,0.06)',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  inputCardFocused: {
    borderColor: 'rgba(168,85,247,0.68)',
    backgroundColor: 'rgba(168,85,247,0.09)',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
  },
  inputLabel: {
    marginBottom: 3,
    color: 'rgba(216,180,254,0.74)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    lineHeight: 15,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  input: {
    minHeight: 38,
    padding: 0,
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 24,
    textAlign: 'center',
  },
  previewText: {
    minHeight: 20,
    marginTop: 8,
    color: 'rgba(168,85,247,0.78)',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'center',
  },
  spacer: {
    flex: 1,
    minHeight: 14,
  },
  primaryButton: {
    width: '100%',
    minHeight: 56,
    overflow: 'hidden',
    borderRadius: 20,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.34,
    shadowRadius: 44,
  },
  primaryGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 16,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 22,
    textAlign: 'center',
  },
  secondaryButton: {
    width: '100%',
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 10,
    paddingVertical: 14,
  },
  secondaryText: {
    color: 'rgba(255,255,255,0.44)',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.58,
  },
  pressed: {
    opacity: 0.82,
  },
});
