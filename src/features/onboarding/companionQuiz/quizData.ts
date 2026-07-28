export type CompanionId =
  | 'ash'
  | 'echo'
  | 'juan'
  | 'kai'
  | 'luna'
  | 'nova'
  | 'river'
  | 'ryuu'
  | 'sage'
  | 'sakura'
  | 'soleil'
  | 'zara';

export type QuizScores = Partial<Record<CompanionId, number>>;

export type QuizOption = {
  label: string;
  scores: QuizScores;
};

export type QuizQuestion = {
  options: QuizOption[];
  q: string;
  sub: string;
};

export type QuizMatchResult = {
  matchId: CompanionId;
  maxPts: number;
  top3: {
    companionId: CompanionId;
    pts: number;
  }[];
};

export const COMPANION_IDS: CompanionId[] = [
  'luna',
  'kai',
  'nova',
  'river',
  'ash',
  'sakura',
  'ryuu',
  'sage',
  'zara',
  'echo',
  'soleil',
  'juan',
];

export const COMPANION_PERSONALITY: Record<
  CompanionId,
  {
    empathy: string;
    humor: string;
    style: string;
    vibe: string;
  }
> = {
  ash: { empathy: 'balanced', humor: 'subtle', style: 'casual', vibe: 'chill' },
  echo: { empathy: 'listener', humor: 'subtle', style: 'philosophical', vibe: 'deep' },
  juan: { empathy: 'balanced', humor: 'fullsend', style: 'casual', vibe: 'playful' },
  kai: { empathy: 'balanced', humor: 'subtle', style: 'hype', vibe: 'motivating' },
  luna: { empathy: 'listener', humor: 'subtle', style: 'thoughtful', vibe: 'chill' },
  nova: { empathy: 'balanced', humor: 'fullsend', style: 'casual', vibe: 'playful' },
  river: { empathy: 'listener', humor: 'none', style: 'thoughtful', vibe: 'chill' },
  ryuu: { empathy: 'advisor', humor: 'none', style: 'thoughtful', vibe: 'motivating' },
  sage: { empathy: 'balanced', humor: 'subtle', style: 'philosophical', vibe: 'deep' },
  sakura: { empathy: 'listener', humor: 'subtle', style: 'casual', vibe: 'playful' },
  soleil: { empathy: 'listener', humor: 'subtle', style: 'hype', vibe: 'playful' },
  zara: { empathy: 'advisor', humor: 'fullsend', style: 'casual', vibe: 'sarcastic' },
};

export const QUESTIONS: QuizQuestion[] = [
  {
    q: "It's 2am. You're wide awake. What are you actually doing?",
    sub: 'be honest \u{1F440}',
    options: [
      {
        label: 'Spiraling about something from 3 years ago \u{1F62D}',
        scores: { luna: 3, echo: 2, river: 1 },
      },
      {
        label: 'Watching videos until my eyes give up \u{1F4F1}',
        scores: { ash: 3, nova: 2, juan: 1 },
      },
      {
        label: "Making plans I'll never follow through on \u{1F4DD}",
        scores: { nova: 3, kai: 2, zara: 1 },
      },
      {
        label: 'Journaling or just staring at the ceiling \u{1F319}',
        scores: { sage: 3, river: 2, luna: 1 },
      },
    ],
  },
  {
    q: 'Someone cancels plans last minute. Your gut reaction is:',
    sub: 'pick the most honest one',
    options: [
      {
        label: 'Lowkey relieved \u{1F605} (introvert win)',
        scores: { ash: 3, river: 2, sage: 1 },
      },
      {
        label: "Annoyed but I'll get over it \u{1F644}",
        scores: { zara: 3, kai: 2, nova: 1 },
      },
      {
        label: "Genuinely hurt but I say 'no worries!' \u{1F972}",
        scores: { luna: 3, sakura: 2, echo: 1 },
      },
      {
        label: 'Already rebooking with someone else \u{1F4F2}',
        scores: { soleil: 3, juan: 2, kai: 1 },
      },
    ],
  },
  {
    q: 'What do you actually need most right now?',
    sub: 'no judgment here',
    options: [
      {
        label: 'Someone to vent to - no advice, just listen \u{1FAC2}',
        scores: { luna: 3, river: 2, echo: 1 },
      },
      {
        label: 'A kick in the ass to get moving \u{1F4AA}',
        scores: { kai: 3, ryuu: 2, zara: 1 },
      },
      {
        label: 'Distractions and good vibes only \u{1F60E}',
        scores: { ash: 3, juan: 2, nova: 1 },
      },
      {
        label: 'Someone to actually understand me \u{1F495}',
        scores: { echo: 3, sage: 2, luna: 1 },
      },
    ],
  },
  {
    q: 'Pick the vibe that hits different:',
    sub: 'trust your gut',
    options: [
      {
        label: '\u{1F338} Cherry blossoms, soft music, no obligations',
        scores: { sakura: 3, river: 2, luna: 1 },
      },
      {
        label: '\u{1F306} Neon lights, late night energy, anything goes',
        scores: { zara: 3, nova: 2, juan: 1 },
      },
      {
        label: '\u{1F3D4}\uFE0F Mountains at sunrise, cold air, total clarity',
        scores: { ryuu: 3, kai: 2, sage: 1 },
      },
      {
        label: '\u{1F6CB}\uFE0F Cozy inside, rain outside, literally no plans',
        scores: { ash: 3, luna: 2, river: 1 },
      },
    ],
  },
  {
    q: 'Your friends would describe you as:',
    sub: 'the real version, not the LinkedIn version',
    options: [
      {
        label: 'The therapist friend - always the listener \u{1F499}',
        scores: { luna: 3, echo: 2, river: 1 },
      },
      {
        label: 'The chaos agent - unpredictable but lovable \u{1F525}',
        scores: { nova: 3, juan: 2, zara: 1 },
      },
      {
        label: 'The reliable one - shows up every time \u{1F91D}',
        scores: { kai: 3, soleil: 2, ryuu: 1 },
      },
      {
        label: 'The quiet one who observes everything \u{1F441}\uFE0F',
        scores: { sage: 3, ash: 2, echo: 1 },
      },
    ],
  },
];

export function calculateQuizResult(scores: QuizScores): QuizMatchResult {
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]) as [CompanionId, number][];
  const winnerId = sorted[0]?.[0];
  const fallbackId: CompanionId = 'luna';
  const matchId = winnerId && COMPANION_IDS.includes(winnerId) ? winnerId : fallbackId;
  const top3 = sorted
    .slice(0, 3)
    .filter(([id]) => COMPANION_IDS.includes(id))
    .map(([companionId, pts]) => ({ companionId, pts }));

  return {
    matchId,
    maxPts: sorted[0]?.[1] || 1,
    top3,
  };
}
