# Unfiltr by Javier — Android Wrapper

React Native / Expo WebView wrapper for the Unfiltr Android app.

## What this does
- Loads `https://unfiltrbyjavier2.vercel.app` in a full-screen WebView
- Handles **Google Sign-In** natively (instead of Apple Sign-In)
- Manages **RevenueCat** subscriptions (Android billing)
- Persists session to AsyncStorage (survives force-close / reinstall)
- Passes push notification tokens to the web app

---

## ⚠️ One manual step — Add the GitHub Actions workflow

The `build-android.yml.txt` file in the root of this repo is the ready-to-use CI/CD workflow.
GitHub blocks automated creation of workflow files (requires a special token scope).

**To activate CI/CD (takes 2 minutes):**
1. Go to https://github.com/Tanjiro-1122/unfiltr-android on GitHub
2. Click **"Add file"** → **"Create new file"**
3. Type `.github/workflows/build-android.yml` as the filename
4. Copy-paste the contents from `build-android.yml.txt` in the repo root
5. Click **"Commit new file"**
6. GitHub Actions is now enabled 🚀

---

## Setup checklist before first build

### 1. EAS Project ID
```bash
# In the repo root:
npx eas init
```
Copy the project ID shown → paste into `app.json` → `extra.eas.projectId`

### 2. Google Sign-In
- Go to [Google Cloud Console](https://console.cloud.google.com)
- **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
- Create **Web application** type → copy the **Web Client ID**
- Also create an **Android** OAuth client ID (uses the SHA-1 fingerprint — EAS provides this)
- Download `google-services.json` → place in the repo root (never commit — add via EAS secret or CI env)
- Add **Web Client ID** to GitHub Secrets as `GOOGLE_WEB_CLIENT_ID`

### 3. RevenueCat Android key
- In [RevenueCat dashboard](https://app.revenuecat.com) → **Apps** → **+ Add new app** → Android
- Add your Google Play app (bundle: `com.huertas.unfiltr`)
- Copy the **public SDK key** (starts with `goog_`)
- Add to GitHub Secrets as `ANDROID_RC_KEY`
- Update `eas.json` → replace `REPLACE_WITH_ANDROID_RC_KEY` with the actual key

### 4. Google Play setup
- Open [Google Play Console](https://play.google.com/console)
- Create new app → bundle ID: `com.huertas.unfiltr`
- **Setup** → **API access** → Link to a Google Cloud project → create a service account
- Download the service account JSON key
- Add to GitHub Secrets as `GOOGLE_PLAY_SERVICE_ACCOUNT_KEY`

### 5. Add `google-services.json`
Option A (recommended): Add via EAS secret
```bash
eas secret:create --scope project --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json
```
Option B: Upload to the repo root (but add it to `.gitignore` first for security)

### 6. GitHub Secrets needed
| Secret | Where to find it |
|--------|-----------------|
| `EXPO_TOKEN` | expo.dev → Account Settings → Access Tokens |
| `ANDROID_RC_KEY` | RevenueCat dashboard → Android app → public SDK key |
| `GOOGLE_WEB_CLIENT_ID` | Google Cloud Console → OAuth 2.0 Web Client ID |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_KEY` | Google Play Console → service account JSON |

---

## Build manually (once setup is done)
```bash
npm install
eas build --platform android --profile production
```

## Bridge message types
Messages the web app can send to the native wrapper:

| Type | Description |
|------|-------------|
| `SIGN_IN_WITH_GOOGLE` | Trigger Google Sign-In overlay |
| `SIGN_OUT` | Sign out current user |
| `PURCHASE` | Purchase a subscription (`{ productId }`) |
| `RESTORE_PURCHASES` | Restore previous purchases |
| `GET_OFFERINGS` | Fetch RevenueCat offerings |
| `GET_CUSTOMER_INFO` | Get current customer/subscription info |
| `SAVE_SESSION` | Persist session data to AsyncStorage |

---

## Architecture
```
Google Play Store
    └── APK/AAB (this wrapper)
         └── WebView → https://unfiltrbyjavier2.vercel.app
              ├── Same Vercel frontend as iOS
              ├── Google Sign-In (bridge: SIGN_IN_WITH_GOOGLE)
              └── RevenueCat Android billing
```
