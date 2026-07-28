import { Platform, type TextStyle, type ViewStyle } from 'react-native';

import { getAppStorageItem, setAppStorageItem } from '@/lib/storage/appStorage';

export type AppearanceFont = 'classic' | 'modern' | 'rounded' | 'typewriter';
export type AppearanceTextSize = 'small' | 'medium' | 'large';
export type AppearanceBubble = 'soft' | 'rounded' | 'minimal';

export type AppearancePreferences = {
  bubble: AppearanceBubble;
  font: AppearanceFont;
  textSize: AppearanceTextSize;
};

export const DEFAULT_APPEARANCE: AppearancePreferences = {
  bubble: 'soft',
  font: 'modern',
  textSize: 'medium',
};

const STORAGE_KEY = 'unfiltr_appearance_preferences';

export async function loadAppearancePreferences(): Promise<AppearancePreferences> {
  const stored = await getAppStorageItem(STORAGE_KEY);
  if (!stored) return DEFAULT_APPEARANCE;
  try {
    const value = JSON.parse(stored) as Partial<AppearancePreferences>;
    return {
      bubble: isBubble(value.bubble) ? value.bubble : DEFAULT_APPEARANCE.bubble,
      font: isFont(value.font) ? value.font : DEFAULT_APPEARANCE.font,
      textSize: isTextSize(value.textSize) ? value.textSize : DEFAULT_APPEARANCE.textSize,
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export async function saveAppearancePreferences(value: AppearancePreferences) {
  await setAppStorageItem(STORAGE_KEY, JSON.stringify(value));
}

export function appearanceFontFamily(font: AppearanceFont): TextStyle['fontFamily'] {
  if (font === 'classic') return Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });
  if (font === 'rounded') return Platform.select({ ios: 'Arial Rounded MT Bold', android: 'sans-serif-medium', default: 'sans-serif' });
  if (font === 'typewriter') return Platform.select({ ios: 'Courier New', android: 'monospace', default: 'monospace' });
  return undefined;
}

export function appearanceFontSize(size: AppearanceTextSize): number {
  if (size === 'small') return 14;
  if (size === 'large') return 18;
  return 16;
}

export function appearanceBubbleStyle(bubble: AppearanceBubble): ViewStyle {
  if (bubble === 'rounded') return { borderRadius: 30, paddingHorizontal: 18, paddingVertical: 15 };
  if (bubble === 'minimal') {
    return {
      backgroundColor: 'rgba(5,2,13,0.48)',
      borderColor: 'rgba(255,255,255,0.22)',
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 16,
      paddingVertical: 13,
    };
  }
  return { borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14 };
}

function isFont(value: unknown): value is AppearanceFont {
  return value === 'classic' || value === 'modern' || value === 'rounded' || value === 'typewriter';
}

function isTextSize(value: unknown): value is AppearanceTextSize {
  return value === 'small' || value === 'medium' || value === 'large';
}

function isBubble(value: unknown): value is AppearanceBubble {
  return value === 'soft' || value === 'rounded' || value === 'minimal';
}
