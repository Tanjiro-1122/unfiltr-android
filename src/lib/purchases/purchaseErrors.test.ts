import { describe, expect, it } from 'vitest';

import {
  categorizeEmptyOfferings,
  categorizePurchaseError,
  describePurchaseError,
  describePurchaseErrorCategory,
  RevenueCatSdkKeyMissingError,
} from './purchaseErrors';

function purchasesError(code: string, extra: Record<string, unknown> = {}) {
  return { code, message: 'raw underlying SDK message that must never reach the user', ...extra };
}

describe('categorizePurchaseError', () => {
  it('a RevenueCatSdkKeyMissingError instance is categorized as sdk-key-missing', () => {
    expect(categorizePurchaseError(new RevenueCatSdkKeyMissingError('android'))).toBe('sdk-key-missing');
  });

  it('code "1" (PURCHASE_CANCELLED_ERROR) or userCancelled true is purchase-cancelled', () => {
    expect(categorizePurchaseError(purchasesError('1'))).toBe('purchase-cancelled');
    expect(categorizePurchaseError({ userCancelled: true })).toBe('purchase-cancelled');
  });

  it('code "3" (PURCHASE_NOT_ALLOWED_ERROR) is purchase-not-allowed', () => {
    expect(categorizePurchaseError(purchasesError('3'))).toBe('purchase-not-allowed');
  });

  it('code "11" (INVALID_CREDENTIALS_ERROR) is invalid-credentials', () => {
    expect(categorizePurchaseError(purchasesError('11'))).toBe('invalid-credentials');
  });

  it('code "10" (NETWORK_ERROR) or "35" (OFFLINE_CONNECTION_ERROR) is network-error', () => {
    expect(categorizePurchaseError(purchasesError('10'))).toBe('network-error');
    expect(categorizePurchaseError(purchasesError('35'))).toBe('network-error');
  });

  it('code "23" (CONFIGURATION_ERROR) is products-not-configured', () => {
    expect(categorizePurchaseError(purchasesError('23'))).toBe('products-not-configured');
  });

  it('an unrecognized code, null, non-object, or a plain Error all fall back to unknown', () => {
    expect(categorizePurchaseError(purchasesError('99'))).toBe('unknown');
    expect(categorizePurchaseError(null)).toBe('unknown');
    expect(categorizePurchaseError(undefined)).toBe('unknown');
    expect(categorizePurchaseError('a string, not an object')).toBe('unknown');
    expect(categorizePurchaseError(new Error('some other failure'))).toBe('unknown');
  });
});

describe('categorizeEmptyOfferings', () => {
  it('no current offering at all is offerings-unavailable', () => {
    expect(categorizeEmptyOfferings(false, 0)).toBe('offerings-unavailable');
  });

  it('a current offering that exists but has zero packages is products-not-configured -- a DIFFERENT state from no offering at all', () => {
    expect(categorizeEmptyOfferings(true, 0)).toBe('products-not-configured');
  });

  it('a current offering with at least one package is not an error state (null)', () => {
    expect(categorizeEmptyOfferings(true, 1)).toBe(null);
  });
});

describe('describePurchaseErrorCategory / describePurchaseError', () => {
  it('every non-unknown category has a fixed, safe message -- never derived from the underlying error', () => {
    expect(describePurchaseErrorCategory('sdk-key-missing')).toMatch(/credentials\/configuration/i);
    expect(describePurchaseErrorCategory('invalid-credentials')).toMatch(/credentials\/configuration/i);
    expect(describePurchaseErrorCategory('offerings-unavailable')).toMatch(/unavailable/i);
    expect(describePurchaseErrorCategory('products-not-configured')).toMatch(/not configured/i);
    expect(describePurchaseErrorCategory('network-error')).toMatch(/network/i);
    expect(describePurchaseErrorCategory('purchase-cancelled')).toMatch(/cancelled/i);
    expect(describePurchaseErrorCategory('purchase-not-allowed')).toMatch(/not allowed/i);
  });

  it('the unknown category uses the caller-supplied fallback, defaulting to a generic safe message', () => {
    expect(describePurchaseErrorCategory('unknown', 'Custom fallback.')).toBe('Custom fallback.');
    expect(describePurchaseErrorCategory('unknown')).toMatch(/something went wrong/i);
  });

  it('describePurchaseError never leaks the raw message for a real SDK error object', () => {
    const message = describePurchaseError(purchasesError('11'));
    expect(message).not.toMatch(/raw underlying SDK message/);
    expect(message).toMatch(/credentials\/configuration/i);
  });

  it('describePurchaseError falls back to the caller-supplied message for an unrecognized failure, never the raw one', () => {
    const message = describePurchaseError(new Error('some raw internal detail'), 'Could not connect to RevenueCat.');
    expect(message).toBe('Could not connect to RevenueCat.');
  });
});
