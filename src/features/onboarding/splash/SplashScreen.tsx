import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { typography } from '@/theme';

const SPLASH_DURATION_MS = 850;
const FADE_DURATION_MS = 520;
const FADE_OUT_DURATION_MS = 180;

const STARS = [
  { top: '12%', left: '17%', size: 2, opacity: 0.5 },
  { top: '16%', left: '74%', size: 1.5, opacity: 0.46 },
  { top: '23%', left: '50%', size: 2, opacity: 0.54 },
  { top: '32%', left: '9%', size: 1.5, opacity: 0.34 },
  { top: '39%', left: '88%', size: 2.5, opacity: 0.48 },
  { top: '57%', left: '19%', size: 1, opacity: 0.3 },
  { top: '68%', left: '82%', size: 1.5, opacity: 0.36 },
  { top: '78%', left: '42%', size: 1, opacity: 0.26 },
] as const;

type SplashScreenProps = {
  holdForCapture?: boolean;
  onComplete: () => void;
};

export function SplashScreen({ holdForCapture = false, onComplete }: SplashScreenProps) {
  const { width } = useWindowDimensions();
  const [fade] = useState(() => new Animated.Value(0));
  const [scale] = useState(() => new Animated.Value(0.96));
  const [glowOpacity] = useState(() => new Animated.Value(0.08));
  const [reduceMotion, setReduceMotion] = useState(false);
  const [artworkReady, setArtworkReady] = useState(false);
  const [minimumTimeElapsed, setMinimumTimeElapsed] = useState(false);
  const completedRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      fade.setValue(1);
      scale.setValue(1);
      glowOpacity.setValue(0.08);
    } else {
      Animated.parallel([
        Animated.timing(fade, {
          toValue: 1,
          duration: FADE_DURATION_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: FADE_DURATION_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(glowOpacity, {
            toValue: 0.14,
            duration: 420,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0.08,
            duration: 360,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }

    const timer = setTimeout(() => setMinimumTimeElapsed(true), SPLASH_DURATION_MS);
    const artworkFallbackTimer = setTimeout(() => setArtworkReady(true), SPLASH_DURATION_MS);

    return () => {
      clearTimeout(timer);
      clearTimeout(artworkFallbackTimer);
    };
  }, [fade, glowOpacity, reduceMotion, scale]);

  useEffect(() => {
    if (holdForCapture) return;
    if (!artworkReady || !minimumTimeElapsed || completedRef.current) return;
    completedRef.current = true;
    if (reduceMotion) {
      onComplete();
      return;
    }
    let didComplete = false;
    const finish = () => {
      if (didComplete) return;
      didComplete = true;
      onComplete();
    };
    const completionFallbackTimer = setTimeout(finish, FADE_OUT_DURATION_MS + 80);

    Animated.timing(fade, {
      toValue: 0,
      duration: FADE_OUT_DURATION_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      clearTimeout(completionFallbackTimer);
      finish();
    });

    return () => clearTimeout(completionFallbackTimer);
  }, [artworkReady, fade, holdForCapture, minimumTimeElapsed, onComplete, reduceMotion]);

  const logoSize = Math.min(width * 0.6, 248);
  const pulseSize = logoSize * 0.78;
  const pulseOffset = (logoSize - pulseSize) / 2;

  return (
    <View style={styles.root}>
      {STARS.map((star, index) => (
        <View
          key={index}
          style={[
            styles.star,
            {
              top: star.top,
              left: star.left,
              width: star.size,
              height: star.size,
              opacity: star.opacity,
            },
          ]}
        />
      ))}
      <View style={styles.vignette} />
      <Animated.View style={[styles.content, { opacity: fade, transform: [{ scale }] }]}>
        <View style={[styles.logoWrap, { width: logoSize, height: logoSize }]}>
          <Animated.View
            style={[
              styles.softPulse,
              {
                width: pulseSize,
                height: pulseSize,
                top: pulseOffset,
                left: pulseOffset,
                opacity: glowOpacity,
              },
            ]}
          />
          <Image
            source={require('../../../../assets/brand/unfiltr-triquetra-logo.png')}
            resizeMode="contain"
            accessibilityLabel="Unfiltr by Javier Triquetra logo"
            onLoad={() => setArtworkReady(true)}
            style={styles.logo}
          />
        </View>
        <Text style={styles.loading}>Loading Unfiltr...</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#03020C',
  },
  vignette: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.025)',
  },
  star: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.88)',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 96,
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  softPulse: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(168,85,247,0.1)',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  loading: {
    ...typography.body,
    marginTop: 4,
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.2,
  },
});
