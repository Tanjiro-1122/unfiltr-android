import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/BackButton';
import { getCompanionMeta, type CompanionId } from '@/features/onboarding/companionQuiz';
import { verifyAdminAccess } from '@/lib/admin/adminAccess';
import { apiClient } from '@/lib/api';
import { getBuildLabel } from '@/lib/build/buildInfo';
import { verifyFamilyAccess } from '@/lib/family/familyAccess';
import { resolvePremiumAccess } from '@/lib/purchases/access';
import { refreshRestoration } from '@/lib/restoration/restorationStore';
import {
  deleteAppStorageItem,
  getAppStorageItem,
  setAppStorageItem,
} from '@/lib/storage/appStorage';

type SettingsScreenProps = {
  onBack: () => void;
  onSignOut?: () => void;
  onOpenNotifications: () => void;
  onOpenPremium: () => void;
};

type RelationshipMode = 'friend' | 'coach' | 'companion';

type ProfileSyncResponse = {
  profile?: {
    companion_name?: string | null;
    preferences?: {
      proactiveGreeting?: boolean;
      relationshipMode?: RelationshipMode;
      voicePersonality?: string;
    } | null;
  } | null;
};

const VOICES = ['warm', 'soft', 'playful', 'calm'];
const RELATIONSHIP_MODES: RelationshipMode[] = ['friend', 'coach', 'companion'];
const PRIVACY_POLICY_URL = 'https://unfiltrbyjavier2.vercel.app/PrivacyPolicy';
const TERMS_OF_SERVICE_URL = 'https://unfiltrbyjavier2.vercel.app/TermsOfUse';

