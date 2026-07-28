import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/BackButton';
import { apiClient, ApiError } from '@/lib/api';
import { clearAdminAccess } from '@/lib/admin/adminAccess';

const ADMIN_WEB_ROOT = 'https://unfiltrbyjavier2.vercel.app';

type AdminDashboardScreenProps = {
  onBack: () => void;
  onOpenDiagnostics?: () => void;
  onLock: () => void;
};

type DeviceCheckResponse = {
  delivered?: number;
  registeredDevices?: number;
  removedInvalidDevices?: number;
  skipped?: string;
};

type AdminSection = {
  description: string;
  label: string;
  path: string;
};

const ADMIN_SECTIONS: AdminSection[] = [
  {
    label: 'Users',
    description: 'Search accounts, inspect memory health, and handle support actions.',
    path: '/AdminDashboard?section=users',
  },
  {
    label: 'Subscriptions',
    description: 'Review plans, grants, expirations, and entitlement overrides.',
    path: '/AdminDashboard?section=subscriptions',
  },
  {
    label: 'Content',
    description: 'Manage companions, worlds, badges, feedback, and app content.',
    path: '/AdminDashboard?section=content',
  },
  {
    label: 'System',
    description: 'Open announcements, maintenance controls, recovery, and audit history.',
    path: '/AdminDashboard?section=system',
  },
];

