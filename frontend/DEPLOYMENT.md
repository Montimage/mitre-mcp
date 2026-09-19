# Deployment Guide - MITRE ATT&CK Intelligence Assistant

This guide covers deploying the React frontend to various hosting platforms.

## Build Information

**Production Build Stats:**

- Total JavaScript: ~224 KB (~70 KB gzipped)
- CSS: 7.13 KB (1.61 KB gzipped)
- HTML: 0.64 KB (0.38 KB gzipped)
- **Total Size: ~72 KB gzipped**

## Prerequisites

Before deployment:

1. Build the production bundle: `npm run build`
2. Ensure mitre-mcp server is accessible (deployed or configured for users)
3. Configure CORS on mitre-mcp server if deploying to different domain

## Deployment Options

### Option 1: Netlify (Recommended)

**Steps:**

1. **Install Netlify CLI** (optional):

   ```bash
   npm install -g netlify-cli
   ```

2. **Build the project**:

   ```bash
   npm run build
   ```

3. **Deploy via CLI**:

   ```bash
   netlify deploy --prod --dir=dist
   ```

   Or **deploy via Netlify UI**:
   - Go to https://app.netlify.com/
   - Drag and drop the `dist` folder
   - Site will be live instantly

**Configuration:**

- Build command: `npm run build`
- Publish directory: `dist`
- No environment variables needed (runtime config via UI)

**Custom Domain:**

- Add custom domain in Netlify settings
- DNS will be configured automatically

### Option 2: Vercel

**Steps:**

1. **Install Vercel CLI**:

   ```bash
   npm install -g vercel
   ```

2. **Deploy**:

   ```bash
   vercel --prod
   ```

   Or **deploy via Vercel UI**:
   - Go to https://vercel.com/new
   - Import your Git repository
   - Configure build settings
   - Deploy

**Configuration:**

- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

### Option 3: GitHub Pages

**Automatic deployment** — `.github/workflows/pages.yml` builds the frontend
on every push to `main` that touches `frontend/` and publishes `dist/` via
`actions/deploy-pages`. The workflow sets `VITE_BASE_PATH=/mitre-mcp/`, which
`vite.config.js` reads as its `base` so all asset URLs resolve under the
project-site path.

**Steps:**

1. **Enable Pages** (one-time, repo admin):

   ```bash
   gh api -X POST repos/{owner}/{repo}/pages -f build_type=workflow
   ```

   Or via UI: Settings > Pages > Source: "GitHub Actions".

2. **Push to `main`** — the workflow deploys automatically. A manual run is
   also available via Actions > "Deploy to GitHub Pages" > Run workflow.

**Access:** `https://montimage.github.io/mitre-mcp/`

**Note:** the live site is static — the chat connects to whatever MCP server
the visitor configures in the settings dialog (default `localhost:8000`).

### Dedicated chat URL

The chat can be opened at full viewport size at the hash URL `#/chat`
(from the chat header's **Open in page** control, or by linking and
reloading directly). Example on GitHub Pages:

`https://montimage.github.io/mitre-mcp/#/chat`

This is distinct from `#chat`, which is the landing-page in-page embed
anchor (`id="chat"`). Navbar **Try it** still points at `#chat`.

Because the dedicated view is a hash route, it reloads on GitHub Pages
and Netlify without an extra SPA fallback (`404.html` or a rewrite of
unknown paths to `index.html`). A path route such as `/chat` is
intentionally not used yet: GitHub Pages project sites do not serve a
`404.html` SPA fallback, so a real `/chat` URL would 404 on reload.

### Option 4: Docker

**Create `Dockerfile`**:

```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Create `nginx.conf`**:

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Enable gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Serve static files
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache";
    }

    # Cache static assets
    location /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # CORS configuration (if needed)
    # add_header Access-Control-Allow-Origin *;
}
```

**Build and run**:

```bash
# Build image
docker build -t mitre-mcp-frontend .

# Run container
docker run -d -p 8080:80 mitre-mcp-frontend

# Access at http://localhost:8080
```

### Option 5: AWS S3 + CloudFront

**Steps:**

1. **Create S3 bucket**:

   ```bash
   aws s3 mb s3://mitre-mcp-frontend
   ```

2. **Configure bucket for static hosting**:

   ```bash
   aws s3 website s3://mitre-mcp-frontend \
     --index-document index.html \
     --error-document index.html
   ```

3. **Upload build files**:

   ```bash
   npm run build
   aws s3 sync dist/ s3://mitre-mcp-frontend --delete
   ```

