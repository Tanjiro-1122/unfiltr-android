import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
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
import { AssistantTypingBubble } from '@/features/chat/AssistantTypingBubble';
import { getCompanionMeta, type CompanionId } from '@/features/onboarding/companionQuiz';
import { WorldPickerSheet } from '@/features/worlds';
import { apiClient } from '@/lib/api/client';
import {
  DEFAULT_APPEARANCE,
  appearanceBubbleStyle,
  appearanceFontFamily,
  appearanceFontSize,
  loadAppearancePreferences,
  saveAppearancePreferences,
  type AppearanceBubble,
  type AppearanceFont,
  type AppearancePreferences,
  type AppearanceTextSize,
} from '@/lib/appearance/preferences';
import { saveChatHistory } from '@/lib/chat/history';
import { useAndroidBackHandler } from '@/lib/navigation/useAndroidBackHandler';
import {
  DEFAULT_VOICE_PERSONALITY,
  PERSONALITY_OPTIONS,
  VOICE_OPTIONS,
  loadVoicePersonalityPreferences,
  saveVoicePersonalityPreferences,
  type PersonalityStyle,
  type VoiceStyle,
} from '@/lib/personality/preferences';
import { updateCachedChatHistory, useRestoration } from '@/lib/restoration/restorationStore';
import { isMessageSaved, toggleSavedMoment } from '@/lib/savedConversations/preferences';
import {
  deleteAppStorageItem,
  getAppStorageItem,
  setAppStorageItem,
} from '@/lib/storage/appStorage';
import { DEFAULT_WORLD, type WorldId, type WorldProfile } from '@/lib/worlds/catalog';
import { loadWorldPreference, saveWorldPreference } from '@/lib/worlds/preferences';

export type ChatMessage = {
  content: string;
  createdAt: string;
  id: string;
  role: 'assistant' | 'user';
};

type RelationshipMode = 'friend' | 'coach' | 'companion';

type ChatScreenProps = {
  initialMessages?: ChatMessage[];
  onBack: () => void;
  onMessagesChange?: (messages: ChatMessage[]) => void;
  onOpenSettings: () => void;
};

type ChatResponse = {
  data?: {
    message?: string;
  };
  message?: string;
  reply?: string;
  text?: string;
};

const RELATIONSHIP_MODES: { id: RelationshipMode; label: string }[] = [
  { id: 'friend', label: 'Friend' },
  { id: 'coach', label: 'Coach' },
  { id: 'companion', label: 'Companion' },
];

const APPEARANCE_FONTS: { id: AppearanceFont; label: string }[] = [
  { id: 'modern', label: 'Modern' },
  { id: 'classic', label: 'Classic' },
  { id: 'rounded', label: 'Rounded' },
  { id: 'typewriter', label: 'Typewriter' },
];

const APPEARANCE_SIZES: { id: AppearanceTextSize; label: string }[] = [
  { id: 'small', label: 'Small' },
  { id: 'medium', label: 'Medium' },
  { id: 'large', label: 'Large' },
];

const APPEARANCE_BUBBLES: { id: AppearanceBubble; label: string }[] = [
  { id: 'soft', label: 'Soft' },
  { id: 'rounded', label: 'Rounded' },
  { id: 'minimal', label: 'Minimal' },
];

const STORAGE = {
  messages: 'unfiltr_chat_messages',
  privateSession: 'unfiltr_private_session',
  relationshipMode: 'unfiltr_relationship_mode',
};
const CHAT_REQUEST_TIMEOUT_MS = 30000;

function createMessage(role: ChatMessage['role'], content: string): ChatMessage {
  return {
    content,
    createdAt: new Date().toISOString(),
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
  };
}

