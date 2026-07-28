import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native';

const DOT_COUNT = 3;

export function AssistantTypingBubble() {
  const [values] = useState(() => [...Array(DOT_COUNT)].map(() => new Animated.Value(0)));
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      values.forEach((value) => value.setValue(0));
      return undefined;
    }

    const loops = values.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 120),
          Animated.timing(value, {
            duration: 220,
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            duration: 220,
            toValue: 0,
            useNativeDriver: true,
          }),
          Animated.delay((DOT_COUNT - index) * 120),
        ]),
      ),
    );

    loops.forEach((loop) => loop.start());
    return () => {
      loops.forEach((loop) => loop.stop());
      values.forEach((value) => value.stopAnimation());
    };
  }, [reduceMotion, values]);

  return (
    <View accessibilityLabel="Assistant is typing" accessibilityRole="progressbar" style={styles.row}>
      {values.map((value, index) => (
        <Animated.View
          key={index}
          style={[
            styles.dot,
            {
              opacity: reduceMotion ? 0.72 : value.interpolate({ inputRange: [0, 1], outputRange: [0.42, 1] }),
              transform: [
                {
                  translateY: reduceMotion
                    ? 0
                    : value.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    height: 7,
    width: 7,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    minHeight: 24,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
});
