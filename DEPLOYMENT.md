# Production Deployment Guide

## Overview

To make your app work on any network, you need to:
1. ✅ Deploy the FastAPI backend to a cloud service
2. ✅ Update app configuration to use production URLs
3. ✅ Build and distribute the app

---

## Part 1: Deploy Backend (FastAPI Server)

### Option A: Railway (Recommended - Easiest) 🚂

**Why Railway?**
- Free tier available
- Automatic HTTPS
- Easy deployment from GitHub
- Environment variables UI
- Fast and reliable

**Steps:**

1. **Prepare your backend for deployment**

Create `server/Procfile`:
```
web: uvicorn app:app --host 0.0.0.0 --port $PORT
```

2. **Sign up for Railway**
   - Go to [railway.app](https://railway.app)
   - Sign up with GitHub

3. **Create New Project**
   - Click "New Project"
   - Choose "Deploy from GitHub repo"
   - Select your `handwriting-orca-math` repository
   - Set root directory to `server`

4. **Configure Environment Variables**
   In Railway dashboard → Variables, add:
   ```
   OPENAI_API_KEY=your-openai-key-here
   MATHPIX_APP_ID=your-mathpix-app-id
   MATHPIX_APP_KEY=your-mathpix-app-key
   ```

5. **Deploy**
   - Railway will auto-detect FastAPI and deploy
   - You'll get a URL like: `https://your-app.railway.app`

6. **Update CORS in server/app.py**
   ```python
   app.add_middleware(
       CORSMiddleware,
       allow_origins=[
           "https://rkukjujwpmimamapxhtg.supabase.co",
           "*"  # For mobile app - tighten this in production
       ],
       allow_credentials=True,
       allow_methods=["*"],
       allow_headers=["*"],
   )
   ```

---

### Option B: Render 🎨

**Steps:**

1. **Create `server/render.yaml`**:
```yaml
services:
  - type: web
    name: orcamath-api
    env: python
    buildCommand: "pip install -r requirements.txt"
    startCommand: "uvicorn app:app --host 0.0.0.0 --port $PORT"
    envVars:
      - key: OPENAI_API_KEY
        sync: false
      - key: MATHPIX_APP_ID
        sync: false
      - key: MATHPIX_APP_KEY
        sync: false
```

2. **Deploy to Render**
   - Go to [render.com](https://render.com)
   - New → Web Service
   - Connect GitHub repo
   - Set root directory: `server`
   - Click "Create Web Service"

3. **Add Environment Variables** in Render dashboard

---

### Option C: Fly.io 🪁

**Steps:**

1. **Install Fly CLI**:
```bash
curl -L https://fly.io/install.sh | sh
```

2. **Create `server/fly.toml`**:
```toml
app = "orcamath-api"

[build]
  builder = "paketobuildpacks/builder:base"

[env]
  PORT = "8080"

[[services]]
  http_checks = []
  internal_port = 8080
  processes = ["app"]
  protocol = "tcp"

  [[services.ports]]
    force_https = true
    handlers = ["http"]
    port = 80

  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443
```

3. **Deploy**:
```bash
cd server
fly launch
fly secrets set OPENAI_API_KEY=your-key
fly secrets set MATHPIX_APP_ID=your-id
fly secrets set MATHPIX_APP_KEY=your-key
fly deploy
```

---

## Part 2: Update App Configuration

### Update `app.json`

Replace the local IP with your production backend URL:

```json
{
  "expo": {
    "extra": {
      "expoPublic": {
        "SUPABASE_URL": "https://rkukjujwpmimamapxhtg.supabase.co",
        "SUPABASE_ANON_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "MATHPIX_PROXY_URL": "https://your-app.railway.app/recognize",
        "LLM_API_URL": "https://your-app.railway.app/validate"
      }
    }
  }
}
```

### Test the Backend

```bash
# Test recognition endpoint
curl -X POST https://your-app.railway.app/recognize \
  -H "Content-Type: application/json" \
  -d '{"image_base64": "test"}'

# Test validation endpoint
curl -X POST https://your-app.railway.app/validate \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is 2+2?",
    "expectedAnswer": "4",
    "priorSteps": [],
    "currentStep": "2+2=4"
  }'
```

---

## Part 3: Build & Distribute the App

### Development Build (For Testing)

```bash
# Rebuild with production URLs
npx expo prebuild --clean

# Build for iOS
npx expo run:ios --device

# Build for Android
npx expo run:android --device
```

### Production Build

#### Option 1: EAS Build (Recommended)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure EAS
eas build:configure

# Build for iOS
eas build --platform ios --profile production

# Build for Android
eas build --platform android --profile production
```

#### Option 2: TestFlight (iOS)

1. **Set up App Store Connect**
   - Create an Apple Developer account ($99/year)
   - Create an app in App Store Connect

2. **Upload to TestFlight**
```bash
eas build --platform ios --profile production
eas submit --platform ios
```

3. **Invite Testers**
   - In App Store Connect → TestFlight
   - Add internal/external testers

#### Option 3: Google Play Console (Android)

1. **Create Google Play Developer account** ($25 one-time)

2. **Upload to Internal Testing**
```bash
eas build --platform android --profile production
eas submit --platform android
```

---

## Part 4: Environment-Based Configuration (Advanced)

For different environments (dev, staging, prod):

### Create `app.config.js`

```javascript
const IS_DEV = process.env.APP_VARIANT === 'development';
const IS_STAGING = process.env.APP_VARIANT === 'staging';

export default {
  expo: {
    name: IS_DEV ? 'OrcaMath (Dev)' : 'OrcaMath',
    slug: 'handwriting-orca-math',
    extra: {
      expoPublic: {
        SUPABASE_URL: 'https://rkukjujwpmimamapxhtg.supabase.co',
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
        MATHPIX_PROXY_URL: IS_DEV
          ? 'http://192.168.1.112:5056/recognize'
          : 'https://your-app.railway.app/recognize',
        LLM_API_URL: IS_DEV
          ? 'http://192.168.1.112:5056/validate'
          : 'https://your-app.railway.app/validate',
      },
    },
  },
};
```

### Use it:
```bash
# Development
APP_VARIANT=development npx expo start

# Production
APP_VARIANT=production eas build --platform ios
```

---

## Part 5: Backend Health & Monitoring

### Add Health Check Endpoint

Add to `server/app.py`:

```python
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0"
    }
```

### Monitor Your Backend

Railway provides:
- Automatic logs
- Metrics dashboard
- Alerts

Set up monitoring at: Railway Dashboard → Your Service → Metrics

---

## Part 6: Security Hardening

### 1. Add API Key Authentication (Optional but Recommended)

Add to `server/app.py`:

```python
from fastapi import Header, HTTPException

API_KEY = os.getenv("API_KEY", "your-secret-key")

async def verify_api_key(x_api_key: str = Header(None)):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return x_api_key

@app.post("/recognize", dependencies=[Depends(verify_api_key)])
async def recognize_endpoint(request: RecognitionRequest):
    # ... existing code
```

Update client code to include API key:

```typescript
// src/mathpix.ts
const response = await fetch(proxyUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-secret-key', // Add to env vars
  },
  body: JSON.stringify({ image_base64: imageBase64 }),
});
```

### 2. Rate Limiting

Add to `server/requirements.txt`:
```
slowapi>=0.1.8
```

Add to `server/app.py`:
```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.post("/recognize")
@limiter.limit("10/minute")
async def recognize_endpoint(request: Request, body: RecognitionRequest):
    # ... existing code
