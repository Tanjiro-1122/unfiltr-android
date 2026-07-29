import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appIndex = await read('app/index.tsx');
const chatScreen = await read('src/features/chat/ChatScreen.tsx');
const settingsScreen = await read('src/features/settings/SettingsScreen.tsx');
const repairedSettingsScreen = await read('src/features/settings/RepairedSettingsScreen.tsx');
const premiumScreen = await read('src/features/premium/PremiumScreen.tsx');
const adminScreen = await read('src/features/admin/AdminDashboardScreen.tsx');
const diagnosticsScreen = await read('src/features/diagnostics/InternalDiagnosticsScreen.tsx');
const revenueCat = await read('src/lib/purchases/revenueCat.ts');
const access = await read('src/lib/purchases/access.ts');
const accountCache = await read('src/lib/restoration/accountCache.ts');
const apiClient = await read('src/lib/api/client.ts');
const worldCatalog = await read('src/lib/worlds/catalog.ts');
const hydrateLocalProfile = await read('src/lib/restoration/hydrateLocalProfile.ts');
const journalScreen = await read('src/features/journal/JournalScreen.tsx');
const optionsHubScreen = await read('src/features/settings/OptionsHubScreen.tsx');
const memoryScreen = await read('src/features/memory/MemoryScreen.tsx');
const meditationScreen = await read('src/features/meditation/MeditationScreen.tsx');
const sessionLifecycle = await read('src/lib/meditation/sessionLifecycle.ts');
const restorationStore = await read('src/lib/restoration/restorationStore.ts');
const withTimeoutSource = await read('src/lib/async/withTimeout.ts');
const fetchWithTimeoutSource = await read('src/lib/api/fetchWithTimeout.ts');
const restorationWatchdogSource = await read('src/lib/restoration/restorationWatchdog.ts');
const restorationDiagnosticsSource = await read('src/lib/diagnostics/restorationDiagnostics.ts');
const accountResolutionOperation = await read('src/lib/restoration/accountResolutionOperation.ts');
const operationGuard = await read('src/lib/async/operationGuard.ts');

test('onboarding order stays Splash -> Age -> Consent -> Sign-In -> account resolution -> (new: Name -> questionnaire/manual avatar -> companion -> naming -> style) -> app', () => {
  assertOrder(appIndex, [
    'if (!splashComplete || !statusLoaded)',
    'if (!onboardingStatus.ageGateComplete)',
    'if (!onboardingStatus.privacyConsentComplete)',
    'if (!onboardingStatus.authComplete) {',
    '<AppleSignInScreen',
    "if (accountResolution === 'blocked' || isRestoreRetrying)",
    "if (accountResolution === null || accountResolution === 'pending')",
    "accountResolution === 'returning' &&",
    "if (accountResolution === 'new') {",
    'if (!onboardingStatus.nameComplete)',
    'if (!onboardingStatus.findMatchComplete)',
    "if (onboardingStatus.matchMode === 'quiz' && !onboardingStatus.quizResult)",
    "if (onboardingStatus.matchMode === 'quiz' && onboardingStatus.quizResult)",
    "if (onboardingStatus.matchMode === 'manual' && !onboardingStatus.companionSelectionComplete)",
    'if (onboardingStatus.companionSelectionComplete && !onboardingStatus.companionNamingComplete)',
    'if (onboardingStatus.companionNamingComplete && !onboardingStatus.connectionStyleComplete)',
    "if (activeScreen === 'chat')",
  ]);
});

test('the backend account lookup only runs once auth has completed, before restoration begins', () => {
  assertOrder(appIndex, [
    'const startupAuth = await restoreStartupAuthSession();',
    "authComplete: startupAuth.status === 'authenticated',",
    "if (!onboardingStatus.authComplete) return undefined;",
    'runDiagnostic: () => withTimeout(runProfileDiagnostic(), ACCOUNT_LOOKUP_TIMEOUT_MS),',
    'startRestoration: () => void refreshRestoration(),',
  ]);
  // The diagnostic -> classify -> refreshRestoration ordering itself now
  // lives in accountResolutionOperation.ts (extracted so it can be unit
  // tested directly -- see accountResolutionOperation.test.ts), not inline
  // in app/index.tsx's effect.
  assertOrder(accountResolutionOperation, [
    'diagnostic = await deps.runDiagnostic();',
    "if (decision === 'allow') {",
    'deps.onReturning();',
    'deps.startRestoration();',
  ]);
});

