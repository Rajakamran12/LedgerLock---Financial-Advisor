# LedgerLock - Vercel Deployment Guide

This document explains how to deploy LedgerLock on Vercel.

## Prerequisites

- GitHub account with the LedgerLock repository pushed
- Vercel account (https://vercel.com)

## Deployment Steps

### 1. Connect GitHub to Vercel

1. Go to https://vercel.com/dashboard
2. Click "Add New..." → "Project"
3. Click "Import Git Repository"
4. Paste: `https://github.com/Rajakamran12/LedgerLock---Financial-Advisor.git`
5. Click "Continue"

### 2. Configure Project

- **Project Name**: `ledger-lock-financial-advisor`
- **Framework Preset**: Next.js (auto-detected)
- **Root Directory**: `./frontend` (auto-detected via vercel.json)
- **Build Command**: `npm run build` (auto-filled)
- **Environment**: Leave as default

### 3. Set Environment Variables

Before clicking "Deploy", add these in the "Environment Variables" section:

**Required Variables:**

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
UPSTASH_REDIS_REST_URL=your_upstash_redis_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token
AGENT_API_KEY=your_gemini_or_agent_api_key
AGENT_URL=https://your-backend-service.onrender.com (or localhost for testing)
NEXT_PUBLIC_APP_URL=https://ledger-lock-financial-advisor.vercel.app
```

### 4. Deploy

1. Click the **"Deploy"** button
2. Wait for the build to complete (usually 1-3 minutes)
3. Once "Ready", your app is live!

### 5. Get Environment Variable Values

**Supabase:**
- Go to https://supabase.com → Your Project → Settings → API
- Copy: Project URL, Publishable Key, Service Role Key

**Upstash (Redis):**
- Go to https://console.upstash.com → Select Redis database → REST API
- Copy: REST URL and Token

**Agent/Gemini API:**
- Use your Gemini API key from Google Cloud Console
- Or use your deployed backend service URL

## Files in This Deployment

- `vercel.json` - Vercel configuration (specifies root directory as `./frontend`)
- `frontend/.env.production` - Production environment file (template with placeholders)
- `frontend/.gitignore` - Git ignore file (prevents committing secrets)

## After Deployment

### Automatic Deployments

- Every push to `main` → Auto-deploys to production
- Pull requests → Creates preview deployments

### Monitoring

1. Visit your live URL: https://ledger-lock-financial-advisor.vercel.app
2. Test public routes: `/`, `/login`, `/sign-up`
3. Check Vercel dashboard → Deployments → Logs for any errors

### Backend Deployment

For the Python agent backend, deploy separately to:
- **Render** (recommended): https://render.com
- **Railway**: https://railway.app
- **Fly.io**: https://fly.io

Then update `AGENT_URL` env variable with your backend service URL.

## Troubleshooting

### 404 Error

- Verify `vercel.json` contains `"rootDirectory": "frontend"`
- Check Vercel logs for build errors
- Ensure all environment variables are set

### Build Failures

1. Go to Vercel Dashboard → Deployments
2. Click latest deployment
3. Check "Build Logs" for errors
4. Common issues:
   - Missing environment variables
   - Node modules dependency conflicts
   - TypeScript compilation errors

### Environment Variables Not Loading

- Verify variables are set in Vercel Settings → Environment Variables
- Ensure `NEXT_PUBLIC_` prefix for client-side variables
- Redeploy after adding new variables

## Support

For issues, check:
- Vercel Documentation: https://vercel.com/docs
- Next.js Documentation: https://nextjs.org/docs
- LedgerLock GitHub: https://github.com/Rajakamran12/LedgerLock---Financial-Advisor
