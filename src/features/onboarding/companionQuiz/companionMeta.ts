import type { CompanionId } from './quizData';

export type CompanionMeta = {
  avatar: string;
  emoji: string;
  explanation: string;
  id: CompanionId;
  name: string;
  summary: string;
  tagline: string;
  traits: string[];
};

export const COMPANION_META: Record<CompanionId, CompanionMeta> = {
  ash: {
    avatar:
      'https://hvvrbpvsgjxiicigkwhu.supabase.co/storage/v1/object/public/companion-avatars/a8e79ed38_ash_happy_nobg.png',
    emoji: '\u{1F32B}\uFE0F',
    explanation:
      'Your answers point toward low-pressure support, relaxed conversation, and wanting space to decompress without being pushed.',
    id: 'ash',
    name: 'Ash',
    summary: 'Chill, laid-back, and easy to talk to.',
    tagline: 'Chill & Laid-Back',
    traits: ['Casual', 'Balanced', 'Subtle humor', 'Chill energy'],
  },
  echo: {
    avatar:
      'https://hvvrbpvsgjxiicigkwhu.supabase.co/storage/v1/object/public/companion-avatars/55bcca860_happy.png',
    emoji: '\u{1F300}',
    explanation:
      'Your answers point toward deep emotional processing, being understood, and wanting someone who can hold the whole feeling with you.',
    id: 'echo',
    name: 'Echo',
    summary: 'Ethereal, intuitive, and emotionally perceptive.',
    tagline: 'Ethereal & Intuitive',
    traits: ['Deep', 'Listener', 'Philosophical', 'Intuitive'],
  },
  juan: {
    avatar:
      'https://hvvrbpvsgjxiicigkwhu.supabase.co/storage/v1/object/public/companion-avatars/00155921c_juan_happy_nobg.png',
    emoji: '\u{1F60E}',
    explanation:
      'Your answers point toward playful energy, quick humor, and needing a companion who can keep things light when life gets loud.',
    id: 'juan',
    name: 'Juan',
    summary: 'Funny, charismatic, and refreshingly unfiltered.',
    tagline: 'Funny & Charismatic',
    traits: ['Playful', 'Casual', 'Full-send humor', 'Balanced'],
  },
  kai: {
    avatar:
      'https://hvvrbpvsgjxiicigkwhu.supabase.co/storage/v1/object/public/companion-avatars/e6bf25bb8_kai_happy_nobg.png',
    emoji: '\u{1F30A}',
    explanation:
      'Your answers point toward momentum, direct encouragement, and wanting someone who helps you move when you feel stuck.',
    id: 'kai',
    name: 'Kai',
    summary: 'Bold, motivating, and ready to hype you up.',
    tagline: 'Bold & Motivating',
    traits: ['Motivating', 'Hype', 'Balanced', 'Direct'],
  },
  luna: {
    avatar:
      'https://hvvrbpvsgjxiicigkwhu.supabase.co/storage/v1/object/public/companion-avatars/943f2fb6c_luna_happy_nobg.png',
    emoji: '\u{1F319}',
    explanation:
      'Your answers point toward late-night reflection, emotional sensitivity, and wanting a companion who listens before trying to fix it.',
    id: 'luna',
    name: 'Luna',
    summary: 'Calm, nurturing, and emotionally present.',
    tagline: 'Calm & Nurturing',
    traits: ['Thoughtful', 'Listener', 'Gentle humor', 'Chill energy'],
  },
  nova: {
    avatar:
      'https://hvvrbpvsgjxiicigkwhu.supabase.co/storage/v1/object/public/companion-avatars/775bab2d1_nova_happy_nobg.png',
    emoji: '\u26A1',
    explanation:
      'Your answers point toward spontaneity, chaos with charm, and wanting a companion who can match your playful momentum.',
    id: 'nova',
    name: 'Nova',
    summary: 'Curious, cosmic, and full of spark.',
    tagline: 'Curious & Cosmic',
    traits: ['Playful', 'Casual', 'Full-send humor', 'Bright'],
  },
  river: {
    avatar:
      'https://hvvrbpvsgjxiicigkwhu.supabase.co/storage/v1/object/public/companion-avatars/590ce6b38_river_neutral.png',
    emoji: '\u{1F33F}',
    explanation:
      'Your answers point toward quiet steadiness, thoughtful reflection, and wanting support that feels gentle rather than forceful.',
    id: 'river',
    name: 'River',
    summary: 'Gentle, flowing, and quietly grounding.',
    tagline: 'Gentle & Flowing',
    traits: ['Thoughtful', 'Listener', 'Soft-spoken', 'Chill'],
  },
  ryuu: {
    avatar:
      'https://hvvrbpvsgjxiicigkwhu.supabase.co/storage/v1/object/public/companion-avatars/9aaa48819_ryuu_happy_nobg.png',
    emoji: '\u{1F409}',
    explanation:
      'Your answers point toward clarity, discipline, and wanting a companion who can steady your focus without sugarcoating everything.',
    id: 'ryuu',
    name: 'Ryuu',
    summary: 'Fierce, disciplined, and quietly protective.',
    tagline: 'Fierce & Disciplined',
    traits: ['Motivating', 'Advisor', 'Thoughtful', 'Focused'],
  },
  sage: {
    avatar:
      'https://hvvrbpvsgjxiicigkwhu.supabase.co/storage/v1/object/public/companion-avatars/6fe6ce5e7_sage_neutral.png',
    emoji: '\u{1F343}',
    explanation:
      'Your answers point toward introspection, meaning-making, and wanting a companion who helps you understand what is underneath.',
    id: 'sage',
    name: 'Sage',
    summary: 'Wise, grounded, and deeply reflective.',
    tagline: 'Wise & Grounded',
    traits: ['Philosophical', 'Deep', 'Balanced', 'Grounded'],
  },
  sakura: {
    avatar:
      'https://hvvrbpvsgjxiicigkwhu.supabase.co/storage/v1/object/public/companion-avatars/6fb3c5226_sakura_happy_nobg.png',
    emoji: '\u{1F338}',
    explanation:
      'Your answers point toward tenderness, soft reassurance, and wanting a companion who brings warmth without overwhelming you.',
    id: 'sakura',
    name: 'Sakura',
    summary: 'Sweet, cheerful, and softly reassuring.',
    tagline: 'Sweet & Cheerful',
    traits: ['Playful', 'Listener', 'Casual', 'Warm'],
  },
  soleil: {
    avatar:
      'https://hvvrbpvsgjxiicigkwhu.supabase.co/storage/v1/object/public/companion-avatars/0e3c34b7e_happy.png',
    emoji: '\u2600\uFE0F',
    explanation:
      'Your answers point toward warmth, optimism, and wanting someone who helps you reconnect with the lighter parts of yourself.',
    id: 'soleil',
    name: 'Soleil',
    summary: 'Warm, radiant, and gently uplifting.',
    tagline: 'Warm & Radiant',
    traits: ['Playful', 'Hype', 'Listener', 'Radiant'],
  },
  zara: {
    avatar:
      'https://hvvrbpvsgjxiicigkwhu.supabase.co/storage/v1/object/public/companion-avatars/46ae5a4f0_zara_neutral.png',
    emoji: '\u2728',
    explanation:
      'Your answers point toward honesty, edge, and wanting a companion who can be real with you without losing the humor.',
    id: 'zara',
    name: 'Zara',
    summary: 'Edgy, authentic, and sharply funny.',
    tagline: 'Edgy & Authentic',
    traits: ['Sarcastic', 'Advisor', 'Casual', 'Full-send humor'],
  },
};

export function getCompanionMeta(id: CompanionId): CompanionMeta {
  return COMPANION_META[id] ?? COMPANION_META.luna;
}