test('the account-lookup effect uses a stable operation guard, not a per-invocation cancelled flag tied to accountResolution', () => {
  // The exact former bug: a `let cancelled = false` closure combined with
  // `accountResolution` in this same effect's dependency array, where the
  // operation's own first action (setAccountResolution('pending')) wrote
  // to that dependency -- causing React to run the OLD invocation's
  // cleanup (cancelled = true) within milliseconds, well before the real
  // network round-trip to profile-diagnostic ever resolved. Every
  // resolution attempt cancelled itself immediately, silently skipping
  // classification and restoration.
  assert.doesNotMatch(appIndex, /let cancelled = false/);
  assertIncludes(appIndex, 'const resolveAccountOperationGuardRef = useRef(createOperationGuard());');
  assertIncludes(appIndex, 'resolveAccountOperationGuardRef.current.begin()');
  assertIncludes(appIndex, 'isStale: () => resolveAccountOperationGuardRef.current.isStale(operationId)');
  // Only a genuine unmount invalidates the guard from outside the
  // resolution effect itself -- confirmed via its own dedicated effect
  // with an empty dependency array.
  assertOrder(appIndex, [
    'const guard = resolveAccountOperationGuardRef.current;',
    'return () => {',
    'guard.invalidate();',
    '};',
    '}, []);',
  ]);
  assertIncludes(operationGuard, 'isStale(operationId: number): boolean {');
  assertIncludes(operationGuard, 'return current !== operationId;');
});

test('the account-resolving progress message reads "Loading your Unfiltr account."', () => {
  assertIncludes(appIndex, 'Loading your Unfiltr account.');
  assert.doesNotMatch(appIndex, /Restoring your account/);
});

test('a genuinely new account (not_found) is never routed to the restore-error screen', () => {
  assertOrder(accountResolutionOperation, [
    'const decision = classify(diagnostic);',
    "if (decision === 'allow') {",
    "} else if (decision === 'not_found') {",
    'deps.onNew();',
    '} else {',
    'deps.onBlocked();',
  ]);
});

test('sign-out never hardcodes companion/relationship completion for the next session', () => {
  const signOutStart = appIndex.indexOf('async function handleSignOut(');
  assert.ok(signOutStart > 0, 'Expected handleSignOut to exist');
  const signOutEnd = appIndex.indexOf('\nasync function clearAllAccountSpecificData', signOutStart);
  assert.ok(signOutEnd > signOutStart, 'Expected clearAllAccountSpecificData after handleSignOut');
  const signOutBody = appIndex.slice(signOutStart, signOutEnd);

  assert.doesNotMatch(signOutBody, /companionSelectionComplete:\s*true/);
  assert.doesNotMatch(signOutBody, /companionNamingComplete:\s*true/);
  assert.doesNotMatch(signOutBody, /connectionStyleComplete:\s*true/);
  assert.doesNotMatch(signOutBody, /selectedCompanionId:\s*'luna'/);
  assertIncludes(signOutBody, 'setOnboardingStatus(initialOnboardingStatus);');
});

test('a returning account hydrates the restored companion id, nickname, display name, and relationship mode', () => {
  assertOrder(appIndex, [
    "if (accountResolution !== 'returning') return;",
    "if (restoration.status !== 'ready') return;",
    'await hydrateLocalProfileFromRestoration(restoration.profile.data);',
  ]);
  [
    "const displayName = readString(profile.display_name);",
    "const companionNickname = readString(profile.companion_name);",
    "const selectedCompanionId = readString(profile.avatar_id);",
    "const relationshipMode = readString(preferences?.relationshipMode);",
    "setSecureItem('onboarding.selectedCompanionId', selectedCompanionId)",
    "setSecureItem('onboarding.companionNickname', companionNickname)",
    "setSecureItem('onboarding.displayName', displayName)",
    "setSecureItem('onboarding.relationshipMode', relationshipMode)",
  ].forEach((needle) => assertIncludes(hydrateLocalProfile, needle));
});

test('a genuinely new (not_found) account never triggers hydration from a previous profile', () => {
  const newAccountStart = appIndex.indexOf("if (accountResolution === 'new') {");
  assert.ok(newAccountStart > 0, 'Expected the new-account onboarding block to exist');
  const newAccountEnd = appIndex.indexOf("if (activeScreen === 'chat')", newAccountStart);
  assert.ok(newAccountEnd > newAccountStart, 'Expected Main Menu screens after the new-account block');
  const newAccountBody = appIndex.slice(newAccountStart, newAccountEnd);

  assert.doesNotMatch(newAccountBody, /hydrateLocalProfileFromRestoration/);
  assertIncludes(
    accountResolutionOperation,
    "} else if (decision === 'not_found') {\n      deps.onNew();",
  );
});

