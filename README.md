# Unfiltr by Javier — Android Wrapper

React Native / Expo WebView wrapper for the Unfiltr Android app.

## What this does
- Loads `https://unfiltrbyjavier2.vercel.app` in a full-screen WebView
- Handles **Google Sign-In** natively (instead of Apple Sign-In)
- Manages **RevenueCat** subscriptions (Android billing)
- Persists session to AsyncStorage (survives force-close / reinstall)
- Passes push notification tokens to the web app

## Setup checklist before first build

### 1. Google Sign-In
- Go to [Google Cloud Console](https://console.cloud.google.com)
- Create OAuth 2.0 credentials → **Web application** type
- Copy the Web Client ID → add to GitHub Secrets as `GOOGLE_WEB_CLIENT_ID`
- Also create an **Android** OAuth client ID (uses SHA-1 fingerprint from EAS)
- Download `google-services.json` → place in repo root (it's gitignored for safety, add via EAS secret or CI)

### 2. RevenueCat Android key
- In RevenueCat dashboard → Apps → Add Android app
- Copy the public SDK key (starts with `goog_`) 
- Add to GitHub Secrets as `ANDROID_RC_KEY`
- Update `app.json` → `extra.eas.projectId` with the new EAS project ID

### 3. Google Play setup
- Create app in [Google Play Console](https://play.google.com/console)
- Bundle ID: `com.huertas.unfiltr`
- Create a service account → download JSON key
- Add to GitHub Secrets as `GOOGLE_PLAY_SERVICE_ACCOUNT_KEY`

### 4. EAS project
```bash
npx eas init
```
Copy the project ID into `app.json` → `extra.eas.projectId`

### 5. GitHub Secrets needed
| Secret | Description |
|--------|-------------|
| `EXPO_TOKEN` | Your Expo account token |
| `ANDROID_RC_KEY` | RevenueCat Android SDK key |
| `GOOGLE_WEB_CLIENT_ID` | Google OAuth Web Client ID |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_KEY` | Google Play service account JSON |

## Build manually
```bash
eas build --platform android --profile production
```

## Web app changes needed
The web app (`UniltrbyJavierbackup`) needs to handle `GOOGLE_SIGN_IN_SUCCESS` messages from the bridge (in addition to the existing `APPLE_SIGN_IN_SUCCESS`). See the bridge message types in `app/index.tsx`.
