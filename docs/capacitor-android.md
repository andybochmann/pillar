# Capacitor Android App

Pillar ships as a Capacitor Android app using **remote URL mode** — the native WebView loads the deployed Next.js server. This means all server features (API routes, SSE, auth, middleware) work unchanged, and web updates deploy without app store resubmission.

## Architecture

```
┌─────────────────────────────────┐
│  Android Device                 │
│  ┌───────────────────────────┐  │
│  │  Capacitor Shell          │  │
│  │  ┌─────────────────────┐  │  │
│  │  │  WebView             │  │  │
│  │  │  (loads server URL)  │  │  │
│  │  └─────────────────────┘  │  │
│  │  ┌─────────────────────┐  │  │
│  │  │  FCM Push Plugin     │  │  │
│  │  │  → device token      │  │  │
│  │  └─────────────────────┘  │  │
│  └───────────────────────────┘  │
└───────────────┬─────────────────┘
                │ HTTPS
                ▼
┌─────────────────────────────────┐
│  Next.js Server                 │
│  ┌────────────┐ ┌────────────┐  │
│  │ API Routes │ │ SSE Events │  │
│  └──────┬─────┘ └────────────┘  │
│         │                       │
│  ┌──────▼─────────────────────┐ │
│  │ Notification Worker        │ │
│  │ → Web Push (VAPID)        │ │
│  │ → Firebase FCM (native)   │ │
│  └────────────────────────────┘ │
└─────────────────────────────────┘
```

## Push Notification Flow

1. **App opens** → Capacitor's `PushNotifications.register()` fires
2. **FCM returns token** → `registration` event fires with device token
3. **Token sent to server** → `POST /api/push/subscribe` with `{ platform: "android", deviceToken: "..." }`
4. **Server stores subscription** → `PushSubscription` model with `platform: "android"`
5. **Notification triggered** → worker calls `sendPushToUser()` → routes to FCM for native subs
6. **Device receives push** → Android notification channel `pillar-default` (IMPORTANCE_HIGH)
7. **User taps notification** → `pushNotificationActionPerformed` → navigates to `data.url`

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | For native push | Base64-encoded Firebase service account JSON |
| `CAPACITOR_SERVER_URL` | Build-time | Server URL for the WebView (default: `http://10.0.2.2:3000`) |

### Generating the Firebase Service Account

1. Go to [Firebase Console](https://console.firebase.google.com/) → Project Settings → Service Accounts
2. Click "Generate new private key" → download JSON
3. Base64-encode it:
   ```bash
   base64 -w0 firebase-service-account.json
   ```
4. Set as `FIREBASE_SERVICE_ACCOUNT_BASE64` environment variable

## Firebase Console Setup

1. Create a Firebase project (or use existing)
2. Add Android app with package name `com.pillar.app`
3. Download `google-services.json` → place in `android/app/`
4. Enable Cloud Messaging API (if not already enabled)

## Building the App

### Prerequisites
- Android Studio (for emulator and build tools)
- Java 17+
- `google-services.json` in `android/app/`

### Development

```bash
# Sync web assets and plugins
pnpm cap:sync

# Open in Android Studio
pnpm cap:open

# Or build from command line
cd android && ./gradlew assembleDebug
```

### Production

Update `capacitor.config.ts` with your production server URL:
```ts
server: {
  url: "https://pillar.example.com",
  androidScheme: "https",
}
```

Then sync and build:
```bash
pnpm cap:sync
cd android && ./gradlew assembleRelease
```

## Notification Channel

The app creates a `pillar-default` notification channel in `MainActivity.java` with `IMPORTANCE_HIGH`. This ensures notifications:
- Show as heads-up banners
- Play sound
- Show in the status bar

## Key Files

| File | Purpose |
|---|---|
| `capacitor.config.ts` | Capacitor config (remote URL, plugins) |
| `android/app/src/main/java/.../MainActivity.java` | Notification channel setup |
| `android/app/google-services.json` | Firebase config (gitignored) |
| `src/lib/firebase-admin.ts` | Firebase Admin SDK + FCM sender |
| `src/lib/capacitor.ts` | Platform detection utility |
| `src/hooks/use-native-push.ts` | Capacitor push bridge hook |
| `src/models/push-subscription.ts` | Extended with `platform` + `deviceToken` |
| `src/lib/web-push.ts` | Dual-path routing (Web Push + FCM) |
