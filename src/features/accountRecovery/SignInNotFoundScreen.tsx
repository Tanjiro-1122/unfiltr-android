import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type SignInNotFoundScreenProps = {
  onCreateAccountInstead: () => void;
  onTryDifferentAccount: () => void;
};

/**
 * Shown when the user chose Sign In (accountChoice) but the authenticated
 * provider identity has no existing Unfiltr account -- the diagnostic
 * classified as 'not_found' while intent === 'signIn'. Sign In must never
 * silently fall into new-account onboarding (see
 * accountResolutionOperation.ts), so this is the only way out of that
 * state: either switch intent to Create Account (same provider identity,
 * runs the full new-account onboarding) or sign out and try a different
 * provider account.
 */
export function SignInNotFoundScreen({
  onCreateAccountInstead,
  onTryDifferentAccount,
}: SignInNotFoundScreenProps) {
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
            No account found for this sign-in.
          </Text>
          <Text style={styles.copy}>
            We couldn&apos;t find an existing Unfiltr account for the account you just signed in
            with. If you meant to create a new account, continue below. Otherwise, try a
            different account.
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={onCreateAccountInstead}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.primaryButtonText}>Create Account Instead</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={onTryDifferentAccount}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryButtonText}>Try a Different Account</Text>
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
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 32,
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: '#8B5CF6',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  secondaryButton: {
    width: '100%',
    maxWidth: 340,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 16,
  },
  secondaryButtonText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.82,
  },
});
