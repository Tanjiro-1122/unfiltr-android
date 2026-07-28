import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/BackButton';
import { getAppStorageItem, setAppStorageItem } from '@/lib/storage/appStorage';
import { getWorldsFor, WORLD_STORAGE_KEYS, type WorldId } from '@/lib/worlds/catalog';

type Props = { onBack: () => void };
const WORLDS = getWorldsFor('journal');

export function ImmersiveWorldsScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<WorldId>(WORLDS[0]!.id);

  useEffect(() => {
    void getAppStorageItem(WORLD_STORAGE_KEYS.journal).then((value) => {
      const match = WORLDS.find((world) => world.id === value);
      if (match) setSelected(match.id);
    });
  }, []);

  function chooseWorld(id: WorldId) {
    setSelected(id);
    void setAppStorageItem(WORLD_STORAGE_KEYS.journal, id);
  }

  return (
    <LinearGradient colors={['#2A0A55', '#10031F', '#05020D']} style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <BackButton accessibilityLabel="Back" onPress={onBack} />
          <View>
            <Text style={styles.title}>Immersive Worlds</Text>
            <Text style={styles.subtitle}>For the immersive journal experience</Text>
          </View>
        </View>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom + 28, 44) },
          ]}
        >
          <Text style={styles.note}>
            Choose the world used when you open Immersive Journal. This does not change the chat
            background.
          </Text>
          {WORLDS.map((world) => {
            const active = selected === world.id;
            return (
              <Pressable
                key={world.id}
                onPress={() => chooseWorld(world.id)}
                style={[styles.card, active && styles.cardActive]}
              >
                <ImageBackground
                  imageStyle={styles.image}
                  source={{ uri: world.backgroundImage }}
                  style={styles.imageWrap}
                >
                  <LinearGradient
                    colors={['transparent', 'rgba(5,2,13,0.92)']}
                    style={styles.overlay}
                  >
                    <View style={styles.copy}>
                      <Text style={styles.worldTitle}>{world.label}</Text>
                      <Text style={styles.worldDesc}>{world.desc}</Text>
                    </View>
                    <Text style={[styles.status, active && styles.statusActive]}>
                      {active ? 'Selected' : 'Choose'}
                    </Text>
                  </LinearGradient>
                </ImageBackground>
              </Pressable>
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
    borderRadius: 99,
    height: 44,
    justifyContent: 'center',
    marginRight: 12,
    width: 44,
  },
  backText: { color: '#FFFFFF', fontSize: 32, lineHeight: 34 },
  card: {
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 14,
    overflow: 'hidden',
  },
  cardActive: { borderColor: '#D8B4FE', borderWidth: 2 },
  content: { paddingHorizontal: 18, paddingTop: 8 },
  copy: { flex: 1 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  image: { borderRadius: 20 },
  imageWrap: { height: 170, justifyContent: 'flex-end' },
  note: { color: 'rgba(255,255,255,0.58)', fontSize: 13, lineHeight: 20, marginBottom: 16 },
  overlay: { alignItems: 'flex-end', flexDirection: 'row', minHeight: 170, padding: 16 },
  root: { flex: 1 },
  safe: { flex: 1 },
  status: { color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: '800' },
  statusActive: { color: '#E9D5FF' },
  subtitle: { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 3 },
  title: { color: '#FFFFFF', fontSize: 23, fontWeight: '900' },
  worldDesc: { color: 'rgba(255,255,255,0.64)', fontSize: 12, marginTop: 4 },
  worldTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: '900' },
});
