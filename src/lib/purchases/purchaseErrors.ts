/**
 * Safe, user-facing categorization for RevenueCat/purchase failures. Never
 * shown to the user: the raw SDK error message/object, credentials, keys,
 * or any other underlying exception detail -- only one of the fixed
 * categories below and its matching, static copy.
 *
 * Error code values are react-native-purchases' PURCHASES_ERROR_CODE enum
 * (@revenuecat/purchases-typescript-internal/dist/generated/error-codes.d.ts)
 * -- compared as literal strings rather than importing the enum, since the
 * package only exposes it at runtime via the default-exported `Purchases`
 * class (`Purchases.PURCHASES_ERROR_CODE`), not as a named export. These
 * values are part of RevenueCat's public SDK contract and don't change.
 */
const PURCHASES_ERROR_CODE = {
  PURCHASE_CANCELLED: '1',
  PURCHASE_NOT_ALLOWED: '3',
  NETWORK_ERROR: '10',
  INVALID_CREDENTIALS: '11',
  CONFIGURATION_ERROR: '23',
  OFFLINE_CONNECTION: '35',
} as const;

export type PurchaseErrorCategory =
  | 'sdk-key-missing'
  | 'offerings-unavailable'
  | 'products-not-configured'
  | 'invalid-credentials'
  | 'network-error'
  | 'purchase-cancelled'
  | 'purchase-not-allowed'
  | 'unknown';

/**
 * Thrown by configureRevenueCat()/syncRevenueCatUser() instead of a plain
 * Error when the platform's public SDK key is missing -- a distinguishable
 * class (not a message string match) so categorizePurchaseError can detect
 * it reliably, and so the thrown error itself never carries anything more
 * sensitive than "which platform".
 */
export class RevenueCatSdkKeyMissingError extends Error {
  constructor(platform: string) {
    super(`RevenueCat ${platform} public SDK key is not configured.`);
    this.name = 'RevenueCatSdkKeyMissingError';
  }
}

export function categorizePurchaseError(error: unknown): PurchaseErrorCategory {
  if (error instanceof RevenueCatSdkKeyMissingError) return 'sdk-key-missing';
  if (!error || typeof error !== 'object') return 'unknown';

  const candidate = error as { code?: unknown; userCancelled?: unknown };
  const code = typeof candidate.code === 'string' ? candidate.code : null;

  // userCancelled is deprecated in favor of the code check, but still
  // checked first for older SDK error shapes that only set it.
  if (candidate.userCancelled === true || code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED) {
    return 'purchase-cancelled';
  }
  if (code === PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED) return 'purchase-not-allowed';
  if (code === PURCHASES_ERROR_CODE.INVALID_CREDENTIALS) return 'invalid-credentials';
  if (code === PURCHASES_ERROR_CODE.NETWORK_ERROR || code === PURCHASES_ERROR_CODE.OFFLINE_CONNECTION) {
    return 'network-error';
  }
  // CONFIGURATION_ERROR is RevenueCat's own bucket for "the dashboard/store
  // setup doesn't match what the app is asking for" -- e.g. no matching
  // product configured -- which is exactly what "products not configured"
  // means here.
  if (code === PURCHASES_ERROR_CODE.CONFIGURATION_ERROR) return 'products-not-configured';

  return 'unknown';
}

/**
 * For a successfully-fetched PurchasesOfferings result (no exception at
 * all) that is still unusable -- distinguishes "no current offering exists"
 * from "a current offering exists but has zero packages", per the two
 * separate states callers must detect.
 */
export function categorizeEmptyOfferings(hasCurrentOffering: boolean, packageCount: number): PurchaseErrorCategory | null {
  if (!hasCurrentOffering) return 'offerings-unavailable';
  if (packageCount === 0) return 'products-not-configured';
  return null;
}

const CATEGORY_MESSAGES: Record<Exclude<PurchaseErrorCategory, 'unknown'>, string> = {
  'sdk-key-missing': 'Store credentials/configuration error. Please try again later.',
  'invalid-credentials': 'Store credentials/configuration error. Please try again later.',
  'offerings-unavailable': 'Subscription plans are unavailable right now. Please try again later.',
  'products-not-configured': 'Subscription plans are not configured yet. Please try again later.',
  'network-error': 'Network error. Check your connection and try again.',
  'purchase-cancelled': 'Purchase cancelled.',
  'purchase-not-allowed': 'Purchases are not allowed on this device or account.',
};

export function describePurchaseErrorCategory(
  category: PurchaseErrorCategory,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (category === 'unknown') return fallback;
  return CATEGORY_MESSAGES[category];
}

/** Drop-in replacement for a raw-message error reader: never returns
 * anything derived from the underlying error object other than its
 * category. */
export function describePurchaseError(error: unknown, fallback?: string): string {
  return describePurchaseErrorCategory(categorizePurchaseError(error), fallback);
}
