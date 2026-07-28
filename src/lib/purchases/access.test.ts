import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

const store = new Map<string, string>();

vi.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'afterFirstUnlockThisDeviceOnly',
  getItemAsync: vi.fn(async (key: string) => store.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    store.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    store.delete(key);
  }),
}));

const getRevenueCatState = vi.fn();
const getRevenueCatTier = vi.fn();

vi.mock('@/lib/purchases/revenueCat', () => ({
  getRevenueCatState: (...args: unknown[]) => getRevenueCatState(...args),
  getRevenueCatTier: (...args: unknown[]) => getRevenueCatTier(...args),
}));

describe('resolvePremiumAccess', () => {
  beforeEach(() => {
    vi.resetModules();
    store.clear();
    getRevenueCatState.mockReset();
    getRevenueCatTier.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('a RevenueCat call that never settles does not block resolution -- falls back to the last known tier', async () => {
    vi.useFakeTimers();
    store.set('unfiltr_revenuecat_tier', 'pro');
    getRevenueCatState.mockReturnValue(new Promise(() => {}));

    const { resolvePremiumAccess } = await import('./access');
    const resultPromise = resolvePremiumAccess();

    await vi.advanceTimersByTimeAsync(8000);
    const result = await resultPromise;

    expect(result.tier).toBe('pro');
    expect(result.hasAccess).toBe(true);
  });

  it('a successful RevenueCat sync updates the tier from the fresh customer info', async () => {
    getRevenueCatState.mockResolvedValue({ customerInfo: { fake: true } });
    getRevenueCatTier.mockReturnValue('ultimate');

    const { resolvePremiumAccess } = await import('./access');
    const result = await resolvePremiumAccess();

    expect(result.tier).toBe('ultimate');
  });

  it('a RevenueCat SDK failure keeps the app usable at the last known tier rather than throwing', async () => {
    store.set('unfiltr_revenuecat_tier', 'plus');
    getRevenueCatState.mockRejectedValue(new Error('SDK not configured'));

    const { resolvePremiumAccess } = await import('./access');
    const result = await resolvePremiumAccess();

    expect(result.tier).toBe('plus');
  });
});
