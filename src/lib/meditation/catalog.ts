import type { CompanionId } from '@/features/onboarding/companionQuiz';
import { getWorldsFor, type WorldId, type WorldProfile } from '@/lib/worlds/catalog';

export type MeditationSoundId =
  | 'aquarium'
  | 'brown'
  | 'early_morning'
  | 'fire'
  | 'ocean'
  | 'pink'
  | 'rain'
  | 'silence';

export type WorldMeditationSoundId =
  | 'ancient_dancing_om'
  | 'ancient_spirit_om'
  | 'calm_native_flute'
  | 'moonlit_blossoms'
  | 'native_flute'
  | 'smooth_as_silk'
  | 'tibetan_bowl_healing'
  | 'tibetan_bowl_peace'
  | 'tibetan_bowls_river'
  | 'traditional_japanese';

export type BreathworkId = '478' | 'box' | 'none' | 'simple';
export type JournalWorldId = WorldId;

export type MeditationSound = {
  available: boolean;
  category: 'ambience' | 'noise' | 'silence';
  desc: string;
  evidence: string;
  id: MeditationSoundId;
  label: string;
  iconUrl: string;
  mark: string;
  sourceNote: string;
  url: string | null;
};

export type WorldMeditationSound = {
  available: true;
  desc: string;
  id: WorldMeditationSoundId;
  iconUrl: string;
  label: string;
  mark: string;
  url: string;
};

export type BreathworkPattern = {
  desc: string;
  id: BreathworkId;
  label: string;
  pattern: number[];
  phases: string[];
};

export type JournalWorld = WorldProfile;

const SUPABASE_PUBLIC_ROOT =
  'https://hvvrbpvsgjxiicigkwhu.supabase.co/storage/v1/object/public/companion-avatars';
const SUPABASE_MEDIA_ROOT = `${SUPABASE_PUBLIC_ROOT}/misc`;
const musicUrl = (fileName: string) => `${SUPABASE_PUBLIC_ROOT}/music/${fileName}`;
const iconUrl = (hash: string) => `${SUPABASE_MEDIA_ROOT}/${hash}_generated_image.png`;

export const MEDITATION_SOUNDS: readonly MeditationSound[] = [
  {
    available: true,
    category: 'ambience',
    desc: 'Rain and soft thunder',
    evidence: 'June 4 Supabase companion-avatars storage',
    iconUrl: iconUrl('d3ba5ab97'),
    id: 'rain',
    label: 'Rainy Day',
    mark: '☔',
    sourceNote: 'Restored from the June 4 meditation catalog.',
    url: musicUrl('rain_v2.mp3'),
  },
  {
    available: true,
    category: 'ambience',
    desc: 'Warm crackling fireplace',
    evidence: 'June 4 Supabase companion-avatars storage',
    iconUrl: iconUrl('d4222ed71'),
    id: 'fire',
    label: 'Cabin Fire',
    mark: '♨',
    sourceNote: 'Restored from the June 4 meditation catalog.',
    url: musicUrl('fire_v2.mp3'),
  },
  {
    available: true,
    category: 'ambience',
    desc: 'Ocean shore and seabirds',
    evidence: 'June 4 Supabase companion-avatars storage',
    iconUrl: iconUrl('1e250678e'),
    id: 'ocean',
    label: 'Beach Waves',
    mark: '≈',
    sourceNote: 'Restored from the June 4 meditation catalog.',
    url: musicUrl('ocean_v2.mp3'),
  },
  {
    available: false,
    category: 'noise',
    desc: 'Deep and grounding',
    evidence: 'The June 4 web app synthesized brown noise with Web Audio.',
    iconUrl: iconUrl('c5f2dc79e'),
    id: 'brown',
    label: 'Brown Noise',
    mark: '◐',
    sourceNote: 'Native synthesis adapter is still required.',
    url: null,
  },
  {
    available: false,
    category: 'noise',
    desc: 'Best for sleep and anxiety',
    evidence: 'The June 4 web app synthesized pink noise with Web Audio.',
    iconUrl: iconUrl('99515dbf1'),
    id: 'pink',
    label: 'Pink Noise',
    mark: '◉',
    sourceNote: 'Native synthesis adapter is still required.',
    url: null,
  },
  {
    available: true,
    category: 'silence',
    desc: 'Breath guide only',
    evidence: 'June 4 silence mode',
    iconUrl: iconUrl('54e09f21c'),
    id: 'silence',
    label: 'Silence',
    mark: '☾',
    sourceNote: 'No media needed.',
    url: null,
  },
  {
    available: true,
    category: 'ambience',
    desc: 'Birdsong and soft dawn light',
    evidence: 'June 4 Supabase companion-avatars storage',
    iconUrl: iconUrl('d3ba5ab97'),
    id: 'early_morning',
    label: 'Early Morning',
    mark: '☀',
    sourceNote: 'Restored from the June 4 meditation catalog.',
    url: musicUrl('rain5.mp3'),
  },
  {
    available: true,
    category: 'ambience',
    desc: 'Gentle bubbles and water life',
    evidence: 'June 4 Supabase companion-avatars storage',
    iconUrl: iconUrl('1e250678e'),
    id: 'aquarium',
    label: 'Aquarium',
    mark: '◌',
    sourceNote: 'Restored from the June 4 meditation catalog.',
    url: musicUrl('creek_b.mp3'),
  },
];

