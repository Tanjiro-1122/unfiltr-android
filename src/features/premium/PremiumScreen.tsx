import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/BackButton';
import {
  getRevenueCatState,
  getRevenueCatTier,
  purchaseRevenueCatPackage,
  restoreRevenueCatPurchases,
  type RevenueCatTier,
} from '@/lib/purchases/revenueCat';

type PremiumScreenProps = {
  onBack: () => void;
  returnTo?: 'home' | 'settings';
};

type PlanView = {
  badge: string | null;
  package: PurchasesPackage;
  rank: number;
  sub: string;
  tier: Exclude<RevenueCatTier, 'free'>;
  title: string;
};

const PERKS = [
  'Deep memory — your companion truly knows you',
  'Voice responses (TTS)',
  'Full conversation history and journal',
  'Priority responses',
];

export function PremiumScreen({ onBack, returnTo = 'settings' }: PremiumScreenProps) {
  const insets = useSafeAreaInsets();
  const [plans, setPlans] = useState<PlanView[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [status, setStatus] = useState(
    Platform.OS === 'web'
      ? 'Purchases are available in the iPhone and Android app.'
      : 'Connecting to the App Store…',
  );
  const [activeTier, setActiveTier] = useState<RevenueCatTier>('free');
  const [loading, setLoading] = useState(Platform.OS !== 'web');
  const [working, setWorking] = useState(false);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.package.identifier === selectedPackageId) ?? plans[0] ?? null,
    [plans, selectedPackageId],
  );

  const load = useCallback(async () => {
    if (Platform.OS === 'web') return;

    try {
      const { customerInfo, offerings } = await getRevenueCatState();
      const available = offerings.current?.availablePackages ?? [];
      const mapped = available
        .map(mapPlan)
        .filter((plan): plan is PlanView => plan !== null)
        .sort((left, right) => left.rank - right.rank);

      setPlans(mapped);
      setSelectedPackageId((currentId) => currentId || mapped[0]?.package.identifier || '');

      const tier = getRevenueCatTier(customerInfo);
      setActiveTier(tier);
      setStatus(
        tier !== 'free'
          ? `${formatTierName(tier)} is active.`
          : mapped.length
            ? 'Choose the plan that fits how much you want to talk.'
            : 'No RevenueCat offering is currently available. Check the RevenueCat offering configuration.',
      );
    } catch (error) {
      setStatus(readPurchaseError(error, 'Could not connect to RevenueCat.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function purchaseSelectedPlan() {
    if (!selectedPlan || working) return;
    setWorking(true);
    setStatus('Opening the App Store purchase sheet…');
    try {
      const customerInfo = await purchaseRevenueCatPackage(selectedPlan.package);
      const tier = getRevenueCatTier(customerInfo);
      setActiveTier(tier);
      setStatus(
        tier !== 'free'
          ? `Purchase successful. ${formatTierName(tier)} is now active.`
          : 'The purchase completed, but the premium entitlement was not returned. Check the RevenueCat entitlement mapping.',
      );
    } catch (error) {
      setStatus(readPurchaseError(error, 'The purchase could not be completed.'));
    } finally {
      setWorking(false);
    }
  }

  async function restore() {
    if (working) return;
    setWorking(true);
    setStatus('Restoring purchases…');
    try {
      const customerInfo = await restoreRevenueCatPurchases();
      const tier = getRevenueCatTier(customerInfo);
      setActiveTier(tier);
      setStatus(
        tier !== 'free'
          ? `Purchases restored. ${formatTierName(tier)} is active.`
          : 'No active premium purchase was found for this App Store account.',
      );
    } catch (error) {
      setStatus(readPurchaseError(error, 'Purchases could not be restored.'));
    } finally {
      setWorking(false);
    }
  }

  const isPremium = activeTier !== 'free';

  return (
    <LinearGradient colors={['#2D0A6E', '#120428', '#05020D']} style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: Math.max(insets.bottom + 28, 52) },
          ]}
        >
          <View style={styles.header}>
            <BackButton
              accessibilityLabel={returnTo === 'home' ? 'Back to home' : 'Back to settings'}
              onPress={onBack}
            />
            <Text style={styles.title}>Premium</Text>
          </View>

          <View style={styles.hero}>
            <Text style={styles.kicker}>You’ve hit your limit</Text>
            <Text style={styles.heroTitle}>Keep your connection going.</Text>
            <Text style={styles.heroCopy}>{status}</Text>
            {loading ? <ActivityIndicator color="#C084FC" style={styles.loader} /> : null}
          </View>

          {isPremium ? (
            <View style={styles.activeCard}>
              <Text style={styles.activeTitle}>{formatTierName(activeTier)} active</Text>
              <Text style={styles.activeCopy}>{describeTier(activeTier)}</Text>
            </View>
          ) : null}

          {!loading && !isPremium
            ? plans.map((plan) => {
                const selected = selectedPlan?.package.identifier === plan.package.identifier;
                return (
                  <View
                    key={plan.package.identifier}
                    style={[styles.planCard, selected && styles.planCardActive]}
                  >
                    <View style={styles.planHeader}>
                      <Text style={styles.planLabel}>{plan.package.product.priceString}</Text>
                      {plan.badge ? <Text style={styles.badge}>{plan.badge}</Text> : null}
                    </View>
                    <Text style={styles.planName}>{plan.title}</Text>
                    <Text style={styles.planSub}>{plan.sub}</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => setSelectedPackageId(plan.package.identifier)}
                      style={styles.selectButton}
                    >
                      <Text style={styles.selectText}>
                        {selected ? 'Selected plan' : 'Select plan'}
                      </Text>
                    </Pressable>
                  </View>
                );
              })
            : null}

          {!isPremium && selectedPlan ? (
            <Pressable
              accessibilityRole="button"
              disabled={working}
              onPress={() => void purchaseSelectedPlan()}
              style={[styles.primaryButton, working && styles.disabledButton]}
            >
              {working ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryText}>Continue with {selectedPlan.title}</Text>
              )}
            </Pressable>
          ) : null}

          <View style={styles.perks}>
            {PERKS.map((perk) => (
              <Text key={perk} style={styles.perk}>
                ✓ {perk}
              </Text>
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={working || Platform.OS === 'web'}
            onPress={() => void restore()}
            style={[styles.restoreButton, working && styles.disabledButton]}
          >
            <Text style={styles.restoreText}>Restore purchases</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={working}
            onPress={() => void load()}
            style={styles.refreshButton}
          >
            <Text style={styles.refreshText}>Refresh subscription status</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function mapPlan(pkg: PurchasesPackage): PlanView | null {
  const productId = pkg.product.identifier;
  if (
    productId === 'com.huertas.unfiltr.pro.annual' ||
    productId === 'unfiltr_ultimate_friend_annual:annual-99'
  ) {
    return {
      badge: 'ULTIMATE FRIEND ⭐',
      package: pkg,
      rank: 0,
      sub: 'Unlimited messages · Memory · Continuity · Cancel anytime',
      tier: 'ultimate',
      title: 'Ultimate Friend — Annual',
    };
  }
  if (
    productId === 'com.huertas.unfiltr.tier.pro' ||
    productId === 'unfiltr_pro_monthly:monthly-1499'
  ) {
    return {
      badge: 'MOST POPULAR ⚡',
      package: pkg,
      rank: 1,
      sub: '200 messages/day · Priority speed · Full journal access',
      tier: 'pro',
      title: 'Pro Tier — Monthly',
    };
  }
  if (
    productId === 'com.huertas.unfiltr.pro.monthly' ||
    productId === 'unfiltr_plus_monthly:monthly-999'
  ) {
    return {
      badge: null,
      package: pkg,
      rank: 2,
      sub: '100 messages/day · Auto-renews monthly',
      tier: 'plus',
      title: 'Premium Monthly',
    };
  }
  return null;
}

function formatTierName(tier: RevenueCatTier): string {
  switch (tier) {
    case 'ultimate':
      return 'Ultimate Friend';
    case 'pro':
      return 'Pro Tier';
    case 'plus':
      return 'Premium Monthly';
    default:
      return 'Free';
  }
}

function describeTier(tier: RevenueCatTier): string {
  switch (tier) {
    case 'ultimate':
      return 'Unlimited messages with full memory and relationship continuity.';
    case 'pro':
      return 'Up to 200 messages per day with priority responses and full journal access.';
    case 'plus':
      return 'Up to 100 messages per day with premium access.';
    default:
      return '10 free messages per day.';
  }
}

function readPurchaseError(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object') return fallback;
  const candidate = error as { code?: string; message?: string; userCancelled?: boolean };
  if (candidate.userCancelled || candidate.code === '1') return 'Purchase cancelled.';
  return candidate.message?.trim() || fallback;
}

const styles = StyleSheet.create({
  activeCard: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderColor: 'rgba(74,222,128,0.4)',
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 18,
    padding: 18,
  },
  activeCopy: { color: 'rgba(255,255,255,0.68)', fontSize: 13, lineHeight: 20, marginTop: 6 },
  activeTitle: { color: '#86EFAC', fontSize: 18, fontWeight: '900' },
  backButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  backText: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  badge: { color: '#FDE68A', fontSize: 10, fontWeight: '900' },
  disabledButton: { opacity: 0.55 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 16, marginBottom: 18 },
  hero: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(168,85,247,0.32)',
    borderRadius: 26,
    borderWidth: 1,
    marginBottom: 18,
    padding: 22,
  },
  heroCopy: { color: 'rgba(255,255,255,0.64)', fontSize: 14, lineHeight: 22 },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 32,
    marginBottom: 12,
  },
  kicker: {
    color: '#C084FC',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  loader: { marginTop: 16 },
  perk: { color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 24 },
  perks: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    marginTop: 18,
    padding: 18,
  },
  planCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 12,
    padding: 18,
  },
  planCardActive: { borderColor: 'rgba(168,85,247,0.7)' },
  planHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  planLabel: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  planName: { color: '#D8B4FE', fontSize: 14, fontWeight: '800', marginTop: 8 },
  planSub: { color: 'rgba(255,255,255,0.58)', fontSize: 13, lineHeight: 20, marginTop: 6 },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#8B5CF6',
    borderRadius: 18,
    justifyContent: 'center',
    marginTop: 6,
    minHeight: 52,
    padding: 14,
  },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  refreshButton: { alignItems: 'center', paddingBottom: 8, paddingHorizontal: 18, paddingTop: 4 },
  refreshText: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '700' },
  restoreButton: { alignItems: 'center', padding: 18 },
  restoreText: { color: '#C084FC', fontSize: 14, fontWeight: '800' },
  root: { flex: 1 },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 52 },
  selectButton: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 14,
    padding: 12,
  },
  selectText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '800' },
  title: { color: '#FFFFFF', flex: 1, fontSize: 24, fontWeight: '900' },
});
