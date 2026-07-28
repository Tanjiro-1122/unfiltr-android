import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/BackButton';
import {
  DEFAULT_TOPIC_PREFERENCES,
  loadTopicPreferences,
  saveTopicPreferences,
  type TopicId,
  type TopicPreferences,
} from '@/lib/topics/preferences';

type TopicsScreenProps = { onBack: () => void };

type TopicOption = {
  id: TopicId;
  icon: string;
  label: string;
  description: string;
};

const TOPICS: TopicOption[] = [
  { id: 'relationships', icon: '💞', label: 'Relationships', description: 'Love, dating, trust, and connection' },
  { id: 'self-growth', icon: '🌱', label: 'Self-growth', description: 'Habits, healing, and becoming yourself' },
  { id: 'stress', icon: '🌊', label: 'Stress & anxiety', description: 'Slow down and sort through the noise' },
  { id: 'family', icon: '🏡', label: 'Family', description: 'Home, parenting, and complicated bonds' },
  { id: 'work', icon: '✨', label: 'Work & purpose', description: 'Career choices, motivation, and direction' },
  { id: 'confidence', icon: '🔥', label: 'Confidence', description: 'Self-worth, courage, and boundaries' },
  { id: 'grief', icon: '🕯️', label: 'Grief & change', description: 'Loss, transitions, and moving forward' },
  { id: 'dreams', icon: '🌙', label: 'Dreams', description: 'Meaning, imagination, and what stays with you' },
  { id: 'creativity', icon: '🎨', label: 'Creativity', description: 'Ideas, expression, and inspiration' },
  { id: 'just-talk', icon: '💬', label: 'Just talk', description: 'No agenda—start wherever you are' },
];

export function TopicsScreen({ onBack }: TopicsScreenProps) {
  const insets = useSafeAreaInsets();
  const [saved, setSaved] = useState<TopicPreferences>(DEFAULT_TOPIC_PREFERENCES);
  const [draft, setDraft] = useState<TopicPreferences>(DEFAULT_TOPIC_PREFERENCES);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let mounted = true;
    void loadTopicPreferences().then((preferences) => {
      if (!mounted) return;
      setSaved(preferences);
      setDraft(preferences);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const changed = useMemo(() => JSON.stringify(saved) !== JSON.stringify(draft), [draft, saved]);

  function toggleTopic(id: TopicId) {
    setNotice('');
    setDraft((current) => ({
      ...current,
      selected: current.selected.includes(id)
        ? current.selected.filter((topic) => topic !== id)
        : [...current.selected, id],
    }));
  }

  function surpriseMe() {
    const options = TOPICS.filter((topic) => topic.id !== 'just-talk');
    const picked = options[Math.floor(Math.random() * options.length)];
    if (!picked) return;
    setDraft((current) => ({ ...current, selected: [picked.id] }));
    setNotice(`${picked.label} picked for you.`);
  }

  async function save() {
    const normalized = {
      customTopic: draft.customTopic.trim(),
      selected: draft.selected.length ? draft.selected : ['just-talk' as TopicId],
    };
    await saveTopicPreferences(normalized);
    setSaved(normalized);
    setDraft(normalized);
    setNotice('Topics saved.');
  }

  return (
    <LinearGradient colors={['#2B0751', '#120322', '#05020D']} style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <BackButton accessibilityLabel="Back" onPress={onBack} />
          <View style={styles.headerCopy}>
            <Text style={styles.title}>💫 Topics</Text>
            <Text style={styles.subtitle}>Choose what you want your companion to understand and explore with you.</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 22, 34) }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.grid}>
            {TOPICS.map((topic) => {
              const active = draft.selected.includes(topic.id);
              return (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  key={topic.id}
                  onPress={() => toggleTopic(topic.id)}
                  style={({ pressed }) => [styles.card, active && styles.cardActive, pressed && styles.pressed]}
                >
                  <View style={styles.cardTop}>
                    <Text style={styles.icon}>{topic.icon}</Text>
                    <View style={[styles.check, active && styles.checkActive]}>
                      <Text style={styles.checkText}>{active ? '✓' : ''}</Text>
                    </View>
                  </View>
                  <Text style={styles.label}>{topic.label}</Text>
                  <Text style={styles.description}>{topic.description}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.sectionTitle}>Something else?</Text>
          <TextInput
            maxLength={80}
            onChangeText={(customTopic) => setDraft((current) => ({ ...current, customTopic }))}
            placeholder="Write your own topic…"
            placeholderTextColor="rgba(255,255,255,0.34)"
            style={styles.input}
            value={draft.customTopic}
          />

          <Pressable onPress={surpriseMe} style={({ pressed }) => [styles.surpriseButton, pressed && styles.pressed]}>
            <Text style={styles.surpriseText}>🎲 Surprise me</Text>
          </Pressable>

          {notice ? <Text style={styles.notice}>{notice}</Text> : null}

          <View style={styles.actions}>
            <Pressable
              disabled={!changed}
              onPress={() => {
                setDraft(saved);
                setNotice('Changes reverted.');
              }}
              style={[styles.secondaryButton, !changed && styles.disabled]}
            >
              <Text style={styles.secondaryText}>Revert</Text>
            </Pressable>
            <Pressable disabled={!changed} onPress={() => void save()} style={[styles.saveButton, !changed && styles.disabled]}>
              <Text style={styles.saveText}>Save topics</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  header: { alignItems: 'flex-start', flexDirection: 'row', gap: 12, paddingHorizontal: 18, paddingTop: 12 },
  headerCopy: { flex: 1, paddingRight: 8 },
  title: { color: '#FFFFFF', fontSize: 26, fontWeight: '900' },
  subtitle: { color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 19, marginTop: 5 },
  content: { paddingHorizontal: 18, paddingTop: 22 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { backgroundColor: 'rgba(255,255,255,0.045)', borderColor: 'rgba(168,85,247,0.25)', borderRadius: 20, borderWidth: 1, minHeight: 142, padding: 14, width: '48.2%' },
  cardActive: { backgroundColor: 'rgba(126,34,206,0.25)', borderColor: '#C084FC' },
  cardTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  icon: { fontSize: 27 },
  check: { alignItems: 'center', borderColor: 'rgba(255,255,255,0.22)', borderRadius: 99, borderWidth: 1, height: 24, justifyContent: 'center', width: 24 },
  checkActive: { backgroundColor: '#A855F7', borderColor: '#D8B4FE' },
  checkText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  label: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', marginTop: 13 },
  description: { color: 'rgba(255,255,255,0.48)', fontSize: 11, lineHeight: 16, marginTop: 5 },
  sectionTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', marginTop: 24 },
  input: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.13)', borderRadius: 16, borderWidth: 1, color: '#FFFFFF', fontSize: 15, marginTop: 10, paddingHorizontal: 15, paddingVertical: 14 },
  surpriseButton: { alignItems: 'center', borderColor: 'rgba(216,180,254,0.34)', borderRadius: 16, borderWidth: 1, marginTop: 12, padding: 14 },
  surpriseText: { color: '#E9D5FF', fontSize: 14, fontWeight: '900' },
  notice: { color: '#D8B4FE', fontSize: 13, fontWeight: '800', marginTop: 14, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  secondaryButton: { alignItems: 'center', borderColor: 'rgba(255,255,255,0.16)', borderRadius: 16, borderWidth: 1, flex: 1, padding: 15 },
  secondaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  saveButton: { alignItems: 'center', backgroundColor: '#8B5CF6', borderRadius: 16, flex: 1.35, padding: 15 },
  saveText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  disabled: { opacity: 0.42 },
  pressed: { opacity: 0.78 },
});