import { getAppStorageItem, setAppStorageItem } from '@/lib/storage/appStorage';

export type PersonalityStyle = 'balanced' | 'warm' | 'playful' | 'direct' | 'calm';
export type VoiceStyle = 'luna' | 'nova' | 'river' | 'sage';

export type VoicePersonalityPreferences = {
  personality: PersonalityStyle;
  voice: VoiceStyle;
};

export const DEFAULT_VOICE_PERSONALITY: VoicePersonalityPreferences = {
  personality: 'balanced',
  voice: 'luna',
};

const STORAGE_KEY = 'unfiltr_voice_personality';

export const PERSONALITY_OPTIONS: {
  id: PersonalityStyle;
  label: string;
  description: string;
  relationshipMode: 'friend' | 'coach' | 'companion';
}[] = [
  { id: 'balanced', label: 'Balanced', description: 'Natural, thoughtful, and flexible.', relationshipMode: 'friend' },
  { id: 'warm', label: 'Warm', description: 'Gentle, caring, and emotionally supportive.', relationshipMode: 'companion' },
  { id: 'playful', label: 'Playful', description: 'More humor, energy, and lightness.', relationshipMode: 'friend' },
  { id: 'direct', label: 'Direct', description: 'Clear, honest, and straight to the point.', relationshipMode: 'coach' },
  { id: 'calm', label: 'Calm', description: 'Steady, reassuring, and low-pressure.', relationshipMode: 'companion' },
];

export const VOICE_OPTIONS: { id: VoiceStyle; label: string; description: string }[] = [
  { id: 'luna', label: 'Luna', description: 'Soft and comforting' },
  { id: 'nova', label: 'Nova', description: 'Bright and expressive' },
  { id: 'river', label: 'River', description: 'Relaxed and grounded' },
  { id: 'sage', label: 'Sage', description: 'Calm and measured' },
];

export async function loadVoicePersonalityPreferences(): Promise<VoicePersonalityPreferences> {
  const raw = await getAppStorageItem(STORAGE_KEY);
  if (!raw) return DEFAULT_VOICE_PERSONALITY;

  try {
    const parsed = JSON.parse(raw) as Partial<VoicePersonalityPreferences>;
    return {
      personality: isPersonalityStyle(parsed.personality) ? parsed.personality : DEFAULT_VOICE_PERSONALITY.personality,
      voice: isVoiceStyle(parsed.voice) ? parsed.voice : DEFAULT_VOICE_PERSONALITY.voice,
    };
  } catch {
    return DEFAULT_VOICE_PERSONALITY;
  }
}

export async function saveVoicePersonalityPreferences(
  preferences: VoicePersonalityPreferences,
): Promise<void> {
  await Promise.all([
    setAppStorageItem(STORAGE_KEY, JSON.stringify(preferences)),
    setAppStorageItem('unfiltr_relationship_mode', relationshipModeForPersonality(preferences.personality)),
  ]);
}

export function relationshipModeForPersonality(
  personality: PersonalityStyle,
): 'friend' | 'coach' | 'companion' {
  return PERSONALITY_OPTIONS.find((option) => option.id === personality)?.relationshipMode ?? 'friend';
}

function isPersonalityStyle(value: unknown): value is PersonalityStyle {
  return value === 'balanced' || value === 'warm' || value === 'playful' || value === 'direct' || value === 'calm';
}

function isVoiceStyle(value: unknown): value is VoiceStyle {
  return value === 'luna' || value === 'nova' || value === 'river' || value === 'sage';
}
