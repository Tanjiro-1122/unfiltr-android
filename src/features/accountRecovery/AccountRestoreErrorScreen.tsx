import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type AccountRestoreErrorScreenProps = {
  busy?: boolean;
  onRetry: () => void;
  onSignOut: () => void;
};

export function AccountRestoreErrorScreen({
  busy = false,
  onRetry,
  onSignOut,
}: AccountRestoreErrorScreenProps) {
  return (
    <LinearGradient
      colors={['#2D0A6E', '#120428', '#06020F', '#020008']}
      locations={[0, 0.39, 0.74, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.root}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Text accessibilityRole="header" style={styles.title}>
            {"We couldn't restore your account right now."}
          </Text>
          <Text style={styles.copy}>
            Please try again. If this keeps happening, sign out and sign in again.
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy }}
            disabled={busy}
            onPress={onRetry}
            style={({ pressed }) => [
              styles.primaryButton,
              busy && styles.disabledButton,
              pressed && styles.pressed,
            ]}
          >
            {busy ? <ActivityIndicator color="#FFFFFF" size="small" /> : null}
            <Text style={styles.primaryButtonText}>{busy ? 'Trying...' : 'Retry'}</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onSignOut}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryButtonText}>Sign Out</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#06020F',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 28,
  },
  title: {
    maxWidth: 340,
    marginBottom: 10,
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 34,
    textAlign: 'center',
  },
  copy: {
    maxWidth: 330,
    marginBottom: 24,
    color: 'rgba(255,255,255,0.66)',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  primaryButton: {
    width: '100%',
    maxWidth: 340,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 18,
    backgroundColor: '#8B5CF6',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 21,
  },
  secondaryButton: {
    width: '100%',
    maxWidth: 340,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 16,
  },
  secondaryButtonText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  disabledButton: {
    opacity: 0.72,
  },
  pressed: {
    opacity: 0.82,
  },
});
