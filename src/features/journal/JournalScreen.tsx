import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/BackButton';
import { getCompanionMeta, type CompanionId } from '@/features/onboarding/companionQuiz';
import {
  deleteRemoteJournalEntry,
  saveRemoteJournalEntry,
  type RemoteJournalEntry,
} from '@/lib/journal/remoteJournal';
import { IMMERSIVE_JOURNAL_WORLDS, type JournalWorld } from '@/lib/meditation/catalog';
import { useAndroidBackHandler } from '@/lib/navigation/useAndroidBackHandler';
import { updateCachedJournalEntries, useRestoration } from '@/lib/restoration/restorationStore';
import {
  getAppStorageItem,
  getJsonItem,
  setAppStorageItem,
  setJsonItem,
} from '@/lib/storage/appStorage';

type JournalMode = 'home' | 'classic' | 'immersive' | 'list' | 'detail' | 'world';

type JournalEntry = {
  content: string;
  created_date: string;
  id: string;
  images?: string[];
  mood: MoodId;
  stickers?: string[];
  syncStatus?: 'pending' | 'synced';
  title: string;
  world?: string;
};

type MoodId =
  | 'happy'
  | 'contentment'
  | 'neutral'
  | 'sad'
  | 'fear'
  | 'anger'
  | 'disgust'
  | 'surprise'
  | 'fatigue';

type JournalScreenProps = {
  onBack: () => void;
  onOpenChat?: (() => void) | undefined;
  onOpenHome?: (() => void) | undefined;
  onOpenMeditation?: (() => void) | undefined;
};

const JOURNAL_ENTRIES_KEY = 'unfiltr_journal_entries';
const JOURNAL_WORLD_KEY = 'unfiltr_journal_world';
const JOURNAL_DRAFT_KEY = 'unfiltr_recovery_journal_entry';
const JOURNAL_WRITER_DRAFT_KEY = 'unfiltr_recovery_journal_writer';
const MEDITATE_COMPANION_KEY = 'unfiltr_meditate_companion';

const MOODS: { id: MoodId; label: string; mark: string }[] = [
  { id: 'happy', label: 'Happy', mark: ':)' },
  { id: 'contentment', label: 'Content', mark: 'calm' },
  { id: 'neutral', label: 'Neutral', mark: '-' },
  { id: 'sad', label: 'Sad', mark: '..' },
  { id: 'fear', label: 'Anxious', mark: '!' },
  { id: 'anger', label: 'Frustrated', mark: '!!' },
  { id: 'disgust', label: 'Disgusted', mark: 'x' },
  { id: 'surprise', label: 'Surprised', mark: '?' },
  { id: 'fatigue', label: 'Tired', mark: 'zzz' },
];

const STICKERS = ['heart', 'star', 'sparkle', 'flower', 'moon', 'leaf'];
const COMPANION_REPLIES = [
  'That really resonates... tell me more if you want.',
  "I'm here, listening to every word.",
  'Thank you for trusting me with that.',
  "You're doing something important by writing this down.",
  'I see you. Keep going.',
  "That took courage to write. I'm proud of you.",
];

