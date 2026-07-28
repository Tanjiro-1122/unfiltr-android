import { LinearGradient } from 'expo-linear-gradient';
import { type PropsWithChildren, useCallback, useMemo, useState } from 'react';
import {
  Image,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/BackButton';
import {
  COMPANION_IDS,
  COMPANION_PERSONALITY,
  getCompanionMeta,
  type CompanionId,
  type CompanionMeta,
} from '@/features/onboarding/companionQuiz';
import { setSecureItem } from '@/lib/storage';

type CompanionSelectionScreenProps = {
  onBack: () => void;
  onCompanionSelected: (companionId: CompanionId) => void;
};

const TOTAL_STEPS = 7;
const STEP = 4;
const SWIPE_THRESHOLD = 40;

function SelectionBackground({ children }: PropsWithChildren) {
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

export function CompanionSelectionScreen({
  onBack,
  onCompanionSelected,
}: CompanionSelectionScreenProps) {
  const companions = useMemo(() => COMPANION_IDS.map((id) => getCompanionMeta(id)), []);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = companions[selectedIndex] ?? companions[0]!;
  const previous = selectedIndex > 0 ? companions[selectedIndex - 1] : null;
  const next = selectedIndex < companions.length - 1 ? companions[selectedIndex + 1] : null;

  const go = useCallback(
    (direction: -1 | 1) => {
      setSelectedIndex((current) =>
        Math.min(Math.max(current + direction, 0), companions.length - 1),
      );
    },
    [companions.length],
  );

  const selectIndex = useCallback(
    (index: number) => {
      setSelectedIndex(Math.min(Math.max(index, 0), companions.length - 1));
    },
    [companions.length],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 12,
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx <= -SWIPE_THRESHOLD) go(1);
          if (gestureState.dx >= SWIPE_THRESHOLD) go(-1);
        },
      }),
    [go],
  );

  const handleChoose = useCallback(async () => {
    await persistSelectedCompanion(selected);
    onCompanionSelected(selected.id);
  }, [onCompanionSelected, selected]);

  return (
    <SelectionBackground>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <View style={styles.top}>
            <BackButton accessibilityLabel="Go back to match options" onPress={onBack} />
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

          <View style={styles.header}>
            <Text style={styles.eyebrow}>Browse companions</Text>
            <Text accessibilityRole="header" style={styles.title}>
              Choose who feels right
            </Text>
            <Text style={styles.copy}>
              Swipe through every companion, then pick the one you want to meet.
            </Text>
          </View>

          <View
            {...panResponder.panHandlers}
            accessibilityLabel={`Selected companion ${selected.name}, ${selected.tagline}`}
            style={styles.stage}
          >
            <View style={styles.halo} />
            {previous ? (
              <PreviewAvatar companion={previous} onPress={() => go(-1)} position="previous" />
            ) : null}
            <MainAvatar companion={selected} />
            {next ? <PreviewAvatar companion={next} onPress={() => go(1)} position="next" /> : null}

            <Pressable
              accessibilityLabel="Previous companion"
              accessibilityRole="button"
              accessibilityState={{ disabled: selectedIndex === 0 }}
              disabled={selectedIndex === 0}
              onPress={() => go(-1)}
              style={({ pressed }) => [
                styles.navButton,
                styles.navButtonLeft,
                selectedIndex === 0 && styles.navButtonDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.navIcon}>{'\u2039'}</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Next companion"
              accessibilityRole="button"
              accessibilityState={{ disabled: selectedIndex === companions.length - 1 }}
              disabled={selectedIndex === companions.length - 1}
              onPress={() => go(1)}
              style={({ pressed }) => [
                styles.navButton,
                styles.navButtonRight,
                selectedIndex === companions.length - 1 && styles.navButtonDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.navIcon}>{'\u203A'}</Text>
            </Pressable>
          </View>

          <View style={styles.info}>
            <Text style={styles.name}>{selected.name}</Text>
            <Text style={styles.tagline}>{selected.tagline}</Text>
            <View style={styles.traits}>
              {selected.traits.slice(0, 3).map((trait) => (
                <View key={trait} style={styles.chip}>
                  <Text style={styles.chipText}>{trait}</Text>
                </View>
              ))}
            </View>
          </View>

          <View
            accessibilityLabel={`Companion ${selectedIndex + 1} of ${companions.length}`}
            style={styles.dots}
          >
            {companions.map((companion, index) => (
              <Pressable
                accessibilityLabel={`Show ${companion.name}`}
                accessibilityRole="button"
                key={companion.id}
                onPress={() => selectIndex(index)}
                style={[
                  styles.dot,
                  index === selectedIndex && styles.dotActive,
                  index === selectedIndex && styles.dotSelected,
                ]}
              />
            ))}
          </View>

          <View style={styles.spacer} />

          <Pressable
            accessibilityLabel={`Choose ${selected.name}`}
            accessibilityRole="button"
            onPress={handleChoose}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <LinearGradient
              colors={['#7C3AED', '#A855F7', '#DB2777']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryGradient}
            >
              <Text style={styles.primaryText}>Choose {selected.name}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </SafeAreaView>
    </SelectionBackground>
  );
}

function MainAvatar({ companion }: { companion: CompanionMeta }) {
  return (
    <View style={styles.mainAvatarWrap}>
      <Image
        accessibilityLabel={`${companion.name} production avatar`}
        resizeMode="contain"
        source={{ uri: companion.avatar }}
        style={styles.mainAvatar}
      />
    </View>
  );
}

function PreviewAvatar({
  companion,
  onPress,
  position,
}: {
  companion: CompanionMeta;
  onPress: () => void;
  position: 'next' | 'previous';
}) {
  return (
    <Pressable
      accessibilityLabel={`Preview ${companion.name}`}
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.previewAvatarWrap,
        position === 'previous' ? styles.previewAvatarPrevious : styles.previewAvatarNext,
      ]}
    >
      <Image resizeMode="contain" source={{ uri: companion.avatar }} style={styles.previewAvatar} />
    </Pressable>
  );
}