test('signing out fully unscopes the device from the previous Apple account before a new one can hydrate', () => {
  // Every field hydrateLocalProfile.ts can write must have a matching clear
  // on sign-out, or a second account signing in on the same device could
  // still see the first account's companion/name data.
  [
    "deleteSecureItem('onboarding.selectedCompanionId')",
    "deleteSecureItem('onboarding.companionNickname')",
    "deleteSecureItem('onboarding.displayName')",
    "deleteSecureItem('onboarding.relationshipMode')",
    "deleteAppStorageItem('unfiltr_companion_id')",
    "deleteAppStorageItem('unfiltr_companion_nickname')",
    "deleteAppStorageItem('unfiltr_companion')",
    "deleteAppStorageItem('unfiltr_relationship_mode')",
    "deleteAppStorageItem('unfiltr_display_name')",
  ].forEach((needle) => assertIncludes(appIndex, needle));

  // clearRestorationForSignOut() clears the *current* account's namespaced
  // cache before clearRememberedAccountIdentity() erases which account that
  // was -- reversing this order would leak the outgoing account's cache.
  assertOrder(appIndex, [
    'await clearRestorationForSignOut();',
    'await clearRememberedAccountIdentity();',
  ]);

  // The in-memory "already hydrated this account" guard must be reset
  // immediately before every handleSignOut call site, or re-authenticating
  // as the same account within the same app session would silently skip
  // re-hydration.
  const signOutCallSites = [];
  for (let index = appIndex.indexOf('void handleSignOut({'); index !== -1; ) {
    signOutCallSites.push(index);
    index = appIndex.indexOf('void handleSignOut({', index + 1);
  }
  assert.ok(signOutCallSites.length >= 2, 'Expected at least two handleSignOut call sites');
  signOutCallSites.forEach((callIndex) => {
    const precedingSource = appIndex.slice(Math.max(0, callIndex - 200), callIndex);
    assertIncludes(precedingSource, 'hydratedAccountIdRef.current = null;');
  });

  assertIncludes(accountCache, 'const accountId = await getCurrentAccountId();');
  assertIncludes(accountCache, 'accountCacheKey(accountId, area)');
});

test('restoration failure or an indefinite hang is never silently shown as Main Menu', () => {
  assertOrder(appIndex, [
    "accountResolution === 'returning' &&",
    "restoration.status !== 'ready' ||",
    "restoration.profile.source === 'unavailable'",
    "if (activeScreen === 'chat')",
  ]);
  assertIncludes(appIndex, "setAccountResolution('blocked');");
  assertIncludes(appIndex, 'RESTORATION_WAIT_TIMEOUT_MS');
  assertIncludes(appIndex, 'ACCOUNT_LOOKUP_TIMEOUT_MS');
  assertIncludes(appIndex, "import { withTimeout } from '@/lib/async/withTimeout';");
  assertIncludes(accountResolutionOperation, "import { TimeoutError } from '@/lib/async/withTimeout';");
  assertIncludes(withTimeoutSource, 'export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {');

  // The UI-level timeouts above are a second line of defense: restoration
  // itself must also settle on its own, independent of whether app/index.tsx
  // is watching, or a retry after the UI timeout fires would just return the
  // same still-pending promise.
  assertIncludes(restorationStore, 'export const RESTORATION_HARD_TIMEOUT_MS');
  assertIncludes(restorationStore, 'withTimeout(restoreStartupAccountData(), RESTORATION_HARD_TIMEOUT_MS)');
  assertIncludes(restorationStore, 'restorePromise = null;');

  // The single outer watchdog is the third, independent line of defense: it
  // does not await, wrap, or race any of the promises the timeouts above
  // protect, so a bug in either of them (or a hang somewhere neither one
  // covers) still cannot leave the resolving screen up forever. It re-arms
  // on every resolveAccount() attempt, including Retry, not just the first.
  assertIncludes(appIndex, "import { scheduleRestorationWatchdog } from '@/lib/restoration/restorationWatchdog';");
  assertIncludes(appIndex, 'const OUTER_RESTORATION_WATCHDOG_MS');
  assertIncludes(appIndex, 'setResolveAttempt((attempt) => attempt + 1);');
  assertIncludes(appIndex, '}, [onboardingStatus.authComplete, resolveAttempt]);');
  assertIncludes(
    restorationWatchdogSource,
    'export function isStillResolving(snapshot: ResolvingSnapshot): boolean {',
  );
  assertIncludes(
    restorationWatchdogSource,
    'export function scheduleRestorationWatchdog(options: {',
  );

  // Diagnostics must survive a release build -- an in-memory-only ring
  // buffer is unreachable if the screen it would explain is the one stuck.
  assertIncludes(restorationDiagnosticsSource, 'console.warn(');
});

