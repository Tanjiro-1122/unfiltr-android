import { LinearGradient } from 'expo-linear-gradient';
import { type PropsWithChildren, useCallback, useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
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

type FindMatchScreenProps = {
  onBack: () => void;
  onBrowseCompanions: () => void;
  onFindMyMatch: () => void;
};

const TOTAL_STEPS = 7;
const STEP = 3;

function FindMatchBackground({ children }: PropsWithChildren) {
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

export function FindMatchScreen({
  onBack,
  onBrowseCompanions,
  onFindMyMatch,
}: FindMatchScreenProps) {
  const [fade] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(12));
  const [isChoosing, setIsChoosing] = useState(false);

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

  const handleFindMyMatch = useCallback(async () => {
    if (isChoosing) return;
    setIsChoosing(true);
    try {
      await setSecureItem('onboarding.matchMode', 'quiz');
      onFindMyMatch();
    } finally {
      setIsChoosing(false);
    }
  }, [isChoosing, onFindMyMatch]);

  const handleBrowseCompanions = useCallback(async () => {
    if (isChoosing) return;
    setIsChoosing(true);
    try {
      await Promise.all([
        setSecureItem('onboarding.matchMode', 'manual'),
        setSecureItem('onboarding.quizCompanionId', 'manual'),
      ]);
      writeWebStorage('unfiltr_quiz_companion_id', 'manual');
      onBrowseCompanions();
    } finally {
      setIsChoosing(false);
    }
  }, [isChoosing, onBrowseCompanions]);

  return (
    <FindMatchBackground>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <View style={styles.top}>
            <BackButton accessibilityLabel="Go back to Name" onPress={onBack} />
          </View>

          <View style={styles.progressTrack}>
            <LinearGradient
              colors={['#7C3AED', '#A855F7', '#DB2777']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: `${(STEP / TOTAL_STEPS) * 100}%` }]}
            />
          </View>

          <Animated.View style={[styles.main, { opacity: fade, transform: [{ translateY }] }]}>
            <Image
              accessibilityLabel="Unfiltr by Javier Triquetra logo"
              resizeMode="contain"
              source={require('../../../../assets/brand/unfiltr-triquetra-logo.png')}
              style={styles.logo}
            />
            <Text style={styles.brand}>Unfiltr by Javier</Text>
            <Text accessibilityRole="header" style={styles.title}>
              {"Let's find your"}
              {'\n'}
              <Text style={styles.titleAccent}>perfect match</Text>
            </Text>
            <Text style={styles.copy}>Choose how you want to meet your companion.</Text>

            <ChoiceCard
              accessibilityLabel="Find My Match"
              description="Answer a short quiz and let Unfiltr suggest your companion."
              disabled={isChoosing}
              icon={'🔮'}
              onPress={handleFindMyMatch}
              title="Find My Match"
            />
            <ChoiceCard
              accessibilityLabel="Browse Companions"
              description="Skip the quiz and choose who feels right yourself."
              disabled={isChoosing}
              icon={'◉'}
              onPress={handleBrowseCompanions}
              title="Browse Companions"
            />
          </Animated.View>
        </View>
      </SafeAreaView>
    </FindMatchBackground>
  );
}

function ChoiceCard({
  accessibilityLabel,
  description,
  disabled,
  icon,
  onPress,
  title,
}: {
  accessibilityLabel: string;
  description: string;
  disabled: boolean;
  icon: string;
  onPress: () => void;
  title: string;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choiceCard,
        pressed && styles.choiceCardPressed,
        disabled && styles.choiceCardDisabled,
      ]}
    >
      <View style={styles.choiceIcon}>
        <Text style={styles.choiceIconText}>{icon}</Text>
      </View>
      <View style={styles.choiceText}>
        <Text style={styles.choiceTitle}>{title}</Text>
        <Text style={styles.choiceDescription}>{description}</Text>
      </View>
      <Text style={styles.choiceArrow}>{'›'}</Text>
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
    backgroundImage: 'linear-gradient(180deg, #2D0A6E 0%, #120428 39%, #06020F 74%, #020008 100%)',
  } as unknown as ViewStyle,
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingBottom: 30,
    paddingTop: 26,
  },
  top: {
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(216,180,254,0.18)',
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
  },
  backIcon: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 24,
  },
  progressTrack: {
    height: 5,
    marginBottom: 44,
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
  main: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 18,
  },
  logo: {
    width: 70,
    height: 70,
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
  titleAccent: {
    color: '#D8B4FE',
  },
  copy: {
    maxWidth: 318,
    marginBottom: 26,
    color: 'rgba(255,255,255,0.56)',
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
  },
  choiceCard: {
    width: '100%',
    maxWidth: 330,
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.24)',
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.055)',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  choiceCardPressed: {
    transform: [{ scale: 0.985 }],
    borderColor: 'rgba(216,180,254,0.62)',
    backgroundColor: 'rgba(168,85,247,0.14)',
  },
  choiceCardDisabled: {
    opacity: 0.6,
  },
  choiceIcon: {
    width: 46,
    height: 46,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(168,85,247,0.18)',
  },
  choiceIconText: {
    color: '#D8B4FE',
    fontSize: 21,
    lineHeight: 25,
  },
  choiceText: {
    flex: 1,
  },
  choiceTitle: {
    marginBottom: 4,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 21,
  },
  choiceDescription: {
    color: 'rgba(255,255,255,0.52)',
    fontSize: 12,
    lineHeight: 18,
  },
  choiceArrow: {
    color: '#D8B4FE',
    fontSize: 28,
    fontWeight: '400',
    lineHeight: 30,
  },
  pressed: {
    opacity: 0.82,
  },
});
