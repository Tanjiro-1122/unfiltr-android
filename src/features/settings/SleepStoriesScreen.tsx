import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/BackButton';
import { getAppStorageItem, setAppStorageItem } from '@/lib/storage/appStorage';

type SleepStoriesScreenProps = { onBack: () => void };
type ThemeId = 'forest' | 'ocean' | 'stars' | 'rain';
type Theme = { id: ThemeId; emoji: string; label: string; story: string };

const THEMES: Theme[] = [
  { id: 'forest', emoji: '🌲', label: 'Enchanted Forest', story: 'The forest rested beneath a velvet sky. Fireflies drifted between the trees, showing you a soft path through the ferns. In a quiet clearing, the leaves whispered that nothing needed to be solved tonight. The moon would keep watch, the trees would hold the silence, and morning could wait. You closed your eyes while the whole forest breathed slowly with you. Goodnight... 🌙' },
  { id: 'ocean', emoji: '🌊', label: 'Ocean Waves', story: 'A small boat rested on a calm midnight sea, rising and falling with each gentle wave. The water carried every heavy thought away until only the tide remained. Above you, stars reflected across the ocean like a road made of light. There was nowhere else to be and nothing more to do. The sea would carry you safely until morning. Goodnight... 🌙' },
  { id: 'stars', emoji: '🌌', label: 'Starry Night', story: 'A quiet star noticed you looking up and drew a glowing path across the sky just for you. You followed it through soft clouds to a moonlit garden floating above the world. A warm place was waiting there. As you rested, the constellations dimmed their light one by one so you could sleep. Goodnight... 🌙' },
  { id: 'rain', emoji: '🌧️', label: 'Rainy Evening', story: 'Rain tapped gently against the window while the room stayed warm and still. The steady rhythm softened the day and loosened every thought. Far away, thunder rolled like a sleepy drum. Tonight, the rain was washing the world clean while you rested beneath a soft blanket. Goodnight... 🌙' },
];

const LAST_THEME_KEY = 'unfiltr_sleep_story_theme';

export function SleepStoriesScreen({ onBack }: SleepStoriesScreenProps) {
  const [selected, setSelected] = useState<Theme | null>(null);
  const [companionName, setCompanionName] = useState('your companion');

  useEffect(() => {
    let mounted = true;
    void Promise.all([
      getAppStorageItem(LAST_THEME_KEY),
      getAppStorageItem('unfiltr_companion_nickname'),
    ]).then(([themeId, name]) => {
      if (!mounted) return;
      setCompanionName(name?.trim() || 'your companion');
      setSelected(THEMES.find((theme) => theme.id === themeId) ?? null);
    });
    return () => {
      mounted = false;
    };
  }, []);

  function chooseTheme(theme: Theme) {
    setSelected(theme);
    void setAppStorageItem(LAST_THEME_KEY, theme.id);
  }

  return (
    <LinearGradient colors={['#16052F', '#090218', '#030109']} style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <BackButton accessibilityLabel="Back to Options" onPress={onBack} />
          <View>
            <Text style={styles.title}>🌙 Sleep Stories</Text>
            <Text style={styles.subtitle}>A gentle way to wind down.</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {selected ? (
            <View>
              <Text style={styles.storyTitle}>{selected.emoji} {selected.label}</Text>
              <Text style={styles.storyBy}>A bedtime story from {companionName}</Text>
              <View style={styles.storyCard}>
                <Text style={styles.storyText}>{selected.story}</Text>
              </View>
              <Pressable onPress={() => setSelected(null)} style={styles.actionButton}>
                <Text style={styles.actionText}>Choose another story</Text>
              </Pressable>
              <Text style={styles.runtimeNote}>🔊 Voice playback will be connected during final runtime integration.</Text>
            </View>
          ) : (
            <View>
              <Text style={styles.intro}>Choose a theme and {companionName} will help you settle in for the night.</Text>
              <View style={styles.grid}>
                {THEMES.map((theme) => (
                  <Pressable accessibilityRole="button" key={theme.id} onPress={() => chooseTheme(theme)} style={styles.themeCard}>
                    <Text style={styles.themeEmoji}>{theme.emoji}</Text>
                    <Text style={styles.themeLabel}>{theme.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  actionButton: { alignItems: 'center', backgroundColor: 'rgba(124,58,237,0.18)', borderColor: 'rgba(192,132,252,0.34)', borderRadius: 16, borderWidth: 1, marginTop: 18, padding: 14 },
  actionText: { color: '#E9D5FF', fontSize: 13, fontWeight: '900' },
  content: { padding: 18, paddingBottom: 44 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 13, padding: 18 },
  intro: { color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 19, marginBottom: 16 },
  root: { flex: 1 },
  runtimeNote: { color: 'rgba(255,255,255,0.4)', fontSize: 11, lineHeight: 16, marginTop: 14, textAlign: 'center' },
  safe: { flex: 1 },
  storyBy: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 14, marginTop: 4 },
  storyCard: { backgroundColor: 'rgba(139,92,246,0.08)', borderColor: 'rgba(192,132,252,0.2)', borderRadius: 20, borderWidth: 1, padding: 18 },
  storyText: { color: 'rgba(255,255,255,0.84)', fontSize: 15, lineHeight: 27 },
  storyTitle: { color: '#E9D5FF', fontSize: 20, fontWeight: '900' },
  subtitle: { color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 3 },
  themeCard: { alignItems: 'center', backgroundColor: 'rgba(139,92,246,0.09)', borderColor: 'rgba(139,92,246,0.26)', borderRadius: 18, borderWidth: 1, justifyContent: 'center', minHeight: 128, padding: 16, width: '48%' },
  themeEmoji: { fontSize: 38 },
  themeLabel: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', marginTop: 9, textAlign: 'center' },
  title: { color: '#FFFFFF', fontSize: 23, fontWeight: '900' },
});