test('sign-out clears auth, restoration cache, chat, private session, and account artifacts', () => {
  [
    'signOutRevenueCat',
    'clearRestorationForSignOut',
    'clearAuthenticatedSession',
    'clearRememberedAccountIdentity',
    'setChatMessages([])',
    "deleteSecureItem('chat.privateSession')",
    "deleteSecureItem('chat.currentSessionId')",
    "deleteAppStorageItem('unfiltr_chat_messages')",
    "deleteAppStorageItem('unfiltr_memory')",
    "deleteAppStorageItem('unfiltr_profile_snapshot')",
  ].forEach((needle) => {
    assertIncludes(appIndex + accountCache, needle);
  });
});

test('sign-out clears premium/entitlement cache and personality/tone so neither leaks to the next account', () => {
  [
    "deleteSecureItem('unfiltr_is_premium')",
    "deleteAppStorageItem('unfiltr_is_premium')",
    "deleteSecureItem('unfiltr_effective_tier')",
    "deleteAppStorageItem('unfiltr_effective_tier')",
    "deleteSecureItem('unfiltr_family_unlock')",
    "deleteAppStorageItem('unfiltr_family_unlock')",
    "deleteSecureItem('unfiltr_family_unlimited')",
    "deleteAppStorageItem('unfiltr_family_unlimited')",
    "deleteSecureItem('unfiltr_unlimited')",
    "deleteAppStorageItem('unfiltr_unlimited')",
    "deleteSecureItem('unfiltr_msg_usage')",
    "deleteSecureItem('onboarding.personalityVibe')",
    "deleteSecureItem('onboarding.personalityStyle')",
    "deleteSecureItem('onboarding.personalityHumor')",
    "deleteSecureItem('onboarding.personalityEmpathy')",
    "deleteAppStorageItem('unfiltr_voice_personality')",
  ].forEach((needle) => assertIncludes(appIndex, needle));

  // RevenueCat's own identity keys are cleared separately, by name, in
  // revenueCat.ts -- confirm that's still wired in ahead of the derived
  // entitlement cache this file owns.
  [
    "deleteSecureItem('revenueCat.appUserId')",
    "deleteAppStorageItem('unfiltr_revenuecat_tier')",
  ].forEach((needle) => assertIncludes(revenueCat, needle));
});

test('sign-out resets active navigation state (active screen, settings/premium return targets, chat messages)', () => {
  const signOutStart = appIndex.indexOf('async function handleSignOut(');
  const signOutEnd = appIndex.indexOf('\nasync function clearAllAccountSpecificData', signOutStart);
  const signOutBody = appIndex.slice(signOutStart, signOutEnd);

  [
    "setActiveScreen('home');",
    "setSettingsReturnTo('home');",
    "setPremiumReturnTo('home');",
    'setChatMessages([]);',
  ].forEach((needle) => assertIncludes(signOutBody, needle));
});

test('the account-scoped cache is identified and cleared before the identity keys that name it are erased', () => {
  assertOrder(appIndex, [
    'await signOutRevenueCat();',
    'await clearRestorationForSignOut();',
    'await clearAuthenticatedSession();',
    'await clearRememberedAccountIdentity();',
  ]);
});

test('Premium has its own dedicated return-to state, distinct from settingsReturnTo', () => {
  assertIncludes(appIndex, "const [premiumReturnTo, setPremiumReturnTo] = useState<AppScreen>('home');");
  assertIncludes(appIndex, "const [settingsReturnTo, setSettingsReturnTo] = useState<AppScreen>('home');");

  // Main Menu -> Premium -> Back -> Main Menu
  assertIncludes(
    appIndex,
    "onOpenPremium={() => {\n          setPremiumReturnTo('home');\n          setActiveScreen('premium');",
  );
  // Settings -> Premium -> Back -> Settings
  assertIncludes(
    appIndex,
    "onOpenPremium={() => {\n            setPremiumReturnTo('settings');\n            setActiveScreen('premium');",
  );
  // Back from Premium always goes to whichever screen opened it, not a fixed target.
  assertIncludes(appIndex, "<PremiumScreen\n          onBack={() => setActiveScreen(premiumReturnTo)}");

  // Main Menu -> Settings -> Back -> Main Menu
  assertIncludes(
    appIndex,
    "onOpenSettings={() => {\n          setSettingsReturnTo('home');\n          setActiveScreen('settings');",
  );
  assertIncludes(appIndex, "onBack={() => setActiveScreen(captureSettings ? 'home' : settingsReturnTo)}");
});

