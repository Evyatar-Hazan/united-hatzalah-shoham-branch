# Deployment Guide

## Frontend - Netlify

### Prerequisites
- GitHub account
- Netlify account (free tier available)
- Frontend repository pushed to GitHub

### Step 1: Connect to Netlify
1. Go to [netlify.com](https://netlify.com)
2. Sign in with GitHub
3. Click "New site from Git"
4. Select your GitHub repository
5. Authorize Netlify to access your GitHub

### Step 2: Configure Build Settings
**Build Command:** `npm run build`
**Publish Directory:** `dist`
**Node Version:** 20

### Step 3: Set Environment Variables
In Netlify Dashboard → Site Settings → Build & Deploy → Environment:

```
VITE_API_URL=https://your-backend-api.onrender.com
```

### Step 4: Deploy
- Netlify automatically deploys on every push to `main` branch
- Builds take ~2-3 minutes
- Your site will be available at `https://your-site.netlify.app`

### Custom Domain
1. Go to Site Settings → Domain Management
2. Add custom domain (requires DNS setup)

---

## Backend - Render

### Prerequisites
- GitHub account
- Render account (free tier available)
- Backend repository pushed to GitHub

### Step 1: Connect to Render
1. Go to [render.com](https://render.com)
2. Sign in with GitHub
3. Click "New +" → Web Service
4. Select your GitHub repository

### Step 2: Configure Service
**Name:** `united-hatzalah-api`
**Runtime:** Node 20
**Build Command:** `npm run build`
**Start Command:** `npm start`
**Region:** Virginia (us-east-1) or closest to users

### Step 3: Set Environment Variables
In Render Dashboard → Environment:

```
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://your-site.netlify.app
```

### Step 4: Deploy
- Render automatically deploys on every push to `main` branch
- Initial build takes ~3-5 minutes
- Your API will be available at `https://your-backend.onrender.com`

### Important Notes
- Free tier has 15-minute sleep if inactive (API will wake up on request)
- To keep alive, upgrade to paid plan or use external monitoring
- Monitor logs: Dashboard → Logs tab

---

## Environment Variables Summary

### Frontend (.env.local)
```
VITE_API_URL=https://your-backend-api.onrender.com
```

### Backend (.env)
```
PORT=5000
NODE_ENV=production
FRONTEND_URL=https://your-site.netlify.app
```

---

## Post-Deployment Checklist

- [ ] Frontend deployed to Netlify
- [ ] Backend deployed to Render
- [ ] Environment variables configured
- [ ] CORS working (test API from frontend)
- [ ] HTTPS enabled on both services
- [ ] Custom domain configured (optional)
- [ ] Monitoring setup (optional)
- [ ] Database backup strategy (when DB integrated)

---

## Troubleshooting

### Frontend Build Fails
- Check Node version (should be 20+)
- Run `npm run build` locally to test
- Check `.env` is not in git
- Verify `dist` directory is created

### Backend Deployment Issues
- Check `npm run build` succeeds locally
- Verify environment variables are set
- Check port is correctly set to 5000
- Review Render logs for errors

### CORS Issues
- Verify `FRONTEND_URL` in backend env vars
- Check that frontend makes requests to correct API URL
- Ensure backend has CORS middleware configured

### API Not Responding
- Check if Render service is awake (free tier sleeps after 15 min)
- Verify backend is running: `curl https://your-backend.onrender.com/api/health`
- Check Render logs for errors