export function ChatScreen({
  initialMessages,
  onBack,
  onMessagesChange,
  onOpenSettings,
}: ChatScreenProps) {
  const insets = useSafeAreaInsets();
  const restoration = useRestoration();
  const [world, setWorld] = useState<WorldProfile>(DEFAULT_WORLD);
  const [worldPickerVisible, setWorldPickerVisible] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages ?? []);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [privateSession, setPrivateSession] = useState(false);
  const [relationshipMode, setRelationshipMode] = useState<RelationshipMode>('friend');
  const [personalityStyle, setPersonalityStyle] = useState<PersonalityStyle>(
    DEFAULT_VOICE_PERSONALITY.personality,
  );
  const [voiceStyle, setVoiceStyle] = useState<VoiceStyle>(DEFAULT_VOICE_PERSONALITY.voice);
  const [companionId, setCompanionId] = useState<CompanionId>('luna');
  const [companionName, setCompanionName] = useState('Luna');
  const [displayName, setDisplayName] = useState('');
  const [appearance, setAppearance] = useState<AppearancePreferences>(DEFAULT_APPEARANCE);
  const [latestSaved, setLatestSaved] = useState(false);
  const [savingMoment, setSavingMoment] = useState(false);
  const [saveNotice, setSaveNotice] = useState('');
  const [chatError, setChatError] = useState('');
  const activeRequestRef = useRef<{ controller: AbortController; id: number } | null>(null);
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);

  useEffect(
    () => () => {
      mountedRef.current = false;
      activeRequestRef.current?.controller.abort();
    },
    [],
  );

  function handleAndroidBack() {
    if (worldPickerVisible) {
      setWorldPickerVisible(false);
      return true;
    }
    if (optionsVisible) {
      setOptionsVisible(false);
      return true;
    }
    onBack();
    return true;
  }
  useAndroidBackHandler(handleAndroidBack);

  useEffect(() => {
    let mounted = true;
    void Promise.all([
      loadWorldPreference('chat'),
      getAppStorageItem('unfiltr_companion_id'),
      getAppStorageItem('unfiltr_companion_nickname'),
      getAppStorageItem('unfiltr_display_name'),
      getAppStorageItem(STORAGE.messages),
      getAppStorageItem(STORAGE.privateSession),
      getAppStorageItem(STORAGE.relationshipMode),
      loadAppearancePreferences(),
      loadVoicePersonalityPreferences(),
    ]).then(
      ([
        savedWorld,
        savedCompanionId,
        nickname,
        userName,
        storedMessages,
        privateValue,
        mode,
        savedAppearance,
        voicePersonality,
      ]) => {
        if (!mounted) return;
        const restoredProfile = restoration.profile.data;
        const restoredMessages = restoration.chatHistory.data;
        const resolvedId = resolveCompanionId(
          typeof restoredProfile?.avatar_id === 'string'
            ? restoredProfile.avatar_id
            : savedCompanionId,
        );
        const meta = getCompanionMeta(resolvedId);
        const resolvedName =
          (typeof restoredProfile?.companion_name === 'string'
            ? restoredProfile.companion_name.trim()
            : '') ||
          nickname?.trim() ||
          meta.name;
        const resolvedUserName =
          (typeof restoredProfile?.display_name === 'string'
            ? restoredProfile.display_name.trim()
            : '') ||
          userName?.trim() ||
          '';
        const localMessages = parseMessages(storedMessages);
        const nextMessages = restoredMessages?.length
          ? restoredMessages
          : initialMessages?.length
            ? initialMessages
            : localMessages.length
              ? localMessages
              : [createMessage('assistant', openingMessage(resolvedName, resolvedUserName))];

        setWorld(savedWorld);
        setCompanionId(resolvedId);
        setCompanionName(resolvedName);
        setDisplayName(resolvedUserName);
        setMessages(nextMessages);
        setPrivateSession(privateValue === 'true');
        setRelationshipMode(resolveRelationshipMode(mode));
        setAppearance(savedAppearance);
        setPersonalityStyle(voicePersonality.personality);
        setVoiceStyle(voicePersonality.voice);
      },
    );
    return () => {
      mounted = false;
    };
  }, [initialMessages, restoration.chatHistory.data, restoration.profile.data]);

  useEffect(() => {
    onMessagesChange?.(messages);
    if (privateSession) return;
    void setAppStorageItem(STORAGE.messages, JSON.stringify(messages.slice(-60)));
    if (messages.length) {
      void saveChatHistory(messages);
      void updateCachedChatHistory(messages);
    }
  }, [messages, onMessagesChange, privateSession]);

  const latestAssistant = useMemo(
    () => [...messages].reverse().find((message) => message.role === 'assistant') ?? null,
    [messages],
  );

  useEffect(() => {
    let mounted = true;
    setSaveNotice('');
    if (!latestAssistant) {
      setLatestSaved(false);
      return () => {
        mounted = false;
      };
    }
    void isMessageSaved(latestAssistant.id).then((saved) => {
      if (mounted) setLatestSaved(saved);
    });
    return () => {
      mounted = false;
    };
  }, [latestAssistant]);

  async function selectWorld(worldId: WorldId) {
    const selected = await saveWorldPreference('chat', worldId);
    setWorld(selected);
  }

  async function savePersonalityStyle(personality: PersonalityStyle) {
    setPersonalityStyle(personality);
    await saveVoicePersonalityPreferences({ personality, voice: voiceStyle });
  }

  async function saveVoiceStyle(voice: VoiceStyle) {
    setVoiceStyle(voice);
    await saveVoicePersonalityPreferences({ personality: personalityStyle, voice });
  }

  async function saveAppearance(next: AppearancePreferences) {
    setAppearance(next);
    await saveAppearancePreferences(next);
  }

  async function saveCurrentConversation() {
    if (!messages.length) return;
    await saveChatHistory(messages);
    await updateCachedChatHistory(messages);
    setSaveNotice('Conversation saved.');
  }

  async function clearCurrentConversation() {
    const opening = createMessage('assistant', openingMessage(companionName, displayName));
    setMessages([opening]);
    await deleteAppStorageItem(STORAGE.messages);
    setSaveNotice('Current conversation cleared.');
  }

  async function toggleLatestSavedMoment() {
    if (!latestAssistant || savingMoment) return;
    setSavingMoment(true);
    setSaveNotice('');
    try {
      const result = await toggleSavedMoment(
        latestAssistant.content,
        companionName,
        latestAssistant.id,
      );
      setLatestSaved(result.saved);
      setSaveNotice(result.saved ? 'Saved to Moments.' : 'Removed from Moments.');
    } catch {
      setSaveNotice('Could not update Saved Moments.');
    } finally {
      setSavingMoment(false);
    }
  }

  async function sendMessage() {
    const text = draft.trim();
    if (!text || loading) return;
    const userMessage = createMessage('user', text);
    const next = [...messages, userMessage];
    setDraft('');
    setMessages(next);
    await requestAssistantReply(next);
  }

  async function retryLastMessage() {
    if (loading || !messages.some((message) => message.role === 'user')) return;
    await requestAssistantReply(messages);
  }

  async function requestAssistantReply(next: ChatMessage[]) {
    activeRequestRef.current?.controller.abort();
    const controller = new AbortController();
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    activeRequestRef.current = { controller, id: requestId };
    const timeoutId = setTimeout(() => controller.abort(), CHAT_REQUEST_TIMEOUT_MS);
    setLoading(true);
    setChatError('');
    try {
      const response = await apiClient.post<ChatResponse>(
        '/api/chat',
        {
          companionId,
          companionName,
          companionNickname: companionName,
          messages: next.map(({ content, role }) => ({ content, role })),
          privateSession,
          relationshipMode,
          userName: displayName,
        },
        { signal: controller.signal },
      );
      const reply =
        response.data?.message?.trim() ||
        response.reply?.trim() ||
        response.message?.trim() ||
        response.text?.trim();
      if (!reply) {
        throw new Error('EMPTY_CHAT_RESPONSE');
      }
      if (!isActiveChatRequest(requestId)) return;
      setMessages((current) => [...current, createMessage('assistant', reply)]);
    } catch (error) {
      if (!isActiveChatRequest(requestId)) return;
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[Chat] Assistant request failed: ${message}`);
      setChatError("I couldn't connect right now. Tap to try again.");
    } finally {
      clearTimeout(timeoutId);
      if (activeRequestRef.current?.id === requestId) activeRequestRef.current = null;
      if (isMountedForRequest(requestId)) setLoading(false);
    }
  }

  function isActiveChatRequest(requestId: number): boolean {
    return mountedRef.current && activeRequestRef.current?.id === requestId;
  }

  function isMountedForRequest(requestId: number): boolean {
    return mountedRef.current && requestIdRef.current === requestId;
  }

  const recoveryNotice =
    restoration.status === 'loading'
      ? 'Restoring your latest conversation…'
      : restoration.chatHistory.source === 'unavailable' && restoration.chatHistory.error
        ? 'Chat history could not be restored. New messages will retry the server.'
        : '';

  return (
    <ImageBackground source={{ uri: world.backgroundImage }} style={styles.root} resizeMode="cover">
      <LinearGradient
        colors={['rgba(0,0,0,0.38)', 'rgba(0,0,0,0.04)', 'rgba(3,0,8,0.58)']}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex}
        >
          <View style={styles.header}>
            <BackButton accessibilityLabel="Back to home" onPress={onBack} />
            <View style={styles.headerCenter}>
              <Text numberOfLines={1} style={styles.title}>
                {companionName}
              </Text>
              <Text style={styles.subtitle}>
                {world.label} · {relationshipMode}
              </Text>
            </View>
            <Pressable onPress={() => setOptionsVisible(true)} style={styles.optionsButton}>
              <Text style={styles.optionsText}>Options</Text>
            </Pressable>
            <Pressable onPress={onOpenSettings} style={styles.iconButton}>
              <Text style={styles.settingsText}>⚙</Text>
            </Pressable>
          </View>

          {recoveryNotice ? <Text style={styles.recovery}>{recoveryNotice}</Text> : null}

          <View style={styles.stage}>
            <View style={[styles.assistantBubble, appearanceBubbleStyle(appearance.bubble)]}>
              <Text
                style={[
                  styles.assistantText,
                  {
                    fontFamily: appearanceFontFamily(appearance.font),
                    fontSize: appearanceFontSize(appearance.textSize),
                    lineHeight: appearanceFontSize(appearance.textSize) + 7,
                  },
                ]}
              >
                {loading ? null : latestAssistant?.content || `Hey. ${companionName} is here.`}
              </Text>
              {loading ? <AssistantTypingBubble /> : null}
              {chatError && !loading ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void retryLastMessage()}
                  style={({ pressed }) => [styles.retryNotice, pressed && styles.pressed]}
                >
                  <Text style={styles.retryText}>{chatError}</Text>
                </Pressable>
              ) : null}
              {latestAssistant && !loading ? (
                <Pressable
                  accessibilityLabel={
                    latestSaved ? 'Remove from Saved Moments' : 'Save to Saved Moments'
                  }
                  accessibilityRole="button"
                  disabled={savingMoment}
                  onPress={() => void toggleLatestSavedMoment()}
                  style={({ pressed }) => [
                    styles.saveMomentButton,
                    latestSaved && styles.saveMomentButtonActive,
                    savingMoment && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.saveMomentIcon}>{latestSaved ? '✓' : '📌'}</Text>
                  <Text style={styles.saveMomentText}>
                    {savingMoment ? 'Saving…' : latestSaved ? 'Saved' : 'Save moment'}
                  </Text>
                </Pressable>
              ) : null}
              {saveNotice ? <Text style={styles.saveNotice}>{saveNotice}</Text> : null}
            </View>
            <Image
              source={{ uri: getCompanionMeta(companionId).avatar }}
              resizeMode="contain"
              style={styles.avatar}
            />
          </View>

          <View style={[styles.composerWrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            <TextInput
              multiline
              onChangeText={setDraft}
              onSubmitEditing={() => void sendMessage()}
              placeholder={`Talk to ${companionName}…`}
              placeholderTextColor="rgba(255,255,255,0.48)"
              style={styles.input}
              value={draft}
            />
            <Pressable
              disabled={!draft.trim() || loading}
              onPress={() => void sendMessage()}
              style={[styles.sendButton, (!draft.trim() || loading) && styles.disabled]}
            >
              <Text style={styles.sendText}>➤</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <OptionsSheet
        appearance={appearance}
        companionName={companionName}
        onAppearanceChange={(next) => void saveAppearance(next)}
        onClose={() => setOptionsVisible(false)}
        onClearCurrentConversation={() => void clearCurrentConversation()}
        onOpenWorlds={() => {
          setOptionsVisible(false);
          setWorldPickerVisible(true);
        }}
        onPersonalityStyleChange={(personality) => void savePersonalityStyle(personality)}
        onPrivateSessionToggle={() => {
          const next = !privateSession;
          setPrivateSession(next);
          void Promise.all([
            setAppStorageItem(STORAGE.privateSession, String(next)),
            next ? deleteAppStorageItem(STORAGE.messages) : Promise.resolve(),
          ]);
        }}
        onRelationshipModeChange={(mode) => {
          setRelationshipMode(mode);
          void setAppStorageItem(STORAGE.relationshipMode, mode);
        }}
        onSaveCurrentConversation={() => void saveCurrentConversation()}
        onVoiceStyleChange={(voice) => void saveVoiceStyle(voice)}
        personalityStyle={personalityStyle}
        privateSession={privateSession}
        relationshipMode={relationshipMode}
        visible={optionsVisible}
        voiceStyle={voiceStyle}
        worldLabel={world.label}
      />
      <WorldPickerSheet
        module="chat"
        onClose={() => setWorldPickerVisible(false)}
        onSelect={(worldId) => void selectWorld(worldId)}
        selectedWorldId={world.id}
        visible={worldPickerVisible}
      />
    </ImageBackground>
  );
}

function OptionsSheet({
  appearance,
  companionName,
  onAppearanceChange,
  onClose,
  onClearCurrentConversation,
  onOpenWorlds,
  onPersonalityStyleChange,
  onPrivateSessionToggle,
  onRelationshipModeChange,
  onSaveCurrentConversation,
  onVoiceStyleChange,
  personalityStyle,
  privateSession,
  relationshipMode,
  voiceStyle,
  visible,
  worldLabel,
}: {
  appearance: AppearancePreferences;
  companionName: string;
  onAppearanceChange: (next: AppearancePreferences) => void;
  onClose: () => void;
  onClearCurrentConversation: () => void;
  onOpenWorlds: () => void;
  onPersonalityStyleChange: (personality: PersonalityStyle) => void;
  onPrivateSessionToggle: () => void;
  onRelationshipModeChange: (mode: RelationshipMode) => void;
  onSaveCurrentConversation: () => void;
  onVoiceStyleChange: (voice: VoiceStyle) => void;
  personalityStyle: PersonalityStyle;
  privateSession: boolean;
  relationshipMode: RelationshipMode;
  voiceStyle: VoiceStyle;
  visible: boolean;
  worldLabel: string;
}) {
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <Pressable onPress={onClose} style={styles.scrim}>
        <Pressable style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Options</Text>
              <Text style={styles.sheetCopy}>Tune how {companionName} shows up.</Text>
            </View>
            <Pressable onPress={onClose}>
              <Text style={styles.close}>×</Text>
            </Pressable>
          </View>
          <Text style={styles.sectionLabel}>Connection style</Text>
          <View style={styles.modeRow}>
            {RELATIONSHIP_MODES.map((mode) => (
              <Pressable
                key={mode.id}
                onPress={() => onRelationshipModeChange(mode.id)}
                style={[styles.modeChip, relationshipMode === mode.id && styles.modeChipActive]}
              >
                <Text style={styles.modeText}>{mode.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.sectionLabel}>Tone & humor</Text>
          <View style={styles.modeRow}>
            {PERSONALITY_OPTIONS.map((option) => (
              <Pressable
                key={option.id}
                onPress={() => onPersonalityStyleChange(option.id)}
                style={[styles.modeChip, personalityStyle === option.id && styles.modeChipActive]}
              >
                <Text style={styles.modeText}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.sectionLabel}>Voice</Text>
          <View style={styles.modeRow}>
            {VOICE_OPTIONS.map((option) => (
              <Pressable
                key={option.id}
                onPress={() => onVoiceStyleChange(option.id)}
                style={[styles.modeChip, voiceStyle === option.id && styles.modeChipActive]}
              >
                <Text style={styles.modeText}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.sectionLabel}>Font</Text>
          <View style={styles.modeRow}>
            {APPEARANCE_FONTS.map((option) => (
              <Pressable
                key={option.id}
                onPress={() => onAppearanceChange({ ...appearance, font: option.id })}
                style={[styles.modeChip, appearance.font === option.id && styles.modeChipActive]}
              >
                <Text style={styles.modeText}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.sectionLabel}>Text size</Text>
          <View style={styles.modeRow}>
            {APPEARANCE_SIZES.map((option) => (
              <Pressable
                key={option.id}
                onPress={() => onAppearanceChange({ ...appearance, textSize: option.id })}
                style={[styles.modeChip, appearance.textSize === option.id && styles.modeChipActive]}
              >
                <Text style={styles.modeText}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.sectionLabel}>Chat bubbles</Text>
          <View style={styles.modeRow}>
            {APPEARANCE_BUBBLES.map((option) => (
              <Pressable
                key={option.id}
                onPress={() => onAppearanceChange({ ...appearance, bubble: option.id })}
                style={[styles.modeChip, appearance.bubble === option.id && styles.modeChipActive]}
              >
                <Text style={styles.modeText}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
          <OptionRow label="World background" value={worldLabel} onPress={onOpenWorlds} />
          <OptionRow
            label="Private session"
            value={privateSession ? 'On' : 'Off'}
            onPress={onPrivateSessionToggle}
          />
          <OptionRow
            label="Save current conversation"
            value="Save"
            onPress={onSaveCurrentConversation}
          />
          <OptionRow
            label="Clear current conversation"
            value="Clear"
            onPress={onClearCurrentConversation}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function OptionRow({
  label,
  onPress,
  value,
}: {
  label: string;
  onPress: () => void;
  value: string;
}) {
  return (
    <Pressable onPress={onPress} style={styles.optionRow}>
      <Text style={styles.optionLabel}>{label}</Text>
      <Text style={styles.optionValue}>{value} ›</Text>
    </Pressable>
  );
}

function parseMessages(value: string | null): ChatMessage[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as ChatMessage[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function resolveRelationshipMode(value: string | null): RelationshipMode {
  return value === 'coach' || value === 'companion' ? value : 'friend';
}

function resolveCompanionId(value: string | null | undefined): CompanionId {
  const ids: CompanionId[] = [
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
  return ids.includes(value as CompanionId) ? (value as CompanionId) : 'luna';
}

function openingMessage(companionName: string, displayName: string) {
  const firstName = displayName.trim().split(/\s+/)[0];
  return `${firstName ? `Hey ${firstName}.` : 'Hey.'} ${companionName} is here. What's been on your mind?`;
}

const styles = StyleSheet.create({
  assistantBubble: {
    alignSelf: 'center',
    backgroundColor: 'rgba(18,5,38,0.82)',
    borderRadius: 18,
    maxWidth: '86%',
    padding: 14,
  },
  assistantText: { color: '#FFFFFF', fontSize: 15, lineHeight: 21 },
  avatar: { alignSelf: 'center', flex: 1, maxHeight: 430, width: '82%' },
  close: { color: '#FFFFFF', fontSize: 28 },
  composerWrap: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  disabled: { opacity: 0.4 },
  flex: { flex: 1 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerCenter: { alignItems: 'center', flex: 1 },
  iconButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(12,4,28,0.62)',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  iconText: { color: '#FFFFFF', fontSize: 34, lineHeight: 36 },
  input: {
    backgroundColor: 'rgba(10,3,24,0.9)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 22,
    borderWidth: 1,
    color: '#FFFFFF',
    flex: 1,
    maxHeight: 120,
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modeChip: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  modeChipActive: { backgroundColor: '#7C3AED' },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  modeText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  optionLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  optionRow: {
    alignItems: 'center',
    borderTopColor: 'rgba(255,255,255,0.1)',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  optionValue: { color: '#D8B4FE', fontSize: 13, fontWeight: '700' },
  optionsButton: {
    backgroundColor: 'rgba(12,4,28,0.72)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  optionsText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  pressed: { opacity: 0.78 },
  recovery: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 12,
    color: '#FFFFFF',
    fontSize: 12,
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retryNotice: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(244,63,94,0.16)',
    borderColor: 'rgba(253,164,175,0.28)',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  retryText: { color: '#FFE4E6', fontSize: 13, fontWeight: '800' },
  root: { backgroundColor: '#05020D', flex: 1 },
  safe: { flex: 1 },
  saveMomentButton: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: 'rgba(216,180,254,0.24)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  saveMomentButtonActive: {
    backgroundColor: 'rgba(126,34,206,0.28)',
    borderColor: 'rgba(236,72,153,0.5)',
  },
  saveMomentIcon: { color: '#F0ABFC', fontSize: 12, fontWeight: '900' },
  saveMomentText: { color: '#F5D0FE', fontSize: 11, fontWeight: '900' },
  saveNotice: {
    color: 'rgba(216,180,254,0.82)',
    fontSize: 10,
    marginTop: 6,
    textAlign: 'right',
  },
  scrim: { backgroundColor: 'rgba(0,0,0,0.68)', flex: 1, justifyContent: 'flex-end' },
  sectionLabel: {
    color: '#D8B4FE',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  sendText: { color: '#FFFFFF', fontSize: 22 },
  settingsText: { color: '#FFFFFF', fontSize: 19 },
  sheet: {
    backgroundColor: '#10031F',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 20,
  },
  sheetCopy: { color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 4 },
  sheetHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  sheetTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  stage: { flex: 1, paddingHorizontal: 14, paddingTop: 12 },
  subtitle: {
    color: 'rgba(255,255,255,0.64)',
    fontSize: 11,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  title: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', maxWidth: 170 },
});
