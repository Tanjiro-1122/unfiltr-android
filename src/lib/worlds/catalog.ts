export type WorldModule = 'chat' | 'journal' | 'meditation';

export type WorldId =
  | 'beach_house'
  | 'cozy_apartment'
  | 'forest_cabin'
  | 'late_night_cafe'
  | 'rooftop'
  | 'space_station'
  | 'cozy-living-room-real'
  | 'sunny-park-real'
  | 'sunset-beach-real'
  | 'outer-space-real'
  | 'enchanted-forest-real'
  | 'rainy-cafe-real'
  | 'tokyo-rooftop-real'
  | 'deep-ocean-real'
  | 'winter-cabin-real'
  | 'cyberpunk-city-real'
  | 'cozy-living-room-anime'
  | 'sunny-park-anime'
  | 'sunset-beach-anime'
  | 'underwater-world-anime'
  | 'cherry-blossom-anime'
  | 'sky-islands-anime'
  | 'enchanted-forest-anime'
  | 'rainy-cafe-anime'
  | 'rooftop-anime'
  | 'winter-cabin-anime'
  | 'cyberpunk-city-anime';

export type WorldProfile = {
  accent: string;
  backgroundImage: string;
  desc: string;
  glow: string;
  id: WorldId;
  label: string;
  mark: string;
  // Only meaningful for CHAT_BACKGROUNDS -- distinguishes the two visual
  // collections native must offer for Chat (see companionData.jsx in the
  // web repo, the source of truth for both sets).
  style?: 'anime' | 'realistic';
  supportedModules: readonly WorldModule[];
};

const SUPABASE_PUBLIC_ROOT =
  'https://hvvrbpvsgjxiicigkwhu.supabase.co/storage/v1/object/public/companion-avatars';

export const WORLD_STORAGE_KEYS = {
  chat: 'unfiltr_background_id',
  journal: 'unfiltr_journal_world',
  meditation: 'unfiltr_meditation_world',
} as const;

