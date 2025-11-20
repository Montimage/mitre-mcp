# Netlify Deployment Guide

Quick guide to deploy the MITRE ATT&CK Intelligence Assistant to Netlify.

## Prerequisites

1. **Netlify Account**: Sign up at https://netlify.com
2. **Node.js**: Version 18 or higher
3. **Git**: Repository should be pushed to GitHub/GitLab/Bitbucket

## Method 1: Automated Deployment Script (Recommended)

### Step 1: Install Netlify CLI

```bash
npm install -g netlify-cli
```

### Step 2: Run Deployment Script

```bash
cd frontend
./deploy.sh
```

The script will:
- Install dependencies
- Build the production bundle
- Prompt for deployment confirmation
- Deploy to Netlify

### Step 3: First-Time Setup

On first deployment, you'll be asked:

```
? What would you like to do?
  Create & configure a new site
```

Choose "Create & configure a new site" and follow prompts:
- **Team**: Select your team
- **Site name**: Choose a unique name (e.g., `mitre-attack-assistant`)
- **Production deploy**: Confirm

Your site will be available at: `https://[site-name].netlify.app`

## Method 2: Manual Deployment via CLI

### Step 1: Build the Project

```bash
cd frontend
npm install
npm run build
```

### Step 2: Deploy

**Production deployment:**
```bash
netlify deploy --prod --dir=dist
```

**Draft/Preview deployment:**
```bash
netlify deploy --dir=dist
```

## Method 3: Deploy via Netlify UI (Drag & Drop)

### Step 1: Build

```bash
cd frontend
npm install
npm run build
```

### Step 2: Deploy

1. Go to https://app.netlify.com/
2. Click "Add new site" > "Deploy manually"
3. Drag and drop the `dist` folder
4. Your site deploys instantly!

## Method 4: Continuous Deployment from Git

### Step 1: Push to Git

```bash
git add .
git commit -m "feat: Add MITRE ATT&CK web interface"
git push origin main
```

### Step 2: Connect to Netlify

1. Go to https://app.netlify.com/
2. Click "Add new site" > "Import an existing project"
3. Choose your Git provider (GitHub, GitLab, Bitbucket)
4. Select your repository
5. Configure build settings:
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `frontend/dist`
6. Click "Deploy site"

### Auto-Deploy

Every push to your main branch will automatically trigger a new deployment.

## Configuration

### Site Settings

After deployment, configure:

1. **Custom Domain** (optional):
   - Site settings > Domain management
   - Add custom domain
   - Configure DNS

2. **Environment Variables** (if needed):
   - Site settings > Environment variables
   - Add: `NODE_VERSION = 18`

3. **Build Settings** (verify):
   - Base directory: `frontend`
   - Build command: `npm run build`
   - Publish directory: `frontend/dist`

### Netlify Configuration

The project includes `netlify.toml` at the root with optimal settings:

```toml
[build]
  command = "npm run build"
  publish = "dist"
  base = "frontend"

[build.environment]
  NODE_VERSION = "18"

# SPA redirect - serves index.html for all routes
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

## Testing the Deployed Site

### 1. Verify Deployment

After deployment, visit your site URL:
```
https://[your-site-name].netlify.app
```

### 2. Check All Sections

- ✅ Hero section loads correctly
- ✅ Features section displays
- ✅ Playbooks section is interactive
- ✅ Chat section renders
- ✅ Footer links work

### 3. Test Functionality

**Configure MCP Server:**
1. Click "⚙️ Configure" in chatbox
2. Enter your server address (if different from localhost:8000)
3. Click "Test Connection"
4. Click "Save"

**Try Example Queries:**
1. Click on a playbook scenario
2. Copy an example query
3. Paste into chatbox
4. Send query

**Note**: Users will need their own mitre-mcp server running locally or deployed.

## MCP Server for Public Access

For a fully functional public demo, you have two options:

### Option A: Users Run Local Server (Recommended)

Clear instructions are provided in the app:
1. Install: `pip install mitre-mcp`
2. Run: `mitre-mcp --http --port 8000`
3. Configure in UI: `localhost:8000`

### Option B: Deploy MCP Server

Deploy mitre-mcp server to a public endpoint:

1. **Deploy Options**:
   - AWS EC2/ECS
   - Google Cloud Run
   - Heroku
   - DigitalOcean

2. **Enable CORS**:
   ```python
   # Add to mitre_mcp_server.py
   from starlette.middleware.cors import CORSMiddleware

   app.add_middleware(
       CORSMiddleware,
       allow_origins=["https://your-site.netlify.app"],
       allow_credentials=True,
       allow_methods=["*"],
       allow_headers=["*"],
   )
   ```

3. **Update Default Config**:
   - Site settings > Environment variables
   - Add: `VITE_MCP_DEFAULT_HOST=your-server.com`
   - Add: `VITE_MCP_DEFAULT_PORT=8000`

## Build & Deploy Commands

### Production Deployment

```bash
# Full deployment
cd frontend
./deploy.sh

