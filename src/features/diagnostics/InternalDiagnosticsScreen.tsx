import Constants from 'expo-constants';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/BackButton';
import { env } from '@/config';
import { hasActiveAdminAccess } from '@/lib/admin/adminAccess';
import { apiClient, getLastApiDiagnostics } from '@/lib/api';
import { isBackendSessionValid } from '@/lib/auth/session';
import { resolvePremiumAccess } from '@/lib/purchases/access';
import { getSecureItem } from '@/lib/storage';
import { getAppStorageItem } from '@/lib/storage/appStorage';

type InternalDiagnosticsScreenProps = {
  onBack: () => void;
};

type ProfileDiagnostic = {
  memory?: { long_term_memory?: { items?: unknown[] } } | null;
  profile?: {
    is_family?: boolean | null;
    tier?: string | null;
  } | null;
};

type ChatHistoryDiagnostic = {
  session?: { messages?: unknown[] } | null;
};

type DiagnosticRow = {
  label: string;
  value: string;
};

export function InternalDiagnosticsScreen({ onBack }: InternalDiagnosticsScreenProps) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<DiagnosticRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const apiDiagnostics = getLastApiDiagnostics();
    const [
      authState,
      appleUserId,
      ageGate,
      consent,
      companionId,
      companionName,
      connectionStyle,
      appleSignInComplete,
      privateSession,
      premiumAccess,
      adminActive,
    ] = await Promise.all([
      isBackendSessionValid(),
      getSecureItem('auth.appleUserId'),
      getSecureItem('onboarding.ageVerified'),
      getSecureItem('onboarding.privacyConsentAccepted'),
      getSecureItem('onboarding.selectedCompanionId'),
      getSecureItem('onboarding.companionNickname'),
      getSecureItem('onboarding.relationshipMode'),
      getSecureItem('auth.accessToken'),
      getAppStorageItem('unfiltr_private_session'),
      resolvePremiumAccess({ refreshRevenueCat: false }),
      hasActiveAdminAccess(),
    ]);

    let profileStatus = 'not loaded';
    let backendTier = 'unknown';
    let memoryCount = -1;
    let familyStatus = 'unknown';
    try {
      const response = await apiClient.post<ProfileDiagnostic>('/api/profile', { action: 'get' });
      profileStatus = response.profile ? 'found' : 'missing';
      backendTier = response.profile?.tier || 'free';
      familyStatus = response.profile?.is_family ? 'active' : 'inactive';
      memoryCount = response.memory?.long_term_memory?.items?.length ?? 0;
    } catch {
      profileStatus = 'error';
    }

    let chatHistoryCount = -1;
    try {
      const chatHistory = await apiClient.post<ChatHistoryDiagnostic>('/api/chat-history', {
        action: 'loadLatest',
      });
      chatHistoryCount = chatHistory.session?.messages?.length ?? 0;
    } catch {
      chatHistoryCount = -1;
    }

    setRows([
      {
        label: 'App version/build',
        value: `${Constants.expoConfig?.version || 'unknown'} (${Constants.expoConfig?.ios?.buildNumber || 'unknown'})`,
      },
      { label: 'API URL', value: env.apiBaseUrl || 'not configured' },
      { label: 'Auth state', value: authState ? 'authenticated' : 'unauthenticated' },
      { label: 'Masked user ID', value: maskIdentifier(appleUserId) },
      {
        label: 'Onboarding flags',
        value: `age:${flag(ageGate)} consent:${flag(consent)} companion:${flag(companionId)} naming:${flag(companionName)} style:${flag(connectionStyle)} apple:${flag(appleSignInComplete)}`,
      },
      { label: 'Profile status', value: profileStatus },
      {
        label: 'Premium status (live RevenueCat check)',
        value: premiumAccess.revenueCatActive ? 'active' : 'inactive',
      },
      { label: 'Backend tier (cached user_profiles.tier)', value: backendTier },
      {
        label: 'Memory count restored',
        value: memoryCount < 0 ? 'unavailable' : String(memoryCount),
      },
      {
        label: 'Chat-history count restored',
        value: chatHistoryCount < 0 ? 'unavailable' : String(chatHistoryCount),
      },
      { label: 'Private Session', value: privateSession === 'true' ? 'on' : 'off' },
      { label: 'Family status', value: familyStatus },
      { label: 'Admin role', value: adminActive ? 'unlocked' : 'locked' },
      { label: 'Last request ID', value: apiDiagnostics.lastRequestId || 'none' },
      { label: 'Last safe error code', value: apiDiagnostics.lastSafeErrorCode || 'none' },
    ]);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [load]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <BackButton accessibilityLabel="Back to admin" onPress={onBack} />
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Internal Diagnostics</Text>
          <Text style={styles.subtitle}>Safe operational state only</Text>
        </View>
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#C084FC" />
          <Text style={styles.loading}>Checking app state...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom + 28, 48) },
          ]}
        >
          {rows.map((row) => (
            <View key={row.label} style={styles.row}>
              <Text style={styles.label}>{row.label}</Text>
              <Text selectable style={styles.value}>
                {row.value}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function flag(value: string | null): string {
  return value ? 'yes' : 'no';
}

function maskIdentifier(value: string | null): string {
  if (!value) return 'none';
  if (value.length <= 8) return '***';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 8 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerCopy: { flex: 1 },
  label: { color: 'rgba(255,255,255,0.56)', fontSize: 12, fontWeight: '800' },
  loading: { color: 'rgba(255,255,255,0.62)', marginTop: 12 },
  row: {
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderColor: 'rgba(216,180,254,0.16)',
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
    padding: 14,
  },
  safe: { backgroundColor: '#080212', flex: 1 },
  subtitle: { color: 'rgba(255,255,255,0.52)', fontSize: 12, marginTop: 2 },
  title: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  value: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginTop: 5 },
});