// ANIME CHAT BACKGROUNDS -- 11, matching companionData.jsx's BACKGROUNDS
// array (style: "anime") exactly, id-for-id in the same order.
const ANIME_CHAT_BACKGROUNDS: readonly WorldProfile[] = [
  {
    accent: '#FFB347',
    backgroundImage: 'https://qphizjwoijvjoygihkle.supabase.co/storage/v1/object/public/companion-avatars/chat/backgrounds/anime/living-room.png',
    desc: 'A warm, comfortable room for everyday conversations',
    glow: 'rgba(255,140,40,0.55)',
    id: 'cozy-living-room-anime',
    label: 'Cozy Living Room',
    mark: '🛋️',
    style: 'anime',
    supportedModules: ['chat'],
  },
  {
    accent: '#4ADE80',
    backgroundImage: 'https://qphizjwoijvjoygihkle.supabase.co/storage/v1/object/public/companion-avatars/chat/backgrounds/anime/park.png',
    desc: 'Open grass, sunlight, and a calm outdoor mood',
    glow: 'rgba(74,222,128,0.5)',
    id: 'sunny-park-anime',
    label: 'Sunny Park',
    mark: '🌳',
    style: 'anime',
    supportedModules: ['chat'],
  },
  {
    accent: '#FBBF24',
    backgroundImage: 'https://qphizjwoijvjoygihkle.supabase.co/storage/v1/object/public/companion-avatars/chat/backgrounds/anime/beach.png',
    desc: 'Golden-hour waves and a peaceful shoreline',
    glow: 'rgba(251,191,36,0.5)',
    id: 'sunset-beach-anime',
    label: 'Sunset Beach',
    mark: '🌅',
    style: 'anime',
    supportedModules: ['chat'],
  },
  {
    accent: '#22D3EE',
    backgroundImage: 'https://qphizjwoijvjoygihkle.supabase.co/storage/v1/object/public/companion-avatars/chat/backgrounds/anime/underwater.png',
    desc: 'A tranquil view beneath the ocean surface',
    glow: 'rgba(34,211,238,0.5)',
    id: 'underwater-world-anime',
    label: 'Underwater World',
    mark: '🌊',
    style: 'anime',
    supportedModules: ['chat'],
  },
  {
    accent: '#F9A8D4',
    backgroundImage: 'https://qphizjwoijvjoygihkle.supabase.co/storage/v1/object/public/companion-avatars/chat/backgrounds/anime/blossom.png',
    desc: 'Soft pink petals drifting on a quiet breeze',
    glow: 'rgba(249,168,212,0.5)',
    id: 'cherry-blossom-anime',
    label: 'Cherry Blossom',
    mark: '🌸',
    style: 'anime',
    supportedModules: ['chat'],
  },
  {
    accent: '#93C5FD',
    backgroundImage: 'https://qphizjwoijvjoygihkle.supabase.co/storage/v1/object/public/companion-avatars/chat/backgrounds/anime/skyislands.png',
    desc: 'Floating islands above the clouds',
    glow: 'rgba(147,197,253,0.5)',
    id: 'sky-islands-anime',
    label: 'Sky Islands',
    mark: '☁️',
    style: 'anime',
    supportedModules: ['chat'],
  },
  {
    accent: '#86EFAC',
    backgroundImage: 'https://qphizjwoijvjoygihkle.supabase.co/storage/v1/object/public/companion-avatars/chat/backgrounds/anime/forest.png',
    desc: 'A magical forest filled with soft natural light',
    glow: 'rgba(134,239,172,0.5)',
    id: 'enchanted-forest-anime',
    label: 'Enchanted Forest',
    mark: '🍄',
    style: 'anime',
    supportedModules: ['chat'],
  },
  {
    accent: '#C462FF',
    backgroundImage: 'https://qphizjwoijvjoygihkle.supabase.co/storage/v1/object/public/companion-avatars/chat/backgrounds/anime/cafe.png',
    desc: 'A cozy café while rain falls outside',
    glow: 'rgba(196,98,255,0.5)',
    id: 'rainy-cafe-anime',
    label: 'Rainy Café',
    mark: '☕',
    style: 'anime',
    supportedModules: ['chat'],
  },
  {
    accent: '#F472B6',
    backgroundImage: 'https://qphizjwoijvjoygihkle.supabase.co/storage/v1/object/public/companion-avatars/chat/backgrounds/anime/rooftop.png',
    desc: 'Neon skyline lights and a quiet rooftop at night',
    glow: 'rgba(244,114,182,0.5)',
    id: 'rooftop-anime',
    label: 'Anime Rooftop',
    mark: '🌇',
    style: 'anime',
    supportedModules: ['chat'],
  },
  {
    accent: '#A3E635',
    backgroundImage: 'https://qphizjwoijvjoygihkle.supabase.co/storage/v1/object/public/companion-avatars/chat/backgrounds/anime/cabin.png',
    desc: 'A warm cabin surrounded by winter snow',
    glow: 'rgba(163,230,53,0.5)',
    id: 'winter-cabin-anime',
    label: 'Winter Cabin',
    mark: '🏔️',
    style: 'anime',
    supportedModules: ['chat'],
  },
  {
    accent: '#F472B6',
    backgroundImage: 'https://qphizjwoijvjoygihkle.supabase.co/storage/v1/object/public/companion-avatars/chat/backgrounds/anime/cyberpunk.png',
    desc: 'Neon streets in a futuristic city',
    glow: 'rgba(244,114,182,0.55)',
    id: 'cyberpunk-city-anime',
    label: 'Cyberpunk City',
    mark: '🌆',
    style: 'anime',
    supportedModules: ['chat'],
  },
];