test('Chat Options is an in-place sheet over ChatScreen, so it always returns to Chat by construction', () => {
  assertIncludes(chatScreen, "const [optionsVisible, setOptionsVisible] = useState(false);");
  assertIncludes(chatScreen, 'onPress={() => setOptionsVisible(true)}');
  assertIncludes(chatScreen, '<OptionsSheet');
  assertIncludes(chatScreen, 'onClose={() => setOptionsVisible(false)}');
  // The gear icon opens the separate, global Settings screen -- distinct
  // from the in-place Options sheet -- and must return to Chat via
  // settingsReturnTo, not a fixed target.
  assertIncludes(chatScreen, 'onPress={onOpenSettings}');
  assertIncludes(
    appIndex,
    "onOpenSettings={() => {\n            setSettingsReturnTo('chat');\n            setActiveScreen('settings');",
  );
});

test('chat supports deployed response contract and no fake reply fallback', () => {
  assertOrder(chatScreen, [
    'response.data?.message?.trim()',
    'response.reply?.trim()',
    'response.message?.trim()',
    'response.text?.trim()',
    "throw new Error('EMPTY_CHAT_RESPONSE')",
  ]);
});

test('chat request has timeout, abort cancellation, stale response guard, and duplicate send guard', () => {
  [
    'CHAT_REQUEST_TIMEOUT_MS',
    'new AbortController()',
    'setTimeout(() => controller.abort()',
    'activeRequestRef.current?.controller.abort()',
    'if (!isActiveChatRequest(requestId)) return;',
    'if (!text || loading) return;',
    'if (loading || !messages.some',
  ].forEach((needle) => assertIncludes(chatScreen, needle));
});

test('private session prevents local and remote chat persistence', () => {
  assertIncludes(chatScreen, 'if (privateSession) return;');
  assertIncludes(chatScreen, 'void saveChatHistory(messages);');
  assertIncludes(chatScreen, 'privateSession,');
  assertIncludes(chatScreen, 'next ? deleteAppStorageItem(STORAGE.messages) : Promise.resolve()');
});

test('chat screen uses shared back button and shared world registry', () => {
  assertIncludes(chatScreen, "import { BackButton } from '@/components/BackButton';");
  assertIncludes(chatScreen, '<BackButton accessibilityLabel="Back to home" onPress={onBack} />');
  assertIncludes(worldCatalog, "export type WorldModule = 'chat' | 'journal' | 'meditation';");
  assertIncludes(worldCatalog, 'WORLD_STORAGE_KEYS');
});

test('journal mode cards use one clean vector arrow icon, not a literal text glyph, with reserved layout space', () => {
  assert.doesNotMatch(journalScreen, /styles\.chevron|>\{'>'\}|â€¹|â€º|â†|âž|→|›/);
  assertIncludes(journalScreen, '<ForwardArrowIcon />');
  assertIncludes(journalScreen, 'function ForwardArrowIcon()');
  // The count of ForwardArrowIcon usages must match ModeCard usages exactly
  // -- one icon per card, no duplicate/leftover chevron overlays.
  const modeCardUsages = journalScreen.match(/<ModeCard\b/g) ?? [];
  const forwardArrowUsages = journalScreen.match(/<ForwardArrowIcon \/>/g) ?? [];
  assert.equal(modeCardUsages.length, 2, 'Expected exactly two ModeCard usages (Classic, Immersive)');
  assert.equal(
    forwardArrowUsages.length,
    1,
    'Expected ForwardArrowIcon defined and rendered exactly once inside ModeCard',
  );
  // The title/body text column must reserve its own flexible space so the
  // arrow can never be squeezed against the card's rounded edge.
  assertIncludes(journalScreen, "<View style={styles.modeText}>");
  assertIncludes(journalScreen, 'modeText: { flex: 1, paddingRight: 12 },');
});

