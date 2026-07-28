/* eslint-disable react-hooks/immutability -- expo-audio SDK 57 exposes AudioPlayer loop/volume as mutable properties. */
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/BackButton';
import { getCompanionMeta, type CompanionId } from '@/features/onboarding/companionQuiz';
import {
  BREATHWORK_PATTERNS,
  MEDITATION_AVATARS,
  MEDITATION_SOUNDS,
  WORLD_MEDITATION_SOUNDS,
  type BreathworkId,
  type MeditationSoundId,
  type WorldMeditationSoundId,
} from '@/lib/meditation/catalog';
import { stopMeditationPlayer } from '@/lib/meditation/playerCleanup';
import { createMeditationCleanupGuard, runMeditationExit } from '@/lib/meditation/sessionLifecycle';
import { useAndroidBackHandler } from '@/lib/navigation/useAndroidBackHandler';
import { getAppStorageItem, setAppStorageItem, setJsonItem } from '@/lib/storage/appStorage';

type MeditationScreenProps = {
  onBack: () => void;
  onOpenChat?: () => void;
  onOpenHome?: () => void;
  onOpenJournal?: () => void;
};

type Phase = 'setup' | 'active' | 'done';
type MeditationTab = 'classic' | 'world';
type SelectedSoundId = MeditationSoundId | WorldMeditationSoundId;

const MEDITATE_COMPANION_KEY = 'unfiltr_meditate_companion';
const MEDITATE_TAB_KEY = 'unfiltr_meditation_tab';
const MEDITATE_SOUND_KEY = 'unfiltr_meditation_sound';
const COMPANIONS: CompanionId[] = [
  'luna',
  'kai',
  'nova',
  'river',
  'ash',
  'sakura',
  'ryuu',
  'sage',
  'zara',
  'echo',
  'soleil',
  'juan',
];

