import { LinearGradient } from 'expo-linear-gradient';
import { type PropsWithChildren } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export type AccountIntent = 'createAccount' | 'signIn';

type AccountChoiceScreenProps = {
  onChoose: (intent: AccountIntent) => void;
};

function AccountChoiceBackground({ children }: PropsWithChildren) {
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

/**
 * Shown once, after Privacy Consent and before the provider sign-in screen.
 * The choice made here (`onChoose`) is threaded through as `accountIntent`
 * and used by accountResolutionOperation.ts to decide what a `not_found`
 * diagnostic means: Sign In must show an explicit "no account found" state
 * rather than silently falling into new-account onboarding, while Create
 * Account is the only path allowed to start it. An existing provider
 * identity (diagnostic decision 'allow') always restores the existing
 * account regardless of which button was pressed here -- that check lives
 * in accountResolutionOperation.ts, not here.
 */
export function AccountChoiceScreen({ onChoose }: AccountChoiceScreenProps) {
  return (
    <AccountChoiceBackground>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Image
            accessibilityLabel="Unfiltr by Javier Triquetra logo"
            resizeMode="contain"
            source={require('../../../../assets/brand/unfiltr-triquetra-logo.png')}
            style={styles.logo}
          />
          <Text style={styles.brand}>Unfiltr by Javier</Text>
          <Text accessibilityRole="header" style={styles.title}>
            Welcome
          </Text>
          <Text style={styles.copy}>
            Do you already have an Unfiltr account, or are you starting fresh?
          </Text>

          <Pressable
            accessibilityLabel="Sign in to an existing account"
            accessibilityRole="button"
            onPress={() => onChoose('signIn')}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.primaryButtonText}>Sign In</Text>
            <Text style={styles.primaryButtonSubtext}>I already have an account</Text>
          </Pressable>

          <Pressable
            accessibilityLabel="Create a new account"
            accessibilityRole="button"
            onPress={() => onChoose('createAccount')}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryButtonText}>Create Account</Text>
            <Text style={styles.secondaryButtonSubtext}>I&apos;m new to Unfiltr</Text>
          </Pressable>

          <Text style={styles.note}>
            Signing in always restores your existing companion, journal, and chat history for the
            account you authenticate with.
          </Text>
        </View>
      </SafeAreaView>
    </AccountChoiceBackground>
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
    paddingBottom: 58,
    paddingTop: 22,
  },
  logo: {
    width: 70,
    height: 70,
    marginBottom: 22,
    borderRadius: 16,
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
    maxWidth: 318,
    marginBottom: 30,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 23,
    textAlign: 'center',
  },
  primaryButton: {
    width: '100%',
    maxWidth: 320,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    marginBottom: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.1,
    shadowRadius: 34,
  },
  primaryButtonText: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  primaryButtonSubtext: {
    color: 'rgba(0,0,0,0.55)',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  secondaryButton: {
    width: '100%',
    maxWidth: 320,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    marginBottom: 22,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  secondaryButtonSubtext: {
    color: 'rgba(255,255,255,0.56)',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  note: {
    maxWidth: 302,
    color: 'rgba(255,255,255,0.32)',
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 17,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.82,
  },
});