// REALISTIC CHAT BACKGROUNDS -- 10, matching companionData.jsx's
// BACKGROUNDS array (style: "realistic") exactly.
const REALISTIC_CHAT_BACKGROUNDS: readonly WorldProfile[] = [
  {
    accent: '#FFB347',
    backgroundImage: `${SUPABASE_PUBLIC_ROOT}/a6417171d_generated_image.png`,
    desc: 'A warm, comfortable room for everyday conversations',
    glow: 'rgba(255,140,40,0.55)',
    id: 'cozy-living-room-real',
    label: 'Cozy Living Room',
    mark: '🛋️',
    style: 'realistic',
    supportedModules: ['chat'],
  },
  {
    accent: '#4ADE80',
    backgroundImage: `${SUPABASE_PUBLIC_ROOT}/76ddffaf4_generated_image.png`,
    desc: 'Open grass, sunlight, and a calm outdoor mood',
    glow: 'rgba(74,222,128,0.5)',
    id: 'sunny-park-real',
    label: 'Sunny Park',
    mark: '🌳',
    style: 'realistic',
    supportedModules: ['chat'],
  },
  {
    accent: '#FBBF24',
    backgroundImage: `${SUPABASE_PUBLIC_ROOT}/327895d3b_generated_image.png`,
    desc: 'Golden-hour waves and a peaceful shoreline',
    glow: 'rgba(251,191,36,0.5)',
    id: 'sunset-beach-real',
    label: 'Sunset Beach',
    mark: '🌅',
    style: 'realistic',
    supportedModules: ['chat'],
  },
  {
    accent: '#818CF8',
    backgroundImage: `${SUPABASE_PUBLIC_ROOT}/3b7121c46_generated_image.png`,
    desc: 'A quiet cosmic view beyond the stars',
    glow: 'rgba(129,140,248,0.55)',
    id: 'outer-space-real',
    label: 'Outer Space',
    mark: '🚀',
    style: 'realistic',
    supportedModules: ['chat'],
  },
  {
    accent: '#86EFAC',
    backgroundImage: `${SUPABASE_PUBLIC_ROOT}/5224b2a62_generated_image.png`,
    desc: 'A magical forest filled with soft natural light',
    glow: 'rgba(134,239,172,0.5)',
    id: 'enchanted-forest-real',
    label: 'Enchanted Forest',
    mark: '🍄',
    style: 'realistic',
    supportedModules: ['chat'],
  },
  {
    accent: '#C462FF',
    backgroundImage: `${SUPABASE_PUBLIC_ROOT}/9923e4610_generated_image.png`,
    desc: 'A cozy café while rain falls outside',
    glow: 'rgba(196,98,255,0.5)',
    id: 'rainy-cafe-real',
    label: 'Rainy Café',
    mark: '☕',
    style: 'realistic',
    supportedModules: ['chat'],
  },
  {
    accent: '#F472B6',
    backgroundImage: `${SUPABASE_PUBLIC_ROOT}/14aa6a0dc_generated_image.png`,
    desc: 'Tokyo lights and a quiet rooftop at night',
    glow: 'rgba(244,114,182,0.5)',
    id: 'tokyo-rooftop-real',
    label: 'Tokyo Rooftop',
    mark: '🌇',
    style: 'realistic',
    supportedModules: ['chat'],
  },
  {
    accent: '#22D3EE',
    backgroundImage: `${SUPABASE_PUBLIC_ROOT}/b30c34634_generated_image.png`,
    desc: 'A tranquil view beneath the ocean surface',
    glow: 'rgba(34,211,238,0.5)',
    id: 'deep-ocean-real',
    label: 'Deep Ocean',
    mark: '🐠',
    style: 'realistic',
    supportedModules: ['chat'],
  },
  {
    accent: '#A3E635',
    backgroundImage: `${SUPABASE_PUBLIC_ROOT}/9be13a080_generated_image.png`,
    desc: 'A warm cabin surrounded by winter snow',
    glow: 'rgba(163,230,53,0.5)',
    id: 'winter-cabin-real',
    label: 'Winter Cabin',
    mark: '🏔️',
    style: 'realistic',
    supportedModules: ['chat'],
  },
  {
    accent: '#F472B6',
    backgroundImage: `${SUPABASE_PUBLIC_ROOT}/007c11451_generated_image.png`,
    desc: 'Neon streets in a futuristic city',
    glow: 'rgba(244,114,182,0.55)',
    id: 'cyberpunk-city-real',
    label: 'Cyberpunk City',
    mark: '🌆',
    style: 'realistic',
    supportedModules: ['chat'],
  },
];

// CHAT_BACKGROUNDS and IMMERSIVE_JOURNAL_WORLDS are two clear, separate
// registries -- Chat's 21 backgrounds (11 anime + 10 realistic) never mix
// with Journal's 6 immersive worlds. Do not merge these into one ambiguous
// collection.
export const CHAT_BACKGROUNDS: readonly WorldProfile[] = [
  ...ANIME_CHAT_BACKGROUNDS,
  ...REALISTIC_CHAT_BACKGROUNDS,
];

