import { LinearGradient } from 'expo-linear-gradient';
import { type PropsWithChildren, useCallback, useState } from 'react';
import {
  BackHandler,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { setSecureItem } from '@/lib/storage';

const AGE_VERIFIED_KEY = 'onboarding.ageVerified';
const VERIFIED_BUTTON_LABEL = [
  "I'm 18 or older ",
  String.fromCharCode(8212),
  " Let's go ",
  String.fromCharCode(8594),
].join('');
const UNDER_AGE_BUTTON_LABEL = "I'm under 18";
const NOTICE_LINE_ONE = 'By continuing you agree to our Terms & Privacy Policy.';
const NOTICE_LINE_TWO = "If you're in crisis, call or text";

type AgeGateScreenProps = {
  onVerified: () => void;
};

function AgeGateBackground({ children }: PropsWithChildren) {
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

export function AgeGateScreen({ onVerified }: AgeGateScreenProps) {
  const [isUnderAge, setIsUnderAge] = useState(false);

  const handleVerified = useCallback(async () => {
    await setSecureItem(AGE_VERIFIED_KEY, 'true');
    onVerified();
  }, [onVerified]);

  const handleUnderAge = useCallback(() => {
    setIsUnderAge(true);
    if (Platform.OS === 'android') {
      BackHandler.exitApp();
    }
  }, []);

  if (isUnderAge) {
    return (
      <AgeGateBackground>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.deniedContent}>
            <Text accessibilityRole="header" style={styles.deniedTitle}>
              You must be 18 or older to use Unfiltr.
            </Text>
            <Text style={styles.deniedText}>
              This experience contains emotional depth and mature themes.
            </Text>
          </View>
        </SafeAreaView>
      </AgeGateBackground>
    );
  }

  return (
    <AgeGateBackground>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <View accessibilityLabel="Onboarding step 1 of 2" style={styles.stepPill}>
            <View style={[styles.stepDot, styles.stepDotActive]} />
            <View style={styles.stepDot} />
            <Text style={styles.stepText}>Step 1 of 2</Text>
          </View>
          <Image
            accessibilityLabel="Unfiltr by Javier Triquetra logo"
            resizeMode="contain"
            source={require('../../../../assets/brand/unfiltr-triquetra-logo.png')}
            style={styles.logo}
          />
          <Text style={styles.brand}>Unfiltr by Javier</Text>
          <Text accessibilityRole="header" style={styles.title}>
            Your Journey Begins
          </Text>
          <Text style={styles.copy}>
            This experience explores emotional depth and mature themes. Please continue only if you
            are 18 years of age or older.
          </Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityLabel="I am 18 or older, continue"
              accessibilityRole="button"
              onPress={handleVerified}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <LinearGradient
                colors={['#7C3AED', '#A855F7', '#DB2777']}
                locations={[0, 0.5, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryButtonGradient}
              >
                <Text style={styles.primaryButtonText}>{VERIFIED_BUTTON_LABEL}</Text>
              </LinearGradient>
            </Pressable>
            <Pressable
              accessibilityLabel="I am under 18"
              accessibilityRole="button"
              onPress={handleUnderAge}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryButtonText}>{UNDER_AGE_BUTTON_LABEL}</Text>
            </Pressable>
          </View>
          <Text style={styles.notice}>
            {NOTICE_LINE_ONE}
            {'\n'}
            {NOTICE_LINE_TWO} <Text style={styles.noticeStrong}>988</Text>.
          </Text>
        </View>
      </SafeAreaView>
    </AgeGateBackground>
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
    paddingBottom: 34,
    paddingTop: 34,
  },
  stepPill: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: 'rgba(216,180,254,0.2)',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.045)',
    paddingHorizontal: 12,
  },
  stepDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  stepDotActive: {
    backgroundColor: '#D8B4FE',
  },
  stepText: {
    marginLeft: 2,
    color: 'rgba(255,255,255,0.46)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  logo: {
    width: 76,
    height: 76,
    marginBottom: 26,
    borderRadius: 17,
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
    maxWidth: 304,
    marginBottom: 42,
    color: 'rgba(255,255,255,0.43)',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 23,
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    maxWidth: 320,
    gap: 12,
  },
  primaryButton: {
    width: '100%',
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 20,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.46,
    shadowRadius: 34,
  },
  primaryButtonGradient: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 18,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
    textAlign: 'center',
  },
  secondaryButton: {
    width: '100%',
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 10,
    paddingVertical: 15,
  },
  secondaryButtonText: {
    color: 'rgba(255,255,255,0.32)',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.82,
  },
  notice: {
    maxWidth: 290,
    marginTop: 28,
    color: 'rgba(255,255,255,0.17)',
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 19,
    textAlign: 'center',
  },
  noticeStrong: {
    color: 'rgba(255,255,255,0.36)',
    fontWeight: '600',
  },
  deniedContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  deniedTitle: {
    marginBottom: 12,
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 30,
    textAlign: 'center',
  },
  deniedText: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 23,
    textAlign: 'center',
  },
});