# Google OAuth Setup Guide

## Current Status
✅ Code updated to handle mobile OAuth properly
✅ Dependencies installed (`expo-auth-session`, `expo-web-browser`)
✅ URL scheme configured (`orcamath`)

## Setup Steps

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API (if not already enabled)

### 2. Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
3. Choose **Web application**
4. Set **Name**: "OrcaMath Web"
5. Under **Authorized redirect URIs**, add:
   ```
   https://rkukjujwpmimamapxhtg.supabase.co/auth/v1/callback
   ```
6. Click **CREATE**
7. **Copy** the Client ID and Client Secret

### 3. Configure Supabase

1. Open your Supabase project: https://rkukjujwpmimamapxhtg.supabase.co
2. Go to **Authentication** → **Providers**
3. Find **Google** and click **Enable**
4. Paste your Google **Client ID** and **Client Secret**
5. Under **Redirect URLs**, add:
   ```
   https://rkukjujwpmimamapxhtg.supabase.co/auth/v1/callback
   orcamath://auth/callback
   ```
6. Click **Save**

### 4. Rebuild the App

Since we added new native modules, you need to rebuild:

```bash
# Install new dependencies (already done)
npm install

# Rebuild the app
npx expo prebuild --clean

# Run on your device
npx expo run:ios --device
```

### 5. Test Google Sign-In

1. Open the app on your device
2. Tap **Continue with Google**
3. A browser window should open
4. Select your Google account
5. Authorize the app
6. You'll be redirected back to the app
7. Check the console logs for "🔗 Redirect URL"

## How It Works

```
1. User taps "Continue with Google"
   ↓
2. App requests OAuth URL from Supabase
   ↓
3. Opens system browser with Google sign-in
   ↓
4. User signs in and authorizes
   ↓
5. Google redirects to: orcamath://auth/callback?access_token=...
   ↓
6. App captures the tokens and sets session
   ↓
7. User is logged in!
```

## Troubleshooting

### "Continue with Google" does nothing
**Solution**: Check these in order:
1. Run `npx expo prebuild --clean` to rebuild native modules
2. Check console for errors
3. Verify Google OAuth credentials in Supabase
4. Make sure redirect URLs match exactly

### Browser opens but shows error
**Possible causes**:
- ❌ Wrong redirect URI in Google Cloud Console
- ❌ Google provider not enabled in Supabase
- ❌ Client ID/Secret mismatch

**Fix**: Double-check all URLs and credentials match

### Redirects but doesn't log in
**Possible causes**:
- ❌ URL scheme mismatch (must be `orcamath://`)
- ❌ `expo-web-browser` not installed properly

**Fix**:
```bash
npm install expo-web-browser expo-auth-session
npx expo prebuild --clean
```

### iOS: "Invalid scheme" error
**Fix**: Make sure `scheme: "orcamath"` is in `app.json`:
```json
{
  "expo": {
    "scheme": "orcamath"
  }
}
```
Already configured! ✅

## Testing Without Google OAuth

If you don't want to set up Google OAuth yet, users can still:
- Sign up with email/password
- Use the app fully
- Set up Google OAuth later

Email/password auth works immediately without any additional setup! 🎉

## Redirect URL Reference

Your app uses:
- **Supabase URL**: `https://rkukjujwpmimamapxhtg.supabase.co`
- **Callback URL**: `https://rkukjujwpmimamapxhtg.supabase.co/auth/v1/callback`
- **Mobile Scheme**: `orcamath://auth/callback`

Add ALL of these to both Google Cloud Console and Supabase!


