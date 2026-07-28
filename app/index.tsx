import * as Notifications from 'expo-notifications';
import {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';

import { AccountRestoreErrorScreen } from '@/features/accountRecovery';
import { AdminDashboardScreen } from '@/features/admin';
import { ChatScreen, type ChatMessage } from '@/features/chat';
import { HomeScreen } from '@/features/home';
import { JournalScreen } from '@/features/journal';
import { MeditationScreen } from '@/features/meditation';
import { MemoryScreen } from '@/features/memory/MemoryScreen';
import { NotificationsScreen } from '@/features/notifications';
import { AgeGateScreen } from '@/features/onboarding/ageGate';
import { AppleSignInScreen } from '@/features/onboarding/appleSignIn';
import { CompanionNamingScreen } from '@/features/onboarding/companionNaming';
import {
  CompanionQuizScreen,
  QuizMatchRevealScreen,
  type CompanionId,
  type QuizMatchResult,
} from '@/features/onboarding/companionQuiz';
import { CompanionSelectionScreen } from '@/features/onboarding/companionSelection';
import { ConnectionStyleScreen } from '@/features/onboarding/connectionStyle';
import { FindMatchScreen } from '@/features/onboarding/findMatch';
import { GoogleSignInScreen } from '@/features/onboarding/googleSignIn';
import { NameScreen } from '@/features/onboarding/name';
import {
  PRIVACY_CONSENT_VERSION,
  PrivacyConsentScreen,
} from '@/features/onboarding/privacyConsent';
import { SplashScreen } from '@/features/onboarding/splash';
import { PremiumScreen } from '@/features/premium';
import { SettingsScreen } from '@/features/settings';
import {
  classifyProfileDiagnostic,
  runProfileDiagnostic,
  unavailableProfileDiagnostic,
  type ProfileDiagnosticResult,
} from '@/lib/accountDiagnostic';
import { clearAuthenticatedSession, clearRememberedAccountIdentity } from '@/lib/auth/session';
import { restoreStartupAuthSession, type StartupAuthStatus } from '@/lib/auth/startup';
import { useAndroidBackHandler } from '@/lib/navigation/useAndroidBackHandler';
import { signOutRevenueCat } from '@/lib/purchases/revenueCat';
import { hydrateLocalProfileFromRestoration } from '@/lib/restoration/hydrateLocalProfile';
import {
  clearRestorationForSignOut,
  refreshRestoration,
  useRestoration,
} from '@/lib/restoration/restorationStore';
import { deleteSecureItem, getSecureItem } from '@/lib/storage';
import { deleteAppStorageItem } from '@/lib/storage/appStorage';
import { signOutGoogleAndroid } from '@/platform/android/googleAuth';

/**
 * Once auth completes, the account is resolved against the backend exactly
 * once before any menu is reachable:
 *  - 'new'       genuinely new account -> run the create-a-companion onboarding
 *  - 'returning' backend found exactly one profile -> restore it, go straight to Main Menu
 *  - 'blocked'   diagnostic was ambiguous/unavailable, or restoration ultimately
 *                failed with no usable cache -> show AccountRestoreErrorScreen
 */
type AccountResolution = 'blocked' | 'new' | 'pending' | 'returning';

type OnboardingStatus = {
  ageGateComplete: boolean;
  authComplete: boolean;
  companionNamingComplete: boolean;
  companionSelectionComplete: boolean;
  connectionStyleComplete: boolean;
  findMatchComplete: boolean;
  matchMode: 'manual' | 'quiz' | null;
  nameComplete: boolean;
  privacyConsentComplete: boolean;
  quizResult: QuizMatchResult | null;
  selectedCompanionId: CompanionId | null;
};

type AppScreen =
  | 'admin'
  | 'chat'
  | 'home'
  | 'journal'
  | 'meditation'
  | 'memory'
  | 'notifications'
  | 'premium'
  | 'settings';

// Neither the account lookup nor the wait for restoration to finish may hang
// indefinitely -- both must resolve to an explicit retry/error state.
const ACCOUNT_LOOKUP_TIMEOUT_MS = 20000;
const RESTORATION_WAIT_TIMEOUT_MS = 20000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Request timed out.')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

const initialOnboardingStatus: OnboardingStatus = {
  ageGateComplete: false,
  authComplete: false,
  companionNamingComplete: false,
  companionSelectionComplete: false,
  connectionStyleComplete: false,
  findMatchComplete: false,
  matchMode: null,
  nameComplete: false,
  privacyConsentComplete: false,
  quizResult: null,
  selectedCompanionId: null,
};

function getSearchParam(name: string): string | null {
  if (!__DEV__ || Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(name);
}

function shouldCapturePrivacyConsent(): boolean {
  return getSearchParam('captureScreen') === 'privacyConsent';
}

function shouldCaptureAppleSignIn(): boolean {
  return getSearchParam('captureScreen') === 'appleSignIn';
}

function shouldCaptureName(): boolean {
  return getSearchParam('captureScreen') === 'name';
}

function shouldCaptureFindMatch(): boolean {
  return getSearchParam('captureScreen') === 'findMatch';
}

function shouldCaptureQuiz(): boolean {
  return getSearchParam('captureScreen') === 'companionQuiz';
}

function shouldCaptureQuizResult(): boolean {
  return getSearchParam('captureScreen') === 'quizResult';
}

function shouldCaptureCompanionSelection(): boolean {
  return getSearchParam('captureScreen') === 'companionSelection';
}

function shouldCaptureCompanionNaming(): boolean {
  return getSearchParam('captureScreen') === 'companionNaming';
}

function shouldCaptureConnectionStyle(): boolean {
  return getSearchParam('captureScreen') === 'connectionStyle';
}

function shouldCaptureHome(): boolean {
  return getSearchParam('captureScreen') === 'home';
}

function shouldCaptureChat(): boolean {
  return getSearchParam('captureScreen') === 'chat';
}

function shouldCaptureJournal(): boolean {
  return getSearchParam('captureScreen') === 'journal';
}

function shouldCaptureMeditation(): boolean {
  return getSearchParam('captureScreen') === 'meditation';
}

function shouldCaptureNotifications(): boolean {
  return getSearchParam('captureScreen') === 'notifications';
}

function shouldCapturePremium(): boolean {
  return getSearchParam('captureScreen') === 'premium';
}

function shouldCaptureSettings(): boolean {
  return getSearchParam('captureScreen') === 'settings';
}

function shouldCaptureSplash(): boolean {
  return getSearchParam('captureScreen') === 'splash';
}

function shouldShowCenterGuide(): boolean {
  return getSearchParam('centerGuide') === '1';
}

function resetWebViewport() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  document.documentElement.style.margin = '0';
  document.documentElement.style.padding = '0';
  document.documentElement.style.width = '100%';
  document.documentElement.style.height = '100%';
  document.body.style.margin = '0';
  document.body.style.padding = '0';
  document.body.style.width = '100%';
  document.body.style.height = '100%';
  document.body.style.overflow = 'hidden';
}

function ScreenFrame({
  children,
  showCenterGuide,
}: {
  children: ReactNode;
  showCenterGuide: boolean;
}) {
  return (
    <View style={styles.screenFrame}>
      {children}
      {showCenterGuide ? <View pointerEvents="none" style={styles.centerGuide} /> : null}
    </View>
  );
}

function AccountResolvingView() {
  return (
    <View style={styles.resolvingRoot}>
      <ActivityIndicator color="#C084FC" size="large" />
      <Text style={styles.resolvingText}>Restoring your account...</Text>
    </View>
  );
}

function captureStatus(screen: string): {
  onboarding: OnboardingStatus;
  resolution: AccountResolution | null;
} {
  const baseComplete: OnboardingStatus = {
    ageGateComplete: true,
    authComplete: true,
    companionNamingComplete: false,
    companionSelectionComplete: false,
    connectionStyleComplete: false,
    findMatchComplete: false,
    matchMode: null,
    nameComplete: false,
    privacyConsentComplete: true,
    quizResult: null,
    selectedCompanionId: null,
  };

  if (screen === 'privacyConsent') {
    return {
      onboarding: { ...baseComplete, authComplete: false, privacyConsentComplete: false },
      resolution: null,
    };
  }

  if (screen === 'appleSignIn') {
    return {
      onboarding: { ...baseComplete, authComplete: false },
      resolution: null,
    };
  }

  if (screen === 'name') {
    return { onboarding: baseComplete, resolution: 'new' };
  }

  if (screen === 'findMatch') {
    return { onboarding: { ...baseComplete, nameComplete: true }, resolution: 'new' };
  }

  if (screen === 'companionQuiz') {
    return {
      onboarding: { ...baseComplete, findMatchComplete: true, matchMode: 'quiz', nameComplete: true },
      resolution: 'new',
    };
  }

  if (screen === 'quizResult') {
    return {
      onboarding: {
        ...baseComplete,
        findMatchComplete: true,
        matchMode: 'quiz',
        nameComplete: true,
        quizResult: {
          matchId: 'luna',
          maxPts: 10,
          top3: [
            { companionId: 'luna', pts: 10 },
            { companionId: 'river', pts: 8 },
            { companionId: 'echo', pts: 5 },
          ],
        },
      },
      resolution: 'new',
    };
  }

  if (screen === 'companionSelection') {
    return {
      onboarding: {
        ...baseComplete,
        findMatchComplete: true,
        matchMode: 'manual',
        nameComplete: true,
      },
      resolution: 'new',
    };
  }

  if (
    screen === 'home' ||
    screen === 'journal' ||
    screen === 'meditation' ||
    screen === 'notifications' ||
    screen === 'premium' ||
    screen === 'settings' ||
    screen === 'chat'
  ) {
    return {
      onboarding: {
        ...baseComplete,
        companionNamingComplete: true,
        companionSelectionComplete: true,
        connectionStyleComplete: true,
        findMatchComplete: true,
        nameComplete: true,
        selectedCompanionId: 'luna',
      },
      resolution: 'returning',
    };
  }

  if (screen === 'connectionStyle') {
    return {
      onboarding: {
        ...baseComplete,
        companionNamingComplete: true,
        companionSelectionComplete: true,
        findMatchComplete: true,
        nameComplete: true,
        selectedCompanionId: 'luna',
      },
      resolution: 'new',
    };
  }

  if (screen === 'companionNaming') {
    return {
      onboarding: {
        ...baseComplete,
        companionSelectionComplete: true,
        findMatchComplete: true,
        nameComplete: true,
        selectedCompanionId: 'luna',
      },
      resolution: 'new',
    };
  }

  return { onboarding: initialOnboardingStatus, resolution: null };
}

export default function FoundationScreen() {
  resetWebViewport();

  const captureHome = shouldCaptureHome();
  const captureSplash = shouldCaptureSplash();
  const captureAppleSignIn = shouldCaptureAppleSignIn();
  const captureFindMatch = shouldCaptureFindMatch();
  const captureName = shouldCaptureName();
  const capturePrivacyConsent = shouldCapturePrivacyConsent();
  const captureQuiz = shouldCaptureQuiz();
  const captureQuizResult = shouldCaptureQuizResult();
  const captureCompanionSelection = shouldCaptureCompanionSelection();
  const captureCompanionNaming = shouldCaptureCompanionNaming();
  const captureConnectionStyle = shouldCaptureConnectionStyle();
  const showCenterGuide = shouldShowCenterGuide();
  const captureChat = shouldCaptureChat();
  const captureJournal = shouldCaptureJournal();
  const captureMeditation = shouldCaptureMeditation();
  const captureNotifications = shouldCaptureNotifications();
  const capturePremium = shouldCapturePremium();
  const captureSettings = shouldCaptureSettings();
  const activeCaptureScreen = getSearchParam('captureScreen') ?? (captureSplash ? 'splash' : null);
  const bypassSplash =
    !!activeCaptureScreen &&
    activeCaptureScreen !== 'splash' &&
    (capturePrivacyConsent ||
      captureAppleSignIn ||
      captureName ||
      captureFindMatch ||
      captureQuiz ||
      captureQuizResult ||
      captureCompanionSelection ||
      captureCompanionNaming ||
      captureConnectionStyle ||
      captureHome ||
      captureChat ||
      captureJournal ||
      captureMeditation ||
      captureNotifications ||
      capturePremium ||
      captureSettings);
  const [splashComplete, setSplashComplete] = useState(bypassSplash);
  const [activeScreen, setActiveScreen] = useState<AppScreen>(() => {
    if (captureChat) return 'chat';
    if (captureJournal) return 'journal';
    if (captureMeditation) return 'meditation';
    if (captureNotifications) return 'notifications';
    if (capturePremium) return 'premium';
    if (captureSettings) return 'settings';
    return 'home';
  });
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [startupAuthStatus, setStartupAuthStatus] = useState<StartupAuthStatus>('unauthenticated');
  const [isRestoreRetrying, setIsRestoreRetrying] = useState(false);
  const [settingsReturnTo, setSettingsReturnTo] = useState<AppScreen>('home');
  const [premiumReturnTo, setPremiumReturnTo] = useState<AppScreen>('home');
  const initialCapture = activeCaptureScreen ? captureStatus(activeCaptureScreen) : null;
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus>(
    () => initialCapture?.onboarding ?? initialOnboardingStatus,
  );
  const [accountResolution, setAccountResolution] = useState<AccountResolution | null>(
    () => initialCapture?.resolution ?? null,
  );
  const [statusLoaded, setStatusLoaded] = useState(bypassSplash);
  const handledResponseId = useRef<string | null>(null);
  const hydratedAccountIdRef = useRef<string | null>(null);
  const restoration = useRestoration();

  // Chat, Journal, and Meditation own their in-screen back stacks (options
  // sheet / world picker / active session) and register their own Android
  // hardware-back handler, so this only covers the screens that have no
  // nested state of their own. 'home' falls through to the OS default
  // (minimize the app), matching standard Android back behavior.
  function handleTopLevelAndroidBack() {
    if (activeScreen === 'settings') {
      setActiveScreen(captureSettings ? 'home' : settingsReturnTo);
      return true;
    }
    if (activeScreen === 'premium') {
      setActiveScreen(premiumReturnTo);
      return true;
    }
    if (activeScreen === 'memory') {
      setActiveScreen('home');
      return true;
    }
    if (activeScreen === 'notifications') {
      setActiveScreen('settings');
      return true;
    }
    if (activeScreen === 'admin') {
      setActiveScreen('settings');
      return true;
    }
    return false;
  }
  useAndroidBackHandler(handleTopLevelAndroidBack);

  // Load local age-gate/consent flags and attempt to silently recover an
  // existing backend session. This does not decide new-vs-returning by
  // itself -- it only determines whether auth is already complete.
  useEffect(() => {
    let mounted = true;

    if (bypassSplash) return undefined;

    async function loadLocalStatus() {
      const [ageVerified, consentAccepted, consentVersion] = await Promise.all([
        getSecureItem('onboarding.ageVerified'),
        getSecureItem('onboarding.privacyConsentAccepted'),
        getSecureItem('onboarding.privacyConsentVersion'),
      ]);
      const startupAuth = await restoreStartupAuthSession();
      if (!mounted) return;

      setStartupAuthStatus(startupAuth.status);
      setOnboardingStatus((current) => ({
        ...current,
        ageGateComplete: ageVerified === 'true',
        authComplete: startupAuth.status === 'authenticated',
        privacyConsentComplete:
          consentAccepted === 'true' && consentVersion === PRIVACY_CONSENT_VERSION,
      }));
      setStatusLoaded(true);
    }

    void loadLocalStatus();

    return () => {
      mounted = false;
    };
  }, [bypassSplash]);

  // The single backend account lookup: runs exactly once per completed auth,
  // and decides new vs. returning vs. blocked. Never falls through to a menu
  // on its own -- callers gate on `accountResolution`.
  useEffect(() => {
    if (!statusLoaded) return undefined;
    if (!onboardingStatus.authComplete) return undefined;
    if (accountResolution !== null) return undefined;

    let cancelled = false;

    async function resolveAccount() {
      setAccountResolution('pending');

      let diagnostic: ProfileDiagnosticResult;
      try {
        diagnostic = await withTimeout(runProfileDiagnostic(), ACCOUNT_LOOKUP_TIMEOUT_MS);
      } catch {
        diagnostic = unavailableProfileDiagnostic();
      }
      if (cancelled) return;

      const decision = classifyProfileDiagnostic(diagnostic);
      if (decision === 'allow') {
        setAccountResolution('returning');
        void refreshRestoration();
      } else if (decision === 'not_found') {
        setAccountResolution('new');
      } else {
        setAccountResolution('blocked');
      }
      setIsRestoreRetrying(false);
    }

    void resolveAccount();

    return () => {
      cancelled = true;
    };
  }, [accountResolution, onboardingStatus.authComplete, statusLoaded]);

  // Once restoration finishes for a returning account, hydrate the legacy
  // per-screen storage keys and detect a total restoration failure (no
  // remote data and no usable cache) rather than silently falling through
  // to Main Menu with a blank profile.
  useEffect(() => {
    if (accountResolution !== 'returning') return;
    if (restoration.status !== 'ready') return;

    async function settleReturningRestoration() {
      if (!restoration.profile.data && restoration.profile.source === 'unavailable') {
        setAccountResolution('blocked');
        return;
      }

      if (hydratedAccountIdRef.current === restoration.accountId) return;
      hydratedAccountIdRef.current = restoration.accountId;
      await hydrateLocalProfileFromRestoration(restoration.profile.data);
    }

    void settleReturningRestoration();
  }, [
    accountResolution,
    restoration.accountId,
    restoration.profile.data,
    restoration.profile.source,
    restoration.status,
  ]);

  // A returning account whose restoration never reaches 'ready' (a hung
  // request rather than an explicit error) must not leave the resolving
  // spinner on screen forever with no escape hatch.
  useEffect(() => {
    if (accountResolution !== 'returning') return undefined;
    if (restoration.status === 'ready') return undefined;

    const timer = setTimeout(() => {
      setAccountResolution((current) => (current === 'returning' ? 'blocked' : current));
    }, RESTORATION_WAIT_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [accountResolution, restoration.status]);

  function retryAccountRestore() {
    if (isRestoreRetrying) return;
    hydratedAccountIdRef.current = null;
    setIsRestoreRetrying(true);
    setAccountResolution(null);
  }

  function signOutFromAccountRestore() {
    setIsRestoreRetrying(false);
    hydratedAccountIdRef.current = null;
    void handleSignOut({
      setAccountResolution,
      setActiveScreen,
      setChatMessages,
      setOnboardingStatus,
      setPremiumReturnTo,
      setSettingsReturnTo,
      setStartupAuthStatus,
    });
  }

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;

    function handleResponse(response: Notifications.NotificationResponse) {
      const identifier = response.notification.request.identifier;
      if (handledResponseId.current === identifier) return;

      const destination = response.notification.request.content.data?.destination;
      const nextScreen = responseDestinationToScreen(destination);
      if (!nextScreen) return;

      handledResponseId.current = identifier;
      setActiveScreen(nextScreen);
    }

    void Notifications.getLastNotificationResponseAsync().then(async (response) => {
      if (!response) return;
      handleResponse(response);
      await Notifications.clearLastNotificationResponseAsync();
    });

    const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
    return () => subscription.remove();
  }, []);

  if (!splashComplete || !statusLoaded) {
    return (
      <ScreenFrame showCenterGuide={showCenterGuide}>
        <SplashScreen
          holdForCapture={captureSplash}
          onComplete={() => (captureSplash ? undefined : setSplashComplete(true))}
        />
      </ScreenFrame>
    );
  }

  if (!onboardingStatus.ageGateComplete) {
    return (
      <ScreenFrame showCenterGuide={showCenterGuide}>
        <AgeGateScreen
          onVerified={() =>
            setOnboardingStatus((current) => ({ ...current, ageGateComplete: true }))
          }
        />
      </ScreenFrame>
    );
  }

  if (!onboardingStatus.privacyConsentComplete) {
    return (
      <ScreenFrame showCenterGuide={showCenterGuide}>
        <PrivacyConsentScreen
          onAccepted={() =>
            setOnboardingStatus((current) => ({ ...current, privacyConsentComplete: true }))
          }
        />
      </ScreenFrame>
    );
  }

  if (!onboardingStatus.authComplete) {
    const signInInitialError =
      startupAuthStatus === 'offline'
        ? 'Could not restore your session because the access server is unavailable. Check your connection and sign in again.'
        : null;
    const handleAuthenticated = () => {
      setStartupAuthStatus('authenticated');
      setOnboardingStatus((current) => ({ ...current, authComplete: true }));
    };

    return (
      <ScreenFrame showCenterGuide={showCenterGuide}>
        {Platform.OS === 'android' ? (
          <GoogleSignInScreen
            initialError={signInInitialError}
            onAuthenticated={handleAuthenticated}
          />
        ) : (
          <AppleSignInScreen
            initialError={signInInitialError}
            onAuthenticated={handleAuthenticated}
          />
        )}
      </ScreenFrame>
    );
  }

  // Backend account lookup and restoration resolution -- never show Main
  // Menu or onboarding creation screens until this has completed or failed
  // explicitly.
  if (accountResolution === 'blocked' || isRestoreRetrying) {
    return (
      <ScreenFrame showCenterGuide={showCenterGuide}>
        <AccountRestoreErrorScreen
          busy={isRestoreRetrying}
          onRetry={retryAccountRestore}
          onSignOut={signOutFromAccountRestore}
        />
      </ScreenFrame>
    );
  }

  if (accountResolution === null || accountResolution === 'pending') {
    return (
      <ScreenFrame showCenterGuide={showCenterGuide}>
        <AccountResolvingView />
      </ScreenFrame>
    );
  }

  if (
    accountResolution === 'returning' &&
    (restoration.status !== 'ready' ||
      (!restoration.profile.data && restoration.profile.source === 'unavailable'))
  ) {
    return (
      <ScreenFrame showCenterGuide={showCenterGuide}>
        <AccountResolvingView />
      </ScreenFrame>
    );
  }

  if (accountResolution === 'new') {
    if (!onboardingStatus.nameComplete) {
      return (
        <ScreenFrame showCenterGuide={showCenterGuide}>
          <NameScreen
            onBack={() => setOnboardingStatus((current) => ({ ...current, authComplete: false }))}
            onComplete={() =>
              setOnboardingStatus((current) => ({ ...current, nameComplete: true }))
            }
          />
        </ScreenFrame>
      );
    }

    if (!onboardingStatus.findMatchComplete) {
      return (
        <ScreenFrame showCenterGuide={showCenterGuide}>
          <FindMatchScreen
            onBack={() => setOnboardingStatus((current) => ({ ...current, nameComplete: false }))}
            onBrowseCompanions={() =>
              setOnboardingStatus((current) => ({
                ...current,
                findMatchComplete: true,
                matchMode: 'manual',
              }))
            }
            onFindMyMatch={() =>
              setOnboardingStatus((current) => ({
                ...current,
                findMatchComplete: true,
                matchMode: 'quiz',
              }))
            }
          />
        </ScreenFrame>
      );
    }

    if (onboardingStatus.matchMode === 'quiz' && !onboardingStatus.quizResult) {
      return (
        <ScreenFrame showCenterGuide={showCenterGuide}>
          <CompanionQuizScreen
            onBack={() =>
              setOnboardingStatus((current) => ({
                ...current,
                findMatchComplete: false,
                matchMode: null,
              }))
            }
            onComplete={(quizResult) =>
              setOnboardingStatus((current) => ({
                ...current,
                quizResult,
              }))
            }
          />
        </ScreenFrame>
      );
    }

    if (onboardingStatus.matchMode === 'quiz' && onboardingStatus.quizResult) {
      return (
        <ScreenFrame showCenterGuide={showCenterGuide}>
          <QuizMatchRevealScreen
            onBack={() =>
              setOnboardingStatus((current) => ({
                ...current,
                quizResult: null,
              }))
            }
            onMeetCompanion={() =>
              setOnboardingStatus((current) => ({
                ...current,
                companionSelectionComplete: true,
                matchMode: null,
                selectedCompanionId: onboardingStatus.quizResult?.matchId ?? null,
              }))
            }
            onViewAllCompanions={() =>
              setOnboardingStatus((current) => ({
                ...current,
                companionSelectionComplete: false,
                matchMode: 'manual',
                quizResult: null,
                selectedCompanionId: null,
              }))
            }
            result={onboardingStatus.quizResult}
          />
        </ScreenFrame>
      );
    }

    if (onboardingStatus.matchMode === 'manual' && !onboardingStatus.companionSelectionComplete) {
      return (
        <ScreenFrame showCenterGuide={showCenterGuide}>
          <CompanionSelectionScreen
            onBack={() =>
              setOnboardingStatus((current) => ({
                ...current,
                findMatchComplete: false,
                matchMode: null,
              }))
            }
            onCompanionSelected={(companionId) =>
              setOnboardingStatus((current) => ({
                ...current,
                companionSelectionComplete: true,
                matchMode: null,
                selectedCompanionId: companionId,
              }))
            }
          />
        </ScreenFrame>
      );
    }

    if (onboardingStatus.companionSelectionComplete && !onboardingStatus.companionNamingComplete) {
      return (
        <ScreenFrame showCenterGuide={showCenterGuide}>
          <CompanionNamingScreen
            companionId={onboardingStatus.selectedCompanionId ?? 'luna'}
            onBack={() =>
              setOnboardingStatus((current) => ({
                ...current,
                companionSelectionComplete: false,
                matchMode: current.quizResult ? 'quiz' : 'manual',
              }))
            }
            onComplete={() =>
              setOnboardingStatus((current) => ({
                ...current,
                companionNamingComplete: true,
              }))
            }
          />
        </ScreenFrame>
      );
    }

    if (onboardingStatus.companionNamingComplete && !onboardingStatus.connectionStyleComplete) {
      return (
        <ScreenFrame showCenterGuide={showCenterGuide}>
          <ConnectionStyleScreen
            onBack={() =>
              setOnboardingStatus((current) => ({
                ...current,
                companionNamingComplete: false,
              }))
            }
            onComplete={() =>
              setOnboardingStatus((current) => ({
                ...current,
                connectionStyleComplete: true,
              }))
            }
          />
        </ScreenFrame>
      );
    }
  }

  if (activeScreen === 'chat') {
    return (
      <ScreenFrame showCenterGuide={showCenterGuide}>
        <ChatScreen
          initialMessages={chatMessages}
          onBack={() => setActiveScreen('home')}
          onMessagesChange={setChatMessages}
          onOpenSettings={() => {
            setSettingsReturnTo('chat');
            setActiveScreen('settings');
          }}
        />
      </ScreenFrame>
    );
  }

  if (activeScreen === 'journal') {
    return (
      <ScreenFrame showCenterGuide={showCenterGuide}>
        <JournalScreen
          onBack={() => setActiveScreen('home')}
          onOpenChat={() => setActiveScreen('chat')}
          onOpenHome={() => setActiveScreen('home')}
          onOpenMeditation={() => setActiveScreen('meditation')}
        />
      </ScreenFrame>
    );
  }

  if (activeScreen === 'meditation') {
    return (
      <ScreenFrame showCenterGuide={showCenterGuide}>
        <MeditationScreen
          onBack={() => setActiveScreen('home')}
          onOpenChat={() => setActiveScreen('chat')}
          onOpenHome={() => setActiveScreen('home')}
          onOpenJournal={() => setActiveScreen('journal')}
        />
      </ScreenFrame>
    );
  }

  if (activeScreen === 'memory') {
    return (
      <ScreenFrame showCenterGuide={showCenterGuide}>
        <MemoryScreen onBack={() => setActiveScreen('home')} />
      </ScreenFrame>
    );
  }

  if (activeScreen === 'notifications') {
    return (
      <ScreenFrame showCenterGuide={showCenterGuide}>
        <NotificationsScreen onBack={() => setActiveScreen('settings')} />
      </ScreenFrame>
    );
  }

  if (activeScreen === 'premium') {
    return (
      <ScreenFrame showCenterGuide={showCenterGuide}>
        <PremiumScreen
          onBack={() => setActiveScreen(premiumReturnTo)}
          returnTo={premiumReturnTo === 'home' ? 'home' : 'settings'}
        />
      </ScreenFrame>
    );
  }

  if (activeScreen === 'admin') {
    return (
      <ScreenFrame showCenterGuide={showCenterGuide}>
        <AdminDashboardScreen
          onBack={() => setActiveScreen('settings')}
          onLock={() => setActiveScreen('settings')}
        />
      </ScreenFrame>
    );
  }

  if (activeScreen === 'settings') {
    return (
      <ScreenFrame showCenterGuide={showCenterGuide}>
        <SettingsScreen
          onBack={() => setActiveScreen(captureSettings ? 'home' : settingsReturnTo)}
          onSignOut={() => {
            hydratedAccountIdRef.current = null;
            void handleSignOut({
              setAccountResolution,
              setActiveScreen,
              setChatMessages,
              setOnboardingStatus,
              setPremiumReturnTo,
              setSettingsReturnTo,
              setStartupAuthStatus,
            });
          }}
          onOpenNotifications={() => setActiveScreen('notifications')}
          onOpenPremium={() => {
            setPremiumReturnTo('settings');
            setActiveScreen('premium');
          }}
        />
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame showCenterGuide={showCenterGuide}>
      <HomeScreen
        onOpenChat={() => setActiveScreen('chat')}
        onOpenJournal={() => setActiveScreen('journal')}
        onOpenMeditation={() => setActiveScreen('meditation')}
        onOpenMemory={() => setActiveScreen('memory')}
        onOpenPremium={() => {
          setPremiumReturnTo('home');
          setActiveScreen('premium');
        }}
        onOpenSettings={() => {
          setSettingsReturnTo('home');
          setActiveScreen('settings');
        }}
      />
    </ScreenFrame>
  );
}

/**
 * Account-safe sign-out. This replaces two prior bugs:
 *  - the build-67 behavior, which reset onboarding but left ageGate/consent
 *    keys such that the next screen shown depended on ordering accidents;
 *  - the (unmerged) branch's stale-data-preserving behavior, which kept the
 *    outgoing account's companion/name/relationship data in local storage
 *    and hardcoded onboarding completion flags to true for whoever signed
 *    in next.
 *
 * Every field a restored profile can hydrate (see hydrateLocalProfile.ts)
 * is cleared here, so a different Apple account signing in afterward can
 * never see the outgoing account's data, and the same account signing back
 * in is re-verified against the backend from scratch (see the account
 * resolution effects above) rather than trusted from stale local state.
 */
async function handleSignOut({
  setAccountResolution,
  setActiveScreen,
  setChatMessages,
  setOnboardingStatus,
  setPremiumReturnTo,
  setSettingsReturnTo,
  setStartupAuthStatus,
}: {
  setAccountResolution: Dispatch<SetStateAction<AccountResolution | null>>;
  setActiveScreen: (screen: AppScreen) => void;
  setChatMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setOnboardingStatus: Dispatch<SetStateAction<OnboardingStatus>>;
  setPremiumReturnTo: (screen: AppScreen) => void;
  setSettingsReturnTo: (screen: AppScreen) => void;
  setStartupAuthStatus: Dispatch<SetStateAction<StartupAuthStatus>>;
}) {
  // clearRestorationForSignOut() clears the *outgoing* account's namespaced
  // cache by first reading auth.appleUserId/userId/profileId to find out
  // which account that is -- it must run before clearRememberedAccountIdentity
  // erases those same keys, or the account-scoped cache clear silently
  // no-ops and the next account to sign in on this device could read the
  // outgoing account's cached chat/journal/memory/profile.
  //
  // 1. Revoke/clear the authenticated session and tokens.
  if (Platform.OS === 'android') {
    await signOutGoogleAndroid().catch(() => undefined);
  }
  await signOutRevenueCat();
  await clearRestorationForSignOut();
  await clearAuthenticatedSession();
  await clearRememberedAccountIdentity();

  // 2. Clear all remaining account-specific local and secure cached data.
  await clearAllAccountSpecificData();

  // 3. Reset active navigation state.
  setActiveScreen('home');
  setSettingsReturnTo('home');
  setPremiumReturnTo('home');
  setChatMessages([]);

  // 4-7. Return to Age Gate, then Policy Consent, then platform Sign-In --
  // initialOnboardingStatus has ageGateComplete/privacyConsentComplete/
  // authComplete all false, and accountResolution(null) means the next
  // completed auth is checked against the backend from scratch before any
  // onboarding screen is skipped.
  setStartupAuthStatus('unauthenticated');
  setAccountResolution(null);
  setOnboardingStatus(initialOnboardingStatus);
}

async function clearAllAccountSpecificData(): Promise<void> {
  await Promise.all([
    // Age gate / consent -- clearing these is what sends the next session
    // back through Age Gate and Policy Consent before sign-in.
    deleteSecureItem('onboarding.ageVerified'),
    deleteSecureItem('onboarding.privacyConsentAccepted'),
    deleteSecureItem('onboarding.privacyConsentVersion'),

    // Display name.
    deleteSecureItem('onboarding.displayName'),
    deleteAppStorageItem('unfiltr_display_name'),

    // Selected companion / companion nickname.
    deleteSecureItem('onboarding.matchMode'),
    deleteSecureItem('onboarding.selectedCompanionId'),
    deleteSecureItem('onboarding.companionNickname'),
    deleteSecureItem('onboarding.quizCompanionId'),
    deleteSecureItem('onboarding.companionId'),
    deleteSecureItem('onboarding.companionPayload'),
    deleteAppStorageItem('unfiltr_companion_id'),
    deleteAppStorageItem('unfiltr_companion_nickname'),
    deleteAppStorageItem('unfiltr_companion'),

    // Relationship mode / personality / tone.
    deleteSecureItem('onboarding.relationshipMode'),
    deleteSecureItem('onboarding.personalityVibe'),
    deleteSecureItem('onboarding.personalityStyle'),
    deleteSecureItem('onboarding.personalityHumor'),
    deleteSecureItem('onboarding.personalityEmpathy'),
    deleteAppStorageItem('unfiltr_relationship_mode'),
    deleteAppStorageItem('unfiltr_voice_personality'),
    deleteAppStorageItem('unfiltr_appearance_preferences'),

    // Chat-specific local state (private session flag and chat background
    // selection; cached chat history itself is cleared by
    // clearRestorationForSignOut's account-scoped cache).
    deleteAppStorageItem('unfiltr_private_session'),
    deleteAppStorageItem('unfiltr_chat_messages'),
    deleteAppStorageItem('unfiltr_background_id'),

    // Premium identity/cache. RevenueCat's own identity is cleared by
    // signOutRevenueCat(); these are the derived entitlement/usage caches
    // that resolvePremiumAccess() writes and that must not leak the
    // outgoing account's tier to whoever signs in next.
    deleteSecureItem('unfiltr_is_premium'),
    deleteAppStorageItem('unfiltr_is_premium'),
    deleteSecureItem('unfiltr_effective_tier'),
    deleteAppStorageItem('unfiltr_effective_tier'),
    deleteSecureItem('unfiltr_family_unlock'),
    deleteAppStorageItem('unfiltr_family_unlock'),
    deleteSecureItem('unfiltr_family_unlimited'),
    deleteAppStorageItem('unfiltr_family_unlimited'),
    deleteSecureItem('unfiltr_unlimited'),
    deleteAppStorageItem('unfiltr_unlimited'),
    deleteSecureItem('unfiltr_msg_usage'),
  ]);
}

function responseDestinationToScreen(value: unknown): AppScreen | null {
  if (value === 'chat' || value === 'unfiltr_notifications_companion') return 'chat';
  if (value === 'journal' || value === 'unfiltr_notifications_journal') return 'journal';
  if (
    value === 'home' ||
    value === 'unfiltr_notifications_daily_checkin' ||
    value === 'account' ||
    value === 'system'
  ) {
    return 'home';
  }
  return null;
}

const styles = StyleSheet.create({
  screenFrame: {
    flex: 1,
  },
  centerGuide: {
    position: (Platform.OS === 'web' ? 'fixed' : 'absolute') as 'absolute',
    top: 0,
    bottom: 0,
    left: (Platform.OS === 'web' ? '50vw' : '50%') as '50%',
    width: 1,
    transform: [{ translateX: -0.5 }],
    backgroundColor: '#FF0000',
    zIndex: 9999,
  },
  resolvingRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#05020D',
    gap: 16,
  },
  resolvingText: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 14,
    fontWeight: '600',
  },
});