export const IMMERSIVE_JOURNAL_WORLDS: readonly WorldProfile[] = [
  {
    accent: '#FFB347',
    backgroundImage: `${SUPABASE_PUBLIC_ROOT}/misc/133f41f0f_generated_image.png`,
    desc: 'Warm lamp, rain on the window, city glow',
    glow: 'rgba(255,140,40,0.55)',
    id: 'cozy_apartment',
    label: 'Cozy Apartment',
    mark: '🏠',
    supportedModules: ['journal', 'meditation'],
  },
  {
    accent: '#4ADE80',
    backgroundImage: `${SUPABASE_PUBLIC_ROOT}/misc/d7bb6e1b5_generated_image.png`,
    desc: 'Fireplace, pine trees, snow outside',
    glow: 'rgba(74,222,128,0.5)',
    id: 'forest_cabin',
    label: 'Forest Cabin',
    mark: '🌲',
    supportedModules: ['journal', 'meditation'],
  },
  {
    accent: '#C462FF',
    backgroundImage: `${SUPABASE_PUBLIC_ROOT}/misc/e0ccd0753_generated_image.png`,
    desc: 'Neon signs, empty café, rain outside',
    glow: 'rgba(196,98,255,0.5)',
    id: 'late_night_cafe',
    label: 'Late Night Café',
    mark: '☕',
    supportedModules: ['journal'],
  },
  {
    accent: '#63B3FF',
    backgroundImage: `${SUPABASE_PUBLIC_ROOT}/misc/2da8b6d3e_generated_image.png`,
    desc: 'Stars, floating in zero gravity',
    glow: 'rgba(99,179,255,0.45)',
    id: 'space_station',
    label: 'Space Station',
    mark: '🌌',
    supportedModules: ['journal', 'meditation'],
  },
  {
    accent: '#FBBF24',
    backgroundImage: `${SUPABASE_PUBLIC_ROOT}/misc/19c79bde2_generated_image.png`,
    desc: 'Sunset, waves, golden hour glow',
    glow: 'rgba(251,191,36,0.45)',
    id: 'beach_house',
    label: 'Beach House',
    mark: '🏖️',
    supportedModules: ['journal', 'meditation'],
  },
  {
    accent: '#F472B6',
    backgroundImage: `${SUPABASE_PUBLIC_ROOT}/misc/6e20d0458_generated_image.png`,
    desc: 'City skyline, night breeze, string lights',
    glow: 'rgba(244,114,182,0.5)',
    id: 'rooftop',
    label: 'Rooftop',
    mark: '🌆',
    supportedModules: ['journal'],
  },
];

export const MEDITATION_WORLDS: readonly WorldProfile[] = IMMERSIVE_JOURNAL_WORLDS.filter((world) =>
  world.supportedModules.includes('meditation'),
);

export const WORLDS: readonly WorldProfile[] = [...CHAT_BACKGROUNDS, ...IMMERSIVE_JOURNAL_WORLDS];
export const DEFAULT_CHAT_WORLD = REALISTIC_CHAT_BACKGROUNDS[0]!;
export const DEFAULT_JOURNAL_WORLD = IMMERSIVE_JOURNAL_WORLDS[0]!;
export const DEFAULT_MEDITATION_WORLD = MEDITATION_WORLDS[0]!;
export const DEFAULT_WORLD = DEFAULT_CHAT_WORLD;

export function getWorld(worldId: string | null | undefined, module?: WorldModule): WorldProfile {
  const candidates = module ? getWorldsFor(module) : WORLDS;
  const fallback = module ? getDefaultWorld(module) : DEFAULT_WORLD;
  return candidates.find((world) => world.id === worldId) ?? fallback;
}

export function getWorldsFor(module: WorldModule): readonly WorldProfile[] {
  if (module === 'chat') return CHAT_BACKGROUNDS;
  if (module === 'journal') return IMMERSIVE_JOURNAL_WORLDS;
  return MEDITATION_WORLDS;
}

export function getDefaultWorld(module: WorldModule): WorldProfile {
  if (module === 'chat') return DEFAULT_CHAT_WORLD;
  if (module === 'journal') return DEFAULT_JOURNAL_WORLD;
  return DEFAULT_MEDITATION_WORLD;
}
