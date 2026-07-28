import { withTimeout } from '@/lib/async/withTimeout';
import { recordRestorationStage } from '@/lib/diagnostics/restorationDiagnostics';
import {
  getRevenueCatState,
  getRevenueCatTier,
  type RevenueCatTier,
} from '@/lib/purchases/revenueCat';
import { getSecureItem, setSecureItem, type SecureStorageKey } from '@/lib/storage';
import { getAppStorageItem, setAppStorageItem } from '@/lib/storage/appStorage';

// RevenueCat's SDK calls are native, not fetch(), so fetchWithTimeout can't
// bound them -- this is the only backstop against a hung Purchases call
// silently blocking whatever awaited resolvePremiumAccess (premium status
// display, chat tier enforcement, and potentially account restoration).
const REVENUECAT_SYNC_TIMEOUT_MS = 8000;

const SPECIAL_ACCESS_KEYS = [
  'unfiltr_family_unlock',
  'unfiltr_family_unlimited',
  'unfiltr_unlimited',
] as const satisfies readonly SecureStorageKey[];

type SpecialAccessKey = (typeof SPECIAL_ACCESS_KEYS)[number];

export type PremiumTier = RevenueCatTier | 'special';

export type PremiumAccessState = {
  dailyMessageLimit: number | null;
  hasAccess: boolean;
  revenueCatActive: boolean;
  source: 'revenuecat' | 'special' | 'none';
  specialAccessActive: boolean;
  tier: PremiumTier;
};

export function getDailyMessageLimit(tier: PremiumTier): number | null {
  switch (tier) {
    case 'free':
      return 10;
    case 'plus':
      return 100;
    case 'pro':
      return 200;
    case 'ultimate':
    case 'special':
      return null;
  }
}

export async function resolvePremiumAccess(
  options: { refreshRevenueCat?: boolean } = {},
): Promise<PremiumAccessState> {
  const specialAccessActive = await hasSpecialAccess();
  let revenueCatTier = await readStoredRevenueCatTier();

  if (options.refreshRevenueCat !== false) {
    recordRestorationStage('revenuecat-sync-start');
    try {
      const { customerInfo } = await withTimeout(
        getRevenueCatState(),
        REVENUECAT_SYNC_TIMEOUT_MS,
      );
      revenueCatTier = getRevenueCatTier(customerInfo);
      recordRestorationStage('revenuecat-sync-success');
    } catch (error) {
      // Keep the last verified RevenueCat tier while offline, during a
      // temporary SDK failure, or if the native call itself hangs.
      recordRestorationStage(
        error instanceof Error && error.name === 'TimeoutError'
          ? 'revenuecat-sync-timeout'
          : 'revenuecat-sync-failed',
      );
    }
  }

  const revenueCatActive = revenueCatTier !== 'free';
  const tier: PremiumTier = specialAccessActive ? 'special' : revenueCatTier;
  const hasAccess = tier !== 'free';
  const source = specialAccessActive ? 'special' : revenueCatActive ? 'revenuecat' : 'none';
  const dailyMessageLimit = getDailyMessageLimit(tier);
  await persistEffectivePremiumState(hasAccess, tier);

  return {
    dailyMessageLimit,
    hasAccess,
    revenueCatActive,
    source,
    specialAccessActive,
    tier,
  };
}

export async function persistEffectivePremiumState(
  hasAccess: boolean,
  tier: PremiumTier = hasAccess ? 'plus' : 'free',
): Promise<void> {
  await Promise.all([
    setSecureItem('unfiltr_is_premium', String(hasAccess)),
    setAppStorageItem('unfiltr_is_premium', String(hasAccess)),
    setSecureItem('unfiltr_effective_tier', tier),
    setAppStorageItem('unfiltr_effective_tier', tier),
  ]);
}

async function hasSpecialAccess(): Promise<boolean> {
  const values = await Promise.all(SPECIAL_ACCESS_KEYS.map((key) => readBoolean(key)));
  return values.some(Boolean);
}

async function readStoredRevenueCatTier(): Promise<RevenueCatTier> {
  const value =
    (await getSecureItem('unfiltr_revenuecat_tier')) ||
    (await getAppStorageItem('unfiltr_revenuecat_tier'));
  return value === 'plus' || value === 'pro' || value === 'ultimate' ? value : 'free';
}

async function readBoolean(key: SpecialAccessKey): Promise<boolean> {
  const secureValue = await getSecureItem(key);
  if (secureValue !== null) return secureValue === 'true';
  return (await getAppStorageItem(key)) === 'true';
}
