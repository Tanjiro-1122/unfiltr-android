# Android 16 and Billing Library 8 upgrade

This branch upgrades the Android wrapper while preserving its existing Vercel WebView behavior.

## Compliance changes

- Expo SDK 54 foundation (Android compile/target SDK 36)
- `compileSdkVersion`: 36
- `targetSdkVersion`: 36
- Android Build Tools: 36.0.0
- RevenueCat React Native SDK 9 or newer (Google Play Billing Library 8)
- App version: 1.0.1
- Android version code: 21

## Behavior that must remain unchanged

- WebView origin: `https://unfiltrbyjavier2.vercel.app`
- Google sign-in
- RevenueCat login, offerings, purchases, restore, and entitlement state
- Push registration and native-to-web bridge
- Camera, microphone, and photo-library permissions
- Persisted onboarding and companion session values

## Required regression checks before merge

1. Fresh install and returning-user login
2. Google sign-in and sign-out
3. Product loading and purchase cancellation
4. Successful purchase and entitlement recognition
5. Restore purchases
6. Push notification permission and token registration
7. Camera and photo picker
8. Microphone permission
9. WebView navigation and offline/retry behavior
10. Release Android App Bundle generation