test('the Immersive Journal world registry contains exactly the six required worlds, correctly named', () => {
  const journalWorldsStart = worldCatalog.indexOf('export const IMMERSIVE_JOURNAL_WORLDS');
  assert.ok(journalWorldsStart > 0, 'Expected IMMERSIVE_JOURNAL_WORLDS to exist');
  const journalWorldsEnd = worldCatalog.indexOf('\n];', journalWorldsStart);
  const journalWorldsBody = worldCatalog.slice(journalWorldsStart, journalWorldsEnd);

  const required = [
    ["id: 'cozy_apartment'", "label: 'Cozy Apartment'"],
    ["id: 'forest_cabin'", "label: 'Forest Cabin'"],
    ["id: 'late_night_cafe'", "label: 'Late Night Café'"],
    ["id: 'space_station'", "label: 'Space Station'"],
    ["id: 'beach_house'", "label: 'Beach House'"],
    ["id: 'rooftop'", "label: 'Rooftop'"],
  ];
  required.forEach(([id, label]) => {
    assertOrder(journalWorldsBody, [id, label]);
  });

  assert.doesNotMatch(journalWorldsBody, /label: 'Cozy Living Room'/);
  const idCount = (journalWorldsBody.match(/id: '/g) ?? []).length;
  assert.equal(idCount, 6, 'Expected exactly six worlds in JOURNAL_WORLDS');
});

test('CHAT_BACKGROUNDS and IMMERSIVE_JOURNAL_WORLDS are two clear, separate registries', () => {
  assertIncludes(worldCatalog, 'export const CHAT_BACKGROUNDS: readonly WorldProfile[] = [');
  assertIncludes(worldCatalog, 'export const IMMERSIVE_JOURNAL_WORLDS: readonly WorldProfile[] = [');
  // Neither registry is derived from, or aliases, the other -- IMMERSIVE_
  // JOURNAL_WORLDS is defined as its own literal array, and CHAT_BACKGROUNDS
  // is built only from the two chat-only background lists.
  assert.match(
    worldCatalog,
    /export const CHAT_BACKGROUNDS: readonly WorldProfile\[\] = \[\r?\n\s*\.\.\.ANIME_CHAT_BACKGROUNDS,\r?\n\s*\.\.\.REALISTIC_CHAT_BACKGROUNDS,\r?\n\];/,
  );
  assertIncludes(worldCatalog, "if (module === 'chat') return CHAT_BACKGROUNDS;");
  assertIncludes(worldCatalog, "if (module === 'journal') return IMMERSIVE_JOURNAL_WORLDS;");
});

test('the Chat background registry contains exactly 11 anime + 10 realistic backgrounds from companionData.jsx, and none belong to Journal', () => {
  const chatBackgroundsStart = worldCatalog.indexOf('const ANIME_CHAT_BACKGROUNDS');
  const chatBackgroundsEnd = worldCatalog.indexOf(
    '\n// CHAT_BACKGROUNDS and IMMERSIVE_JOURNAL_WORLDS',
  );
  assert.ok(chatBackgroundsStart > 0 && chatBackgroundsEnd > chatBackgroundsStart);
  const chatBackgroundsBody = worldCatalog.slice(chatBackgroundsStart, chatBackgroundsEnd);

  const requiredAnime = [
    'Cozy Living Room',
    'Sunny Park',
    'Sunset Beach',
    'Underwater World',
    'Cherry Blossom',
    'Sky Islands',
    'Enchanted Forest',
    'Rainy Café',
    'Anime Rooftop',
    'Winter Cabin',
    'Cyberpunk City',
  ];
  const requiredRealistic = [
    'Cozy Living Room',
    'Sunny Park',
    'Sunset Beach',
    'Outer Space',
    'Enchanted Forest',
    'Rainy Café',
    'Tokyo Rooftop',
    'Deep Ocean',
    'Winter Cabin',
    'Cyberpunk City',
  ];

  const animeCount = (chatBackgroundsBody.match(/style: 'anime'/g) ?? []).length;
  const realisticCount = (chatBackgroundsBody.match(/style: 'realistic'/g) ?? []).length;
  assert.equal(animeCount, 11, 'Expected exactly 11 anime chat backgrounds');
  assert.equal(realisticCount, 10, 'Expected exactly 10 realistic chat backgrounds');

  const labelPattern = (label) => new RegExp(`label: '${label}',\\r?\\n\\s*mark:`);
  requiredAnime.forEach((label) => assert.match(chatBackgroundsBody, labelPattern(label)));
  requiredRealistic.forEach((label) => assert.match(chatBackgroundsBody, labelPattern(label)));

  // None of the six Immersive Journal world ids leak into Chat's registry.
  ['cozy_apartment', 'forest_cabin', 'late_night_cafe', 'space_station', 'beach_house'].forEach(
    (journalId) => {
      assert.doesNotMatch(chatBackgroundsBody, new RegExp(`id: '${journalId}'`));
    },
  );
  // supportedModules for every chat background is chat-only.
  assert.doesNotMatch(chatBackgroundsBody, /supportedModules: \['chat', 'journal'\]/);
  assert.doesNotMatch(chatBackgroundsBody, /supportedModules: \['journal'/);
});

test('settings, premium, and admin use shared back controls without global private session', () => {
  assertIncludes(
    settingsScreen,
    '<BackButton accessibilityLabel="Back to home" onPress={onBack} />',
  );
  assertIncludes(
    premiumScreen,
    "accessibilityLabel={returnTo === 'home' ? 'Back to home' : 'Back to settings'}",
  );
  assertIncludes(
    adminScreen,
    '<BackButton accessibilityLabel="Back to settings" onPress={onBack} />',
  );
  assert.doesNotMatch(settingsScreen, /label="Private session"/);
});

test('chat options own relationship, tone, voice, private session, and current conversation controls', () => {
  [
    'Connection style',
    'Tone & humor',
    'Voice',
    'Private session',
    'Save current conversation',
    'Clear current conversation',
    'PERSONALITY_OPTIONS',
    'VOICE_OPTIONS',
    'module="chat"',
  ].forEach((needle) => assertIncludes(chatScreen, needle));
  assert.doesNotMatch(chatScreen, /History recovery/);
  assert.doesNotMatch(chatScreen, /module="journal"/);
});

test('chat background/font/bubble-style appearance controls live in Chat Options, not in Settings', () => {
  [
    "Text style={styles.sectionLabel}>Font",
    "Text style={styles.sectionLabel}>Text size",
    "Text style={styles.sectionLabel}>Chat bubbles",
    'onAppearanceChange',
    'appearance: AppearancePreferences',
  ].forEach((needle) => assertIncludes(chatScreen, needle));

  // The Settings hub must not offer a second, duplicate place to change the
  // same chat-rendering preference (font/bubble/tone/voice) -- those are
  // chat controls and belong only in Chat Options.
  assert.doesNotMatch(optionsHubScreen, /appearance/i);
  assert.doesNotMatch(optionsHubScreen, /voice.{0,3}(&|and).{0,3}tone/i);
  assert.doesNotMatch(optionsHubScreen, /onOpenVoicePersonality/);
  assert.doesNotMatch(repairedSettingsScreen, /AppearanceScreen/);
  assert.doesNotMatch(repairedSettingsScreen, /VoicePersonalityScreen/);

  // Both duplicate screens are gone, not just unreachable.
  assert.equal(fileExistsSync('src/features/settings/AppearanceScreen.tsx'), false);
  assert.equal(fileExistsSync('src/features/settings/VoicePersonalityScreen.tsx'), false);
});

test('sign-out clears chat appearance preferences (bubble/font/text size)', () => {
  assertIncludes(appIndex, "deleteAppStorageItem('unfiltr_appearance_preferences')");
});

test('app settings own account, family, premium, data, notifications, and authorized admin entry', () => {
  [
    'Account',
    'Privacy',
    'Notifications',
    'Premium',
    'Family access',
    'Admin Dashboard',
    'Clear chat history',
    'Delete memory snapshot',
    'Sign out',
    'verifyAdminAccess(code)',
  ].forEach((needle) => assertIncludes(settingsScreen, needle));
});

test('RevenueCat entitlement and account switching state are explicit', () => {
  [
    "REVENUECAT_ENTITLEMENT_ID = 'unfiltr by javier Pro'",
    'com.huertas.unfiltr.pro.monthly',
    'com.huertas.unfiltr.pro.annual',
    'Purchases.purchasePackage',
    'Purchases.restorePurchases',
    'Purchases.logOut',
    "deleteSecureItem('revenueCat.appUserId')",
    "deleteAppStorageItem('unfiltr_revenuecat_tier')",
  ].forEach((needle) => assertIncludes(revenueCat, needle));
  assertIncludes(access, 'resolvePremiumAccess');
});

test('protected diagnostics screen exposes safe state only after admin unlock route', () => {
  [
    'InternalDiagnosticsScreen',
    'App version/build',
    'API URL',
    'Auth state',
    'Masked user ID',
    'Onboarding flags',
    'Profile status',
    'Premium status (live RevenueCat check)',
    'Backend tier (cached user_profiles.tier)',
    'Memory count restored',
    'Chat-history count restored',
    'Private Session',
    'Family status',
    'Admin role',
    'Last request ID',
    'Last safe error code',
  ].forEach((needle) => assertIncludes(diagnosticsScreen, needle));
  assertIncludes(repairedSettingsScreen, 'onOpenDiagnostics');
  assertIncludes(adminScreen, 'Internal Diagnostics');
  assert.doesNotMatch(diagnosticsScreen, /service_role|secret|full private/i);
});

test('memory count and chat-history count diagnostics report counts only, never raw memory/message text', () => {
  assertIncludes(diagnosticsScreen, 'memoryCount = response.memory?.long_term_memory?.items?.length');
  assertIncludes(diagnosticsScreen, 'chatHistoryCount = chatHistory.session?.messages?.length');
  // The row values must be counts (numbers/strings), never the item/message
  // arrays or their text content rendered directly.
  assert.doesNotMatch(diagnosticsScreen, /value: response\.memory/);
  assert.doesNotMatch(diagnosticsScreen, /value: chatHistory\.session/);
});

test('MemoryScreen reads the backend\'s actual companion_memory shape (long_term_memory.items), not the disabled legacy shape', () => {
  assertIncludes(memoryScreen, 'response.memory?.long_term_memory');
  assertIncludes(memoryScreen, 'longTermMemory?.items');
  // The old shape (top-level memory_summary/user_facts/session_memory/
  // relationship_milestones keys) is never written by any current backend
  // code path -- api/summarizeSession.js is disabled (410) specifically
  // because "Durable memory is written through /api/chat" instead.
  assert.doesNotMatch(memoryScreen, /memory\.memory_summary/);
  assert.doesNotMatch(memoryScreen, /memory\.user_facts/);
  assert.doesNotMatch(memoryScreen, /memory\.session_memory/);
  assert.doesNotMatch(memoryScreen, /memory\.relationship_milestones/);
});

test('meditation End Session delegates to the pure, unit-tested runMeditationExit orchestration', () => {
  assertIncludes(meditationScreen, 'await runMeditationExit(');
  assertIncludes(meditationScreen, 'saveCompletionSnapshot:');
  assertIncludes(meditationScreen, 'stopPlayer: () => stopPlayer(');
});

test('the completion-snapshot write is fire-and-forget: exiting an active session never awaits it', () => {
  // The original bug: `await setJsonItem(...)` ran before `setPhase(\'done\')`,
  // so a hung storage write left the user stuck on a disabled "Ending..."
  // button forever -- the leading hypothesis for the reported TestFlight
  // freeze. Confirm the fix's shape: the snapshot write is fired via
  // `void ...catch(...)`, not awaited, before the guarded state update runs.
  assertOrder(sessionLifecycle, [
    'if (complete) {',
    'void deps.saveCompletionSnapshot().catch(() => {',
    'await Promise.resolve();',
    'if (deps.guard.isMounted()) {',
  ]);
  assert.doesNotMatch(sessionLifecycle, /await deps\.saveCompletionSnapshot/);
});

test('api client passes AbortController signal and captures safe request diagnostics', () => {
  assertIncludes(apiClient, 'type RequestOptions = RequestInit');
  assertIncludes(apiClient, 'fetchWithTimeout(`${baseUrl}${path}`, { ...options, headers })');
  assertIncludes(apiClient, 'X-Unfiltr-Request-Id');
  assertIncludes(apiClient, 'getLastApiDiagnostics');
  assertIncludes(apiClient, 'lastSafeErrorCode');
  assertIncludes(fetchWithTimeoutSource, 'new AbortController()');
  assertIncludes(fetchWithTimeoutSource, 'signal: controller.signal');
});

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

function fileExistsSync(path) {
  return existsSync(new URL(`../${path}`, import.meta.url));
}

function assertIncludes(source, needle) {
  assert.ok(source.includes(needle), `Expected source to include: ${needle}`);
}

function assertOrder(source, needles) {
  let index = -1;
  for (const needle of needles) {
    const next = source.indexOf(needle, index + 1);
    assert.ok(next > index, `Expected "${needle}" after index ${index}`);
    index = next;
  }
}
