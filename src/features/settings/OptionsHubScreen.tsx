import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type OptionsHubScreenProps = {
  onClose: () => void;
  onOpenBadges: () => void;
  onOpenCapsule: () => void;
  onOpenCustomize: () => void;
  onOpenGames: () => void;
  onOpenHistory: () => void;
  onOpenMood: () => void;
  onOpenSaved: () => void;
  onOpenSettings: () => void;
  onOpenSleep: () => void;
  onOpenTopics: () => void;
  onOpenWorlds: () => void;
};

type OptionItem = { id: string; icon: string; label: string; ready?: boolean };

const OPTIONS: OptionItem[] = [
  { id: 'customize', icon: '🎨', label: 'Customize', ready: true },
  { id: 'history', icon: '📖', label: 'History', ready: true },
  { id: 'worlds', icon: '🌌', label: 'Worlds', ready: true },
  { id: 'topics', icon: '💫', label: 'Topics', ready: true },
  { id: 'mood', icon: '🌈', label: 'Mood', ready: true },
  { id: 'capsule', icon: '🔮', label: 'Capsule', ready: true },
  { id: 'sleep', icon: '🌙', label: 'Sleep', ready: true },
  { id: 'games', icon: '🎮', label: 'Games', ready: true },
  { id: 'badges', icon: '🏅', label: 'Badges', ready: true },
  { id: 'saved', icon: '💜', label: 'Saved', ready: true },
];

export function OptionsHubScreen(props: OptionsHubScreenProps) {
  const insets = useSafeAreaInsets();
  const [notice, setNotice] = useState('');

  function openOption(option: OptionItem) {
    const actions: Record<string, (() => void) | undefined> = {
      badges: props.onOpenBadges,
      capsule: props.onOpenCapsule,
      customize: props.onOpenCustomize,
      games: props.onOpenGames,
      history: props.onOpenHistory,
      mood: props.onOpenMood,
      saved: props.onOpenSaved,
      sleep: props.onOpenSleep,
      topics: props.onOpenTopics,
      worlds: props.onOpenWorlds,
    };
    const action = actions[option.id];
    if (action) return action();
    setNotice(`${option.label} is being restored next.`);
  }

  return (
    <LinearGradient colors={['#25064A', '#110222', '#05020D']} style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.scrim}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <View style={styles.headerCopy}><Text style={styles.title}>✨ Options</Text><Text style={styles.subtitle}>What would you like to do?</Text></View>
              <Pressable onPress={props.onClose} style={styles.closeButton}><Text style={styles.closeText}>×</Text></Pressable>
            </View>
            <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom + 18, 30) }]} showsVerticalScrollIndicator={false}>
              <View style={styles.grid}>{OPTIONS.map((option) => <Pressable key={option.id} onPress={() => openOption(option)} style={[styles.optionCard, option.ready && styles.optionCardReady]}><Text style={styles.optionIcon}>{option.icon}</Text><Text style={styles.optionLabel}>{option.label}</Text></Pressable>)}</View>
              {notice ? <Text style={styles.notice}>{notice}</Text> : null}
              <Pressable onPress={props.onOpenSettings} style={styles.accountButton}><Text style={styles.accountIcon}>⚙️</Text><View style={styles.accountCopy}><Text style={styles.accountTitle}>Account & privacy settings</Text><Text style={styles.accountSubtitle}>Notifications, PIN, premium, data, and sign out</Text></View><Text style={styles.chevron}>›</Text></Pressable>
            </ScrollView>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  accountButton: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.045)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 20, borderWidth: 1, flexDirection: 'row', marginTop: 18, minHeight: 72, paddingHorizontal: 16 },
  accountCopy: { flex: 1 }, accountIcon: { fontSize: 24, marginRight: 12 }, accountSubtitle: { color: 'rgba(255,255,255,0.44)', fontSize: 11, lineHeight: 16, marginTop: 2 }, accountTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' }, chevron: { color: 'rgba(255,255,255,0.54)', fontSize: 30 }, closeButton: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 99, height: 44, justifyContent: 'center', width: 44 }, closeText: { color: '#FFFFFF', fontSize: 27 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, handle: { alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.24)', borderRadius: 99, height: 5, marginTop: 17, width: 50 }, header: { alignItems: 'center', flexDirection: 'row', paddingBottom: 18, paddingHorizontal: 24, paddingTop: 22 }, headerCopy: { flex: 1 }, notice: { color: '#D8B4FE', fontSize: 13, fontWeight: '800', marginTop: 18, textAlign: 'center' }, optionCard: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.035)', borderColor: 'rgba(168,85,247,0.28)', borderRadius: 22, borderWidth: 1, justifyContent: 'center', minHeight: 104, paddingHorizontal: 8, width: '30.9%' }, optionCardReady: { backgroundColor: 'rgba(126,34,206,0.17)', borderColor: 'rgba(236,72,153,0.38)' }, optionIcon: { fontSize: 31 }, optionLabel: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', marginTop: 8, textAlign: 'center' }, root: { flex: 1 }, safe: { flex: 1 }, scrim: { backgroundColor: 'rgba(5,2,13,0.42)', flex: 1, justifyContent: 'flex-end', paddingTop: 46 }, scroll: { paddingHorizontal: 20 }, sheet: { backgroundColor: '#16032D', borderColor: 'rgba(168,85,247,0.32)', borderTopLeftRadius: 34, borderTopRightRadius: 34, borderWidth: 1, flex: 1, maxHeight: '94%', overflow: 'hidden' }, subtitle: { color: 'rgba(255,255,255,0.48)', fontSize: 14, marginTop: 4 }, title: { color: '#FFFFFF', fontSize: 27, fontWeight: '900' },
});