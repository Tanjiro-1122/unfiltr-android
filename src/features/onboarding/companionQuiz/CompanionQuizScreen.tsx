import { LinearGradient } from 'expo-linear-gradient';
import { type PropsWithChildren, useCallback, useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/BackButton';

import {
  QUESTIONS,
  calculateQuizResult,
  type QuizMatchResult,
  type QuizOption,
  type QuizScores,
} from './quizData';

type CompanionQuizScreenProps = {
  onBack: () => void;
  onComplete: (result: QuizMatchResult) => void;
};

const TOTAL_STEPS = 7;
const ONBOARDING_STEP = 3;
const ANSWER_DELAY_MS = 320;

function QuizBackground({ children }: PropsWithChildren) {
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

export function CompanionQuizScreen({ onBack, onComplete }: CompanionQuizScreenProps) {
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState<QuizScores>({});
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [fade] = useState(() => new Animated.Value(1));
  const [translateX] = useState(() => new Animated.Value(0));
  const question = QUESTIONS[step] ?? QUESTIONS[0]!;

  useEffect(() => {
    fade.setValue(0);
    translateX.setValue(28);
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(translateX, {
        toValue: 0,
        damping: 28,
        mass: 0.8,
        stiffness: 260,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, step, translateX]);

  const handleAnswer = useCallback(
    (option: QuizOption, idx: number) => {
      if (selectedIdx !== null) return;

      setSelectedIdx(idx);
      const newScores = { ...scores };
      Object.entries(option.scores).forEach(([id, pts]) => {
        const companionId = id as keyof QuizScores;
        newScores[companionId] = (newScores[companionId] || 0) + pts;
      });

      setTimeout(() => {
        setSelectedIdx(null);
        setScores(newScores);

        if (step >= QUESTIONS.length - 1) {
          onComplete(calculateQuizResult(newScores));
          return;
        }

        setStep((current) => current + 1);
      }, ANSWER_DELAY_MS);
    },
    [onComplete, scores, selectedIdx, step],
  );

  return (
    <QuizBackground>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.top}>
            <BackButton accessibilityLabel="Go back to match options" onPress={onBack} />
            <View style={styles.topSpacer} />
          </View>

          <View
            accessibilityLabel={`Onboarding progress, step ${ONBOARDING_STEP} of ${TOTAL_STEPS}`}
            accessibilityRole="progressbar"
            style={styles.progressTrack}
          >
            <LinearGradient
              colors={['#7C3AED', '#A855F7', '#DB2777']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: `${(ONBOARDING_STEP / TOTAL_STEPS) * 100}%` }]}
            />
          </View>

          <Animated.View style={{ opacity: fade, transform: [{ translateX }] }}>
            <View style={styles.quizProgress}>
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={styles.dots}
              >
                {QUESTIONS.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.dot,
                      index < step && styles.dotComplete,
                      index === step && styles.dotActive,
                    ]}
                  />
                ))}
              </View>
              <Text
                accessibilityLabel={`Question ${step + 1} of ${QUESTIONS.length}`}
                style={styles.count}
              >
                {step + 1} / {QUESTIONS.length}
              </Text>
            </View>

            <Text style={styles.eyebrow}>Find My Match</Text>
            <Text accessibilityRole="header" style={styles.title}>
              {question.q}
            </Text>
            <Text style={styles.subcopy}>{question.sub}</Text>

            <View style={styles.options}>
              {question.options.map((option, index) => (
                <AnswerCard
                  key={option.label}
                  index={index}
                  isSelected={selectedIdx === index}
                  label={option.label}
                  onPress={() => handleAnswer(option, index)}
                />
              ))}
            </View>

            <Text style={styles.footer}>Tap one answer to continue.</Text>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </QuizBackground>
  );
}

function AnswerCard({
  index,
  isSelected,
  label,
  onPress,
}: {
  index: number;
  isSelected: boolean;
  label: string;
  onPress: () => void;
}) {
  const letter = String.fromCharCode(65 + index);

  return (
    <Pressable
      accessibilityLabel={`Answer ${letter}: ${label}`}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        isSelected && styles.optionSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.letter, isSelected && styles.letterSelected]}>
        <Text style={styles.letterText}>{letter}</Text>
      </View>
      <Text style={styles.optionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#05020D',
  },
  webGradient: {
    backgroundImage:
      'radial-gradient(circle at 50% -10%, rgba(90, 26, 183, 0.54), transparent 44%), radial-gradient(circle at 85% 94%, rgba(219,39,119,0.16), transparent 32%), linear-gradient(180deg, #2D0A6E 0%, #120428 42%, #05020D 100%)',
  } as unknown as ViewStyle,
  safeArea: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingBottom: 34,
    paddingHorizontal: 28,
    paddingTop: 54,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
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
  quizProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
  dotActive: {
    width: 28,
    backgroundColor: '#DB2777',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.34,
    shadowRadius: 18,
  },
  dotComplete: {
    backgroundColor: '#A855F7',
  },
  count: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  eyebrow: {
    marginBottom: 10,
    color: '#D8B4FE',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.3,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  title: {
    marginBottom: 8,
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 34,
    textShadowColor: 'rgba(168,85,247,0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 18,
  },
  subcopy: {
    marginBottom: 28,
    color: 'rgba(255,255,255,0.48)',
    fontSize: 15,
    fontStyle: 'italic',
    fontWeight: '400',
    lineHeight: 22,
  },
  options: {
    gap: 12,
  },
  option: {
    width: '100%',
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.18)',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.045)',
    padding: 16,
  },
  optionSelected: {
    borderColor: 'rgba(168,85,247,0.62)',
    backgroundColor: 'rgba(168,85,247,0.2)',
    transform: [{ scale: 0.99 }],
  },
  letter: {
    width: 30,
    height: 30,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(168,85,247,0.15)',
  },
  letterSelected: {
    backgroundColor: 'rgba(216,180,254,0.24)',
  },
  letterText: {
    color: '#D8B4FE',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  optionText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  footer: {
    marginTop: 22,
    color: 'rgba(255,255,255,0.32)',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.82,
  },
});