export const WORLD_MEDITATION_SOUNDS: readonly WorldMeditationSound[] = [
  {
    available: true,
    desc: 'Traditional Chinese',
    iconUrl: iconUrl('3f3c3c05e'),
    id: 'moonlit_blossoms',
    label: 'Moonlit Blossoms',
    mark: '✿',
    url: musicUrl('moonlit_blossoms_chinese.mp3'),
  },
  {
    available: true,
    desc: 'Full Chinese melody',
    iconUrl: iconUrl('238aed294'),
    id: 'smooth_as_silk',
    label: 'Smooth as Silk',
    mark: '〰',
    url: musicUrl('smooth_as_silk_chinese.mp3'),
  },
  {
    available: true,
    desc: 'Traditional Japanese',
    iconUrl: iconUrl('965c00b3c'),
    id: 'traditional_japanese',
    label: 'Sakura Dreams',
    mark: '❀',
    url: musicUrl('traditional_japanese.mp3'),
  },
  {
    available: true,
    desc: 'Calm Native American',
    iconUrl: iconUrl('7cef8d781'),
    id: 'calm_native_flute',
    label: 'Spirit Flute',
    mark: '♪',
    url: musicUrl('calm_native_flute.mp3'),
  },
  {
    available: true,
    desc: 'Native American plains',
    iconUrl: iconUrl('c5882a86e'),
    id: 'native_flute',
    label: 'Mountain Flute',
    mark: '△',
    url: musicUrl('native_american_flute.mp3'),
  },
  {
    available: true,
    desc: 'Om chanting echoes',
    iconUrl: iconUrl('02107e7a6'),
    id: 'ancient_spirit_om',
    label: 'Ancient Spirit',
    mark: 'ॐ',
    url: musicUrl('ancient_spirit_om.mp3'),
  },
  {
    available: true,
    desc: 'Dancing Om chanting',
    iconUrl: iconUrl('bbcc2d8e7'),
    id: 'ancient_dancing_om',
    label: 'Sacred Dance',
    mark: '✧',
    url: musicUrl('ancient_dancing_om.mp3'),
  },
  {
    available: true,
    desc: 'Tibetan bowls and river',
    iconUrl: iconUrl('515daf4b9'),
    id: 'tibetan_bowls_river',
    label: 'River Bowls',
    mark: '◠',
    url: musicUrl('tibetan_bowls_river.mp3'),
  },
  {
    available: true,
    desc: 'Tibetan sound healing',
    iconUrl: iconUrl('97ed86f52'),
    id: 'tibetan_bowl_healing',
    label: 'Healing Bowls',
    mark: '✚',
    url: musicUrl('tibetan_bowl_healing.mp3'),
  },
  {
    available: true,
    desc: 'Ambient Tibetan peace',
    iconUrl: iconUrl('f47c5b0f9'),
    id: 'tibetan_bowl_peace',
    label: 'Bowl Peace',
    mark: '☯',
    url: musicUrl('tibetan_bowl_peace.mp3'),
  },
];

export const BREATHWORK_PATTERNS: readonly BreathworkPattern[] = [
  {
    desc: 'Inhale 4, hold 7, exhale 8',
    id: '478',
    label: '4-7-8',
    pattern: [4, 7, 8],
    phases: ['Inhale', 'Hold', 'Exhale'],
  },
  {
    desc: 'In 4, hold 4, out 4, hold 4',
    id: 'box',
    label: 'Box Breathing',
    pattern: [4, 4, 4, 4],
    phases: ['Inhale', 'Hold', 'Exhale', 'Hold'],
  },
  {
    desc: 'Inhale 4, exhale 4',
    id: 'simple',
    label: '4-4 Simple',
    pattern: [4, 4],
    phases: ['Inhale', 'Exhale'],
  },
  {
    desc: 'No guided breathing',
    id: 'none',
    label: 'Just Ambience',
    pattern: [],
    phases: [],
  },
];

export const IMMERSIVE_JOURNAL_WORLDS: readonly JournalWorld[] = getWorldsFor('journal');
export const MEDITATION_WORLDS: readonly WorldProfile[] = getWorldsFor('meditation');

export const MEDITATION_AVATARS: Partial<Record<CompanionId, string>> = {
  ash: `${SUPABASE_MEDIA_ROOT}/7057e2cdc_ash_meditation.png`,
  echo: `${SUPABASE_MEDIA_ROOT}/a937dffb9_echo_meditation.png`,
  juan: `${SUPABASE_MEDIA_ROOT}/609a3c0d7_juan_meditation.png`,
  kai: `${SUPABASE_MEDIA_ROOT}/94d7a11ba_kai_meditation.png`,
  luna: `${SUPABASE_MEDIA_ROOT}/77af5e6d3_luna_meditation.png`,
  nova: `${SUPABASE_MEDIA_ROOT}/745636f0e_nova_meditation.png`,
  river: `${SUPABASE_MEDIA_ROOT}/b1dcf6480_river_meditation.png`,
  ryuu: `${SUPABASE_MEDIA_ROOT}/9f5906b5a_ryuu_meditation.png`,
  sage: `${SUPABASE_MEDIA_ROOT}/66be0c212_sage_meditation.png`,
  sakura: `${SUPABASE_MEDIA_ROOT}/54138a454_sakura_meditation.png`,
  soleil: `${SUPABASE_MEDIA_ROOT}/5841520c9_soleil_meditation.png`,
  zara: `${SUPABASE_MEDIA_ROOT}/126c7e0ac_zara_meditation.png`,
};
