import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/BackButton';

type GamesScreenProps = { onBack: () => void };
type GameId = 'questions' | 'either' | 'gratitude';

const GAMES = [
  {
    id: 'questions' as const,
    emoji: '💭',
    title: 'Deep Questions',
    copy: 'Thoughtful prompts for honest reflection.',
  },
  {
    id: 'either' as const,
    emoji: '⚖️',
    title: 'This or That',
    copy: 'Quick choices that reveal what matters.',
  },
  {
    id: 'gratitude' as const,
    emoji: '✨',
    title: 'Gratitude Spark',
    copy: 'Small prompts for noticing something good.',
  },
];

const PROMPTS: Record<GameId, string[]> = {
  questions: [
    'What is something you wish people understood about you?',
    'What made you feel most like yourself recently?',
    'What would you tell the version of you from one year ago?',
  ],
  either: [
    'Quiet night in or spontaneous adventure?',
    'Relive one perfect day or see one day from your future?',
    'Be deeply understood or endlessly admired?',
  ],
  gratitude: [
    'Name one ordinary thing that made today easier.',
    'Who made you feel supported recently?',
    'What is one thing your body helped you do today?',
  ],
};

export function GamesScreen({ onBack }: GamesScreenProps) {
  const insets = useSafeAreaInsets();
  const [game, setGame] = useState<GameId | null>(null);
  const [index, setIndex] = useState(0);
  const prompt = useMemo(
    () => (game ? PROMPTS[game][index % PROMPTS[game].length] : ''),
    [game, index],
  );

  return (
    <LinearGradient colors={['#25064A', '#10021F', '#05020D']} style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <BackButton accessibilityLabel="Back" onPress={onBack} />
          <View>
            <Text style={styles.title}>🎮 Games</Text>
            <Text style={styles.subtitle}>Play, reflect, and reconnect.</Text>
          </View>
        </View>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom + 28, 44) },
          ]}
        >
          {game ? (
            <View>
              <Text style={styles.gameTitle}>
                {GAMES.find((item) => item.id === game)?.title}
              </Text>
              <View style={styles.promptCard}>
                <Text style={styles.prompt}>{prompt}</Text>
              </View>
              <Pressable
                onPress={() => setIndex((value) => value + 1)}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryText}>Next prompt</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setGame(null);
                  setIndex(0);
                }}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryText}>Choose another game</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.grid}>
              {GAMES.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => setGame(item.id)}
                  style={styles.card}
                >
                  <Text style={styles.emoji}>{item.emoji}</Text>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardCopy}>{item.copy}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(139,92,246,0.1)',
    borderColor: 'rgba(192,132,252,0.24)',
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    width: '48%',
  },
  cardCopy: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 5,
  },
  cardTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', marginTop: 10 },
  content: { paddingHorizontal: 18, paddingTop: 14 },
  emoji: { fontSize: 34 },
  gameTitle: { color: '#E9D5FF', fontSize: 20, fontWeight: '900', marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 13,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    borderRadius: 16,
    marginTop: 16,
    padding: 15,
  },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  prompt: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 30,
    textAlign: 'center',
  },
  promptCard: {
    backgroundColor: 'rgba(139,92,246,0.12)',
    borderColor: 'rgba(192,132,252,0.28)',
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 230,
    padding: 24,
  },
  root: { flex: 1 },
  safe: { flex: 1 },
  secondaryButton: { alignItems: 'center', padding: 15 },
  secondaryText: { color: 'rgba(255,255,255,0.58)', fontSize: 13, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 3 },
  title: { color: '#FFFFFF', fontSize: 23, fontWeight: '900' },
});
