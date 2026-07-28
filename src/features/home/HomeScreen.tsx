import { LinearGradient } from 'expo-linear-gradient';
import { type PropsWithChildren, useEffect, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getCompanionMeta,
  type CompanionId,
  type CompanionMeta,
} from '@/features/onboarding/companionQuiz';
import { useRestoration } from '@/lib/restoration/restorationStore';
import { getSecureItem } from '@/lib/storage';

type HomeScreenProps = {
  onOpenChat?: () => void;
  onOpenJournal?: () => void;
  onOpenMeditation?: () => void;
  onOpenMemory?: () => void;
  onOpenPremium?: () => void;
  onOpenSettings?: () => void;
};

type HomeCompanion = CompanionMeta & {
  displayName: string;
};

type HomeAction = {
  accent: string;
  accessibilityLabel: string;
  description: string;
  id: 'journal' | 'meditate' | 'premium';
  label: string;
  onPress: (() => void) | undefined;
  symbol: string;
};

const DEFAULT_DISPLAY_NAME = 'there';

function HomeBackground({ children }: PropsWithChildren) {
  if (Platform.OS === 'web') {
    return <View style={[styles.root, styles.webViewport, styles.webGradient]}>{children}</View>;
  }

  return (
    <LinearGradient
      colors={['#2D0A6E', '#120428', '#05020D']}
      locations={[0, 0.42, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.root}
    >
      {children}
    </LinearGradient>
  );
}

export function HomeScreen({
  onOpenChat,
  onOpenJournal,
  onOpenMeditation,
  onOpenMemory,
  onOpenPremium,
}: HomeScreenProps) {
  const insets = useSafeAreaInsets();
  const restoration = useRestoration();
  const { width } = useWindowDimensions();
  const viewportWidth = getViewportWidth(width);
  const layout = getResponsiveLayout(viewportWidth);
  const [displayName, setDisplayName] = useState(DEFAULT_DISPLAY_NAME);
  const [companion, setCompanion] = useState<HomeCompanion>(() => {
    const meta = getCompanionMeta('luna');
    return { ...meta, displayName: meta.name };
  });

  useEffect(() => {
    let mounted = true;

    async function loadHomeData() {
      const [
        profileDisplayName,
        onboardingDisplayName,
        selectedCompanionId,
        companionId,
        companionNickname,
        companionPayload,
      ] = await Promise.all([
        getSecureItem('auth.displayName'),
        getSecureItem('onboarding.displayName'),
        getSecureItem('onboarding.selectedCompanionId'),
        getSecureItem('onboarding.companionId'),
        getSecureItem('onboarding.companionNickname'),
        getSecureItem('onboarding.companionPayload'),
      ]);

      if (!mounted) return;

      const restoredProfile = restoration.profile.data;
      const resolvedDisplayName = resolveDisplayName([
        typeof restoredProfile?.display_name === 'string' ? restoredProfile.display_name : null,
        profileDisplayName,
        onboardingDisplayName,
        readWebStorage('unfiltr_display_name'),
        readWebStorage('unfiltr_user_display_name'),
        readWebStorage('onboarding.displayName'),
      ]);
      const payload = parseCompanionPayload(
        companionPayload || readWebStorage('unfiltr_companion'),
      );
      const resolvedCompanionId = resolveCompanionId(
        (typeof restoredProfile?.avatar_id === 'string' ? restoredProfile.avatar_id : null) ||
          selectedCompanionId ||
          companionId ||
          payload?.id ||
          readWebStorage('unfiltr_companion_id'),
      );
      const meta = getCompanionMeta(resolvedCompanionId);
      const resolvedCompanionName =
        (typeof restoredProfile?.companion_name === 'string'
          ? restoredProfile.companion_name.trim()
          : '') ||
        companionNickname?.trim() ||
        payload?.displayName?.trim() ||
        readWebStorage('unfiltr_companion_nickname')?.trim() ||
        meta.name;

      setDisplayName(resolvedDisplayName);
      setCompanion({ ...meta, displayName: resolvedCompanionName });
    }

    void loadHomeData();

    return () => {
      mounted = false;
    };
  }, [restoration.profile.data]);

  const firstName = getFirstName(displayName);
  const heroTitle = `${firstName}, what do you want to do today?`;
  const heroSubtitle = `Chat with ${companion.displayName}, write privately, or take a moment to breathe.`;
  const contentWidth = Math.min(viewportWidth - layout.sidePadding * 2, layout.maxContentWidth);
  const actions: HomeAction[] = [
    {
      accent: '#FB7185',
      accessibilityLabel: 'Open journal',
      description: 'Private reflection',
      id: 'journal',
      label: 'Journal',
      onPress: onOpenJournal,
      symbol: '\u270E',
    },
    {
      accent: '#FBBF24',
      accessibilityLabel: 'Open meditation',
      description: 'Breathe and reset',
      id: 'meditate',
      label: 'Meditate',
      onPress: onOpenMeditation,
      symbol: '\u2726',
    },
    {
      accent: '#86EFAC',
      accessibilityLabel: 'Open premium',
      description: 'Plans and restore',
      id: 'premium',
      label: 'Premium',
      onPress: onOpenPremium,
      symbol: '+',
    },
  ];

  return (
    <HomeBackground>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          bounces={false}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingBottom: Math.max(insets.bottom + 30, 44),
              paddingHorizontal: layout.sidePadding,
              paddingTop: layout.topPadding,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.content, { maxWidth: layout.maxContentWidth, width: contentWidth }]}>
            <Pressable
              accessibilityLabel={`Chat with ${companion.displayName}`}
              accessibilityRole="button"
              onPress={onOpenChat}
              style={({ pressed }) => [styles.heroCard, pressed && styles.pressed]}
            >
              <LinearGradient
                colors={['rgba(124,58,237,0.5)', 'rgba(168,85,247,0.22)', 'rgba(219,39,119,0.14)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroGradient}
              />
              <View style={styles.heroText}>
                <Text style={styles.heroKicker}>Continue with {companion.displayName}</Text>
                <Text adjustsFontSizeToFit numberOfLines={5} style={styles.heroTitle}>
                  {heroTitle}
                </Text>
                <Text style={styles.heroSubtitle}>{heroSubtitle}</Text>
              </View>
              <Image
                accessibilityIgnoresInvertColors
                resizeMode="contain"
                source={{ uri: companion.avatar }}
                style={[styles.heroAvatar, { height: layout.heroAvatarHeight }]}
              />
            </Pressable>

            <Pressable
              accessibilityLabel={`Chat with ${companion.displayName}`}
              accessibilityRole="button"
              onPress={onOpenChat}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <LinearGradient
                colors={['#7C3AED', '#A855F7', '#DB2777']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryGradient}
              >
                <Text style={styles.primaryText}>Chat with {companion.displayName}</Text>
              </LinearGradient>
            </Pressable>

            <View style={[styles.actionGrid, layout.isTablet && styles.actionGridTablet]}>
              {actions.map((action) => (
                <HomeActionCard action={action} key={action.id} />
              ))}
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Memory</Text>
            </View>
            <Pressable
              accessibilityLabel="Open memory"
              accessibilityRole="button"
              onPress={onOpenMemory}
              style={({ pressed }) => [styles.infoCard, pressed && styles.pressed]}
            >
              <Text style={styles.infoTitle}>Memory Snapshot</Text>
              <Text style={styles.infoBody}>
                {companion.displayName} remembers the details you choose to share. Tap to view your
                connected memory.
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </HomeBackground>
  );
}

function HomeActionCard({ action }: { action: HomeAction }) {
  return (
    <Pressable
      accessibilityLabel={action.accessibilityLabel}
      accessibilityRole="button"
      onPress={action.onPress}
      style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]}
    >
      <Text style={[styles.actionSymbol, { color: action.accent }]}>{action.symbol}</Text>
      <View style={styles.actionTextWrap}>
        <Text style={styles.actionTitle}>{action.label}</Text>
        <Text style={styles.actionDescription}>{action.description}</Text>
      </View>
    </Pressable>
  );
}

