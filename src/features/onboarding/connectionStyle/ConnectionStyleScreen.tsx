import { LinearGradient } from 'expo-linear-gradient';
import { type PropsWithChildren, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/BackButton';
import { setSecureItem } from '@/lib/storage';

type RelationshipMode = 'friend' | 'coach' | 'companion';

type ConnectionStyleScreenProps = {
  onBack: () => void;
  onComplete: () => void;
};

type ConnectionMode = {
  borderColor: string;
  color: string;
  description: string;
  emoji: string;
  id: RelationshipMode;
  label: string;
  softColor: string;
};

const TOTAL_STEPS = 7;
const STEP = 6;
const DEFAULT_MODE: RelationshipMode = 'friend';

const CONNECTION_MODES: ConnectionMode[] = [
  {
    borderColor: 'rgba(129,140,248,0.36)',
    color: '#818CF8',
    description: 'Casual, real talk - like texting someone who actually gets you.',
    emoji: '\u{1F44B}',
    id: 'friend',
    label: 'Friend',
    softColor: 'rgba(129,140,248,0.14)',
  },
  {
    borderColor: 'rgba(52,211,153,0.34)',
    color: '#34D399',
    description: 'Focused, direct, goal-oriented - here to push you forward.',
    emoji: '\u{1F3AF}',
    id: 'coach',
    label: 'Coach',
    softColor: 'rgba(52,211,153,0.13)',
  },
  {
    borderColor: 'rgba(192,132,252,0.36)',
    color: '#C084FC',
    description: 'Deep connection, emotional support - always in your corner.',
    emoji: '\u{1F49C}',
    id: 'companion',
    label: 'Companion',
    softColor: 'rgba(192,132,252,0.14)',
  },
];

function ConnectionStyleBackground({ children }: PropsWithChildren) {
  if (Platform.OS === 'web') {
    return <View style={[styles.root, styles.webGradient]}>{children}</View>;
  }

  return (
    <LinearGradient
      colors={['#2D0A6E', '#120428', '#06020F', '#020008']}
      locations={[0, 0.42, 0.76, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.root}
    >
      {children}
    </LinearGradient>
  );
}

export function ConnectionStyleScreen({ onBack, onComplete }: ConnectionStyleScreenProps) {
  const [selected, setSelected] = useState<RelationshipMode>(DEFAULT_MODE);
  const [saving, setSaving] = useState(false);
  const [fade] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(12));

  useEffect(() => {
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
  }, [fade, translateY]);

  const selectedMode = useMemo(
    () => CONNECTION_MODES.find((mode) => mode.id === selected) ?? CONNECTION_MODES[0]!,
    [selected],
  );

  const handleContinue = useCallback(async () => {
    if (saving) return;

    setSaving(true);
    try {
      await Promise.all([setSecureItem('onboarding.relationshipMode', selected)]);
      writeWebStorage('unfiltr_relationship_mode', selected);
      writeWebStorage('unfiltr_onboarding_complete', 'true');
      onComplete();
    } finally {
      setSaving(false);
    }
  }, [onComplete, saving, selected]);

  return (
    <ConnectionStyleBackground>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <View style={styles.top}>
            <BackButton accessibilityLabel="Go back to companion naming" onPress={onBack} />
            <View style={styles.topSpacer} />
          </View>

          <View
            accessibilityLabel="Onboarding progress"
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

          <Animated.View style={[styles.main, { opacity: fade, transform: [{ translateY }] }]}>
            <Text style={styles.eyebrow}>Your dynamic</Text>
            <Text accessibilityRole="header" style={styles.title}>
              Choose your{'\n'}connection style
            </Text>
            <Text style={styles.copy}>
              This shapes how your companion talks to you. You can always change it later.
            </Text>

            <View style={styles.options}>
              {CONNECTION_MODES.map((mode) => (
                <ConnectionStyleCard
                  key={mode.id}
                  mode={mode}
                  onPress={() => setSelected(mode.id)}
                  selected={selected === mode.id}
                />
              ))}
            </View>
          </Animated.View>

          <View style={styles.spacer} />

          <Pressable
            accessibilityLabel={`Continue with ${selectedMode.label} connection style`}
            accessibilityRole="button"
            disabled={saving}
            onPress={handleContinue}
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
        </View>
      </SafeAreaView>
    </ConnectionStyleBackground>
  );
}

function ConnectionStyleCard({
  mode,
  onPress,
  selected,
}: {
  mode: ConnectionMode;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityHint="Sets how your companion should respond in Chat"
      accessibilityLabel={`${mode.label}. ${mode.description}`}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selected && [
          styles.cardSelected,
          {
            backgroundColor: mode.softColor,
            borderColor: mode.color,
            shadowColor: mode.color,
          },
        ],
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.iconBox,
          selected && {
            backgroundColor: mode.softColor,
            borderColor: mode.borderColor,
          },
        ]}
      >
        <Text style={styles.icon}>{mode.emoji}</Text>
      </View>
      <View style={styles.cardText}>
        <Text style={[styles.cardTitle, selected && styles.cardTitleSelected]}>{mode.label}</Text>
        <Text style={[styles.cardDescription, selected && styles.cardDescriptionSelected]}>
          {mode.description}
        </Text>
      </View>
      {selected ? (
        <View style={[styles.check, { backgroundColor: mode.color }]}>
          <Text style={styles.checkText}>{'✓'}</Text>
        </View>
      ) : null}
    </Pressable>
  );
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
    backgroundImage:
      'radial-gradient(ellipse at 50% -12%, rgba(124,58,237,.48), transparent 42%), radial-gradient(ellipse at 80% 88%, rgba(236,72,153,.16), transparent 36%), radial-gradient(ellipse at 10% 92%, rgba(88,28,135,.32), transparent 42%), linear-gradient(180deg, #2D0A6E 0%, #120428 42%, #06020F 76%, #020008 100%)',
  } as unknown as ViewStyle,
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 18,
    paddingTop: 24,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(216,180,254,0.22)',
    borderRadius: 21,
    backgroundColor: 'rgba(124,58,237,0.13)',
  },
  backIcon: {
    color: '#F5EAFE',
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 30,
    transform: [{ translateY: -1 }],
  },
  topSpacer: {
    width: 42,
  },
  progressTrack: {
    height: 5,
    marginBottom: 34,
    overflow: 'hidden',
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  progressFill: {
    height: '100%',
    borderRadius: 99,
  },
  main: {
    alignItems: 'center',
  },
  eyebrow: {
    marginBottom: 10,
    color: '#C4B5FD',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.44,
    lineHeight: 16,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 31,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 35,
    textAlign: 'center',
    textShadowColor: 'rgba(168,85,247,0.38)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 22,
  },
  copy: {
    maxWidth: 326,
    marginBottom: 22,
    marginTop: 8,
    color: 'rgba(255,255,255,0.58)',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    textAlign: 'center',
  },
  options: {
    width: '100%',
    gap: 10,
  },
  card: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.11)',
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.045)',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  cardSelected: {
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 34,
  },
  iconBox: {
    width: 46,
    height: 46,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  icon: {
    fontSize: 22,
    lineHeight: 27,
  },
  cardText: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 21,
  },
  cardTitleSelected: {
    color: '#FFFFFF',
  },
  cardDescription: {
    marginTop: 3,
    color: 'rgba(255,255,255,0.52)',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 17,
  },
  cardDescriptionSelected: {
    color: 'rgba(255,255,255,0.75)',
  },
  check: {
    width: 24,
    height: 24,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  checkText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 18,
  },
  spacer: {
    flex: 1,
    minHeight: 12,
  },
  primaryButton: {
    width: '100%',
    minHeight: 58,
    overflow: 'hidden',
    borderRadius: 20,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.42,
    shadowRadius: 34,
  },
  primaryGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 17,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 22,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.58,
  },
  pressed: {
    opacity: 0.82,
  },
});
