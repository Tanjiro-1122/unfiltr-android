import { Platform } from 'react-native';
import Purchases, {
  type CustomerInfo,
  type PurchasesOfferings,
  type PurchasesPackage,
} from 'react-native-purchases';

import { env } from '@/config';
import { deleteSecureItem, getSecureItem, setSecureItem } from '@/lib/storage';
import { deleteAppStorageItem, setAppStorageItem } from '@/lib/storage/appStorage';

export const REVENUECAT_ENTITLEMENT_ID = 'unfiltr by javier Pro';

export type RevenueCatTier = 'free' | 'plus' | 'pro' | 'ultimate';

const PRODUCT_TIERS: Record<string, RevenueCatTier> = {
  'com.huertas.unfiltr.pro.annual': 'ultimate',
  'com.huertas.unfiltr.pro.monthly': 'plus',
  'com.huertas.unfiltr.tier.pro': 'pro',
  'unfiltr_plus_monthly:monthly-999': 'plus',
  'unfiltr_pro_monthly:monthly-1499': 'pro',
  'unfiltr_ultimate_friend_annual:annual-99': 'ultimate',
};

let configured = false;
let activeAppUserId: string | null = null;

export async function configureRevenueCat(): Promise<void> {
  if (Platform.OS === 'web') return;

  const apiKey = Platform.OS === 'ios' ? env.revenueCatAppleApiKey : env.revenueCatGoogleApiKey;
  if (!apiKey) throw new Error(`RevenueCat ${Platform.OS} public SDK key is not configured.`);

  if (!configured) {
    Purchases.configure({ apiKey });
    configured = true;
  }

  const storedUserId = await getStoredRevenueCatUserId();
  if (storedUserId) await syncRevenueCatUser(storedUserId);
}

export async function syncRevenueCatUser(appUserId: string): Promise<CustomerInfo | null> {
  if (Platform.OS === 'web') return null;

  const normalized = appUserId.trim();
  if (!normalized) return null;

  if (!configured) {
    const apiKey = Platform.OS === 'ios' ? env.revenueCatAppleApiKey : env.revenueCatGoogleApiKey;
    if (!apiKey) throw new Error(`RevenueCat ${Platform.OS} public SDK key is not configured.`);
    Purchases.configure({ apiKey });
    configured = true;
  }

  if (activeAppUserId === normalized) {
    const customerInfo = await Purchases.getCustomerInfo();
    await persistRevenueCatState(customerInfo);
    return customerInfo;
  }

  const result = await Purchases.logIn(normalized);
  activeAppUserId = normalized;
  await setSecureItem('revenueCat.appUserId', normalized);
  await persistRevenueCatState(result.customerInfo);
  return result.customerInfo;
}

export async function signOutRevenueCat(): Promise<void> {
  activeAppUserId = null;
  await Promise.all([
    deleteSecureItem('revenueCat.appUserId'),
    deleteSecureItem('unfiltr_revenuecat_premium'),
    deleteSecureItem('unfiltr_revenuecat_tier'),
    deleteAppStorageItem('unfiltr_revenuecat_premium'),
    deleteAppStorageItem('unfiltr_revenuecat_tier'),
  ]);

  if (Platform.OS === 'web' || !configured) return;

  try {
    const isAnonymous = await Purchases.isAnonymous();
    if (!isAnonymous) await Purchases.logOut();
  } catch (error) {
    console.warn('[RevenueCat] Sign-out reset failed:', error);
  }
}

export async function getRevenueCatState(): Promise<{
  customerInfo: CustomerInfo;
  offerings: PurchasesOfferings;
}> {
  await configureRevenueCat();
  const [customerInfo, offerings] = await Promise.all([
    Purchases.getCustomerInfo(),
    Purchases.getOfferings(),
  ]);
  await persistRevenueCatState(customerInfo);
  return { customerInfo, offerings };
}

export async function purchaseRevenueCatPackage(
  selectedPackage: PurchasesPackage,
): Promise<CustomerInfo> {
  await configureRevenueCat();
  const result = await Purchases.purchasePackage(selectedPackage);
  await persistRevenueCatState(result.customerInfo);
  return result.customerInfo;
}

export async function restoreRevenueCatPurchases(): Promise<CustomerInfo> {
  await configureRevenueCat();
  const customerInfo = await Purchases.restorePurchases();
  await persistRevenueCatState(customerInfo);
  return customerInfo;
}

export function hasPremiumEntitlement(customerInfo: CustomerInfo): boolean {
  return Boolean(customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT_ID]);
}

export function getRevenueCatTier(customerInfo: CustomerInfo): RevenueCatTier {
  if (!hasPremiumEntitlement(customerInfo)) return 'free';

  const activeProducts = new Set(customerInfo.activeSubscriptions);
  const entitlementProduct =
    customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT_ID]?.productIdentifier;
  if (entitlementProduct) activeProducts.add(entitlementProduct);

  if ([...activeProducts].some((productId) => PRODUCT_TIERS[productId] === 'ultimate')) {
    return 'ultimate';
  }
  if ([...activeProducts].some((productId) => PRODUCT_TIERS[productId] === 'pro')) return 'pro';
  if ([...activeProducts].some((productId) => PRODUCT_TIERS[productId] === 'plus')) return 'plus';

  // Keep unknown products premium while defaulting them to the lower paid message allowance.
  return 'plus';
}

export async function persistRevenueCatState(customerInfo: CustomerInfo): Promise<boolean> {
  const tier = getRevenueCatTier(customerInfo);
  const premium = tier !== 'free';
  await Promise.all([
    setSecureItem('unfiltr_revenuecat_premium', String(premium)),
    setAppStorageItem('unfiltr_revenuecat_premium', String(premium)),
    setSecureItem('unfiltr_revenuecat_tier', tier),
    setAppStorageItem('unfiltr_revenuecat_tier', tier),
  ]);
  return premium;
}

async function getStoredRevenueCatUserId(): Promise<string | null> {
  return (
    (await getSecureItem('revenueCat.appUserId')) ||
    (await getSecureItem('auth.appleUserId')) ||
    (await getSecureItem('auth.userId')) ||
    null
  );
}