function resolveDisplayName(values: (string | null | undefined)[]) {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return DEFAULT_DISPLAY_NAME;
}

function getFirstName(name: string) {
  return name.trim().split(/\s+/)[0] || DEFAULT_DISPLAY_NAME;
}

function getViewportWidth(width: number) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return Math.min(
      document.documentElement.clientWidth || window.innerWidth,
      window.innerWidth,
      393,
    );
  }
  return width;
}

function getResponsiveLayout(width: number) {
  const isTablet = width >= 720;
  return {
    heroAvatarHeight: isTablet ? 330 : 242,
    isTablet,
    maxContentWidth: isTablet ? 680 : 520,
    sidePadding: width < 360 ? 18 : width >= 720 ? 44 : 24,
    topPadding: width < 360 ? 20 : width >= 720 ? 42 : 26,
  };
}

function parseCompanionPayload(value: string | null): { displayName?: string; id?: string } | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as { displayName?: unknown; id?: unknown };
    const payload: { displayName?: string; id?: string } = {};
    if (typeof parsed.displayName === 'string') payload.displayName = parsed.displayName;
    if (typeof parsed.id === 'string') payload.id = parsed.id;
    return payload;
  } catch {
    return null;
  }
}

function readWebStorage(key: string): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return window.localStorage.getItem(key);
}