```

### 3. HTTPS Only

All cloud providers (Railway, Render, Fly.io) provide automatic HTTPS. Make sure to:
- Never use `http://` in production
- Always use `https://` for backend URLs

---

## Quick Start Deployment Checklist

- [ ] Sign up for Railway (or Render/Fly.io)
- [ ] Push your code to GitHub
- [ ] Deploy backend from GitHub
- [ ] Add environment variables (OPENAI_API_KEY, MATHPIX_APP_ID, MATHPIX_APP_KEY)
- [ ] Get your production URL (e.g., `https://your-app.railway.app`)
- [ ] Update `app.json` with production URLs
- [ ] Test backend endpoints with curl
- [ ] Rebuild app: `npx expo prebuild --clean`
- [ ] Test on device: `npx expo run:ios --device`
- [ ] (Optional) Set up EAS Build for distribution

---

## Cost Estimates

**Backend Hosting:**
- Railway: $5-20/month (free tier available)
- Render: $7+/month (free tier available but slow)
- Fly.io: $5-15/month (generous free tier)

**App Distribution:**
- Apple Developer: $99/year (for iOS)
- Google Play: $25 one-time (for Android)
- EAS Build: Free for personal use

**APIs:**
- OpenAI GPT-4o: ~$5-50/month depending on usage
- Mathpix: Check their pricing
- Supabase: Free tier is very generous

**Total estimated monthly cost:** $20-100/month

---

## Recommended Path

1. **Deploy to Railway** (15 minutes)
2. **Update app.json** (2 minutes)
3. **Test on device** (5 minutes)
4. **Share via TestFlight** (optional, 30 minutes)

Railway is the fastest and easiest for getting started!