# Or manually
npm run build
netlify deploy --prod --dir=dist
```

### Preview/Draft Deployment

```bash
npm run build
netlify deploy --dir=dist
```

### Local Preview

```bash
# Preview production build locally
npm run build
npm run preview
# Access at http://localhost:4173
```

## Troubleshooting

### Build Fails

**Error**: "Build failed with exit code 1"

**Solution**:
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

### 404 on Routes

**Error**: Page refreshes result in 404

**Solution**: Already configured in `netlify.toml` with SPA redirect

### CORS Errors

**Error**: "CORS policy: No 'Access-Control-Allow-Origin'"

**Solution**:
1. Enable CORS in mitre-mcp server
2. Or deploy frontend and server on same domain

### Large Bundle Size

**Warning**: "Bundle size exceeds recommendation"

**Current size**: ~72 KB gzipped (excellent!)

To further optimize:
```bash
npm run build -- --mode production
```

## Performance Optimization

Netlify automatically provides:

- ✅ **Global CDN**: Content served from nearest edge location
- ✅ **Compression**: Automatic gzip/brotli compression
- ✅ **HTTP/2**: Faster page loads
- ✅ **SSL/TLS**: Free HTTPS certificate
- ✅ **Build optimization**: Production build settings

## Monitoring

### Netlify Analytics (Optional)

Enable in Site settings > Analytics:
- Page views
- Unique visitors
- Top pages
- Traffic sources

### Custom Analytics

Add Google Analytics or Plausible:

1. Edit `index.html` in `public/` folder
2. Add analytics script before `</head>`
3. Rebuild and redeploy

## Custom Domain Setup

### 1. Add Domain in Netlify

Site settings > Domain management > Add custom domain

### 2. Configure DNS

**Option A: Netlify DNS** (recommended):
- Transfer DNS to Netlify for automatic setup

**Option B: External DNS**:
```
CNAME: www.yourdomain.com -> [site-name].netlify.app
A Record: yourdomain.com -> (Netlify IP from docs)
```

### 3. Enable HTTPS

Automatically enabled for custom domains (Let's Encrypt).

## Cost

**Netlify Free Tier**:
- 100 GB bandwidth/month
- 300 build minutes/month
- Unlimited sites
- Free SSL

**Perfect for**: Personal projects, demos, documentation

**Upgrade if needed**: Pro plan $19/month for higher limits

## Support & Resources

- **Netlify Docs**: https://docs.netlify.com/
- **Netlify Community**: https://answers.netlify.com/
- **Status**: https://netlifystatus.com/

## Quick Reference

```bash
# Install CLI
npm install -g netlify-cli

# Login
netlify login

# Build
cd frontend && npm run build

# Deploy (draft)
netlify deploy --dir=dist

# Deploy (production)
netlify deploy --prod --dir=dist

# Open dashboard
netlify open

# View logs
netlify logs

# Unlink site
netlify unlink
```

## Next Steps

After successful deployment:

1. ✅ Share the URL with users
2. ✅ Add to README.md
3. ✅ Set up custom domain (optional)
4. ✅ Configure analytics (optional)
5. ✅ Set up continuous deployment from Git

---

**Deployment successful!** 🎉

Your MITRE ATT&CK Intelligence Assistant is now live and accessible worldwide.
