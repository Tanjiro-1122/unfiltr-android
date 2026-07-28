import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/BackButton';
import {
  deleteHistorySession,
  loadHistorySessions,
  searchHistorySessions,
  type HistorySession,
} from '@/lib/history/preferences';

type HistoryScreenProps = { onBack: () => void };

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDifference = Math.round((startToday - startDate) / 86_400_000);

  if (dayDifference === 0) return 'Today';
  if (dayDifference === 1) return 'Yesterday';
  if (dayDifference > 1 && dayDifference < 7) {
    return date.toLocaleDateString(undefined, { weekday: 'long' });
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function HistoryScreen({ onBack }: HistoryScreenProps) {
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let mounted = true;
    void loadHistorySessions()
      .then((loaded) => {
        if (mounted) setSessions(loaded);
      })
      .catch(() => {
        if (mounted) setNotice('Could not load your conversation history.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const filteredSessions = useMemo(() => searchHistorySessions(sessions, query), [query, sessions]);

  async function handleDelete(id: string) {
    setNotice('');
    try {
      const updated = await deleteHistorySession(id);
      setSessions(updated);
      setConfirmDeleteId(null);
      if (expandedId === id) setExpandedId(null);
    } catch {
      setNotice('Could not delete that conversation. Try again.');
    }
  }

  return (
    <LinearGradient colors={['#280650', '#110221', '#05020D']} style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <BackButton accessibilityLabel="Back" onPress={onBack} />
          <View style={styles.headerCopy}>
            <Text style={styles.title}>💬 Chat History</Text>
            <Text style={styles.subtitle}>
              {sessions.length > 0
                ? `${sessions.length} saved conversation${sessions.length === 1 ? '' : 's'}`
                : 'Your conversations will appear here'}
            </Text>
          </View>
        </View>

        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            accessibilityLabel="Search conversations"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setQuery}
            placeholder="Search conversations…"
            placeholderTextColor="rgba(255,255,255,0.34)"
            style={styles.searchInput}
            value={query}
          />
          {query ? (
            <Pressable
              accessibilityLabel="Clear search"
              onPress={() => setQuery('')}
              style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
            >
              <Text style={styles.clearText}>×</Text>
            </Pressable>
          ) : null}
        </View>

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom + 28, 44) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>⏳</Text>
              <Text style={styles.emptyTitle}>Loading history…</Text>
            </View>
          ) : null}

          {!loading && filteredSessions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyTitle}>
                {query ? 'No matches found' : 'No saved conversations yet'}
              </Text>
              <Text style={styles.emptyCopy}>
                {query
                  ? 'Try another word or phrase.'
                  : 'Completed conversations will appear here once chat history saving is enabled.'}
              </Text>
            </View>
          ) : null}

          {filteredSessions.map((session) => {
            const expanded = expandedId === session.id;
            const confirmingDelete = confirmDeleteId === session.id;
            const visibleMessages = session.messages.filter((message) => message.role !== 'system');

            return (
              <View key={session.id} style={[styles.card, expanded && styles.cardExpanded]}>
                <Pressable
                  accessibilityLabel={`${session.title}, ${formatDate(session.updatedAt)}`}
                  accessibilityRole="button"
                  onPress={() => {
                    setExpandedId(expanded ? null : session.id);
                    setConfirmDeleteId(null);
                  }}
                  style={({ pressed }) => [styles.cardHeader, pressed && styles.pressed]}
                >
                  <View style={styles.cardIcon}>
                    <Text style={styles.cardIconText}>💬</Text>
                  </View>
                  <View style={styles.cardCopy}>
                    <View style={styles.metaRow}>
                      <Text numberOfLines={1} style={styles.cardTitle}>
                        {session.title}
                      </Text>
                      <Text style={styles.messageCount}>{visibleMessages.length} msgs</Text>
                    </View>
                    <Text style={styles.dateText}>
                      {formatDate(session.updatedAt)} · {formatTime(session.updatedAt)}
                    </Text>
                    <Text numberOfLines={expanded ? 3 : 2} style={styles.preview}>
                      {session.preview}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>{expanded ? '⌃' : '⌄'}</Text>
                </Pressable>

                {expanded ? (
                  <View style={styles.expandedBody}>
                    {visibleMessages.length > 0 ? (
                      visibleMessages.map((message, index) => (
                        <View
                          key={message.id ?? `${session.id}-${index}`}
                          style={[
                            styles.messageBubble,
                            message.role === 'user' ? styles.userBubble : styles.assistantBubble,
                          ]}
                        >
                          <Text style={styles.messageRole}>
                            {message.role === 'user' ? 'You' : 'Companion'}
                          </Text>
                          <Text style={styles.messageText}>{message.content}</Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.noMessages}>No message details are available.</Text>
                    )}

                    {confirmingDelete ? (
                      <View style={styles.deleteConfirmRow}>
                        <Text style={styles.deleteConfirmText}>Delete this conversation?</Text>
                        <Pressable
                          onPress={() => void handleDelete(session.id)}
                          style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
                        >
                          <Text style={styles.deleteButtonText}>Delete</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => setConfirmDeleteId(null)}
                          style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
                        >
                          <Text style={styles.cancelButtonText}>Cancel</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => setConfirmDeleteId(session.id)}
                        style={({ pressed }) => [styles.deleteLink, pressed && styles.pressed]}
                      >
                        <Text style={styles.deleteLinkText}>Delete conversation</Text>
                      </Pressable>
                    )}
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  assistantBubble: { alignSelf: 'flex-start', backgroundColor: 'rgba(139,92,246,0.13)' },
  backButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 99,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  backText: { color: '#FFFFFF', fontSize: 32, fontWeight: '300', lineHeight: 34 },
  cancelButton: { paddingHorizontal: 10, paddingVertical: 8 },
  cancelButtonText: { color: 'rgba(255,255,255,0.62)', fontSize: 12, fontWeight: '800' },
  card: {
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardCopy: { flex: 1, minWidth: 0 },
  cardExpanded: { backgroundColor: 'rgba(109,40,217,0.14)', borderColor: 'rgba(167,139,250,0.35)' },
  cardHeader: { alignItems: 'center', flexDirection: 'row', gap: 12, padding: 15 },
  cardIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(139,92,246,0.16)',
    borderRadius: 14,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  cardIconText: { fontSize: 21 },
  cardTitle: { color: '#FFFFFF', flex: 1, fontSize: 14, fontWeight: '900' },
  chevron: { color: 'rgba(255,255,255,0.48)', fontSize: 18, marginLeft: 4 },
  clearButton: { alignItems: 'center', height: 34, justifyContent: 'center', width: 34 },
  clearText: { color: 'rgba(255,255,255,0.55)', fontSize: 22 },
  content: { paddingHorizontal: 16, paddingTop: 12 },
  dateText: { color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 3 },
  deleteButton: {
    backgroundColor: 'rgba(244,63,94,0.18)',
    borderColor: 'rgba(251,113,133,0.4)',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  deleteButtonText: { color: '#FDA4AF', fontSize: 12, fontWeight: '900' },
  deleteConfirmRow: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 14 },
  deleteConfirmText: { color: 'rgba(255,255,255,0.72)', flex: 1, fontSize: 12, fontWeight: '700' },
  deleteLink: { alignSelf: 'flex-end', marginTop: 12, paddingHorizontal: 4, paddingVertical: 8 },
  deleteLinkText: { color: '#FDA4AF', fontSize: 12, fontWeight: '800' },
  emptyCopy: {
    color: 'rgba(255,255,255,0.34)',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 7,
    maxWidth: 290,
    textAlign: 'center',
  },
  emptyIcon: { fontSize: 52 },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingTop: 60,
  },
  emptyTitle: { color: 'rgba(255,255,255,0.72)', fontSize: 17, fontWeight: '900', marginTop: 14 },
  expandedBody: { borderTopColor: 'rgba(255,255,255,0.07)', borderTopWidth: 1, padding: 15 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  headerCopy: { flex: 1 },
  messageBubble: { borderRadius: 15, marginBottom: 9, maxWidth: '92%', padding: 12 },
  messageCount: {
    backgroundColor: 'rgba(139,92,246,0.16)',
    borderRadius: 99,
    color: '#C4B5FD',
    fontSize: 10,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  messageRole: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 10,
    fontWeight: '900',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  messageText: { color: 'rgba(255,255,255,0.84)', fontSize: 13, lineHeight: 19 },
  metaRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  noMessages: { color: 'rgba(255,255,255,0.38)', fontSize: 13, textAlign: 'center' },
  notice: {
    color: '#FDA4AF',
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 20,
    textAlign: 'center',
  },
  pressed: { opacity: 0.76 },
  preview: { color: 'rgba(255,255,255,0.57)', fontSize: 12, lineHeight: 17, marginTop: 6 },
  root: { flex: 1 },
  safe: { flex: 1 },
  searchIcon: { color: 'rgba(255,255,255,0.42)', fontSize: 22 },
  searchInput: { color: '#FFFFFF', flex: 1, fontSize: 14, paddingVertical: 0 },
  searchWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.065)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    marginBottom: 6,
    marginHorizontal: 18,
    minHeight: 48,
    paddingHorizontal: 13,
  },
  subtitle: { color: 'rgba(255,255,255,0.42)', fontSize: 12, marginTop: 3 },
  title: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  userBubble: { alignSelf: 'flex-end', backgroundColor: 'rgba(236,72,153,0.13)' },
});