function resolveCompanionId(value: string | null | undefined): CompanionId {
  return isCompanionId(value) ? value : 'luna';
}

function isCompanionId(value: string | null | undefined): value is CompanionId {
  return (
    value === 'ash' ||
    value === 'echo' ||
    value === 'juan' ||
    value === 'kai' ||
    value === 'luna' ||
    value === 'nova' ||
    value === 'river' ||
    value === 'ryuu' ||
    value === 'sage' ||
    value === 'sakura' ||
    value === 'soleil' ||
    value === 'zara'
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05020D' },
  webViewport: { width: 393, maxWidth: 393, overflow: 'hidden' } as unknown as ViewStyle,
  webGradient: {
    backgroundImage:
      'radial-gradient(circle at 50% -8%, rgba(90,26,183,.72), transparent 42%), radial-gradient(circle at 80% 28%, rgba(219,39,119,.18), transparent 30%), linear-gradient(180deg,#2d0a6e 0%, #120428 42%, #05020d 100%)',
  } as unknown as ViewStyle,
  safeArea: { flex: 1 },
  scrollContent: { alignItems: 'center', flexGrow: 1 },
  content: { alignSelf: 'center' },
  heroCard: {
    minHeight: 282,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(216,180,254,0.22)',
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.04)',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.22,
    shadowRadius: 70,
  },
  heroGradient: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  heroText: { maxWidth: '56%', paddingBottom: 20, paddingLeft: 20, paddingTop: 38 },
  heroKicker: {
    color: '#D8B4FE',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.15,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  heroTitle: {
    marginTop: 9,
    color: '#FFFFFF',
    fontSize: 31,
    fontWeight: '900',
    lineHeight: 33,
  },
  heroSubtitle: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.58)',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
  },
  heroAvatar: {
    position: 'absolute',
    right: -18,
    bottom: -22,
    width: '54%',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.3,
    shadowRadius: 36,
  },
  primaryButton: {
    minHeight: 58,
    marginTop: 16,
    overflow: 'hidden',
    borderRadius: 20,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.3,
    shadowRadius: 48,
  },
  primaryGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 17,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 22,
    textAlign: 'center',
  },
  actionGrid: { flexDirection: 'row', gap: 12, marginTop: 14 },
  actionGridTablet: { gap: 16 },
  actionCard: {
    minHeight: 116,
    flex: 1,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.045)',
    padding: 16,
  },
  actionSymbol: { fontSize: 28, fontWeight: '900', lineHeight: 32 },
  actionTextWrap: { gap: 2 },
  actionTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', lineHeight: 25 },
  actionDescription: {
    color: 'rgba(255,255,255,0.44)',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  sectionHeader: { marginBottom: 10, marginTop: 22 },
  sectionLabel: {
    color: 'rgba(216,180,254,0.75)',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  infoCard: {
    borderWidth: 1,
    borderColor: 'rgba(216,180,254,0.14)',
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 16,
  },
  infoTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', lineHeight: 20 },
  infoBody: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
  },
  pressed: { opacity: 0.82 },
});