export function SettingsScreen({
  onBack,
  onSignOut,
  onOpenNotifications,
  onOpenPremium,
}: SettingsScreenProps) {
  const insets = useSafeAreaInsets();
  const [nickname, setNickname] = useState('');
  const [relationshipMode, setRelationshipMode] = useState<RelationshipMode>('friend');
  const [voicePersonality, setVoicePersonality] = useState('warm');
  const [proactiveGreeting, setProactiveGreeting] = useState(true);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [pinModal, setPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [companionName, setCompanionName] = useState('Luna');
  const [isPremium, setIsPremium] = useState(false);
  const [status, setStatus] = useState('');
  const [accessModal, setAccessModal] = useState<'admin' | 'family' | null>(null);
  const [accessCode, setAccessCode] = useState('');
  const [accessError, setAccessError] = useState('');
  const [verifyingAccess, setVerifyingAccess] = useState(false);
  const familyTapCount = useRef(0);
  const adminTapCount = useRef(0);
  const familyTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const adminTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;
    void Promise.all([
      getAppStorageItem('unfiltr_companion_nickname'),
      getAppStorageItem('unfiltr_relationship_mode'),
      getAppStorageItem('unfiltr_voice_personality'),
      getAppStorageItem('unfiltr_proactive_greeting'),
      getAppStorageItem('unfiltr_pin_hash'),
      getAppStorageItem('unfiltr_companion_id'),
      getAppStorageItem('unfiltr_is_premium'),
    ]).then(async ([nick, mode, voice, greeting, pin, companionId, premium]) => {
      const meta = getCompanionMeta(resolveCompanionId(companionId));
      let resolvedNickname = nick ?? '';
      let resolvedMode = resolveRelationshipMode(mode);
      let resolvedVoice = voice || 'warm';
      let resolvedGreeting = greeting !== 'false';
      try {
        const remote = await apiClient.post<ProfileSyncResponse>('/api/profile', {
          action: 'get',
        });
        const preferences = remote.profile?.preferences;
        resolvedNickname = remote.profile?.companion_name?.trim() || resolvedNickname;
        resolvedMode = resolveRelationshipMode(preferences?.relationshipMode || resolvedMode);
        resolvedVoice = VOICES.includes(preferences?.voicePersonality || '')
          ? preferences!.voicePersonality!
          : resolvedVoice;
        resolvedGreeting =
          typeof preferences?.proactiveGreeting === 'boolean'
            ? preferences.proactiveGreeting
            : resolvedGreeting;
        await Promise.all([
          setAppStorageItem('unfiltr_companion_nickname', resolvedNickname),
          setAppStorageItem('unfiltr_relationship_mode', resolvedMode),
          setAppStorageItem('unfiltr_voice_personality', resolvedVoice),
          setAppStorageItem('unfiltr_proactive_greeting', String(resolvedGreeting)),
        ]);
      } catch {
        // Keep local settings when offline.
      }
      if (!mounted) return;
      setNickname(resolvedNickname);
      setCompanionName(resolvedNickname || meta.name);
      setRelationshipMode(resolvedMode);
      setVoicePersonality(resolvedVoice);
      setProactiveGreeting(resolvedGreeting);
      setPinEnabled(!!pin);
      setIsPremium(premium === 'true');
      void deleteAppStorageItem('unfiltr_admin_unlocked');
    });
    return () => {
      mounted = false;
    };
  }, []);

  async function saveNickname() {
    const trimmed = nickname.trim();
    if (!trimmed) return;
    await setAppStorageItem('unfiltr_companion_nickname', trimmed);
    setCompanionName(trimmed);
    const synced = await syncProfileSettings({ companion_name: trimmed });
    setStatus(synced ? 'Nickname saved across your devices.' : 'Nickname saved on this device.');
  }

  async function saveRelationshipMode(mode: RelationshipMode) {
    setRelationshipMode(mode);
    await setAppStorageItem('unfiltr_relationship_mode', mode);
    const synced = await syncProfileSettings({ preferences: { relationshipMode: mode } });
    setStatus(
      synced
        ? 'Connection style saved across your devices.'
        : 'Connection style saved on this device.',
    );
  }

  async function saveVoice(voice: string) {
    setVoicePersonality(voice);
    await setAppStorageItem('unfiltr_voice_personality', voice);
    const synced = await syncProfileSettings({ preferences: { voicePersonality: voice } });
    setStatus(
      synced
        ? 'Voice preference saved across your devices.'
        : 'Voice preference saved on this device.',
    );
  }

  async function toggleStored(key: string, value: boolean, setter: (value: boolean) => void) {
    setter(value);
    await setAppStorageItem(key, String(value));
    if (key === 'unfiltr_proactive_greeting') {
      const synced = await syncProfileSettings({ preferences: { proactiveGreeting: value } });
      setStatus(
        synced
          ? 'Greeting preference saved across your devices.'
          : 'Greeting preference saved on this device.',
      );
    }
  }

  async function syncProfileSettings(profile: {
    companion_name?: string;
    preferences?: {
      proactiveGreeting?: boolean;
      relationshipMode?: RelationshipMode;
      voicePersonality?: string;
    };
  }) {
    try {
      await apiClient.post('/api/profile', { action: 'update', profile });
      return true;
    } catch {
      return false;
    }
  }

  async function clearChat() {
    await Promise.all([
      deleteAppStorageItem('unfiltr_chat_history'),
      deleteAppStorageItem('unfiltr_chat_messages'),
      deleteAppStorageItem('unfiltr_current_chat_db_id'),
    ]);
    setStatus('Chat history cleared on this device.');
  }

  async function clearMemory() {
    await Promise.all([
      deleteAppStorageItem('unfiltr_memory'),
      deleteAppStorageItem('unfiltr_profile_snapshot'),
      deleteAppStorageItem('unfiltr_memory_summary'),
    ]);
    setStatus('Memory snapshot cleared on this device.');
  }

  async function savePin() {
    if (pinInput.length !== 4) return;
    await setAppStorageItem('unfiltr_pin_hash', pinInput);
    setPinEnabled(true);
    setPinInput('');
    setPinModal(false);
    setStatus('PIN saved.');
  }

  function registerHiddenTap(kind: 'admin' | 'family') {
    const counter = kind === 'admin' ? adminTapCount : familyTapCount;
    const timer = kind === 'admin' ? adminTapTimer : familyTapTimer;
    counter.current += 1;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      counter.current = 0;
    }, 3000);
    if (counter.current >= 5) {
      if (timer.current) clearTimeout(timer.current);
      counter.current = 0;
      if (kind === 'admin') {
        setAccessCode('');
        setAccessError('');
        setAccessModal(kind);
        return;
      }
      setAccessCode('');
      setAccessError('');
      setAccessModal(kind);
    }
  }

  async function verifySpecialAccess() {
    const code = accessCode.trim();
    if (!code || !accessModal) return;
    setVerifyingAccess(true);
    setAccessError('');
    try {
      if (accessModal === 'family') {
        const result = await verifyFamilyAccess(code);
        if (!result.ok) {
          setAccessError(result.message);
          return;
        }
        await Promise.all([
          setAppStorageItem('unfiltr_family_unlock', 'true'),
          setAppStorageItem('unfiltr_family_unlimited', 'true'),
          setAppStorageItem('unfiltr_unlimited', 'true'),
          setAppStorageItem('unfiltr_is_premium', 'true'),
          setAppStorageItem('unfiltr_is_pro', 'true'),
          setAppStorageItem('unfiltr_is_annual', 'true'),
        ]);
        setIsPremium(true);
        setAccessModal(null);
        setAccessCode('');
        await refreshRestoration();
        await resolvePremiumAccess({ refreshRevenueCat: false });
        setStatus('Family access activated across your devices.');
        return;
      }

      const result = await verifyAdminAccess(code);
      if (!result.ok) {
        setAccessError(result.message);
        return;
      }
      setAccessModal(null);
      setAccessCode('');
      setStatus('Admin access confirmed. Open Options to enter the Admin Dashboard.');
    } catch {
      // verifyFamilyAccess/verifyAdminAccess both catch their own network
      // and ApiError failures and return a result object -- this only
      // catches something unexpected in the surrounding state updates.
      setAccessError('Could not reach the access server. Check the API URL and try again.');
    } finally {
      setVerifyingAccess(false);
    }
  }

  async function openExternalUrl(url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      setStatus('Could not open that link on this device.');
    }
  }

  async function removePin() {
    await deleteAppStorageItem('unfiltr_pin_hash');
    setPinEnabled(false);
    setPinModal(false);
    setStatus('PIN removed.');
  }

  return (
    <LinearGradient colors={['#2D0A6E', '#120428', '#05020D']} style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: Math.max(insets.bottom + 36, 64) },
          ]}
        >
          <View style={styles.header}>
            <BackButton accessibilityLabel="Back to home" onPress={onBack} />
            <View style={styles.titleWrap}>
              <Text style={styles.title}>Settings</Text>
              <Text style={styles.subtitle}>{companionName} and your private app space</Text>
            </View>
          </View>

          <Section title="Companion">
            <Text style={styles.label}>Nickname</Text>
            <View style={styles.inputRow}>
              <TextInput
                accessibilityLabel="Companion nickname"
                onChangeText={setNickname}
                placeholder="Companion nickname"
                placeholderTextColor="rgba(255,255,255,0.35)"
                style={styles.input}
                value={nickname}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => void saveNickname()}
                style={styles.smallButton}
              >
                <Text style={styles.smallButtonText}>Save</Text>
              </Pressable>
            </View>
            <Text style={styles.label}>Connection style</Text>
            <View style={styles.segmentRow}>
              {RELATIONSHIP_MODES.map((mode) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: relationshipMode === mode }}
                  key={mode}
                  onPress={() => void saveRelationshipMode(mode)}
                  style={[styles.segment, relationshipMode === mode && styles.segmentActive]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      relationshipMode === mode && styles.segmentTextActive,
                    ]}
                  >
                    {capitalize(mode)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Section>

          <Section title="Voice">
            <View style={styles.segmentRow}>
              {VOICES.map((voice) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: voicePersonality === voice }}
                  key={voice}
                  onPress={() => void saveVoice(voice)}
                  style={[styles.segment, voicePersonality === voice && styles.segmentActive]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      voicePersonality === voice && styles.segmentTextActive,
                    ]}
                  >
                    {capitalize(voice)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Section>

          <Section title="Privacy">
            <ToggleRow
              description="Allow your companion to greet you proactively."
              label="Proactive greeting"
              onValueChange={(value) =>
                void toggleStored('unfiltr_proactive_greeting', value, setProactiveGreeting)
              }
              value={proactiveGreeting}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => setPinModal(true)}
              style={styles.rowButton}
            >
              <Text style={styles.rowTitle}>
                {pinEnabled ? 'Change or remove PIN' : 'Set journal and chat PIN'}
              </Text>
              <Text style={styles.rowDesc}>PIN remains optional in Settings.</Text>
            </Pressable>
          </Section>

          <Section title="Account">
            <Pressable
              accessibilityRole="button"
              onPress={onOpenNotifications}
              style={styles.rowButton}
            >
              <Text style={styles.rowTitle}>Notifications</Text>
              <Text style={styles.rowDesc}>
                Check-ins, companion nudges, and journal reminders.
              </Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onOpenPremium} style={styles.rowButton}>
              <Text style={styles.rowTitle}>{isPremium ? 'Premium active' : 'Premium'}</Text>
              <Text style={styles.rowDesc}>RevenueCat subscriptions and restore flow.</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setAccessCode('');
                setAccessError('');
                setAccessModal('family');
              }}
              style={styles.rowButton}
            >
              <Text style={styles.rowTitle}>Family access</Text>
              <Text style={styles.rowDesc}>Activate an owner-issued family code.</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setAccessCode('');
                setAccessError('');
                setAccessModal('admin');
              }}
              style={styles.rowButton}
            >
              <Text style={styles.rowTitle}>Admin Dashboard</Text>
              <Text style={styles.rowDesc}>Requires signed-in owner access.</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onSignOut} style={styles.rowButton}>
              <Text style={styles.rowTitle}>Sign out</Text>
              <Text style={styles.rowDesc}>
                Clears this account session and its restored local cache on this device.
              </Text>
            </Pressable>
          </Section>

          <Section title="Data">
            <Pressable
              accessibilityRole="button"
              onPress={() => void clearChat()}
              style={styles.rowButton}
            >
              <Text style={styles.rowTitle}>Clear chat history</Text>
              <Text style={styles.rowDesc}>Removes local chat history from this device.</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => void clearMemory()}
              style={styles.rowButton}
            >
              <Text style={styles.rowTitle}>Delete memory snapshot</Text>
              <Text style={styles.rowDesc}>Clears local memory/profile snapshot data.</Text>
            </Pressable>
          </Section>

          <Section title="Legal">
            <Pressable
              accessibilityRole="link"
              onPress={() => void openExternalUrl(PRIVACY_POLICY_URL)}
              style={styles.rowButton}
            >
              <Text style={styles.rowTitle}>Privacy Policy</Text>
              <Text style={styles.rowDesc}>Open the current privacy policy.</Text>
            </Pressable>
            <Pressable
              accessibilityRole="link"
              onPress={() => void openExternalUrl(TERMS_OF_SERVICE_URL)}
              style={styles.rowButton}
            >
              <Text style={styles.rowTitle}>Terms of Service</Text>
              <Text style={styles.rowDesc}>Open subscription and app terms.</Text>
            </Pressable>
          </Section>

          <View style={styles.hiddenAccessFooter}>
            <Pressable
              accessibilityLabel="Unfiltr family access"
              accessibilityRole="button"
              onPress={() => registerHiddenTap('family')}
              style={styles.logoTapTarget}
            >
              <Image
                source={require('../../../assets/brand/unfiltr-triquetra-logo.png')}
                style={styles.footerLogo}
              />
            </Pressable>
            <Pressable
              accessibilityLabel="App version"
              accessibilityRole="button"
              onPress={() => registerHiddenTap('admin')}
            >
              <Text style={styles.versionText}>Unfiltr Native · {getBuildLabel()}</Text>
            </Pressable>
          </View>

          {status ? <Text style={styles.status}>{status}</Text> : null}
        </ScrollView>
      </SafeAreaView>

      <Modal animationType="fade" transparent visible={pinModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.pinPanel}>
            <Text style={styles.pinTitle}>{pinEnabled ? 'Update PIN' : 'Set Your PIN'}</Text>
            <Text style={styles.pinCopy}>Choose a 4-digit code.</Text>
            <TextInput
              accessibilityLabel="PIN"
              keyboardType="number-pad"
              maxLength={4}
              onChangeText={setPinInput}
              secureTextEntry
              style={styles.pinInput}
              value={pinInput}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => void savePin()}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryText}>Save PIN</Text>
            </Pressable>
            {pinEnabled ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void removePin()}
                style={styles.removePinButton}
              >
                <Text style={styles.removePinText}>Remove PIN</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={() => setPinModal(false)}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" transparent visible={accessModal !== null}>
        <View style={styles.modalBackdrop}>
          <View style={styles.pinPanel}>
            <Text style={styles.pinTitle}>
              {accessModal === 'admin' ? 'Admin Access' : 'Family Access'}
            </Text>
            <Text style={styles.pinCopy}>Enter your private access code.</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setAccessCode}
              onSubmitEditing={() => void verifySpecialAccess()}
              placeholder="Access code"
              placeholderTextColor="rgba(255,255,255,0.35)"
              secureTextEntry
              style={[styles.pinInput, styles.accessInput]}
              value={accessCode}
            />
            {accessError ? <Text style={styles.accessError}>{accessError}</Text> : null}
            <Pressable
              accessibilityRole="button"
              disabled={verifyingAccess || !accessCode.trim()}
              onPress={() => void verifySpecialAccess()}
              style={[
                styles.primaryButton,
                (verifyingAccess || !accessCode.trim()) && styles.disabledButton,
              ]}
            >
              <Text style={styles.primaryText}>{verifyingAccess ? 'Checking…' : 'Continue'}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setAccessModal(null);
                setAccessCode('');
                setAccessError('');
              }}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

