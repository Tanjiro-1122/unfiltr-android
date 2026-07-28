import { setSecureItem } from '@/lib/storage';
import { setAppStorageItem } from '@/lib/storage/appStorage';

export type RestoredProfileFields = Record<string, unknown> | null | undefined;

/**
 * Writes a restored backend profile into the legacy secure/app-storage keys that
 * existing screens (Journal, Meditation, Settings, etc.) read directly. This is
 * what makes "restore profile, companion id, companion nickname, relationship
 * style" actually observable app-wide after a returning-account resolution,
 * without requiring every screen to be rewritten to read from the restoration
 * store instead.
 */
export async function hydrateLocalProfileFromRestoration(
  profile: RestoredProfileFields,
): Promise<void> {
  if (!profile) return;

  const displayName = readString(profile.display_name);
  const companionNickname = readString(profile.companion_name);
  const selectedCompanionId = readString(profile.avatar_id);
  const preferences = isRecord(profile.preferences) ? profile.preferences : null;
  const relationshipMode = readString(preferences?.relationshipMode);

  const writes: Promise<void>[] = [];

  if (displayName) {
    writes.push(setSecureItem('onboarding.displayName', displayName));
    writes.push(setAppStorageItem('unfiltr_display_name', displayName));
  }
  if (companionNickname) {
    writes.push(setSecureItem('onboarding.companionNickname', companionNickname));
    writes.push(setAppStorageItem('unfiltr_companion_nickname', companionNickname));
  }
  if (selectedCompanionId) {
    writes.push(setSecureItem('onboarding.selectedCompanionId', selectedCompanionId));
    writes.push(setSecureItem('onboarding.companionId', selectedCompanionId));
    writes.push(setAppStorageItem('unfiltr_companion_id', selectedCompanionId));
  }
  if (relationshipMode) {
    writes.push(setSecureItem('onboarding.relationshipMode', relationshipMode));
    writes.push(setAppStorageItem('unfiltr_relationship_mode', relationshipMode));
  }
  if (selectedCompanionId || companionNickname) {
    writes.push(
      setAppStorageItem(
        'unfiltr_companion',
        JSON.stringify({
          displayName: companionNickname ?? undefined,
          id: selectedCompanionId ?? undefined,
        }),
      ),
    );
  }

  await Promise.all(writes);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