export function JournalScreen({ onBack }: JournalScreenProps) {
  const insets = useSafeAreaInsets();
  const restoration = useRestoration();
  const [mode, setMode] = useState<JournalMode>('home');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [selectedWorld, setSelectedWorld] = useState(IMMERSIVE_JOURNAL_WORLDS[0]!);
  const [companionId, setCompanionId] = useState<CompanionId>('luna');
  const [companionName, setCompanionName] = useState('Luna');
  const [currentMood, setCurrentMood] = useState<MoodId>('neutral');

  useEffect(() => {
    let mounted = true;

    async function load() {
      const [storedEntries, mood, world, storedCompanionId, companionPayload, nick] =
        await Promise.all([
          getJsonItem<JournalEntry[]>(JOURNAL_ENTRIES_KEY, []),
          getAppStorageItem('unfiltr_mood'),
          getAppStorageItem(JOURNAL_WORLD_KEY),
          getAppStorageItem('unfiltr_companion_id'),
          getAppStorageItem('unfiltr_companion'),
          getAppStorageItem('unfiltr_companion_nickname'),
        ]);
      if (!mounted) return;

      const parsedCompanion = parseCompanion(companionPayload);
      const resolvedId = resolveCompanionId(storedCompanionId || parsedCompanion?.id);
      const meta = getCompanionMeta(resolvedId);
      const restoredEntries = mapRemoteEntries(restoration.journalEntries.data);
      setEntries(restoredEntries.length ? restoredEntries : storedEntries);
      setCurrentMood(resolveMood(mood));
      setCompanionId(resolvedId);
      setCompanionName(nick?.trim() || parsedCompanion?.displayName || meta.name);
      setSelectedWorld(
        IMMERSIVE_JOURNAL_WORLDS.find((item) => item.id === world) ?? IMMERSIVE_JOURNAL_WORLDS[0]!,
      );
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [restoration.journalEntries.data, restoration.journalEntries.source]);

  async function persistEntries(next: JournalEntry[]) {
    setEntries(next);
    await setJsonItem(JOURNAL_ENTRIES_KEY, next);
    await updateCachedJournalEntries(next.map(toRemoteJournalEntry));
  }

  function openEntry(entry: JournalEntry) {
    setSelectedEntry(entry);
    setMode('detail');
  }

  async function saveEntry(entry: JournalEntry) {
    const pendingEntry = { ...entry, syncStatus: 'pending' as const };
    const next = [pendingEntry, ...entries.filter((item) => item.id !== entry.id)];
    await persistEntries(next);
    await setAppStorageItem(
      'unfiltr_mood_history',
      JSON.stringify({ [new Date().toISOString().slice(0, 10)]: entry.mood }),
    );
    try {
      const saved = await saveRemoteJournalEntry(toRemoteJournalEntry(entry));
      if (saved) {
        const synced = mapRemoteEntry(saved);
        await persistEntries([synced, ...next.filter((item) => item.id !== synced.id)]);
      }
    } catch {
      await persistEntries(next);
    }
    setMode('list');
  }

  async function deleteEntry(entryId: string) {
    const next = entries.filter((entry) => entry.id !== entryId);
    await persistEntries(next);
    try {
      await deleteRemoteJournalEntry(entryId);
    } catch {
      // Local deletion stands; a later save/restore will rehydrate if the server still has it.
    }
    setSelectedEntry(null);
    setMode('list');
  }

  const handleAndroidBack = useCallback(() => {
    if (mode === 'home') {
      onBack();
      return true;
    }
    if (mode === 'detail') {
      setMode('list');
      return true;
    }
    setMode('home');
    return true;
  }, [mode, onBack]);
  useAndroidBackHandler(handleAndroidBack);

  return (
    <LinearGradient colors={['#2A0A55', '#10031F', '#05020D']} style={styles.root}>
      <SafeAreaView style={styles.safe}>
        {mode === 'classic' || mode === 'immersive' ? (
          <JournalWriter
            companionId={companionId}
            companionName={companionName}
            initialMood={currentMood}
            immersive={mode === 'immersive'}
            onBack={() => setMode('home')}
            onSave={(entry) => void saveEntry(entry)}
            selectedWorld={selectedWorld}
          />
        ) : mode === 'world' ? (
          <WorldPicker
            onBack={() => setMode('home')}
            onSelect={(world) => {
              setSelectedWorld(world);
              void setAppStorageItem(JOURNAL_WORLD_KEY, world.id);
              setMode('immersive');
            }}
            selectedWorldId={selectedWorld.id}
          />
        ) : mode === 'detail' && selectedEntry ? (
          <EntryDetail
            entry={selectedEntry}
            onBack={() => setMode('list')}
            onDelete={() => void deleteEntry(selectedEntry.id)}
            onEdit={() => setMode('classic')}
          />
        ) : (
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: Math.max(insets.bottom + 28, 48) },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <Header
              companionName={companionName}
              onBack={mode === 'home' ? onBack : () => setMode('home')}
              title={mode === 'list' ? 'Saved Entries' : 'Journal'}
            />
            {mode === 'list' ? (
              <EntryList entries={entries} onCreate={() => setMode('classic')} onOpen={openEntry} />
            ) : (
              <JournalHome
                entries={entries}
                onClassic={() => setMode('classic')}
                onImmersive={() => setMode('world')}
                onList={() => setMode('list')}
              />
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

function Header({
  companionName,
  onBack,
  title,
}: {
  companionName: string;
  onBack: () => void;
  title: string;
}) {
  return (
    <View style={styles.header}>
      <BackButton onPress={onBack} />
      <View style={styles.headerTitleWrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>Private reflections with {companionName}</Text>
      </View>
    </View>
  );
}

function JournalHome({
  entries,
  onClassic,
  onImmersive,
  onList,
}: {
  entries: JournalEntry[];
  onClassic: () => void;
  onImmersive: () => void;
  onList: () => void;
}) {
  return (
    <View>
      <ModeCard
        accent="#A78BFA"
        body="Mood, recovery, voice, photos, stickers"
        onPress={onClassic}
        title="Classic writing"
      />
      <ModeCard
        accent="#60A5FA"
        body="Choose a room and write with your companion nearby"
        onPress={onImmersive}
        title="Immersive world"
      />
      <View style={styles.savedPreview}>
        <View style={styles.savedHeader}>
          <Text style={styles.cardTitle}>Saved Entries</Text>
          <Pressable accessibilityRole="button" onPress={onList}>
            <Text style={styles.linkText}>View all</Text>
          </Pressable>
        </View>
        {entries.length ? (
          entries
            .slice(0, 3)
            .map((entry) => <EntryRow entry={entry} key={entry.id} onPress={onList} />)
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Your journal is empty</Text>
            <Text style={styles.emptyCopy}>
              Write freely, speak your thoughts, or just reflect. Your journal is private.
            </Text>
            <Pressable accessibilityRole="button" onPress={onClassic} style={styles.emptyButton}>
              <Text style={styles.emptyButtonText}>Start Journaling</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

function ModeCard({
  accent,
  body,
  onPress,
  title,
}: {
  accent: string;
  body: string;
  onPress: () => void;
  title: string;
}) {
  return (
    <Pressable
      accessibilityLabel={title}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.modeCard,
        { borderColor: accent, backgroundColor: title.includes('Classic') ? '#5B2AA0' : '#12375F' },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.modeText}>
        <Text style={styles.modeTitle}>{title}</Text>
        <Text style={styles.modeBody}>{body}</Text>
      </View>
      <ForwardArrowIcon />
    </Pressable>
  );
}

function ForwardArrowIcon() {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.forwardArrowIcon}
    >
      <View style={styles.forwardArrowLine} />
      <View style={styles.forwardArrowHead} />
    </View>
  );
}

function EntryList({
  entries,
  onCreate,
  onOpen,
}: {
  entries: JournalEntry[];
  onCreate: () => void;
  onOpen: (entry: JournalEntry) => void;
}) {
  const groups = groupEntries(entries);
  return (
    <View>
      <Pressable accessibilityRole="button" onPress={onCreate} style={styles.newEntryButton}>
        <Text style={styles.newEntryText}>New Entry</Text>
      </Pressable>
      {entries.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Your journal is empty</Text>
          <Text style={styles.emptyCopy}>Your memories live here when you are ready.</Text>
        </View>
      ) : (
        groups.map((group) => (
          <View key={group.label} style={styles.entryGroup}>
            <Text style={styles.groupLabel}>{group.label}</Text>
            {group.entries.map((entry) => (
              <EntryRow entry={entry} key={entry.id} onPress={() => onOpen(entry)} />
            ))}
          </View>
        ))
      )}
    </View>
  );
}

function EntryRow({ entry, onPress }: { entry: JournalEntry; onPress: () => void }) {
  const mood = MOODS.find((item) => item.id === entry.mood) ?? MOODS[2]!;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.entryRow}>
      <Text style={styles.entryMood}>{mood.mark}</Text>
      <View style={styles.entryText}>
        <Text numberOfLines={1} style={styles.entryTitle}>
          {entry.title || 'Untitled'}
        </Text>
        <Text style={styles.entryDate}>{formatEntryDate(entry.created_date)}</Text>
        {entry.syncStatus === 'pending' ? <Text style={styles.entrySync}>Sync pending</Text> : null}
      </View>
    </Pressable>
  );
}

function JournalWriter({
  companionId,
  companionName,
  immersive,
  initialMood,
  onBack,
  onSave,
  selectedWorld,
}: {
  companionId: CompanionId;
  companionName: string;
  immersive: boolean;
  initialMood: MoodId;
  onBack: () => void;
  onSave: (entry: JournalEntry) => void;
  selectedWorld: JournalWorld;
}) {
  const insets = useSafeAreaInsets();
  const companion = getCompanionMeta(companionId);
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<MoodId>(initialMood);
  const [stickers, setStickers] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [voiceOn, setVoiceOn] = useState(false);
  const [reply, setReply] = useState('');
  const draftKey = immersive ? JOURNAL_DRAFT_KEY : JOURNAL_WRITER_DRAFT_KEY;

  useEffect(() => {
    let mounted = true;
    void getJsonItem<{ content?: string; images?: string[]; mood?: MoodId; stickers?: string[] }>(
      draftKey,
      {},
    ).then((draft) => {
      if (!mounted) return;
      if (draft.content) setContent(draft.content);
      if (draft.mood) setMood(draft.mood);
      if (draft.images) setImages(draft.images);
      if (draft.stickers) setStickers(draft.stickers);
    });
    return () => {
      mounted = false;
    };
  }, [draftKey]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void setJsonItem(draftKey, { content, images, mood, stickers, savedAt: Date.now() });
    }, 900);
    return () => clearTimeout(timeout);
  }, [content, draftKey, images, mood, stickers]);

  function handleSave() {
    if (!content.trim() && images.length === 0 && stickers.length === 0) return;
    const entry: JournalEntry = {
      content: content.trim(),
      created_date: new Date().toISOString(),
      id: Date.now().toString(),
      images,
      mood,
      stickers,
      title: titleFromContent(content),
    };
    if (immersive) entry.world = selectedWorld.id;
    setReply(COMPANION_REPLIES[Math.floor(Math.random() * COMPANION_REPLIES.length)]!);
    setTimeout(() => onSave(entry), immersive ? 850 : 150);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.writerRoot}
    >
      {immersive ? (
        <LinearGradient
          colors={[selectedWorld.accent, '#0B0614', '#05020D']}
          locations={[0, 0.38, 1]}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View style={styles.writerHeader}>
        <BackButton onPress={onBack} />
        <Text style={styles.writerHeaderTitle}>
          {immersive ? selectedWorld.label : 'New Entry'}
        </Text>
        <Pressable accessibilityRole="button" onPress={handleSave} style={styles.saveButton}>
          <Text style={styles.saveButtonText}>Save</Text>
        </Pressable>
      </View>

      {immersive ? (
        <View style={styles.immersiveCompanion}>
          <Image
            resizeMode="contain"
            source={{ uri: companion.avatar }}
            style={styles.immersiveAvatar}
          />
          {reply ? <Text style={styles.companionReply}>{reply}</Text> : null}
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.writerContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.promptLabel}>HOW ARE YOU FEELING?</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.moodScroll}>
          {MOODS.map((item) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: mood === item.id }}
              key={item.id}
              onPress={() => setMood(item.id)}
              style={[styles.moodButton, mood === item.id && styles.moodButtonActive]}
            >
              <Text
                style={[styles.moodButtonText, mood === item.id && styles.moodButtonTextActive]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <Text style={styles.promptText}>
          {immersive
            ? `Write anything... ${companionName} is listening.`
            : "What's on your mind right now?"}
        </Text>
        <TextInput
          accessibilityLabel="Journal entry"
          multiline
          onChangeText={setContent}
          placeholder="Start writing..."
          placeholderTextColor="rgba(255,255,255,0.32)"
          selectionColor="#A855F7"
          style={styles.writerInput}
          value={content}
        />
        {stickers.length ? (
          <View style={styles.inlineRow}>
            {stickers.map((sticker, index) => (
              <Text key={`${sticker}-${index}`} style={styles.inlineToken}>
                {sticker}
              </Text>
            ))}
          </View>
        ) : null}
        {images.length ? (
          <View style={styles.inlineRow}>
            {images.map((image, index) => (
              <View key={`${image}-${index}`} style={styles.photoStub}>
                <Text style={styles.photoStubText}>Photo {index + 1}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
      <View style={[styles.writerToolbar, { paddingBottom: Math.max(insets.bottom + 10, 18) }]}>
        <ToolButton
          label="Photo"
          onPress={() => setImages((current) => [...current, `photo-${Date.now()}`])}
        />
        <ToolButton
          label="Stickers"
          onPress={() =>
            setStickers((current) => [
              ...current,
              STICKERS[current.length % STICKERS.length] ?? 'sparkle',
            ])
          }
        />
        <ToolButton
          label={voiceOn ? 'Stop' : 'Voice'}
          onPress={() => setVoiceOn((value) => !value)}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function ToolButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.toolButton}
    >
      <Text style={styles.toolText}>{label}</Text>
    </Pressable>
  );
}

function WorldPicker({
  onBack,
  onSelect,
  selectedWorldId,
}: {
  onBack: () => void;
  onSelect: (world: JournalWorld) => void;
  selectedWorldId: string;
}) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Header companionName="your companion" onBack={onBack} title="Pick Your Space" />
      {IMMERSIVE_JOURNAL_WORLDS.map((world) => (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: selectedWorldId === world.id }}
          key={world.id}
          onPress={() => onSelect(world)}
          style={[styles.worldCard, { borderColor: world.accent }]}
        >
          <Text style={[styles.worldTitle, { color: world.accent }]}>{world.label}</Text>
          <Text style={styles.worldDesc}>{world.desc}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function EntryDetail({
  entry,
  onBack,
  onDelete,
  onEdit,
}: {
  entry: JournalEntry;
  onBack: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Header
        companionName="Saved reflection"
        onBack={onBack}
        title={entry.title || 'Journal Entry'}
      />
      <View style={styles.detailCard}>
        <Text style={styles.entryDate}>{formatEntryDate(entry.created_date)}</Text>
        <Text style={styles.detailText}>{entry.content}</Text>
        {entry.stickers?.length ? (
          <Text style={styles.detailMeta}>Stickers: {entry.stickers.join(', ')}</Text>
        ) : null}
        {entry.images?.length ? (
          <Text style={styles.detailMeta}>Photos: {entry.images.length}</Text>
        ) : null}
      </View>
      <Pressable accessibilityRole="button" onPress={onEdit} style={styles.newEntryButton}>
        <Text style={styles.newEntryText}>Edit Entry</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onDelete} style={styles.deleteButton}>
        <Text style={styles.deleteText}>Delete Entry</Text>
      </Pressable>
    </ScrollView>
  );
}

function groupEntries(entries: JournalEntry[]) {
  const groups = new Map<string, JournalEntry[]>();
  entries.forEach((entry) => {
    const date = new Date(entry.created_date);
    const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    groups.set(label, [...(groups.get(label) ?? []), entry]);
  });
  return [...groups.entries()].map(([label, groupEntries]) => ({ entries: groupEntries, label }));
}

function titleFromContent(content: string) {
  const trimmed = content.trim();
  if (!trimmed) return 'Untitled Entry';
  return trimmed.split(/\s+/).slice(0, 6).join(' ').slice(0, 52);
}

function formatEntryDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
  });
}

function resolveMood(value: string | null): MoodId {
  return MOODS.some((mood) => mood.id === value) ? (value as MoodId) : 'neutral';
}

function resolveCompanionId(value: string | null | undefined): CompanionId {
  const id = value?.toLowerCase().trim();
  const valid: CompanionId[] = [
    'ash',
    'echo',
    'juan',
    'kai',
    'luna',
    'nova',
    'river',
    'ryuu',
    'sage',
    'sakura',
    'soleil',
    'zara',
  ];
  return valid.includes(id as CompanionId) ? (id as CompanionId) : 'luna';
}

function parseCompanion(value: string | null): { displayName?: string; id?: string } | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as { displayName?: string; id?: string };
  } catch {
    return null;
  }
}

function mapRemoteEntries(entries: RemoteJournalEntry[] | null): JournalEntry[] {
  return Array.isArray(entries) ? entries.map(mapRemoteEntry) : [];
}

function mapRemoteEntry(entry: RemoteJournalEntry): JournalEntry {
  return {
    content: entry.content,
    created_date: entry.created_at || entry.created_date || new Date().toISOString(),
    id: entry.id,
    mood: resolveMood(entry.mood || null),
    syncStatus: 'synced',
    title: entry.title || titleFromContent(entry.content),
  };
}

function toRemoteJournalEntry(entry: JournalEntry): RemoteJournalEntry {
  return {
    content: entry.content,
    created_at: entry.created_date,
    created_date: entry.created_date,
    id: entry.id,
    mood: entry.mood,
    title: entry.title,
  };
}

export const journalStorageKeys = {
  entries: JOURNAL_ENTRIES_KEY,
  meditateCompanion: MEDITATE_COMPANION_KEY,
  world: JOURNAL_WORLD_KEY,
};

const styles = StyleSheet.create({
  bottomNavWrap: {
    alignSelf: 'center',
    backgroundColor: 'rgba(8,5,17,0.92)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    left: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
    position: 'absolute',
    right: 20,
  },
  cardTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  chipRow: { flexDirection: 'row', gap: 10, marginTop: 22 },
  circleButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  circleText: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  companionReply: {
    backgroundColor: 'rgba(0,0,0,0.56)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 16,
    borderWidth: 1,
    color: '#FFFFFF',
    fontSize: 13,
    marginTop: -6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    textAlign: 'center',
  },
  deleteButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(251,113,133,0.12)',
    borderColor: 'rgba(251,113,133,0.35)',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 12,
    padding: 14,
  },
  deleteText: { color: '#FB7185', fontSize: 14, fontWeight: '800' },
  detailCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
  },
  detailMeta: { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 12 },
  detailText: { color: 'rgba(255,255,255,0.88)', fontSize: 16, lineHeight: 29, marginTop: 20 },
  emptyButton: {
    alignSelf: 'center',
    backgroundColor: 'rgba(168,85,247,0.16)',
    borderColor: 'rgba(168,85,247,0.32)',
    borderRadius: 22,
    borderWidth: 1,
    marginTop: 18,
    paddingHorizontal: 22,
    paddingVertical: 11,
  },
  emptyButtonText: { color: '#C084FC', fontSize: 14, fontWeight: '800' },
  emptyCopy: { color: 'rgba(255,255,255,0.52)', fontSize: 13, lineHeight: 21, textAlign: 'center' },
  emptyState: { alignItems: 'center', paddingHorizontal: 22, paddingVertical: 30 },
  emptyTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginBottom: 8 },
  entryDate: { color: 'rgba(255,255,255,0.48)', fontSize: 11 },
  entryGroup: { gap: 10, marginTop: 18 },
  entryMood: { color: '#C084FC', fontSize: 14, fontWeight: '900', width: 26 },
  entryRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  entryText: { flex: 1 },
  entrySync: { color: '#FBBF24', fontSize: 11, fontWeight: '800', marginTop: 3 },
  entryTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  forwardArrowHead: {
    borderRightColor: '#FFFFFF',
    borderRightWidth: 3,
    borderTopColor: '#FFFFFF',
    borderTopWidth: 3,
    height: 12,
    marginLeft: -8,
    transform: [{ rotate: '45deg' }],
    width: 12,
  },
  forwardArrowIcon: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 32,
    justifyContent: 'center',
    marginLeft: 16,
    width: 32,
  },
  forwardArrowLine: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    height: 3,
    width: 18,
  },
  groupLabel: {
    color: 'rgba(255,255,255,0.34)',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  header: { alignItems: 'center', flexDirection: 'row', gap: 18, marginBottom: 22 },
  headerTitleWrap: { flex: 1 },
  immersiveAvatar: { height: 158, width: 180 },
  immersiveCompanion: { alignItems: 'center', paddingTop: 8 },
  inlineRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  inlineToken: {
    backgroundColor: 'rgba(168,85,247,0.16)',
    borderRadius: 999,
    color: '#E9D5FF',
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  linkText: { color: '#C084FC', fontSize: 13, fontWeight: '800' },
  modeBody: { color: 'rgba(255,255,255,0.74)', fontSize: 13, marginTop: 4 },
  modeCard: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    minHeight: 90,
    paddingHorizontal: 22,
    paddingVertical: 18,
  },
  modeText: { flex: 1, paddingRight: 12 },
  modeTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  moodButton: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  moodButtonActive: {
    backgroundColor: 'rgba(168,85,247,0.22)',
    borderColor: 'rgba(168,85,247,0.44)',
  },
  moodButtonText: { color: 'rgba(255,255,255,0.58)', fontSize: 12, fontWeight: '700' },
  moodButtonTextActive: { color: '#E9D5FF' },
  moodChip: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  moodChipText: { color: 'rgba(255,255,255,0.78)', fontSize: 12, fontWeight: '800' },
  moodScroll: { marginBottom: 16 },
  navItem: { alignItems: 'center', flex: 1 },
  navText: { color: 'rgba(255,255,255,0.5)', fontSize: 11 },
  navTextActive: { color: '#C084FC', fontWeight: '900' },
  newEntryButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(168,85,247,0.18)',
    borderColor: 'rgba(168,85,247,0.38)',
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 18,
    padding: 14,
  },
  newEntryText: { color: '#E9D5FF', fontSize: 14, fontWeight: '900' },
  photoStub: {
    backgroundColor: 'rgba(96,165,250,0.16)',
    borderRadius: 12,
    height: 72,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  photoStubText: { color: '#BFDBFE', fontSize: 12, fontWeight: '800' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  promptLabel: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  promptText: { color: '#C084FC', fontSize: 14, fontStyle: 'italic', marginBottom: 12 },
  root: { flex: 1 },
  safe: { flex: 1 },
  saveButton: {
    backgroundColor: 'rgba(52,211,153,0.16)',
    borderColor: 'rgba(52,211,153,0.32)',
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  saveButtonText: { color: '#86EFAC', fontSize: 13, fontWeight: '900' },
  savedHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  savedPreview: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 24,
    borderWidth: 1,
    marginTop: 14,
    padding: 20,
  },
  scrollContent: { paddingHorizontal: 20, paddingTop: 52 },
  subtitle: { color: 'rgba(255,255,255,0.62)', fontSize: 13 },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  todayCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(168,85,247,0.35)',
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 28,
    minHeight: 150,
    padding: 20,
  },
  todayCopy: { color: 'rgba(255,255,255,0.68)', fontSize: 14, lineHeight: 22, marginTop: 10 },
  toolButton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  toolText: { color: 'rgba(255,255,255,0.72)', fontSize: 12, fontWeight: '800' },
  worldCard: {
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 14,
    minHeight: 106,
    padding: 20,
  },
  worldDesc: { color: 'rgba(255,255,255,0.62)', fontSize: 13, marginTop: 6 },
  worldTitle: { fontSize: 19, fontWeight: '900' },
  writerContent: { paddingHorizontal: 20, paddingTop: 18 },
  writerHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  writerHeaderTitle: {
    color: '#FFFFFF',
    flex: 1,
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  writerInput: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 17,
    lineHeight: 31,
    minHeight: 240,
    textAlignVertical: 'top',
  },
  writerRoot: { flex: 1 },
  writerToolbar: {
    backgroundColor: 'rgba(5,2,13,0.8)',
    borderTopColor: 'rgba(255,255,255,0.08)',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
});