export function MeditationScreen({ onBack }: MeditationScreenProps) {
  const insets = useSafeAreaInsets();
  const player = useAudioPlayer(null, { downloadFirst: true });
  const guardRef = useRef(createMeditationCleanupGuard());
  const intervalRefs = useRef<ReturnType<typeof setInterval>[]>([]);
  const [phase, setPhase] = useState<Phase>('setup');
  const [tab, setTab] = useState<MeditationTab>('classic');
  const [selectedSound, setSelectedSound] = useState<SelectedSoundId>('rain');
  const [selectedBreath, setSelectedBreath] = useState<BreathworkId>('478');
  const [timer, setTimer] = useState(0);
  const [companionId, setCompanionId] = useState<CompanionId>('luna');
  const [breathIndex, setBreathIndex] = useState(0);
  const [breathCount, setBreathCount] = useState(0);
  const [audioError, setAudioError] = useState('');
  const [paused, setPaused] = useState(false);
  const [sessionExiting, setSessionExiting] = useState(false);
  const [float] = useState(() => new Animated.Value(0));

  const breathwork = useMemo(
    () => BREATHWORK_PATTERNS.find((item) => item.id === selectedBreath) ?? BREATHWORK_PATTERNS[0]!,
    [selectedBreath],
  );
  const sound = useMemo(() => {
    const classic = MEDITATION_SOUNDS.find((item) => item.id === selectedSound);
    if (classic) return classic;
    return WORLD_MEDITATION_SOUNDS.find((item) => item.id === selectedSound) ?? MEDITATION_SOUNDS[0]!;
  }, [selectedSound]);
  const visibleSounds = tab === 'classic' ? MEDITATION_SOUNDS : WORLD_MEDITATION_SOUNDS;
  const companion = getCompanionMeta(companionId);
  const avatarUrl = MEDITATION_AVATARS[companionId] ?? companion.avatar;
  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -18] });

  const clearSessionTimers = useCallback(() => {
    intervalRefs.current.forEach((handle) => clearInterval(handle));
    intervalRefs.current = [];
  }, []);

  const stopPlayer = useCallback(
    (context: string) => {
      stopMeditationPlayer(player, context);
    },
    [player],
  );

  const exitSession = useCallback(
    async ({ complete, navigateBack }: { complete: boolean; navigateBack: boolean }) => {
      await runMeditationExit(
        { complete, navigateBack },
        {
          clearSessionTimers,
          guard: guardRef.current,
          onBack,
          saveCompletionSnapshot: () =>
            setJsonItem('unfiltr_just_meditated', {
              breathwork: breathwork.label,
              duration: timer,
              sound: sound.label,
              timestamp: Date.now(),
            }).catch((error: unknown) => {
              const message = error instanceof Error ? error.message : String(error);
              console.warn(`[Meditation] Could not save completion snapshot: ${message}`);
            }),
          setPaused,
          setPhase,
          setSessionExiting,
          stopPlayer: () => stopPlayer(complete ? 'session completion' : 'navigation'),
        },
      );
    },
    [breathwork.label, clearSessionTimers, onBack, sound.label, stopPlayer, timer],
  );

  useEffect(() => {
    const guard = guardRef.current;
    guard.markMounted();
    let cancelled = false;

    void Promise.all([
      getAppStorageItem(MEDITATE_COMPANION_KEY),
      getAppStorageItem('unfiltr_companion_id'),
      getAppStorageItem(MEDITATE_TAB_KEY),
      getAppStorageItem(MEDITATE_SOUND_KEY),
    ]).then(([meditationCompanion, selectedCompanion, storedTab, storedSound]) => {
      if (cancelled || !guard.shouldUpdateState()) return;
      setCompanionId(resolveCompanionId(meditationCompanion || selectedCompanion));
      const nextTab: MeditationTab = storedTab === 'world' ? 'world' : 'classic';
      setTab(nextTab);
      if (isValidSoundForTab(storedSound, nextTab)) setSelectedSound(storedSound);
    });

    return () => {
      cancelled = true;
      guard.markUnmounted();
      clearSessionTimers();
      stopPlayer('unmount');
    };
  }, [clearSessionTimers, stopPlayer]);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => {
      animation.stop();
      float.stopAnimation();
    };
  }, [float]);

  function startTimers(pattern: readonly number[]) {
    clearSessionTimers();
    intervalRefs.current.push(setInterval(() => setTimer((value) => value + 1), 1000));
    if (!pattern.length) return;

    let nextBreathIndex = 0;
    let nextBreathCount = 0;
    intervalRefs.current.push(
      setInterval(() => {
        nextBreathCount += 1;
        const currentDuration = pattern[nextBreathIndex] ?? 1;
        if (nextBreathCount >= currentDuration) {
          nextBreathCount = 0;
          nextBreathIndex = (nextBreathIndex + 1) % pattern.length;
        }
        if (!guardRef.current.shouldUpdateState()) return;
        setBreathCount(nextBreathCount);
        setBreathIndex(nextBreathIndex);
      }, 1000),
    );
  }

  async function start() {
    guardRef.current.resetExit();
    const sourceToken = guardRef.current.beginSourceChange();
    setAudioError('');
    clearSessionTimers();
    stopPlayer('new session');

    try {
      await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false });
      if (!guardRef.current.isActiveSourceChange(sourceToken)) return;

      if (sound.url) {
        player.replace(sound.url);
        player.loop = true;
        player.volume = 0.75;
        player.play();
      } else if (!sound.available) {
        setAudioError(`${sound.label} is not available in the native catalog yet.`);
      }

      if (!guardRef.current.shouldUpdateState(sourceToken)) return;
      setTimer(0);
      setBreathCount(0);
      setBreathIndex(0);
      setPaused(false);
      setSessionExiting(false);
      setPhase('active');
      startTimers(breathwork.pattern);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[Meditation] The selected sound could not start: ${message}`);
      if (guardRef.current.shouldUpdateState(sourceToken)) {
        setAudioError('The selected sound could not start. Try another sound.');
        stopPlayer('failed start');
      }
    }
  }

  function selectTab(nextTab: MeditationTab) {
    guardRef.current.beginSourceChange();
    stopPlayer('tab change');
    setTab(nextTab);
    const nextSound = nextTab === 'classic' ? 'rain' : 'moonlit_blossoms';
    setSelectedSound(nextSound);
    setAudioError('');
    void setAppStorageItem(MEDITATE_TAB_KEY, nextTab);
    void setAppStorageItem(MEDITATE_SOUND_KEY, nextSound);
  }

  function handleSoundSelect(id: SelectedSoundId) {
    guardRef.current.beginSourceChange();
    stopPlayer('sound change');
    setSelectedSound(id);
    setAudioError('');
    void setAppStorageItem(MEDITATE_SOUND_KEY, id);
  }

  function handleBack() {
    void exitSession({ complete: false, navigateBack: true });
  }

  function stop() {
    void exitSession({ complete: true, navigateBack: false });
  }

  // During an active session there is deliberately no direct "back to home"
  // affordance (only Pause / End session) -- hardware back mirrors that by
  // ending the session the same way the End session button does, rather
  // than silently discarding it.
  const handleAndroidBack = useCallback(() => {
    if (phase === 'active') {
      if (!sessionExiting) void exitSession({ complete: true, navigateBack: false });
      return true;
    }
    void exitSession({ complete: false, navigateBack: true });
    return true;
  }, [exitSession, phase, sessionExiting]);
  useAndroidBackHandler(handleAndroidBack);

  function togglePause() {
    if (sessionExiting) return;

    if (paused) {
      try {
        if (sound.url) player.play();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[Meditation] Audio resume failed: ${message}`);
        setAudioError('The selected sound could not resume. You can end this session safely.');
      }
      setPaused(false);
      startTimers(breathwork.pattern);
      return;
    }

    clearSessionTimers();
    try {
      player.pause();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[Meditation] Audio pause failed: ${message}`);
    }
    setPaused(true);
  }

  if (phase === 'active') {
    const phaseName = breathwork.phases[breathIndex] ?? 'Breathe';
    const duration = breathwork.pattern[breathIndex] ?? 1;
    return (
      <LinearGradient colors={['#16072D', '#06020F']} style={styles.root}>
        <SafeAreaView style={styles.activeSafe}>
          <Text style={styles.activeMeta}>{sound.label} · {breathwork.label}</Text>
          <Text style={styles.timer}>{formatTimer(timer)}</Text>
          <View style={styles.activeCenter}>
            <Animated.Image
              resizeMode="contain"
              source={{ uri: avatarUrl }}
              style={[styles.activeAvatar, { transform: [{ translateY }] }]}
            />
            {breathwork.pattern.length ? (
              <View style={styles.breathPanel}>
                <Text style={styles.breathPhase}>{phaseName}</Text>
                <Text style={styles.breathCount}>{Math.max(duration - breathCount, 0)}s</Text>
              </View>
            ) : null}
          </View>
          {audioError ? <Text style={styles.error}>{audioError}</Text> : null}
          <View style={styles.activeControls}>
            <Pressable accessibilityRole="button" onPress={togglePause} style={styles.pauseButton}>
              <Text style={styles.pauseText}>{paused ? 'Resume' : 'Pause'}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ busy: sessionExiting, disabled: sessionExiting }}
              disabled={sessionExiting}
              onPress={stop}
              style={[styles.stopButton, sessionExiting && styles.disabled]}
            >
              <Text style={styles.stopText}>{sessionExiting ? 'Ending...' : 'End session'}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (phase === 'done') {
    return (
      <LinearGradient colors={['#16072D', '#06020F']} style={styles.root}>
        <SafeAreaView style={styles.doneSafe}>
          <Image resizeMode="contain" source={{ uri: avatarUrl }} style={styles.doneAvatar} />
          <Text style={styles.doneTitle}>Session complete</Text>
          <Text style={styles.doneCopy}>{formatTimer(timer)} · {sound.label} · {breathwork.label}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              guardRef.current.resetExit();
              setPhase('setup');
            }}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryText}>Choose Something Else</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={handleBack} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Go Back</Text>
          </Pressable>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#2D0A6E', '#110421', '#05020D']} style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom + 28, 48) }]}
        >
          <View style={styles.header}>
            <BackButton onPress={handleBack} />
            <Text style={styles.title}>Meditate</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.hero}>
            <Image resizeMode="contain" source={{ uri: avatarUrl }} style={styles.heroAvatar} />
            <Text style={styles.heroTitle}>Breathe with {companion.name}</Text>
            <Text style={styles.heroCopy}>Choose your sound, breathing rhythm, and companion.</Text>
          </View>

          <View style={styles.segment}>
            {(['classic', 'world'] as const).map((item) => (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === item }}
                key={item}
                onPress={() => selectTab(item)}
                style={[styles.segmentItem, tab === item && styles.segmentItemActive]}
              >
                <Text style={[styles.segmentText, tab === item && styles.segmentTextActive]}>
                  {item === 'classic' ? 'Classic' : 'World'}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionTitle}>{tab === 'classic' ? 'Classic sounds' : 'World music'}</Text>
          <View style={styles.soundGrid}>
            {visibleSounds.map((item) => (
              <SoundCard
                active={selectedSound === item.id}
                description={item.available ? item.desc : `${item.desc} · unavailable`}
                disabled={!item.available}
                iconUrl={item.iconUrl}
                key={item.id}
                onPress={() => handleSoundSelect(item.id)}
                title={item.label}
              />
            ))}
          </View>
          {audioError ? <Text style={styles.error}>{audioError}</Text> : null}

          <Text style={styles.sectionTitle}>Breathwork</Text>
          {BREATHWORK_PATTERNS.map((item) => (
            <OptionRow
              active={selectedBreath === item.id}
              description={item.desc}
              key={item.id}
              onPress={() => setSelectedBreath(item.id)}
              title={item.label}
            />
          ))}

          <Text style={styles.sectionTitle}>Companion</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {COMPANIONS.map((id) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: companionId === id }}
                key={id}
                onPress={() => {
                  setCompanionId(id);
                  void setAppStorageItem(MEDITATE_COMPANION_KEY, id);
                }}
                style={[styles.companionPill, companionId === id && styles.companionPillActive]}
              >
                <Text style={styles.companionPillText}>{getCompanionMeta(id).name}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Pressable accessibilityRole="button" onPress={() => void start()} style={styles.primaryButton}>
            <Text style={styles.primaryText}>Begin Session</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function SoundCard({
  active,
  description,
  disabled,
  iconUrl,
  onPress,
  title,
}: {
  active: boolean;
  description: string;
  disabled?: boolean;
  iconUrl: string;
  onPress: () => void;
  title: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.soundCard, active && styles.soundCardActive, disabled && styles.disabled]}
    >
      <View style={styles.soundMarkWrap}>
        <Image resizeMode="contain" source={{ uri: iconUrl }} style={styles.soundIcon} />
      </View>
      <Text numberOfLines={2} style={styles.soundTitle}>{title}</Text>
      <Text numberOfLines={2} style={styles.soundDesc}>{description}</Text>
    </Pressable>
  );
}

function OptionRow({
  active,
  description,
  onPress,
  title,
}: {
  active: boolean;
  description: string;
  onPress: () => void;
  title: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.optionRow, active && styles.optionRowActive]}
    >
      <View style={styles.optionText}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionDesc}>{description}</Text>
      </View>
      <Text style={styles.selectedMark}>{active ? '✓' : ''}</Text>
    </Pressable>
  );
}

function isValidSoundForTab(value: string | null, tab: MeditationTab): value is SelectedSoundId {
  if (!value) return false;
  return tab === 'classic'
    ? MEDITATION_SOUNDS.some((item) => item.id === value)
    : WORLD_MEDITATION_SOUNDS.some((item) => item.id === value);
}

function resolveCompanionId(value: string | null): CompanionId {
  return COMPANIONS.includes(value as CompanionId) ? (value as CompanionId) : 'luna';
}

function formatTimer(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  activeAvatar: { flex: 1, maxHeight: 430, width: '92%' },
  activeCenter: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  activeControls: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 28,
  },
  activeMeta: { color: 'rgba(255,255,255,0.52)', fontSize: 13, marginTop: 12, textAlign: 'center' },
  activeSafe: { flex: 1, paddingHorizontal: 24 },
  breathCount: { color: 'rgba(255,255,255,0.54)', fontSize: 14, textAlign: 'center' },
  breathPanel: { alignItems: 'center', marginTop: 18 },
  breathPhase: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  companionPill: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  companionPillActive: { backgroundColor: 'rgba(168,85,247,0.2)', borderColor: 'rgba(168,85,247,0.44)' },
  companionPillText: { color: 'rgba(255,255,255,0.72)', fontSize: 12, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  doneAvatar: { height: 180, width: 220 },
  doneCopy: { color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 28, textAlign: 'center' },
  doneSafe: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  doneTitle: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', marginBottom: 8 },
  error: { color: '#FDA4AF', fontSize: 13, marginTop: 8, textAlign: 'center' },
  header: { alignItems: 'center', flexDirection: 'row', marginBottom: 16 },
  headerSpacer: { width: 44 },
  hero: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 28,
    borderWidth: 1,
    marginBottom: 18,
    padding: 20,
  },
  heroAvatar: { height: 190, width: 220 },
  heroCopy: { color: 'rgba(255,255,255,0.58)', fontSize: 13, lineHeight: 20, textAlign: 'center' },
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', marginBottom: 8, textAlign: 'center' },
  optionDesc: { color: 'rgba(255,255,255,0.52)', fontSize: 12, marginTop: 3 },
  optionRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 10,
    padding: 14,
  },
  optionRowActive: { backgroundColor: 'rgba(168,85,247,0.15)', borderColor: 'rgba(168,85,247,0.36)' },
  optionText: { flex: 1 },
  optionTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  pauseButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(139,92,246,0.24)',
    borderColor: 'rgba(196,181,253,0.32)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 30,
    paddingVertical: 14,
  },
  pauseText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#8B5CF6',
    borderRadius: 18,
    marginTop: 20,
    padding: 16,
    width: '100%',
  },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  root: { flex: 1 },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 18 },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    marginTop: 10,
    padding: 14,
    width: '100%',
  },
  secondaryText: { color: 'rgba(255,255,255,0.62)', fontSize: 14, fontWeight: '800' },
  sectionTitle: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 18,
    textTransform: 'uppercase',
  },
  segment: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    flexDirection: 'row',
    padding: 4,
  },
  segmentItem: { alignItems: 'center', borderRadius: 13, flex: 1, paddingVertical: 11 },
  segmentItemActive: { backgroundColor: '#7C3AED' },
  segmentText: { color: 'rgba(255,255,255,0.58)', fontSize: 13, fontWeight: '800' },
  segmentTextActive: { color: '#FFFFFF' },
  selectedMark: { color: '#C084FC', fontSize: 18, fontWeight: '900', width: 20 },
  soundCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 138,
    padding: 12,
    width: '31.5%',
  },
  soundCardActive: { backgroundColor: 'rgba(168,85,247,0.18)', borderColor: '#A855F7', borderWidth: 2 },
  soundDesc: { color: 'rgba(255,255,255,0.48)', fontSize: 10, lineHeight: 14, marginTop: 5, textAlign: 'center' },
  soundGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  soundIcon: { height: 54, width: 54 },
  soundMarkWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(168,85,247,0.26)',
    borderRadius: 18,
    height: 62,
    justifyContent: 'center',
    marginBottom: 9,
    width: 62,
  },
  soundTitle: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', textAlign: 'center' },
  stopButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  stopText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  timer: { color: 'rgba(255,255,255,0.14)', fontSize: 48, fontWeight: '200', letterSpacing: 6, textAlign: 'center' },
  title: { color: '#FFFFFF', flex: 1, fontSize: 22, fontWeight: '900', textAlign: 'center' },
});
