# Deployment Guide: DiscountVouchers.com

## Prerequisites

- Node.js 18+
- Cloudflare account with Workers enabled
- Wrangler CLI installed (`npm i -g wrangler`)

## Step 1: Cloudflare Setup

### Create Workers Account
```bash
wrangler login
# Opens browser to authenticate
```

### Create D1 Database
```bash
wrangler d1 create discountvouchers
# Returns: database_id = <YOUR_ID>
```

Copy the database ID into `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "discountvouchers"
database_id = "YOUR_ID"  # ← Paste here
```

## Step 2: Local Testing

```bash
# Install dependencies
npm install

# Build data
npm run build

# Start dev server
npm run dev

# Visit http://localhost:8787
```

Test endpoints:
- `GET /api/vouchers?q=test`
- `GET /api/merchants`
- `GET /api/top-merchants`

## Step 3: Database Schema

```bash
# Create tables locally first
wrangler d1 execute discountvouchers --file ./schema.sql --local

# For production
wrangler d1 execute discountvouchers --file ./schema.sql --remote
```

## Step 4: Seed Data

### Option A: Automatic (recommended)
```bash
bash deploy.sh
```

### Option B: Manual
```bash
# Seed merchants
wrangler d1 execute discountvouchers --file ./data/seed-merchants.sql --remote

# Seed vouchers
wrangler d1 execute discountvouchers --file ./data/seed-vouchers.sql --remote

# Verify
wrangler d1 shell discountvouchers --remote
> SELECT COUNT(*) FROM merchants;
> SELECT COUNT(*) FROM vouchers;
```

## Step 5: Deploy to Production

```bash
# Deploy Worker
wrangler deploy

# URL: https://discountvouchers.workers.dev
```

## Step 6: Custom Domain (Optional)

### Add Custom Domain to Workers
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Workers → discountvouchers → Settings → Routes
3. Add Route: `discountvouchers.com/*`
4. Zone: Select your zone
5. Save

Or via CLI:
```bash
wrangler publish --name discountvouchers --route "discountvouchers.com/*"
```

### DNS Setup
Add CNAME record in your DNS provider:
```
discountvouchers.com CNAME discountvouchers.workers.dev
```

## Monitoring & Debugging

### View Logs
```bash
# Real-time logs
wrangler tail discountvouchers

# Specific endpoint
wrangler tail discountvouchers --format json | grep "/api/vouchers"
```

### Query D1
```bash
# Connect to remote database
wrangler d1 shell discountvouchers --remote

# View top merchants
SELECT name, COUNT(*) as voucher_count FROM merchants m 
JOIN vouchers v ON m.id = v.merchant_id 
GROUP BY m.id ORDER BY voucher_count DESC LIMIT 10;

# Check expired vouchers
SELECT code, expiry_date FROM vouchers WHERE expiry_date < DATE('now');
```

### Analytics
Enable in Workers Analytics:
1. Dashboard → Workers → discountvouchers → Analyze Traffic
2. View requests, errors, latency

## Scaling & Performance

### Database Optimization
```sql
-- Verify indexes exist
SELECT * FROM pragma_index_list('vouchers');

-- Add more indexes if needed
CREATE INDEX idx_vouchers_date ON vouchers(scraped_at DESC);
CREATE INDEX idx_merchants_category_active ON merchants(category, is_active);
```

### Caching
Add cache headers to API responses:
```javascript
headers: {
  'Cache-Control': 'public, max-age=3600', // 1 hour
  'Content-Type': 'application/json'
}
```

### Rate Limiting
Implement rate limiting:
```javascript
const rateLimit = (limit = 100, window = 60000) => {
  const requests = new Map();
  return (req) => {
    const ip = req.headers.get('cf-connecting-ip');
    const now = Date.now();
    if (!requests.has(ip)) requests.set(ip, []);
    const userRequests = requests.get(ip).filter(t => now - t < window);
    if (userRequests.length >= limit) {
      return new Response('Too many requests', { status: 429 });
    }
    userRequests.push(now);
    requests.set(ip, userRequests);
  };
};
```

## Continuous Updates

### Scheduled Scraping
Set up a cron job to update vouchers:

```bash
# Option 1: Wrangler Cron (coming soon to D1)
# Configure in wrangler.toml:
# triggers = { crons = ["0 */6 * * *"] }  # Every 6 hours

# Option 2: External Cron Service
curl -X POST https://discountvouchers.workers.dev/api/scrape \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Add endpoint to `src/index.mjs`:
```javascript
router.post('/api/scrape', async (req, env) => {
  // Verify auth token
  const token = req.headers.get('Authorization');
  if (token !== `Bearer ${env.SCRAPE_TOKEN}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Run scraper (call scraper-advanced.mjs)
  // Update D1
  return new Response(JSON.stringify({ status: 'Scraping...' }));
});
```

### Manual Refresh
```bash
npm run build  # Rebuild data
wrangler d1 execute discountvouchers --file ./data/seed-vouchers.sql --remote
```

## Rollback

If something breaks in production:

```bash
# Revert to previous version
git checkout HEAD~1

# Redeploy
wrangler deploy

# Or delete database and reseed
wrangler d1 delete discountvouchers
wrangler d1 create discountvouchers
bash deploy.sh
```

## Environment Variables

Store secrets in `wrangler.toml`:
```toml
[env.production]
vars = { SCRAPE_TOKEN = "secret_token" }

[[r2_buckets]]
binding = "IMAGES"
bucket_name = "discountvouchers-images"
```

Access in worker:
```javascript
export default {
  fetch: (req, env) => {
    const token = env.SCRAPE_TOKEN;
    const images = env.IMAGES;
  }
}
```

## Costs

**Free Tier:**
- 100,000 requests/day
- Up to 3 D1 databases
- Limited storage

**Pricing:**
- Workers: $0.15 per 1M requests
- D1: $0.75 per 1GB storage, $1.25 per 1M read ops
- R2 (if using): $0.015/GB stored

**Estimate:** £5-15/month at scale (100k requests/day)

## Troubleshooting

### "Database not found"
```bash
wrangler d1 create discountvouchers --remote
wrangler d1 execute discountvouchers --file ./schema.sql --remote
```

### "Workers limit exceeded"
- Check request rate (should be <100 req/sec)
- Implement caching on expensive queries
- Use D1 pagination (LIMIT/OFFSET)

### "Timeout errors"
- Increase timeout in wrangler.toml:
  ```toml
  [build]
  cwd = "."
  command = "npm run build"
  watch_paths = ["src/**/*.mjs"]
  ```

### "Cannot find module"
```bash
npm install
npm audit fix
```

## Support

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [D1 Documentation](https://developers.cloudflare.com/d1/)
- [Wrangler CLI](https://developers.cloudflare.com/wrangler/)