export function AdminDashboardScreen({
  onBack,
  onLock,
  onOpenDiagnostics,
}: AdminDashboardScreenProps) {
  const insets = useSafeAreaInsets();
  const [testModal, setTestModal] = useState(false);
  const [ownerCode, setOwnerCode] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [testStatus, setTestStatus] = useState('');
  const [openStatus, setOpenStatus] = useState('');

  async function lockAdminAccess() {
    await clearAdminAccess();
    onLock();
  }

  async function openAdminSection(section: AdminSection) {
    setOpenStatus('');
    try {
      const supported = await Linking.canOpenURL(`${ADMIN_WEB_ROOT}${section.path}`);
      if (!supported) {
        setOpenStatus('The protected web dashboard could not be opened on this device.');
        return;
      }
      await Linking.openURL(`${ADMIN_WEB_ROOT}${section.path}`);
      setOpenStatus(`${section.label} opened in the protected owner dashboard.`);
    } catch {
      setOpenStatus('The protected web dashboard could not be opened.');
    }
  }

  async function sendNotificationTest() {
    const code = ownerCode.trim();
    if (!code || sendingTest) return;
    setSendingTest(true);
    setTestStatus('');
    try {
      const result = await apiClient.post<DeviceCheckResponse>('/api/tools/device-check', {
        ownerCode: code,
      });
      setOwnerCode('');
      setTestModal(false);
      if (result.skipped === 'NO_REGISTERED_DEVICES' || !result.registeredDevices) {
        setTestStatus(
          'No registered phone found. Open Settings → Notifications on the installed app first.',
        );
      } else if ((result.delivered ?? 0) > 0) {
        setTestStatus(
          `Test notification accepted for ${result.delivered} registered device${result.delivered === 1 ? '' : 's'}.`,
        );
      } else {
        setTestStatus('The phone was registered, but Expo did not accept the test notification.');
      }
    } catch (error) {
      const message =
        error instanceof ApiError && error.status === 429
          ? 'Please wait 30 seconds before sending another test.'
          : error instanceof ApiError && error.status === 403
            ? 'The owner code was not accepted.'
            : error instanceof ApiError && (error.status === 404 || error.status === 503)
              ? 'The protected notification route is not deployed on the configured backend.'
              : 'The notification test could not be sent.';
      setTestStatus(message);
      setOwnerCode('');
    } finally {
      setSendingTest(false);
    }
  }

  return (
    <LinearGradient colors={['#2D0A6E', '#120428', '#05020D']} style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom + 32, 52) },
          ]}
        >
          <View style={styles.header}>
            <BackButton accessibilityLabel="Back to settings" onPress={onBack} />
            <View style={styles.headerText}>
              <Text style={styles.title}>Admin Dashboard</Text>
              <Text style={styles.subtitle}>Owner access confirmed</Text>
            </View>
          </View>

          <View style={styles.heroCard}>
            <Text style={styles.heroEyebrow}>OWNER MODE</Text>
            <Text style={styles.heroTitle}>Admin access is active.</Text>
            <Text style={styles.heroCopy}>
              Sensitive tools stay on the protected backend. Selecting a section opens the original
              owner dashboard instead of exposing server credentials inside the mobile app.
            </Text>
          </View>

          {onOpenDiagnostics ? (
            <Pressable
              accessibilityLabel="Open internal diagnostics"
              accessibilityRole="button"
              onPress={onOpenDiagnostics}
              style={styles.row}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Internal Diagnostics</Text>
                <Text style={styles.rowCopy}>Safe app, auth, access, and memory state.</Text>
              </View>
              <Text style={styles.rowArrow}>{'›'}</Text>
            </Pressable>
          ) : null}

          {ADMIN_SECTIONS.map((section) => (
            <Pressable
              accessibilityLabel={`Open ${section.label} admin tools`}
              accessibilityRole="button"
              key={section.label}
              onPress={() => void openAdminSection(section)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{section.label}</Text>
                <Text style={styles.rowCopy}>{section.description}</Text>
              </View>
              <Text style={styles.rowArrow}>{'›'}</Text>
            </Pressable>
          ))}

          {openStatus ? <Text style={styles.openStatus}>{openStatus}</Text> : null}

          <View style={styles.testCard}>
            <Text style={styles.rowTitle}>Notification delivery test</Text>
            <Text style={styles.rowCopy}>
              Sends one real test alert only to your signed-in Apple account’s registered phone.
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={sendingTest}
              onPress={() => {
                setOwnerCode('');
                setTestModal(true);
              }}
              style={styles.testButton}
            >
              <Text style={styles.testButtonText}>
                {sendingTest ? 'Sending…' : 'Send Test Notification'}
              </Text>
            </Pressable>
            {testStatus ? <Text style={styles.testStatus}>{testStatus}</Text> : null}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => void lockAdminAccess()}
            style={styles.lockButton}
          >
            <Text style={styles.lockButtonText}>Lock Admin Access</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>

      <Modal
        animationType="fade"
        onRequestClose={() => setTestModal(false)}
        transparent
        visible={testModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirm owner access</Text>
            <Text style={styles.modalCopy}>
              Enter the owner code to send one notification to your phone.
            </Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setOwnerCode}
              onSubmitEditing={() => void sendNotificationTest()}
              placeholder="Owner code"
              placeholderTextColor="rgba(255,255,255,0.32)"
              secureTextEntry
              style={styles.input}
              value={ownerCode}
            />
            <View style={styles.modalActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setOwnerCode('');
                  setTestModal(false);
                }}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={!ownerCode.trim() || sendingTest}
                onPress={() => void sendNotificationTest()}
                style={[
                  styles.confirmButton,
                  (!ownerCode.trim() || sendingTest) && styles.disabled,
                ]}
              >
                <Text style={styles.confirmText}>{sendingTest ? 'Sending…' : 'Send'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
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
  backText: { color: '#FFFFFF', fontSize: 26, fontWeight: '700', lineHeight: 30 },
  cancelButton: { alignItems: 'center', flex: 1, padding: 14 },
  cancelText: { color: 'rgba(255,255,255,0.62)', fontSize: 14, fontWeight: '800' },
  confirmButton: {
    alignItems: 'center',
    backgroundColor: '#8B5CF6',
    borderRadius: 14,
    flex: 1,
    padding: 14,
  },
  confirmText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  content: { paddingHorizontal: 20, paddingTop: 10 },
  disabled: { opacity: 0.45 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 14, marginBottom: 22 },
  headerText: { flex: 1 },
  heroCard: {
    backgroundColor: 'rgba(168,85,247,0.12)',
    borderColor: 'rgba(168,85,247,0.34)',
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 16,
    padding: 20,
  },
  heroCopy: { color: 'rgba(255,255,255,0.58)', fontSize: 14, lineHeight: 21, marginTop: 8 },
  heroEyebrow: { color: '#D8B4FE', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', lineHeight: 28, marginTop: 8 },
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
  lockButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(251,113,133,0.12)',
    borderColor: 'rgba(251,113,133,0.35)',
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 8,
    padding: 16,
  },
  lockButtonText: { color: '#FB7185', fontSize: 15, fontWeight: '900' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.72)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#16062F',
    borderColor: 'rgba(168,85,247,0.38)',
    borderRadius: 22,
    borderWidth: 1,
    maxWidth: 380,
    padding: 20,
    width: '100%',
  },
  modalCopy: { color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 19, marginTop: 6 },
  modalTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  openStatus: { color: '#D8B4FE', fontSize: 12, lineHeight: 18, marginBottom: 12 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  root: { flex: 1 },
  row: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 10,
    padding: 16,
  },
  rowArrow: { color: '#D8B4FE', fontSize: 28, fontWeight: '500', marginLeft: 12 },
  rowCopy: { color: 'rgba(255,255,255,0.48)', fontSize: 13, lineHeight: 19, marginTop: 4 },
  rowText: { flex: 1 },
  rowTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  safe: { flex: 1 },
  subtitle: { color: 'rgba(255,255,255,0.48)', fontSize: 12, marginTop: 2 },
  testButton: {
    alignItems: 'center',
    backgroundColor: '#8B5CF6',
    borderRadius: 15,
    marginTop: 14,
    padding: 14,
  },
  testButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  testCard: {
    backgroundColor: 'rgba(168,85,247,0.08)',
    borderColor: 'rgba(168,85,247,0.28)',
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  testStatus: { color: '#D8B4FE', fontSize: 12, lineHeight: 18, marginTop: 12 },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
});
