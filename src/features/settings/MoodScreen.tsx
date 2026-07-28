import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/BackButton';
import {
  loadMoodHistory,
  MOODS,
  saveTodayMood,
  type MoodHistory,
  type MoodId,
} from '@/lib/mood/preferences';

const POSITIVE = new Set<MoodId>(['happy', 'motivated', 'loved', 'calm']);

export function MoodScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const [history, setHistory] = useState<MoodHistory>({});
  const [selected, setSelected] = useState<MoodId | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let mounted = true;
    void loadMoodHistory()
      .then((value) => {
        if (!mounted) return;
        setHistory(value);
        setSelected(value[new Date().toISOString().slice(0, 10)] ?? null);
      })
      .catch(() => {
        if (mounted) setNotice('Could not load your mood history.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const recentDays = useMemo(() => {
    return Array.from({ length: 14 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (13 - index));
      const key = date.toISOString().slice(0, 10);
      const mood = history[key] ?? null;
      return {
        day: date.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2),
        key,
        mood,
      };
    });
  }, [history]);

  const logged = recentDays.filter((day) => day.mood).length;
  const positive = recentDays.filter((day) => day.mood && POSITIVE.has(day.mood)).length;
  const positivity = logged ? Math.round((positive / logged) * 100) : 0;

  async function chooseMood(mood: MoodId) {
    if (saving) return;
    setSaving(true);
    setNotice('');
    try {
      const next = await saveTodayMood(mood);
      setHistory(next);
      setSelected(mood);
      setNotice('Today’s mood is saved.');
    } catch {
      setNotice('Could not save your mood. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <LinearGradient colors={['#240641', '#10021F', '#05020D']} style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <BackButton accessibilityLabel="Back" onPress={onBack} />
          <View style={styles.headerCopy}>
            <Text style={styles.title}>🌈 Mood</Text>
            <Text style={styles.subtitle}>Notice how you feel without judging it.</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 28, 44) }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>How are you feeling today?</Text>
          <View style={styles.grid}>
            {MOODS.map((mood) => (
              <Pressable
                accessibilityLabel={mood.label}
                disabled={saving}
                key={mood.id}
                onPress={() => void chooseMood(mood.id)}
                style={({ pressed }) => [
                  styles.moodCard,
                  selected === mood.id && styles.moodCardSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.emoji}>{mood.emoji}</Text>
                <Text style={styles.moodLabel}>{mood.label}</Text>
              </Pressable>
            ))}
          </View>

          {notice ? <Text style={styles.notice}>{notice}</Text> : null}

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{logged || '—'}</Text>
              <Text style={styles.statLabel}>Days logged</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{logged ? `${positivity}%` : '—'}</Text>
              <Text style={styles.statLabel}>Positive days</Text>
            </View>
          </View>

          <View style={styles.historyCard}>
            <Text style={styles.sectionTitle}>Last 14 days</Text>
            <View style={styles.daysRow}>
              {recentDays.map((day) => {
                const meta = MOODS.find((mood) => mood.id === day.mood);
                return (
                  <View key={day.key} style={styles.dayItem}>
                    <Text style={styles.dayLabel}>{day.day}</Text>
                    <View style={[styles.dayBubble, meta && styles.dayBubbleLogged]}>
                      <Text style={styles.dayEmoji}>{meta?.emoji ?? '·'}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {loading ? <Text style={styles.loading}>Loading mood history…</Text> : null}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 8 },
  dayBubble: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, height: 34, justifyContent: 'center', width: 34 },
  dayBubbleLogged: { backgroundColor: 'rgba(139,92,246,0.18)' },
  dayEmoji: { fontSize: 18 },
  dayItem: { alignItems: 'center', marginBottom: 10, width: '14.28%' },
  dayLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 9, marginBottom: 4 },
  daysRow: { flexDirection: 'row', flexWrap: 'wrap' },
  emoji: { fontSize: 30 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 13, paddingHorizontal: 18, paddingVertical: 14 },
  headerCopy: { flex: 1 },
  historyCard: { backgroundColor: 'rgba(255,255,255,0.045)', borderColor: 'rgba(255,255,255,0.08)', borderRadius: 18, borderWidth: 1, marginTop: 18, padding: 15 },
  loading: { color: 'rgba(255,255,255,0.4)', marginTop: 16, textAlign: 'center' },
  moodCard: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.045)', borderColor: 'rgba(168,85,247,0.2)', borderRadius: 17, borderWidth: 1, justifyContent: 'center', minHeight: 92, width: '30.8%' },
  moodCardSelected: { backgroundColor: 'rgba(126,34,206,0.28)', borderColor: '#C084FC' },
  moodLabel: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', marginTop: 7 },
  notice: { color: '#D8B4FE', fontSize: 12, fontWeight: '800', marginTop: 14, textAlign: 'center' },
  pressed: { opacity: 0.76 },
  root: { flex: 1 },
  safe: { flex: 1 },
  sectionTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', marginBottom: 13 },
  statCard: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, flex: 1, padding: 16 },
  statLabel: { color: 'rgba(255,255,255,0.42)', fontSize: 11, marginTop: 4 },
  statValue: { color: '#C4B5FD', fontSize: 22, fontWeight: '900' },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  subtitle: { color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 3 },
  title: { color: '#FFFFFF', fontSize: 23, fontWeight: '900' },
});