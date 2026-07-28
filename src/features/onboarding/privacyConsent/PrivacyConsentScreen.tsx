import { LinearGradient } from 'expo-linear-gradient';
import { type PropsWithChildren, useCallback, useState } from 'react';
import {
  BackHandler,
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { setSecureItem } from '@/lib/storage';

export const PRIVACY_CONSENT_VERSION = '2026-07-14.v1';

const PRIVACY_POLICY_URL = 'https://unfiltrbyjavier2.vercel.app/PrivacyPolicy';
const TERMS_OF_SERVICE_URL = 'https://unfiltrbyjavier2.vercel.app/TermsOfUse';
const CONTINUE_LABEL = ['Continue ', String.fromCharCode(8594)].join('');

type PrivacyConsentScreenProps = {
  onAccepted: () => void;
};

function ConsentBackground({ children }: PropsWithChildren) {
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

export function PrivacyConsentScreen({ onAccepted }: PrivacyConsentScreenProps) {
  const [hasConsented, setHasConsented] = useState(false);
  const [hasDeclined, setHasDeclined] = useState(false);

  const handleOpenLink = useCallback((url: string) => {
    void Linking.openURL(url);
  }, []);

  const handleAccept = useCallback(async () => {
    if (!hasConsented) return;
    await Promise.all([
      setSecureItem('onboarding.privacyConsentAccepted', 'true'),
      setSecureItem('onboarding.privacyConsentVersion', PRIVACY_CONSENT_VERSION),
    ]);
    onAccepted();
  }, [hasConsented, onAccepted]);

  const handleDecline = useCallback(() => {
    setHasDeclined(true);
    if (Platform.OS === 'android') {
      BackHandler.exitApp();
    }
  }, []);

  if (hasDeclined) {
    return (
      <ConsentBackground>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.deniedContent}>
            <Text accessibilityRole="header" style={styles.deniedTitle}>
              Consent is required to use Unfiltr.
            </Text>
            <Text style={styles.deniedText}>
              Because Unfiltr uses sensitive journal and conversation content to personalize AI
              responses, we cannot continue without your consent.
            </Text>
          </View>
        </SafeAreaView>
      </ConsentBackground>
    );
  }

  return (
    <ConsentBackground>
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
            Privacy Consent
          </Text>
          <Text style={styles.copy}>
            Unfiltr may process sensitive journal entries, chat messages, memories, and emotional
            reflections to provide personalized AI responses.
          </Text>

          <View style={styles.disclosure}>
            <Text style={styles.disclosureTitle}>What this means</Text>
            <Text style={styles.disclosureText}>
              Your private content can be used to remember context, shape companion replies, and
              make the experience feel personal. We do not sell your personal data.
            </Text>
          </View>

          <View style={styles.links}>
            <Pressable
              accessibilityLabel="Open Privacy Policy"
              accessibilityRole="link"
              onPress={() => handleOpenLink(PRIVACY_POLICY_URL)}
              style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
            >
              <Text style={styles.linkText}>Privacy Policy</Text>
              <Text style={styles.linkArrow}>{String.fromCharCode(8599)}</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Open Terms of Service"
              accessibilityRole="link"
              onPress={() => handleOpenLink(TERMS_OF_SERVICE_URL)}
              style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
            >
              <Text style={styles.linkText}>Terms of Service</Text>
              <Text style={styles.linkArrow}>{String.fromCharCode(8599)}</Text>
            </Pressable>
          </View>

          <Pressable
            accessibilityLabel="Consent to privacy and AI processing"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: hasConsented }}
            onPress={() => setHasConsented((value) => !value)}
            style={({ pressed }) => [styles.consentRow, pressed && styles.pressed]}
          >
            <View style={[styles.checkbox, hasConsented && styles.checkboxChecked]}>
              {hasConsented ? (
                <Text style={styles.checkmark}>{String.fromCharCode(10003)}</Text>
              ) : null}
            </View>
            <Text style={[styles.consentText, hasConsented && styles.consentTextActive]}>
              I understand and consent to Unfiltr processing sensitive journal and conversation
              content to personalize AI responses.
            </Text>
          </Pressable>

          <View style={styles.actions}>
            <Pressable
              accessibilityLabel="Continue after consenting"
              accessibilityRole="button"
              accessibilityState={{ disabled: !hasConsented }}
              disabled={!hasConsented}
              onPress={handleAccept}
              style={({ pressed }) => [
                styles.primaryButton,
                !hasConsented && styles.primaryButtonDisabled,
                pressed && styles.pressed,
              ]}
            >
              <LinearGradient
                colors={
                  hasConsented
                    ? ['#7C3AED', '#A855F7', '#DB2777']
                    : ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.08)']
                }
                locations={hasConsented ? [0, 0.5, 1] : [0, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryButtonGradient}
              >
                <Text
                  style={[styles.primaryButtonText, !hasConsented && styles.disabledButtonText]}
                >
                  {CONTINUE_LABEL}
                </Text>
              </LinearGradient>
            </Pressable>
            <Pressable
              accessibilityLabel="Decline privacy consent"
              accessibilityRole="button"
              onPress={handleDecline}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryButtonText}>Decline</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </ConsentBackground>
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
    paddingBottom: 28,
    paddingTop: 38,
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
    marginBottom: 22,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 23,
    textAlign: 'center',
  },
  disclosure: {
    width: '100%',
    maxWidth: 320,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.18)',
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.045)',
    padding: 16,
  },
  disclosureTitle: {
    marginBottom: 6,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  disclosureText: {
    color: 'rgba(255,255,255,0.56)',
    fontSize: 12.5,
    fontWeight: '400',
    lineHeight: 19,
  },
  links: {
    width: '100%',
    maxWidth: 320,
    gap: 8,
    marginBottom: 12,
  },
  linkRow: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.25)',
    borderRadius: 14,
    backgroundColor: 'rgba(139,92,246,0.12)',
    paddingHorizontal: 14,
  },
  linkText: {
    color: '#D8B4FE',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  linkArrow: {
    color: '#A78BFA',
    fontSize: 14,
    fontWeight: '600',
  },
  consentRow: {
    width: '100%',
    maxWidth: 320,
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.24)',
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  checkboxChecked: {
    borderColor: 'transparent',
    backgroundColor: '#A855F7',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 18,
  },
  consentText: {
    flex: 1,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12.5,
    fontWeight: '400',
    lineHeight: 18,
  },
  consentTextActive: {
    color: '#FFFFFF',
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
  primaryButtonDisabled: {
    shadowOpacity: 0,
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
  disabledButtonText: {
    color: 'rgba(255,255,255,0.28)',
  },
  secondaryButton: {
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
