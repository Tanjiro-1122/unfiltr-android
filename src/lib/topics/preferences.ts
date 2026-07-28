import { getAppStorageItem, setAppStorageItem } from '@/lib/storage/appStorage';

export type TopicId =
  | 'relationships'
  | 'self-growth'
  | 'stress'
  | 'family'
  | 'work'
  | 'confidence'
  | 'grief'
  | 'dreams'
  | 'creativity'
  | 'just-talk';

export type TopicPreferences = {
  customTopic: string;
  selected: TopicId[];
};

export const TOPIC_STORAGE_KEY = 'unfiltr_topic_preferences';

export const DEFAULT_TOPIC_PREFERENCES: TopicPreferences = {
  customTopic: '',
  selected: ['just-talk'],
};

export async function loadTopicPreferences(): Promise<TopicPreferences> {
  const raw = await getAppStorageItem(TOPIC_STORAGE_KEY);
  if (!raw) return DEFAULT_TOPIC_PREFERENCES;

  try {
    const parsed = JSON.parse(raw) as Partial<TopicPreferences>;
    return {
      customTopic: typeof parsed.customTopic === 'string' ? parsed.customTopic : '',
      selected: Array.isArray(parsed.selected)
        ? parsed.selected.filter(isTopicId)
        : DEFAULT_TOPIC_PREFERENCES.selected,
    };
  } catch {
    return DEFAULT_TOPIC_PREFERENCES;
  }
}

export async function saveTopicPreferences(preferences: TopicPreferences) {
  await setAppStorageItem(TOPIC_STORAGE_KEY, JSON.stringify(preferences));
}

function isTopicId(value: unknown): value is TopicId {
  return [
    'relationships',
    'self-growth',
    'stress',
    'family',
    'work',
    'confidence',
    'grief',
    'dreams',
    'creativity',
    'just-talk',
  ].includes(String(value));
}
