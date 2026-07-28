import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/BackButton';
import { apiClient } from '@/lib/api/client';
import { setSecureItem } from '@/lib/storage';

type ProfileRecord = {
  id?: string;
  display_name?: string;
  companion_name?: string;
  preferences?: Record<string, unknown>;
  updated_at?: string;
};

type MemoryItem = {
  category?: string;
  text?: string;
  updated_at?: string;
};

// The backend (api/chat.js persistDurableCompanionMemoryBounded) writes a
// single companion_memory row per account under key "long_term_memory",
// shaped { items: MemoryItem[], updated_at }. This is the only key it ever
// writes -- there is no "memory_summary"/"user_facts"/"session_memory"/
// "relationship_milestones" key produced anywhere in the current backend
// (that was a legacy shape from the now-disabled /api/summarizeSession
// endpoint). Read the current shape.
type LongTermMemory = {
  items?: MemoryItem[];
  updated_at?: string;
};

type ProfileResponse = {
  profile?: ProfileRecord | null;
  memory?: { long_term_memory?: LongTermMemory } & Record<string, unknown>;
};

const CATEGORY_LABELS: Record<string, string> = {
  general: 'General',
  goals: 'Goals',
  identity: 'Identity',
  people: 'People in your life',
  preferences: 'Preferences',
  values: 'Values',
  wellbeing: 'Wellbeing',
  work: 'Work',
};

export function MemoryScreen({ onBack }: { onBack: () => void }) {
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadMemory = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.post<ProfileResponse>('/api/profile', { action: 'get' });
      const longTermMemory = response.memory?.long_term_memory;
      setProfile(response.profile ?? null);
      setItems(Array.isArray(longTermMemory?.items) ? longTermMemory.items : []);
      setUpdatedAt(longTermMemory?.updated_at);
      if (response.profile?.id) await setSecureItem('auth.profileId', response.profile.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Memory could not be loaded.');
      setProfile(null);
      setItems([]);
      setUpdatedAt(undefined);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void loadMemory();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [loadMemory]);

  const grouped = groupByCategory(items);

  return (
    <LinearGradient colors={['#2D0A6E', '#110421', '#05020D']} style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <BackButton accessibilityLabel="Back to home" onPress={onBack} />
          <Text style={styles.title}>Memory</Text>
          <View style={styles.headerSpacer} />
        </View>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#C084FC" size="large" />
            <Text style={styles.loadingText}>Connecting your memory…</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.errorTitle}>Memory is not connected</Text>
            <Text style={styles.errorCopy}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void loadMemory()}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>Try Again</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {grouped.length ? (
              grouped.map((group) => (
                <MemoryCard
                  key={group.category}
                  title={CATEGORY_LABELS[group.category] ?? humanize(group.category)}
                  value={group.items.map((item) => item.text).join('\n')}
                />
              ))
            ) : (
              <MemoryCard
                title="What your companion remembers"
                value="Your memory is connected. New details will appear as you continue chatting -- deep memory is a Premium feature."
              />
            )}
            {updatedAt || profile?.updated_at ? (
              <Text style={styles.updated}>
                Last updated {formatDate(updatedAt || profile?.updated_at || '')}
              </Text>
            ) : null}
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

function MemoryCard({ title, value }: { title: string; value: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardCopy}>{value || 'Nothing saved here yet.'}</Text>
    </View>
  );
}

function groupByCategory(items: MemoryItem[]): { category: string; items: MemoryItem[] }[] {
  const byCategory = new Map<string, MemoryItem[]>();
  for (const item of items) {
    const text = item.text?.trim();
    if (!text) continue;
    const category = item.category?.trim() || 'general';
    const list = byCategory.get(category) ?? [];
    list.push({ ...item, text });
    byCategory.set(category, list);
  }
  return [...byCategory.entries()].map(([category, categoryItems]) => ({
    category,
    items: categoryItems,
  }));
}

function humanize(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderColor: 'rgba(216,180,254,0.16)',
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 14,
    padding: 18,
  },
  cardCopy: { color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 21, marginTop: 8 },
  cardTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  center: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  content: { paddingBottom: 44, paddingHorizontal: 20, paddingTop: 12 },
  errorCopy: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
    textAlign: 'center',
  },
  errorTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerSpacer: { width: 68 },
  loadingText: { color: 'rgba(255,255,255,0.58)', fontSize: 14, marginTop: 14 },
  retryButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 18,
    marginTop: 22,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  retryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  root: { flex: 1 },
  safe: { flex: 1 },
  title: { color: '#FFFFFF', flex: 1, fontSize: 22, fontWeight: '900', textAlign: 'center' },
  updated: { color: 'rgba(255,255,255,0.36)', fontSize: 11, marginTop: 4, textAlign: 'center' },
});
