import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/BackButton';
import {
  COMPANION_IDS,
  COMPANION_PERSONALITY,
  getCompanionMeta,
  type CompanionId,
} from '@/features/onboarding/companionQuiz';
import { getSecureItem, setSecureItem } from '@/lib/storage';
import { setAppStorageItem } from '@/lib/storage/appStorage';

type CustomizeCompanionScreenProps = {
  onBack: () => void;
  onSaved?: (companionId: CompanionId) => void;
};

export function CustomizeCompanionScreen({ onBack, onSaved }: CustomizeCompanionScreenProps) {
  const insets = useSafeAreaInsets();
  const companions = useMemo(() => COMPANION_IDS.map((id) => getCompanionMeta(id)), []);
  const [selectedId, setSelectedId] = useState<CompanionId>('luna');
  const [savedId, setSavedId] = useState<CompanionId>('luna');
  const [status, setStatus] = useState('');

  useEffect(() => {
    let mounted = true;
    void getSecureItem('onboarding.selectedCompanionId').then((value) => {
      if (!mounted || !isCompanionId(value)) return;
      setSelectedId(value);
      setSavedId(value);
    });
    return () => {
      mounted = false;
    };
  }, []);

  async function saveSelection() {
    const personality = COMPANION_PERSONALITY[selectedId] ?? COMPANION_PERSONALITY.luna;
    await Promise.all([
      setSecureItem('onboarding.selectedCompanionId', selectedId),
      setSecureItem('onboarding.personalityVibe', personality.vibe),
      setSecureItem('onboarding.personalityStyle', personality.style),
      setSecureItem('onboarding.personalityHumor', personality.humor),
      setSecureItem('onboarding.personalityEmpathy', personality.empathy),
      setAppStorageItem('unfiltr_companion_id', selectedId),
    ]);
    setSavedId(selectedId);
    setStatus(`${getCompanionMeta(selectedId).name} is now your companion.`);
    onSaved?.(selectedId);
  }

  return (
    <LinearGradient colors={['#210641', '#10021F', '#05020D']} style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <BackButton accessibilityLabel="Back to settings" onPress={onBack} />
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Customize</Text>
            <Text style={styles.title}>Choose your companion</Text>
            <Text style={styles.subtitle}>Pick who you want beside you throughout Unfiltr.</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: Math.max(insets.bottom + 120, 140) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.grid}>
            {companions.map((companion) => {
              const selected = selectedId === companion.id;
              return (
                <Pressable
                  accessibilityLabel={`${companion.name}, ${companion.tagline}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={companion.id}
                  onPress={() => {
                    setSelectedId(companion.id);
                    setStatus('');
                  }}
                  style={({ pressed }) => [
                    styles.card,
                    selected && styles.cardSelected,
                    pressed && styles.cardPressed,
                  ]}
                >
                  <View style={[styles.avatarWrap, selected && styles.avatarWrapSelected]}>
                    <Image
                      resizeMode="contain"
                      source={{ uri: companion.avatar }}
                      style={styles.avatar}
                    />
                    {selected ? (
                      <View style={styles.checkBadge}>
                        <Text style={styles.checkText}>✓</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.name, selected && styles.nameSelected]}>
                    {companion.name}
                  </Text>
                  <Text numberOfLines={2} style={styles.tagline}>
                    {companion.tagline}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 14, 24) }]}>
          {status ? <Text style={styles.status}>{status}</Text> : null}
          <Pressable
            accessibilityRole="button"
            disabled={selectedId === savedId}
            onPress={() => void saveSelection()}
            style={({ pressed }) => [
              styles.saveButton,
              selectedId === savedId && styles.saveButtonDisabled,
              pressed && selectedId !== savedId && styles.cardPressed,
            ]}
          >
            <LinearGradient
              colors={['#7C3AED', '#A855F7', '#DB2777']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveGradient}
            >
              <Text style={styles.saveText}>
                {selectedId === savedId
                  ? `${getCompanionMeta(savedId).name} selected`
                  : `Choose ${getCompanionMeta(selectedId).name}`}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

function isCompanionId(value: string | null): value is CompanionId {
  return COMPANION_IDS.includes(value as CompanionId);
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    paddingBottom: 16,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 18,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  closeText: { color: '#FFFFFF', fontSize: 31, fontWeight: '700', lineHeight: 32 },
  headerCopy: { flex: 1 },
  eyebrow: {
    color: '#D8B4FE',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  title: { color: '#FFFFFF', fontSize: 25, fontWeight: '900', marginTop: 2 },
  subtitle: { color: 'rgba(255,255,255,0.52)', fontSize: 13, lineHeight: 18, marginTop: 3 },
  scroll: { paddingHorizontal: 16, paddingTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    borderWidth: 1,
    minHeight: 168,
    paddingHorizontal: 8,
    paddingVertical: 12,
    width: '31.2%',
  },
  cardSelected: {
    backgroundColor: 'rgba(126,34,206,0.24)',
    borderColor: '#B24CFF',
    borderWidth: 2,
    shadowColor: '#A855F7',
    shadowOpacity: 0.38,
    shadowRadius: 14,
  },
  cardPressed: { opacity: 0.82 },
  avatarWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    borderWidth: 1,
    height: 98,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  avatarWrapSelected: { backgroundColor: 'rgba(126,34,206,0.28)' },
  avatar: { height: 96, width: '94%' },
  checkBadge: {
    alignItems: 'center',
    backgroundColor: '#A855F7',
    borderRadius: 99,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    right: 5,
    top: 5,
    width: 24,
  },
  checkText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  name: { color: 'rgba(255,255,255,0.88)', fontSize: 14, fontWeight: '900', marginTop: 9 },
  nameSelected: { color: '#E9D5FF' },
  tagline: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
    textAlign: 'center',
  },
  footer: {
    backgroundColor: 'rgba(5,2,13,0.96)',
    borderTopColor: 'rgba(255,255,255,0.08)',
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    position: 'absolute',
    right: 0,
  },
  status: {
    color: '#86EFAC',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  saveButton: { borderRadius: 18, overflow: 'hidden' },
  saveButtonDisabled: { opacity: 0.5 },
  saveGradient: {
    alignItems: 'center',
    minHeight: 54,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  saveText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
});