function Section({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ToggleRow({
  description,
  label,
  onValueChange,
  value,
}: {
  description: string;
  label: string;
  onValueChange: (value: boolean) => void;
  value: boolean;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleText}>
        <Text style={styles.rowTitle}>{label}</Text>
        <Text style={styles.rowDesc}>{description}</Text>
      </View>
      <Switch
        onValueChange={onValueChange}
        thumbColor="#FFFFFF"
        trackColor={{ false: 'rgba(255,255,255,0.18)', true: '#8B5CF6' }}
        value={value}
      />
    </View>
  );
}

function resolveCompanionId(value: string | null): CompanionId {
  const ids: CompanionId[] = [
    'ash',
    'echo',
    'juan',
    'kai',
    'luna',
    'nova',
    'river',
    'ryuu',
    'sage',
    'sakura',
    'soleil',
    'zara',
  ];
  return ids.includes(value as CompanionId) ? (value as CompanionId) : 'luna';
}

function resolveRelationshipMode(value: string | null): RelationshipMode {
  return RELATIONSHIP_MODES.includes(value as RelationshipMode)
    ? (value as RelationshipMode)
    : 'friend';
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  backText: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  cancelButton: { alignItems: 'center', padding: 14 },
  cancelText: { color: 'rgba(255,255,255,0.58)', fontSize: 14, fontWeight: '800' },
  header: { alignItems: 'center', flexDirection: 'row', gap: 16, marginBottom: 18 },
  input: { color: '#FFFFFF', flex: 1, fontSize: 15, paddingHorizontal: 14 },
  inputRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 18,
    minHeight: 52,
  },
  label: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.78)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  pinCopy: { color: 'rgba(255,255,255,0.52)', fontSize: 13, marginBottom: 18, textAlign: 'center' },
  pinInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(168,85,247,0.4)',
    borderRadius: 16,
    borderWidth: 1,
    color: '#FFFFFF',
    fontSize: 24,
    letterSpacing: 10,
    marginBottom: 14,
    padding: 14,
    textAlign: 'center',
  },
  pinPanel: {
    backgroundColor: '#16072D',
    borderColor: 'rgba(168,85,247,0.35)',
    borderRadius: 24,
    borderWidth: 1,
    maxWidth: 340,
    padding: 22,
    width: '100%',
  },
  pinTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 6,
    textAlign: 'center',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#8B5CF6',
    borderRadius: 16,
    padding: 14,
  },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  removePinButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(251,113,133,0.12)',
    borderRadius: 16,
    marginTop: 10,
    padding: 14,
  },
  removePinText: { color: '#FB7185', fontSize: 14, fontWeight: '900' },
  accessError: { color: '#FB7185', fontSize: 12, marginBottom: 12, textAlign: 'center' },
  accessInput: { letterSpacing: 0 },
  disabledButton: { opacity: 0.45 },
  footerLogo: { height: 54, resizeMode: 'contain', width: 54 },
  hiddenAccessFooter: { alignItems: 'center', marginTop: 6, paddingVertical: 20 },
  logoTapTarget: { alignItems: 'center', justifyContent: 'center', padding: 8 },
  versionText: { color: 'rgba(255,255,255,0.28)', fontSize: 11, padding: 8 },
  root: { flex: 1 },
  rowButton: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
    padding: 15,
  },
  rowDesc: { color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 18, marginTop: 3 },
  rowTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 52 },
  section: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 14,
    padding: 16,
  },
  sectionTitle: {
    color: '#C084FC',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 14,
    textTransform: 'uppercase',
  },
  segment: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 999,
    flex: 1,
    paddingVertical: 10,
  },
  segmentActive: { backgroundColor: 'rgba(168,85,247,0.28)' },
  segmentRow: { flexDirection: 'row', gap: 8 },
  segmentText: { color: 'rgba(255,255,255,0.52)', fontSize: 12, fontWeight: '800' },
  segmentTextActive: { color: '#FFFFFF' },
  smallButton: {
    backgroundColor: 'rgba(168,85,247,0.22)',
    borderRadius: 14,
    marginRight: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  smallButtonText: { color: '#E9D5FF', fontSize: 12, fontWeight: '900' },
  status: { color: '#86EFAC', fontSize: 13, fontWeight: '800', marginTop: 4, textAlign: 'center' },
  subtitle: { color: 'rgba(255,255,255,0.56)', fontSize: 12 },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  titleWrap: { flex: 1 },
  toggleRow: { alignItems: 'center', flexDirection: 'row', gap: 12, marginBottom: 10 },
  toggleText: { flex: 1 },
});
