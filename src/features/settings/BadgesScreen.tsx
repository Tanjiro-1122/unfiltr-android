import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/BackButton';

type BadgesScreenProps = { onBack: () => void };

type Badge = { icon: string; title: string; description: string; unlocked: boolean };

const BADGES: Badge[] = [
  { icon: '🌱', title: 'First Step', description: 'Begin your Unfiltr journey.', unlocked: true },
  { icon: '💬', title: 'Open Heart', description: 'Share something real with your companion.', unlocked: true },
  { icon: '🌈', title: 'Mood Check-In', description: 'Record your first mood.', unlocked: true },
  { icon: '📖', title: 'Story Keeper', description: 'Build a meaningful chat history.', unlocked: false },
  { icon: '💜', title: 'Moment Saved', description: 'Save a companion reply that matters.', unlocked: false },
  { icon: '🔥', title: 'Seven Day Spark', description: 'Return for seven days.', unlocked: false },
  { icon: '🌙', title: 'Restful Mind', description: 'Complete a sleep story.', unlocked: false },
  { icon: '🔮', title: 'Future You', description: 'Create a time capsule.', unlocked: false },
  { icon: '🏆', title: 'Unfiltr Champion', description: 'Unlock every core achievement.', unlocked: false },
];

export function BadgesScreen({ onBack }: BadgesScreenProps) {
  const insets = useSafeAreaInsets();
  const unlocked = BADGES.filter((badge) => badge.unlocked).length;

  return (
    <LinearGradient colors={['#2B0751', '#120322', '#05020D']} style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <BackButton accessibilityLabel="Back" onPress={onBack} />
          <View style={styles.headerCopy}>
            <Text style={styles.title}>🏅 Badges</Text>
            <Text style={styles.subtitle}>Small reminders of how far you have come.</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 28, 44) }]} showsVerticalScrollIndicator={false}>
          <View style={styles.progressCard}>
            <Text style={styles.progressValue}>{unlocked} / {BADGES.length}</Text>
            <Text style={styles.progressLabel}>badges unlocked</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round((unlocked / BADGES.length) * 100)}%` }]} />
            </View>
          </View>

          <View style={styles.grid}>
            {BADGES.map((badge) => (
              <View key={badge.title} style={[styles.card, !badge.unlocked && styles.cardLocked]}>
                <Text style={[styles.icon, !badge.unlocked && styles.locked]}>{badge.unlocked ? badge.icon : '🔒'}</Text>
                <Text style={[styles.badgeTitle, !badge.unlocked && styles.locked]}>{badge.title}</Text>
                <Text style={styles.description}>{badge.description}</Text>
                <Text style={[styles.status, badge.unlocked ? styles.unlockedText : styles.lockedText]}>{badge.unlocked ? 'Unlocked' : 'Locked'}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  badgeTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', marginTop: 8, textAlign: 'center' },
  card: { alignItems: 'center', backgroundColor: 'rgba(139,92,246,0.11)', borderColor: 'rgba(216,180,254,0.26)', borderRadius: 20, borderWidth: 1, minHeight: 176, padding: 15, width: '48%' },
  cardLocked: { backgroundColor: 'rgba(255,255,255,0.035)', borderColor: 'rgba(255,255,255,0.08)' },
  content: { paddingHorizontal: 18, paddingTop: 8 },
  description: { color: 'rgba(255,255,255,0.48)', fontSize: 11, lineHeight: 16, marginTop: 6, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 13, paddingHorizontal: 18, paddingVertical: 14 },
  headerCopy: { flex: 1 },
  icon: { fontSize: 38 },
  locked: { opacity: 0.42 },
  lockedText: { color: 'rgba(255,255,255,0.28)' },
  progressCard: { backgroundColor: 'rgba(236,72,153,0.1)', borderColor: 'rgba(236,72,153,0.24)', borderRadius: 20, borderWidth: 1, marginBottom: 18, padding: 17 },
  progressFill: { backgroundColor: '#C084FC', borderRadius: 99, height: 8 },
  progressLabel: { color: 'rgba(255,255,255,0.48)', fontSize: 12, marginTop: 2 },
  progressTrack: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 99, height: 8, marginTop: 13, overflow: 'hidden' },
  progressValue: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  root: { flex: 1 },
  safe: { flex: 1 },
  status: { fontSize: 10, fontWeight: '900', marginTop: 'auto', paddingTop: 10, textTransform: 'uppercase' },
  subtitle: { color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 3 },
  title: { color: '#FFFFFF', fontSize: 23, fontWeight: '900' },
  unlockedText: { color: '#D8B4FE' },
});
