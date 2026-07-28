import { Pressable, StyleSheet, View } from 'react-native';

type BackButtonProps = {
  accessibilityLabel?: string;
  onPress: () => void;
};

export function BackButton({ accessibilityLabel = 'Go back', onPress }: BackButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <View style={styles.chevron} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: 'rgba(12,4,28,0.72)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  chevron: {
    borderBottomColor: '#FFFFFF',
    borderBottomWidth: 2.5,
    borderLeftColor: '#FFFFFF',
    borderLeftWidth: 2.5,
    height: 11,
    marginLeft: 4,
    transform: [{ rotate: '45deg' }],
    width: 11,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.96 }],
  },
});
