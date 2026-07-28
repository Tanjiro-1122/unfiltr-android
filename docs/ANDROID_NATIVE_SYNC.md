# Android Native Sync

Source of truth: `Tanjiro-1122/unfiltr-native@babbcf6ab55c297bd391a576e0f4c8733c7bc8b1` (`repair/post-build67-fixes`).

Target branch: `android/sync-ios-repair`.

## Architecture finding

The current Android `app/index.tsx` is a WebView wrapper around `https://unfiltrbyjavier2.vercel.app`. It is not the native Expo/React Native application now present in `unfiltr-native`.

The conversion will therefore preserve Android release identity and services while replacing the wrapper UI and shared logic with the repaired native application.

## Preserve from the Android repository

- Android package: `com.huertas.unfiltr`
- Existing EAS Android project identity
- `google-services.json` integration
- Google Sign-In configuration
- Android permissions and notification configuration
- Google Play Billing / RevenueCat Android setup
- Play internal-track submission configuration
- API 36 and Billing Library 8 compatibility work

## Import from repaired native source

- Native onboarding and legal gates
- Account resolution and returning-account restoration
- Account-safe sign-out
- Main Menu, Chat, Journal, Meditation, Premium and Settings screens
- Chat backgrounds and immersive journal registries
- Chat appearance, tone and relationship controls
- Memory restoration and diagnostics
- Meditation End Session hardening and tests
- Supabase-migrated asset URLs

## Work order

1. Align Expo SDK, React Native, TypeScript and shared dependencies with the repaired native repository.
2. Replace the WebView entry point with the native router/application tree.
3. Port the repaired `src/`, `app/`, tests and native assets.
4. Add Android Google Sign-In as the platform-auth implementation in the repaired onboarding flow.
5. Keep RevenueCat platform selection and map Google Play products to the existing entitlement tiers.
6. Add Android hardware-back handling for onboarding, Premium, Settings, Chat Options, Journal and Meditation.
7. Validate notifications on Android 13+ and verify notification channel/icon behavior.
8. Run typecheck, lint, release tests, unit tests, Expo Doctor and Android export.
9. Produce an internal Android App Bundle and test through Play internal testing before production promotion.

## Guardrails

- Do not modify `main` directly.
- Do not publish to Google Play until the critical native flows pass on a physical Android device.
- Do not remove Android signing, Google services or Play submission configuration while synchronizing the native source.
- Do not reuse the WebView wrapper as the final user interface.
