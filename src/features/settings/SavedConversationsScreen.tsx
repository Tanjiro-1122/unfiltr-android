import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/BackButton';
import {
  loadSavedMoments,
  removeSavedMoment,
  saveLatestAssistantMessage,
  type SavedMoment,
} from '@/lib/savedConversations/preferences';
import { getAppStorageItem } from '@/lib/storage/appStorage';

type SavedConversationsScreenProps = { onBack: () => void };

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function SavedConversationsScreen({ onBack }: SavedConversationsScreenProps) {
  const insets = useSafeAreaInsets();
  const [moments, setMoments] = useState<SavedMoment[]>([]);
  const [companionName, setCompanionName] = useState('Companion');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let mounted = true;
    void Promise.all([loadSavedMoments(), getAppStorageItem('unfiltr_companion_nickname')])
      .then(([loaded, name]) => {
        if (!mounted) return;
        setMoments(loaded);
        setCompanionName(name?.trim() || 'Companion');
      })
      .catch(() => {
        if (mounted) setNotice('Could not load your saved moments.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function handleSaveLatest() {
    if (saving) return;
    setSaving(true);
    setNotice('');
    try {
      const result = await saveLatestAssistantMessage(companionName);
      setMoments(result.moments);
      setNotice(
        result.saved
          ? 'Latest companion reply saved.'
          : 'There is no new companion reply to save yet.',
      );
    } catch {
      setNotice('Could not save that moment. Try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setNotice('');
    try {
      const updated = await removeSavedMoment(id);
      setMoments(updated);
      setConfirmDeleteId(null);
    } catch {
      setNotice('Could not remove that saved moment.');
    }
  }

  return (
    <LinearGradient colors={['#25064A', '#10021F', '#05020D']} style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <BackButton accessibilityLabel="Back" onPress={onBack} />
          <View style={styles.headerCopy}>
            <Text style={styles.title}>💜 Saved Moments</Text>
            <Text style={styles.subtitle}>Keep the replies that matter most.</Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={() => void handleSaveLatest()}
          style={({ pressed }) => [
            styles.saveLatestButton,
            saving && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.saveLatestIcon}>📌</Text>
          <View style={styles.saveLatestCopy}>
            <Text style={styles.saveLatestTitle}>
              {saving ? 'Saving…' : 'Save latest companion reply'}
            </Text>
            <Text style={styles.saveLatestSubtitle}>
              Saves the newest reply from your current chat.
            </Text>
          </View>
        </Pressable>

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
              <Text style={styles.emptyTitle}>Loading saved moments…</Text>
            </View>
          ) : null}

          {!loading && moments.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📌</Text>
              <Text style={styles.emptyTitle}>No saved moments yet</Text>
              <Text style={styles.emptyCopy}>
                Save the latest companion reply and it will appear here.
              </Text>
            </View>
          ) : null}

          {moments.map((moment) => {
            const confirming = confirmDeleteId === moment.id;
            return (
              <View key={moment.id} style={styles.card}>
                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>
                    {moment.companionName} · {formatDate(moment.savedAt)}
                  </Text>
                  <Text style={styles.pin}>📌</Text>
                </View>
                <Text style={styles.contentText}>{moment.content}</Text>

                {confirming ? (
                  <View style={styles.deleteRow}>
                    <Text style={styles.deleteQuestion}>Remove this saved moment?</Text>
                    <Pressable
                      onPress={() => void handleDelete(moment.id)}
                      style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
                    >
                      <Text style={styles.deleteButtonText}>Remove</Text>
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
                    accessibilityLabel="Remove saved moment"
                    onPress={() => setConfirmDeleteId(moment.id)}
                    style={({ pressed }) => [styles.removeLink, pressed && styles.pressed]}
                  >
                    <Text style={styles.removeLinkText}>Remove</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
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
  cancelButton: { paddingHorizontal: 9, paddingVertical: 8 },
  cancelButtonText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '800' },
  card: {
    backgroundColor: 'rgba(139,92,246,0.09)',
    borderColor: 'rgba(167,139,250,0.2)',
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
    padding: 15,
  },
  content: { paddingHorizontal: 16, paddingTop: 14 },
  contentText: { color: 'rgba(255,255,255,0.88)', fontSize: 14, lineHeight: 21, marginTop: 8 },
  deleteButton: {
    backgroundColor: 'rgba(244,63,94,0.18)',
    borderColor: 'rgba(251,113,133,0.4)',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  deleteButtonText: { color: '#FDA4AF', fontSize: 12, fontWeight: '900' },
  deleteQuestion: { color: 'rgba(255,255,255,0.68)', flex: 1, fontSize: 12, fontWeight: '700' },
  deleteRow: { alignItems: 'center', flexDirection: 'row', gap: 7, marginTop: 13 },
  disabled: { opacity: 0.5 },
  emptyCopy: {
    color: 'rgba(255,255,255,0.34)',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 7,
    maxWidth: 280,
    textAlign: 'center',
  },
  emptyIcon: { fontSize: 50 },
  emptyState: { alignItems: 'center', paddingHorizontal: 28, paddingTop: 62 },
  emptyTitle: { color: 'rgba(255,255,255,0.72)', fontSize: 17, fontWeight: '900', marginTop: 12 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 13,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  headerCopy: { flex: 1 },
  metaRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  metaText: { color: 'rgba(216,180,254,0.72)', fontSize: 11, fontWeight: '800' },
  notice: {
    color: '#D8B4FE',
    fontSize: 12,
    fontWeight: '800',
    marginHorizontal: 18,
    marginTop: 10,
    textAlign: 'center',
  },
  pin: { fontSize: 14 },
  pressed: { opacity: 0.76 },
  removeLink: { alignSelf: 'flex-end', marginTop: 8, padding: 6 },
  removeLinkText: { color: '#FDA4AF', fontSize: 12, fontWeight: '800' },
  root: { flex: 1 },
  safe: { flex: 1 },
  saveLatestButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(126,34,206,0.17)',
    borderColor: 'rgba(236,72,153,0.34)',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    marginHorizontal: 18,
    marginTop: 4,
    padding: 14,
  },
  saveLatestCopy: { flex: 1 },
  saveLatestIcon: { fontSize: 24, marginRight: 12 },
  saveLatestSubtitle: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  saveLatestTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  subtitle: { color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 3 },
  title: { color: '#FFFFFF', fontSize: 23, fontWeight: '900' },
});
