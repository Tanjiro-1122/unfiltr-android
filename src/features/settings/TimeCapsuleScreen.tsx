import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/BackButton';
import {
  DEFAULT_CAPSULE_PREFERENCES,
  DELAY_OPTIONS,
  addCapsule,
  deleteCapsule,
  getDeliverableCapsules,
  getDeliveredCapsules,
  getPendingCapsules,
  loadTimeCapsules,
  type TimeCapsule,
} from '@/lib/timeCapsule/preferences';

type TimeCapsuleScreenProps = { onBack: () => void };

export function TimeCapsuleScreen({ onBack }: TimeCapsuleScreenProps) {
  const insets = useSafeAreaInsets();
  const [capsules, setCapsules] = useState<TimeCapsule[]>(DEFAULT_CAPSULE_PREFERENCES.capsules);
  const [message, setMessage] = useState('');
  const [selectedDays, setSelectedDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let mounted = true;
    void loadTimeCapsules().then((loaded) => {
      if (!mounted) return;
      setCapsules(loaded);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const deliverable = getDeliverableCapsules(capsules);
  const pending = getPendingCapsules(capsules);
  const delivered = getDeliveredCapsules(capsules);

  async function handleSeal() {
    const text = message.trim();
    if (!text || saving) return;
    setSaving(true);
    setNotice('');
    try {
      const updated = await addCapsule(text, selectedDays);
      setCapsules(updated);
      setMessage('');
      setSent(true);
      setTimeout(() => setSent(false), 3000);
    } catch {
      setNotice('Could not seal your capsule. Try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const updated = await deleteCapsule(id);
    setCapsules(updated);
    setConfirmDeleteId(null);
  }

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return (
    <LinearGradient colors={['#2B0751', '#120322', '#05020D']} style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <BackButton accessibilityLabel="Back" onPress={onBack} />
          <View style={styles.headerCopy}>
            <Text style={styles.title}>🔮 Time Capsule</Text>
            <Text style={styles.subtitle}>
              Write a message to your future self. Your companion will deliver it when the time
              comes.
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom + 22, 34) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {sent ? (
            <View style={styles.sentContainer}>
              <Text style={styles.sentIcon}>✨</Text>
              <Text style={styles.sentTitle}>Sealed!</Text>
              <Text style={styles.sentBody}>
                Your companion will deliver this message in{' '}
                {DELAY_OPTIONS.find((d) => d.days === selectedDays)?.label ??
                  `${selectedDays} days`}
                .
              </Text>
            </View>
          ) : (
            <View style={styles.writeCard}>
              <Text style={styles.sectionLabel}>Your message</Text>
              <TextInput
                maxLength={1000}
                multiline
                onChangeText={setMessage}
                placeholder="Dear future me… right now I'm feeling, hoping for, working on…"
                placeholderTextColor="rgba(255,255,255,0.34)"
                style={styles.textArea}
                value={message}
              />
              <Text style={styles.charCount}>{message.length}/1000</Text>

              <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Deliver in</Text>
              <View style={styles.chipRow}>
                {DELAY_OPTIONS.map((option) => {
                  const active = selectedDays === option.days;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={option.days}
                      onPress={() => setSelectedDays(option.days)}
                      style={({ pressed }) => [
                        styles.chip,
                        active && styles.chipActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                disabled={!message.trim() || saving}
                onPress={() => void handleSeal()}
                style={({ pressed }) => [
                  styles.sealButton,
                  (!message.trim() || saving) && styles.disabled,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.sealText}>
                  {saving ? 'Sealing…' : '🔒 Seal & Send to Future Me'}
                </Text>
              </Pressable>
            </View>
          )}

          {notice ? <Text style={styles.notice}>{notice}</Text> : null}

          {loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>⏳</Text>
              <Text style={styles.emptyText}>Loading your capsules…</Text>
            </View>
          ) : null}

          {/* Deliverable capsules */}
          {!loading && deliverable.length > 0 ? (
            <View>
              <Text style={styles.sectionHeader}>📬 Ready to read</Text>
              {deliverable.map((c) => (
                <View key={c.id} style={styles.capsuleDelivered}>
                  <Text style={styles.capsuleMeta}>
                    Written {formatDate(c.created_at)} · Ready {formatDate(c.deliver_at)}
                  </Text>
                  <Text style={styles.capsuleMessage}>{c.message}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Pending capsules */}
          {!loading && pending.length > 0 ? (
            <View>
              <Text style={styles.sectionHeader}>🔒 Sealed ({pending.length})</Text>
              {pending.map((c) => (
                <View key={c.id} style={styles.capsulePending}>
                  {confirmDeleteId === c.id ? (
                    <View style={styles.deleteConfirmRow}>
                      <Text style={styles.deleteConfirmText}>Delete this capsule?</Text>
                      <Pressable
                        onPress={() => void handleDelete(c.id)}
                        style={({ pressed }) => [styles.deleteYesButton, pressed && styles.pressed]}
                      >
                        <Text style={styles.deleteYesText}>Delete</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setConfirmDeleteId(null)}
                        style={({ pressed }) => [styles.deleteNoButton, pressed && styles.pressed]}
                      >
                        <Text style={styles.deleteNoText}>Cancel</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      onLongPress={() => setConfirmDeleteId(c.id)}
                      onPress={() => setConfirmDeleteId(c.id)}
                      style={styles.capsulePendingInner}
                    >
                      <Text style={styles.capsuleMeta}>
                        Sealed {formatDate(c.created_at)} · Opens {formatDate(c.deliver_at)}
                      </Text>
                      <Text style={styles.capsuleSealedText}>
                        This message is sealed until its delivery date 🔒
                      </Text>
                      <Text style={styles.deleteHint}>Tap to delete</Text>
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          ) : null}

          {/* Delivered capsules */}
          {!loading && delivered.length > 0 ? (
            <View>
              <Text style={styles.sectionHeader}>📬 Delivered</Text>
              {delivered.map((c) => (
                <View key={c.id} style={styles.capsuleDelivered}>
                  <Text style={styles.capsuleMeta}>
                    Written {formatDate(c.created_at)} · Delivered {formatDate(c.deliver_at)}
                  </Text>
                  <Text style={styles.capsuleMessage}>{c.message}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Empty state */}
          {!loading && capsules.length === 0 && !sent ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>⏳</Text>
              <Text style={styles.emptyText}>
                No capsules yet. Write your first message to the future.
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  backText: { color: '#FFFFFF', fontSize: 34, lineHeight: 36 },
  headerCopy: { flex: 1, paddingRight: 8 },
  title: { color: '#FFFFFF', fontSize: 26, fontWeight: '900' },
  subtitle: { color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 19, marginTop: 5 },
  content: { paddingHorizontal: 18, paddingTop: 22 },
  writeCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(168,85,247,0.25)',
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  textArea: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: 'rgba(255,255,255,0.13)',
    borderRadius: 16,
    borderWidth: 1,
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 22,
    minHeight: 120,
    padding: 14,
  },
  charCount: { color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 6, textAlign: 'right' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 999,
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: 'rgba(126,34,206,0.3)',
    borderColor: 'rgba(168,85,247,0.6)',
  },
  chipText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: '#C084FC' },
  sealButton: {
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    borderRadius: 16,
    marginTop: 16,
    padding: 15,
  },
  sealText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  disabled: { opacity: 0.42 },
  pressed: { opacity: 0.78 },
  notice: { color: '#FB7185', fontSize: 13, fontWeight: '800', marginTop: 14, textAlign: 'center' },
  sentContainer: { alignItems: 'center', paddingVertical: 40 },
  sentIcon: { fontSize: 56 },
  sentTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', marginTop: 16 },
  sentBody: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  sectionHeader: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: 24,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  capsuleDelivered: {
    backgroundColor: 'rgba(168,85,247,0.1)',
    borderColor: 'rgba(168,85,247,0.25)',
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    padding: 16,
  },
  capsulePending: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  capsulePendingInner: { padding: 16 },
  capsuleMeta: { color: 'rgba(255,255,255,0.35)', fontSize: 11, marginBottom: 8 },
  capsuleMessage: { color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 22 },
  capsuleSealedText: { color: 'rgba(255,255,255,0.3)', fontSize: 13, fontStyle: 'italic' },
  deleteHint: { color: 'rgba(255,255,255,0.2)', fontSize: 10, marginTop: 8 },
  deleteConfirmRow: { alignItems: 'center', flexDirection: 'row', gap: 10, padding: 16 },
  deleteConfirmText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, flex: 1 },
  deleteYesButton: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  deleteYesText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  deleteNoButton: {
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  deleteNoText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '800' },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: 'rgba(255,255,255,0.3)', fontSize: 14, marginTop: 12, textAlign: 'center' },
});
