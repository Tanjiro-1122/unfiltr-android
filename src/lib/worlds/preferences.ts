import { getAppStorageItem, setAppStorageItem } from '@/lib/storage/appStorage';
import {
  getDefaultWorld,
  getWorld,
  getWorldsFor,
  WORLD_STORAGE_KEYS,
  type WorldId,
  type WorldModule,
  type WorldProfile,
} from '@/lib/worlds/catalog';

const LEGACY_CHAT_ENV_KEY = 'unfiltr_env';

type LegacyChatEnvironment = {
  backgroundId?: string;
  bg?: string;
  id?: string;
  url?: string;
};

export async function loadWorldPreference(module: WorldModule): Promise<WorldProfile> {
  const storedWorldId = await getAppStorageItem(WORLD_STORAGE_KEYS[module]);
  if (storedWorldId) return getWorld(storedWorldId, module);

  if (module === 'chat') {
    const legacyEnvironment = await getAppStorageItem(LEGACY_CHAT_ENV_KEY);
    const migrated = parseLegacyChatEnvironment(legacyEnvironment);
    if (migrated) {
      await saveWorldPreference('chat', migrated.id);
      return migrated;
    }
  }

  return getDefaultWorld(module);
}

export async function saveWorldPreference(
  module: WorldModule,
  worldId: WorldId,
): Promise<WorldProfile> {
  const world = getWorld(worldId, module);
  await setAppStorageItem(WORLD_STORAGE_KEYS[module], world.id);

  if (module === 'chat') {
    await setAppStorageItem(
      LEGACY_CHAT_ENV_KEY,
      JSON.stringify({
        backgroundId: world.id,
        bg: world.backgroundImage,
        id: world.id,
        label: world.label,
        url: world.backgroundImage,
      }),
    );
  }

  return world;
}

function parseLegacyChatEnvironment(value: string | null): WorldProfile | null {
  if (!value) return null;
  const chatWorlds = getWorldsFor('chat');

  try {
    const parsed = JSON.parse(value) as LegacyChatEnvironment;
    const requestedId = parsed.backgroundId || parsed.id;
    if (requestedId && chatWorlds.some((world) => world.id === requestedId)) {
      return getWorld(requestedId, 'chat');
    }

    const url = parsed.url || parsed.bg;
    if (url) return chatWorlds.find((world) => world.backgroundImage === url) ?? null;
  } catch {
    if (chatWorlds.some((world) => world.id === value)) return getWorld(value, 'chat');
  }

  return null;
}
