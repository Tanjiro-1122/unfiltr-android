import { getJsonItem, setJsonItem } from '@/lib/storage/appStorage';

const STORAGE_KEY = 'unfiltr_mood_history';

export const MOODS = [
  { id: 'happy', emoji: '😊', label: 'Happy' },
  { id: 'motivated', emoji: '🚀', label: 'Motivated' },
  { id: 'loved', emoji: '🥰', label: 'Loved' },
  { id: 'calm', emoji: '😌', label: 'Calm' },
  { id: 'neutral', emoji: '😐', label: 'Neutral' },
  { id: 'anxious', emoji: '😰', label: 'Anxious' },
  { id: 'frustrated', emoji: '😤', label: 'Frustrated' },
  { id: 'sad', emoji: '😢', label: 'Sad' },
  { id: 'anger', emoji: '😠', label: 'Angry' },
  { id: 'fear', emoji: '😨', label: 'Fear' },
  { id: 'fatigue', emoji: '😴', label: 'Tired' },
] as const;

export type MoodId = (typeof MOODS)[number]['id'];
export type MoodHistory = Record<string, MoodId>;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function loadMoodHistory(): Promise<MoodHistory> {
  const value = await getJsonItem<unknown>(STORAGE_KEY, {});
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const validIds = new Set(MOODS.map((mood) => mood.id));
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, MoodId] =>
        typeof entry[1] === 'string' && validIds.has(entry[1] as MoodId),
    ),
  );
}

export async function saveTodayMood(mood: MoodId): Promise<MoodHistory> {
  const history = await loadMoodHistory();
  const next = { ...history, [todayKey()]: mood };
  await setJsonItem(STORAGE_KEY, next);
  return next;
}
