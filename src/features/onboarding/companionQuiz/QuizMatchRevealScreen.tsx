import { LinearGradient } from 'expo-linear-gradient';
import { type PropsWithChildren, useCallback } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/BackButton';
import { setSecureItem } from '@/lib/storage';

import { getCompanionMeta } from './companionMeta';
import { COMPANION_PERSONALITY, type QuizMatchResult } from './quizData';

type QuizMatchRevealScreenProps = {
  onBack: () => void;
  onMeetCompanion: () => void;
  onViewAllCompanions: () => void;
  result: QuizMatchResult;
};

const TOTAL_STEPS = 7;
const ONBOARDING_STEP = 3;

function RevealBackground({ children }: PropsWithChildren) {
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

export function QuizMatchRevealScreen({
  onBack,
  onMeetCompanion,
  onViewAllCompanions,
  result,
}: QuizMatchRevealScreenProps) {
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width - 56, 337);
  const companion = getCompanionMeta(result.matchId);
  const matchStrength = Math.max(
    8,
    Math.min(100, Math.round(((result.top3[0]?.pts ?? result.maxPts) / result.maxPts) * 100)),
  );

  const handleMeetCompanion = useCallback(async () => {
    const personality = COMPANION_PERSONALITY[companion.id] ?? COMPANION_PERSONALITY.luna;

    await Promise.all([
      setSecureItem('onboarding.selectedCompanionId', companion.id),
      setSecureItem('onboarding.quizCompanionId', companion.id),
      setSecureItem('onboarding.personalityVibe', personality.vibe),
      setSecureItem('onboarding.personalityStyle', personality.style),
      setSecureItem('onboarding.personalityHumor', personality.humor),
      setSecureItem('onboarding.personalityEmpathy', personality.empathy),
    ]);
    writeWebStorage('unfiltr_selected_companion_id', companion.id);
    writeWebStorage('unfiltr_quiz_companion_id', companion.id);
    writeWebStorage('unfiltr_personality_vibe', personality.vibe);
    writeWebStorage('unfiltr_personality_style', personality.style);
    writeWebStorage('unfiltr_personality_humor', personality.humor);
    writeWebStorage('unfiltr_personality_empathy', personality.empathy);
    onMeetCompanion();
  }, [companion.id, onMeetCompanion]);

  const handleViewAllCompanions = useCallback(async () => {
    await Promise.all([
      setSecureItem('onboarding.matchMode', 'manual'),
      setSecureItem('onboarding.quizCompanionId', 'manual'),
    ]);
    writeWebStorage('unfiltr_quiz_companion_id', 'manual');
    onViewAllCompanions();
  }, [onViewAllCompanions]);

  return (
    <RevealBackground>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.top}>
            <BackButton accessibilityLabel="Go back to quiz" onPress={onBack} />
            <View style={styles.topSpacer} />
          </View>

          <View
            accessibilityLabel={`Onboarding progress, step ${ONBOARDING_STEP} of ${TOTAL_STEPS}`}
            accessibilityRole="progressbar"
            style={[styles.progressTrack, { width: contentWidth }]}
          >
            <LinearGradient
              colors={['#7C3AED', '#A855F7', '#DB2777']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: `${(ONBOARDING_STEP / TOTAL_STEPS) * 100}%` }]}
            />
          </View>

          <Text style={[styles.eyebrow, { width: contentWidth }]}>Your match is...</Text>
          <View style={[styles.matchCard, { width: contentWidth }]}>
            <View style={styles.avatarPane}>
              <Image
                accessibilityLabel={`${companion.name} production avatar`}
                resizeMode="contain"
                source={{ uri: companion.avatar }}
                style={styles.avatar}
              />
            </View>
            <View style={styles.detailsPane}>
              <Text accessibilityRole="header" style={styles.name}>
                {companion.name}
              </Text>
              <Text style={styles.summary}>{companion.summary}</Text>
              <View style={styles.traits}>
                {companion.traits.slice(0, 4).map((trait) => (
                  <View key={trait} style={styles.chip}>
                    <Text style={styles.chipText}>{trait}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.scoreBlock}>
                <View style={styles.scoreRow}>
                  <Text style={styles.scoreLabel}>Match strength</Text>
                  <Text style={styles.scoreLabel}>Top result</Text>
                </View>
                <View style={styles.scoreTrack}>
                  <LinearGradient
                    colors={['#7C3AED', '#A855F7', '#DB2777']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.scoreFill, { width: `${matchStrength}%` }]}
                  />
                </View>
              </View>
            </View>
          </View>

          <View style={[styles.whyCard, { width: contentWidth }]}>
            <Text style={styles.whyTitle}>Why {companion.name} matched</Text>
            <Text style={styles.whyText}>{companion.explanation}</Text>
          </View>

          <View style={styles.spacer} />

          <Pressable
            accessibilityLabel={`Meet ${companion.name}`}
            accessibilityRole="button"
            onPress={handleMeetCompanion}
            style={({ pressed }) => [
              styles.primaryButton,
              { width: contentWidth },
              pressed && styles.pressed,
            ]}
          >
            <LinearGradient
              colors={['#7C3AED', '#A855F7', '#DB2777']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryGradient}
            >
              <Text style={styles.primaryText}>Meet {companion.name}</Text>
            </LinearGradient>
          </Pressable>

          <Pressable
            accessibilityLabel="View all companions"
            accessibilityRole="button"
            onPress={handleViewAllCompanions}
            style={({ pressed }) => [
              styles.secondaryButton,
              { width: contentWidth },
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.secondaryText}>View all companions</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </RevealBackground>
  );
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
      'radial-gradient(circle at 24% 28%, rgba(168,85,247,.28), transparent 36%), radial-gradient(circle at 85% 76%, rgba(219,39,119,.16), transparent 30%), linear-gradient(180deg,#2d0a6e 0%, #120428 42%, #05020d 100%)',
  } as unknown as ViewStyle,
  safeArea: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingBottom: 28,
    paddingHorizontal: 28,
    paddingTop: 48,
  },
  top: {
    width: '100%',
    maxWidth: 360,
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
    marginBottom: 32,
    overflow: 'hidden',
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  progressFill: {
    height: '100%',
    borderRadius: 99,
  },
  eyebrow: {
    marginBottom: 8,
    color: '#D8B4FE',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  matchCard: {
    width: '100%',
    minHeight: 290,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(216,180,254,0.24)',
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.052)',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.22,
    shadowRadius: 70,
  },
  avatarPane: {
    width: '42%',
    minHeight: 290,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    backgroundColor: 'rgba(168,85,247,0.12)',
  },
  avatar: {
    width: 176,
    height: 280,
    transform: [{ translateX: -4 }],
  },
  detailsPane: {
    width: '58%',
    minWidth: 0,
    paddingBottom: 18,
    paddingHorizontal: 18,
    paddingTop: 20,
  },
  name: {
    marginBottom: 10,
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 42,
    textShadowColor: 'rgba(168,85,247,0.46)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 24,
  },
  summary: {
    flexShrink: 1,
    marginBottom: 14,
    color: 'rgba(255,255,255,0.68)',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  traits: {
    maxWidth: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 14,
  },
  chip: {
    borderWidth: 1,
    borderColor: 'rgba(216,180,254,0.22)',
    borderRadius: 99,
    backgroundColor: 'rgba(168,85,247,0.13)',
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  chipText: {
    color: 'rgba(255,255,255,0.84)',
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 14,
  },
  scoreBlock: {
    marginTop: 'auto',
    paddingTop: 12,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 7,
  },
  scoreLabel: {
    flexShrink: 1,
    color: 'rgba(255,255,255,0.42)',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  scoreTrack: {
    height: 6,
    overflow: 'hidden',
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  scoreFill: {
    height: '100%',
    borderRadius: 99,
  },
  whyCard: {
    width: '100%',
    marginTop: 36,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.16)',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 16,
  },
  whyTitle: {
    marginBottom: 4,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
  },
  whyText: {
    color: 'rgba(255,255,255,0.54)',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 20,
  },
  spacer: {
    flex: 1,
    minHeight: 18,
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
    fontWeight: '800',
    lineHeight: 22,
    textAlign: 'center',
  },
  secondaryButton: {
    width: '100%',
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 10,
    paddingVertical: 16,
  },
  secondaryText: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.82,
  },
});