4. **Set bucket policy** (make public):

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PublicReadGetObject",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::mitre-mcp-frontend/*"
       }
     ]
   }
   ```

5. **Create CloudFront distribution**:
   - Origin: S3 bucket
   - Enable HTTPS
   - Set default root object: `index.html`
   - Custom error response: 404 -> /index.html

### Option 6: Traditional Web Hosting

For shared hosting (cPanel, FTP):

1. **Build the project**:

   ```bash
   npm run build
   ```

2. **Upload `dist` folder contents** via FTP/SFTP to public_html or www directory

3. **Configure `.htaccess`** (for Apache):
   ```apache
   <IfModule mod_rewrite.c>
     RewriteEngine On
     RewriteBase /
     RewriteRule ^index\.html$ - [L]
     RewriteCond %{REQUEST_FILENAME} !-f
     RewriteCond %{REQUEST_FILENAME} !-d
     RewriteRule . /index.html [L]
   </IfModule>

   # Enable gzip compression
   <IfModule mod_deflate.c>
     AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript application/json
   </IfModule>
   ```

## Post-Deployment Configuration

### 1. MCP Server Access

Users need access to a running mitre-mcp server. Options:

**A. Self-hosted** (users run locally):

- Users run: `mitre-mcp --http --port 8000`
- Configure in UI: localhost:8000

**B. Deployed mitre-mcp server**:

- Deploy mitre-mcp to cloud (AWS, GCP, Azure)
- Expose via public URL with authentication
- Users configure: your-server.com:8000

**C. CORS Configuration** (if server on different domain):

Allow your frontend domain via the server's `MITRE_CORS_ORIGINS`
environment variable (credentials are never allowed):

```bash
MITRE_CORS_ORIGINS="https://your-frontend-domain.com,http://localhost:5173"
```

### 2. Environment Variables

If using environment variables (optional):

**Netlify/Vercel**:

- Add in dashboard: Settings > Environment Variables
- Example: `VITE_MCP_DEFAULT_HOST=api.example.com`

**GitHub Pages**:

- Not supported; users configure at runtime via UI

### 3. Custom Domain

**Netlify**:

```bash
netlify domains:add your-domain.com
```

**Vercel**:

```bash
vercel domains add your-domain.com
```

**GitHub Pages**:

- Add CNAME file to `public/` folder
- Configure DNS: CNAME record pointing to `yourusername.github.io`

### 4. HTTPS

All modern platforms (Netlify, Vercel, GitHub Pages) provide free SSL/TLS certificates automatically.

For custom deployments:

- Use Let's Encrypt: https://letsencrypt.org/
- Or cloud provider SSL (AWS Certificate Manager, etc.)

## Performance Optimization

### 1. Enable Compression

All platforms enable gzip/brotli by default. If using custom hosting, ensure compression is enabled.

### 2. CDN

Platforms like Netlify, Vercel automatically use global CDN.

For custom deployments, consider:

- Cloudflare (free tier available)
- AWS CloudFront
- Google Cloud CDN

### 3. Caching

Headers are configured in build process. For custom hosting:

**nginx**:

```nginx
location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
}

location / {
    add_header Cache-Control "no-cache";
}
```

**Apache (.htaccess)**:

```apache
<FilesMatch "\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2)$">
    Header set Cache-Control "max-age=31536000, public, immutable"
</FilesMatch>

<FilesMatch "index\.html$">
    Header set Cache-Control "no-cache, no-store, must-revalidate"
</FilesMatch>
```

## Monitoring

### Analytics (Optional)

Add analytics to track usage:

**Google Analytics**:

```javascript
// Add to index.html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

**Plausible** (privacy-friendly):

```html
<script
  defer
  data-domain="yourdomain.com"
  src="https://plausible.io/js/script.js"
></script>
```

### Error Tracking

**Sentry**:

```bash
npm install @sentry/react
```

```javascript
// In main.jsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "YOUR_SENTRY_DSN",
  environment: "production",
});
```

## Continuous Deployment

### GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: "18"

      - name: Install dependencies
        run: |
          cd frontend
          npm ci

      - name: Build
        run: |
          cd frontend
          npm run build

      - name: Deploy to Netlify
        uses: netlify/actions/cli@master
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
        with:
          args: deploy --dir=frontend/dist --prod
```

## Security Considerations

1. **API Keys**: Never commit API keys (OpenAI, etc.) to repository
2. **CORS**: Configure properly to only allow your domain
3. **CSP**: Add Content Security Policy headers
4. **HTTPS**: Always use HTTPS in production
5. **Rate Limiting**: Implement on mitre-mcp server side

## Troubleshooting

### Build Fails

**Issue**: Build errors with dependencies

```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Blank Page After Deployment

**Possible causes**:

1. Incorrect `base` in vite.config.js (GitHub Pages)
2. Missing `.htaccess` or nginx config for SPA routing
3. Build files not uploaded to correct directory

**Solution**: Check browser console for errors, verify file paths

### CORS Errors

**Issue**: Cannot connect to mitre-mcp server

**Solution**:

- Add CORS middleware to mitre-mcp server
- Or deploy both on same domain/subdomain
- Or use reverse proxy

### Slow Loading

**Solutions**:

- Enable CDN
- Verify compression enabled
- Check network waterfall in DevTools
- Consider code splitting (already optimized in Vite)

## Maintenance

### Updates

```bash
# Update dependencies
npm update

# Check for security vulnerabilities
npm audit

# Build and test
npm run build
npm run preview

# Deploy
# (use your deployment method)
```

### Backup

- Keep source code in Git repository
- Backup deployment configs
- Document custom configurations

## Cost Estimates

**Free Tier Options**:

- Netlify: 100GB bandwidth/month, unlimited sites
- Vercel: 100GB bandwidth/month
- GitHub Pages: Unlimited bandwidth for public repos
- Cloudflare Pages: Unlimited bandwidth

**Paid Options** (if exceeding free tier):

- Netlify Pro: $19/month
- Vercel Pro: $20/month
- AWS S3 + CloudFront: ~$1-5/month for small traffic

## Support

For deployment issues:

- Check platform-specific documentation
- Review build logs
- Test locally first: `npm run preview`
- Contact platform support if needed

---

**Recommended**: Start with Netlify or Vercel for easiest deployment with zero configuration.
