import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AdminDashboardScreen } from '@/features/admin';
import { InternalDiagnosticsScreen } from '@/features/diagnostics';
import { clearAdminAccess, hasActiveAdminAccess, verifyAdminAccess } from '@/lib/admin/adminAccess';

import { BadgesScreen } from './BadgesScreen';
import { CustomizeCompanionScreen } from './CustomizeCompanionScreen';
import { GamesScreen } from './GamesScreen';
import { HistoryScreen } from './HistoryScreen';
import { ImmersiveWorldsScreen } from './ImmersiveWorldsScreen';
import { MoodScreen } from './MoodScreen';
import { OptionsHubScreen } from './OptionsHubScreen';
import { SavedConversationsScreen } from './SavedConversationsScreen';
import { SettingsScreen as OriginalSettingsScreen } from './SettingsScreen';
import { SleepStoriesScreen } from './SleepStoriesScreen';
import { TimeCapsuleScreen } from './TimeCapsuleScreen';
import { TopicsScreen } from './TopicsScreen';

type RepairedSettingsScreenProps = {
  onBack: () => void;
  onSignOut?: () => void;
  onOpenNotifications: () => void;
  onOpenPremium: () => void;
  // 'options' lands on the Customize/History/Worlds/... grid (Chat's own
  // gear icon); 'account' skips straight to account/privacy settings
  // (Settings entered from Home) -- see app/index.tsx. Defaults to
  // 'options' to preserve existing behavior for any caller that doesn't
  // pass it.
  initialView?: 'account' | 'options';
};
type SettingsView =
  | 'options'
  | 'account'
  | 'badges'
  | 'customize'
  | 'diagnostics'
  | 'games'
  | 'history'
  | 'mood'
  | 'saved'
  | 'sleep'
  | 'time-capsule'
  | 'topics'
  | 'worlds';

export function SettingsScreen(props: RepairedSettingsScreenProps) {
  const initialView = props.initialView ?? 'options';
  const [adminOpen, setAdminOpen] = useState(false);
  const [view, setView] = useState<SettingsView>(initialView);
  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const [ownerCode, setOwnerCode] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;
    void hasActiveAdminAccess().then((active) => {
      if (mounted && active) setAdminOpen(true);
    });
    return () => {
      mounted = false;
      if (tapTimer.current) clearTimeout(tapTimer.current);
    };
  }, []);

  function registerOwnerTap() {
    tapCount.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => {
      tapCount.current = 0;
    }, 3000);
    if (tapCount.current < 5) return;
    tapCount.current = 0;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    setOwnerCode('');
    setError('');
    setCodeModalOpen(true);
  }

  async function unlockAdmin() {
    const code = ownerCode.trim();
    if (!code || verifying) return;
    setVerifying(true);
    setError('');
    const result = await verifyAdminAccess(code);
    setVerifying(false);
    setOwnerCode('');
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setCodeModalOpen(false);
    setAdminOpen(true);
  }

  async function lockAdmin() {
    await clearAdminAccess();
    setAdminOpen(false);
  }

  // When entered directly on 'account' (Settings from Home), there is no
  // Options grid to fall back to -- go all the way out instead of showing a
  // screen this entry point should never reach.
  const backToOptions = () => (initialView === 'options' ? setView('options') : props.onBack());
  if (view === 'customize') return <CustomizeCompanionScreen onBack={backToOptions} />;
  if (view === 'badges') return <BadgesScreen onBack={backToOptions} />;
  if (view === 'diagnostics')
    return <InternalDiagnosticsScreen onBack={() => setAdminOpen(true)} />;
  if (view === 'games') return <GamesScreen onBack={backToOptions} />;
  if (view === 'history') return <HistoryScreen onBack={backToOptions} />;
  if (view === 'mood') return <MoodScreen onBack={backToOptions} />;
  if (view === 'saved') return <SavedConversationsScreen onBack={backToOptions} />;
  if (view === 'sleep') return <SleepStoriesScreen onBack={backToOptions} />;
  if (view === 'topics') return <TopicsScreen onBack={backToOptions} />;
  if (view === 'time-capsule') return <TimeCapsuleScreen onBack={backToOptions} />;
  if (view === 'worlds') return <ImmersiveWorldsScreen onBack={backToOptions} />;
  if (adminOpen)
    return (
      <AdminDashboardScreen
        onBack={() => setAdminOpen(false)}
        onLock={() => void lockAdmin()}
        onOpenDiagnostics={() => {
          setAdminOpen(false);
          setView('diagnostics');
        }}
      />
    );

  if (view === 'options') {
    return (
      <OptionsHubScreen
        onClose={props.onBack}
        onOpenBadges={() => setView('badges')}
        onOpenCapsule={() => setView('time-capsule')}
        onOpenCustomize={() => setView('customize')}
        onOpenGames={() => setView('games')}
        onOpenHistory={() => setView('history')}
        onOpenMood={() => setView('mood')}
        onOpenSaved={() => setView('saved')}
        onOpenSettings={() => setView('account')}
        onOpenSleep={() => setView('sleep')}
        onOpenTopics={() => setView('topics')}
        onOpenWorlds={() => setView('worlds')}
      />
    );
  }

  return (
    <View style={styles.root}>
      <OriginalSettingsScreen {...props} onBack={backToOptions} />
      <Pressable
        accessibilityElementsHidden
        accessibilityLabel="Owner access"
        importantForAccessibility="no-hide-descendants"
        onPress={registerOwnerTap}
        style={styles.hiddenTapTarget}
      />
      <Modal
        animationType="fade"
        onRequestClose={() => setCodeModalOpen(false)}
        transparent
        visible={codeModalOpen}
      >
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.title}>Owner Access</Text>
            <Text style={styles.copy}>
              Enter the protected owner code to open the Admin Dashboard.
            </Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setOwnerCode}
              onSubmitEditing={() => void unlockAdmin()}
              placeholder="Owner code"
              placeholderTextColor="rgba(255,255,255,0.32)"
              secureTextEntry
              style={styles.input}
              value={ownerCode}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.actions}>
              <Pressable
                onPress={() => {
                  setOwnerCode('');
                  setError('');
                  setCodeModalOpen(false);
                }}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={!ownerCode.trim() || verifying}
                onPress={() => void unlockAdmin()}
                style={[styles.confirmButton, (!ownerCode.trim() || verifying) && styles.disabled]}
              >
                <Text style={styles.confirmText}>{verifying ? 'Checking…' : 'Unlock'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.74)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  cancelButton: { alignItems: 'center', flex: 1, padding: 14 },
  cancelText: { color: 'rgba(255,255,255,0.62)', fontSize: 14, fontWeight: '800' },
  card: {
    backgroundColor: '#16062F',
    borderColor: 'rgba(168,85,247,0.4)',
    borderRadius: 22,
    borderWidth: 1,
    maxWidth: 380,
    padding: 20,
    width: '100%',
  },
  confirmButton: {
    alignItems: 'center',
    backgroundColor: '#8B5CF6',
    borderRadius: 14,
    flex: 1,
    padding: 14,
  },
  confirmText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  copy: { color: 'rgba(255,255,255,0.56)', fontSize: 13, lineHeight: 19, marginTop: 6 },
  disabled: { opacity: 0.45 },
  error: { color: '#FB7185', fontSize: 12, lineHeight: 18, marginTop: 10 },
  hiddenTapTarget: { bottom: 0, height: 76, left: 0, position: 'absolute', right: 0, zIndex: 50 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 14,
    borderWidth: 1,
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  root: { flex: 1 },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
});
