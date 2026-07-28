import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/BackButton';
import { apiClient } from '@/lib/api/client';
import { getAppStorageItem, setAppStorageItem } from '@/lib/storage/appStorage';

type NotificationsScreenProps = {
  onBack: () => void;
};

type NotificationOption = {
  body: string;
  hour: number;
  key: string;
  label: string;
  minute: number;
  scheduleKey: string;
  title: string;
};

const OPTIONS: NotificationOption[] = [
  {
    body: 'Take a quiet minute and check in with yourself.',
    hour: 9,
    key: 'unfiltr_notifications_daily_checkin',
    label: 'Daily check-in',
    minute: 0,
    scheduleKey: 'unfiltr_notifications_daily_checkin_id',
    title: 'A gentle check-in',
  },
  {
    body: 'Your companion is here whenever you feel ready to talk.',
    hour: 15,
    key: 'unfiltr_notifications_companion',
    label: 'Companion nudges',
    minute: 0,
    scheduleKey: 'unfiltr_notifications_companion_id',
    title: 'Your companion is here',
  },
  {
    body: 'A few honest words are enough. Your journal is waiting.',
    hour: 20,
    key: 'unfiltr_notifications_journal',
    label: 'Journal reminders',
    minute: 30,
    scheduleKey: 'unfiltr_notifications_journal_id',
    title: 'A moment for your journal',
  },
];

const DESCRIPTIONS: Record<string, string> = {
  unfiltr_notifications_companion: 'A daily afternoon reminder from your selected companion.',
  unfiltr_notifications_daily_checkin: 'A gentle reminder each morning to return to your space.',
  unfiltr_notifications_journal: 'A private evening prompt when the day gets quiet.',
};

export function NotificationsScreen({ onBack }: NotificationsScreenProps) {
  const [enabled, setEnabled] = useState(false);
  const [values, setValues] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState('Checking permission…');

  useEffect(() => {
    let mounted = true;

    async function loadState() {
      const stored = await Promise.all(OPTIONS.map(({ key }) => getAppStorageItem(key)));
      const nextValues = Object.fromEntries(
        OPTIONS.map(({ key }, index) => [key, stored[index] === 'true']),
      );

      if (Platform.OS === 'web') {
        if (!mounted) return;
        setValues(nextValues);
        setEnabled(true);
        setStatus('Preview mode. Native devices will use scheduled reminders.');
        return;
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('unfiltr-reminders', {
          importance: Notifications.AndroidImportance.DEFAULT,
          name: 'Unfiltr reminders',
          sound: 'default',
        });
      }

      const permission = await Notifications.getPermissionsAsync();
      const granted = hasPermission(permission);
      if (!mounted) return;
      setValues(nextValues);
      setEnabled(granted);
      setStatus(granted ? 'Notifications enabled' : 'Permission not requested');
      if (granted) void registerRemoteDevice();
    }

    void loadState();
    return () => {
      mounted = false;
    };
  }, []);

  async function request() {
    if (Platform.OS === 'web') {
      setEnabled(true);
      setStatus('Enabled for preview. Native devices will request OS permission.');
      return true;
    }

    const result = await Notifications.requestPermissionsAsync();
    const granted = hasPermission(result);
    setEnabled(granted);
    if (!granted) {
      setStatus('Permission not granted');
      return false;
    }

    const connected = await registerRemoteDevice();
    setStatus(
      connected
        ? 'Notifications enabled and this device is connected.'
        : 'Notifications enabled. Remote connection will retry later.',
    );
    return true;
  }

  async function toggle(option: NotificationOption, value: boolean) {
    if (value && !enabled) {
      const granted = await request();
      if (!granted) return;
    }

    setValues((current) => ({ ...current, [option.key]: value }));
    await setAppStorageItem(option.key, String(value));

    if (Platform.OS === 'web') return;

    const existingId = await getAppStorageItem(option.scheduleKey);
    if (existingId) {
      try {
        await Notifications.cancelScheduledNotificationAsync(existingId);
      } catch {
        // The OS may already have removed the old request.
      }
      await setAppStorageItem(option.scheduleKey, '');
    }

    if (!value) {
      setStatus(`${option.label} turned off.`);
      return;
    }

    const trigger: Notifications.DailyTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: option.hour,
      minute: option.minute,
      ...(Platform.OS === 'android' ? { channelId: 'unfiltr-reminders' } : {}),
    };

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        body: option.body,
        data: { destination: option.key },
        sound: 'default',
        title: option.title,
      },
      trigger,
    });

    await setAppStorageItem(option.scheduleKey, identifier);
    setStatus(`${option.label} scheduled for ${formatTime(option.hour, option.minute)}.`);
  }

  return (
    <LinearGradient colors={['#2D0A6E', '#120428', '#05020D']} style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <BackButton accessibilityLabel="Back to settings" onPress={onBack} />
            <Text style={styles.title}>Notifications</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Stay connected gently</Text>
            <Text style={styles.cardCopy}>
              Unfiltr can remind you to check in, write, or return to your companion.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void request()}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryText}>
                {enabled ? 'Notifications enabled' : 'Enable notifications'}
              </Text>
            </Pressable>
            <Text style={styles.status}>{status}</Text>
          </View>
          {OPTIONS.map((option) => (
            <View key={option.key} style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{option.label}</Text>
                <Text style={styles.rowDesc}>{DESCRIPTIONS[option.key]}</Text>
                <Text style={styles.timeText}>{formatTime(option.hour, option.minute)}</Text>
              </View>
              <Switch
                onValueChange={(value) => void toggle(option, value)}
                thumbColor="#FFFFFF"
                trackColor={{ false: 'rgba(255,255,255,0.18)', true: '#8B5CF6' }}
                value={!!values[option.key]}
              />
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

async function registerRemoteDevice() {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;
  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (typeof projectId !== 'string' || !projectId) return false;

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    await apiClient.post('/api/profile', {
      action: 'registerNotificationDevice',
      expoToken: token.data,
      platform: Platform.OS,
    });
    return true;
  } catch (error) {
    if (__DEV__) console.warn('[Notifications] Remote registration failed:', error);
    return false;
  }
}

function hasPermission(result: Notifications.NotificationPermissionsStatus) {
  return result.granted || result.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

function formatTime(hour: number, minute: number) {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(168,85,247,0.3)',
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 18,
    padding: 20,
  },
  cardCopy: { color: 'rgba(255,255,255,0.62)', fontSize: 14, lineHeight: 22 },
  cardTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', marginBottom: 8 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 16, marginBottom: 18 },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#8B5CF6',
    borderRadius: 16,
    marginTop: 16,
    padding: 14,
  },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  root: { flex: 1 },
  row: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    padding: 16,
  },
  rowDesc: { color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 18, marginTop: 3 },
  rowText: { flex: 1 },
  rowTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 52 },
  status: { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 10, textAlign: 'center' },
  timeText: { color: '#C084FC', fontSize: 11, fontWeight: '800', marginTop: 5 },
  title: { color: '#FFFFFF', flex: 1, fontSize: 24, fontWeight: '900' },
});