async function persistSelectedCompanion(companion: CompanionMeta) {
  const personality = COMPANION_PERSONALITY[companion.id] ?? COMPANION_PERSONALITY.luna;

  await Promise.all([
    setSecureItem('onboarding.selectedCompanionId', companion.id),
    setSecureItem('onboarding.personalityVibe', personality.vibe),
    setSecureItem('onboarding.personalityStyle', personality.style),
    setSecureItem('onboarding.personalityHumor', personality.humor),
    setSecureItem('onboarding.personalityEmpathy', personality.empathy),
  ]);
  writeWebStorage('unfiltr_selected_companion_id', companion.id);
  writeWebStorage('unfiltr_personality_vibe', personality.vibe);
  writeWebStorage('unfiltr_personality_style', personality.style);
  writeWebStorage('unfiltr_personality_humor', personality.humor);
  writeWebStorage('unfiltr_personality_empathy', personality.empathy);
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
      'radial-gradient(circle at 50% -8%, rgba(90,26,183,.52), transparent 42%), radial-gradient(circle at 50% 55%, rgba(168,85,247,.12), transparent 34%), linear-gradient(180deg,#2d0a6e 0%, #120428 42%, #05020d 100%)',
  } as unknown as ViewStyle,
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingBottom: 28,
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
    marginBottom: 28,
    overflow: 'hidden',
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  progressFill: {
    height: '100%',
    borderRadius: 99,
  },
  header: {
    alignItems: 'center',
    marginBottom: 18,
  },
  eyebrow: {
    marginBottom: 8,
    color: '#D8B4FE',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    lineHeight: 16,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 31,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 34,
    textAlign: 'center',
    textShadowColor: 'rgba(168,85,247,0.38)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 22,
  },
  copy: {
    maxWidth: 280,
    marginTop: 6,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    textAlign: 'center',
  },
  stage: {
    height: 282,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(216,180,254,0.2)',
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  halo: {
    position: 'absolute',
    bottom: 48,
    left: '50%',
    width: 210,
    height: 36,
    borderRadius: 99,
    backgroundColor: 'rgba(168,85,247,0.28)',
    transform: [{ translateX: -105 }],
  },
  mainAvatarWrap: {
    position: 'absolute',
    right: 0,
    bottom: 18,
    left: 0,
    zIndex: 3,
    alignItems: 'center',
  },
  mainAvatar: {
    width: 220,
    height: 248,
  },
  previewAvatarWrap: {
    position: 'absolute',
    bottom: 42,
    zIndex: 1,
    opacity: 0.38,
  },
  previewAvatarPrevious: {
    left: 52,
  },
  previewAvatarNext: {
    right: 52,
  },
  previewAvatar: {
    width: 104,
    height: 178,
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    zIndex: 4,
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    backgroundColor: 'rgba(6,2,15,0.56)',
    transform: [{ translateY: -21 }],
  },
  navButtonLeft: {
    left: 12,
  },
  navButtonRight: {
    right: 12,
  },
  navButtonDisabled: {
    opacity: 0.35,
  },
  navIcon: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 32,
  },
  info: {
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 12,
  },
  name: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 31,
    textAlign: 'center',
  },
  tagline: {
    marginBottom: 12,
    marginTop: 5,
    color: 'rgba(255,255,255,0.54)',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19,
    textAlign: 'center',
  },
  traits: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: 'rgba(216,180,254,0.22)',
    borderRadius: 99,
    backgroundColor: 'rgba(168,85,247,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginBottom: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dotSelected: {
    width: 22,
  },
  dotActive: {
    backgroundColor: '#DB2777',
  },
  spacer: {
    flex: 1,
    minHeight: 12,
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
  pressed: {
    opacity: 0.82,
  },
});
