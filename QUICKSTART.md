# DiscountVouchers - Quick Start Setup

**Status**: Live at https://discountvouchers.rewardspy.workers.dev

## What's Built

✅ **Site Repo** (dougs123/discountvouchers-site)
- CF Worker + Frontend
- D1 Database (4,999 merchants, 1,964 vouchers)
- GitHub Actions CI/CD configured
- Google Analytics & GSC ready

✅ **Harvest Repo** (dougs123/discountvouchers-harvest)
- Advanced scraper pipeline
- Merchant data
- Ready for continuous updates

## One-Time Setup (5 min)

### 1. Get Cloudflare Credentials

Go to: https://dash.cloudflare.com/profile/api-tokens

**Option A: Use Existing Token**
- Look for token with "Account.D1" + "Account.Workers Scripts" permissions
- Example: "Workers Builds" or "recycle-co-uk-github-deploy"
- Copy the token value

**Option B: Create New Token**
- Click "Create Token"
- Template: "Edit Cloudflare Workers"
- Permissions:
  - Account.D1 Database (Edit)
  - Account.Workers Scripts (Edit)
- Resources: All accounts
- TTL: 1 year
- Click Create

### 2. Get Account ID

In same page or via: https://dash.cloudflare.com/
- Sidebar → Account ID (copy it)
- Example: a1b2c3d4e5f6g7h8...

### 3. Add GitHub Secrets

Go to: https://github.com/dougs123/discountvouchers-site/settings/secrets/actions

Click "New repository secret" twice:

**Secret 1:**
- Name: `CLOUDFLARE_API_TOKEN`
- Value: (paste token from step 1)

**Secret 2:**
- Name: `CLOUDFLARE_ACCOUNT_ID`
- Value: (paste account ID from step 2)

Click "Add secret" for each.

### 4. Test Deployment

```bash
cd ~/DiscountVouchers
echo "# Test deploy" >> README.md
git add README.md
git commit -m "Test GitHub Actions deployment"
git push
```

Go to: https://github.com/dougs123/discountvouchers-site/actions

Wait for green ✅ (takes ~30-60 sec)

Then verify: https://discountvouchers.rewardspy.workers.dev

## Next Steps

### Today
- [ ] Add Cloudflare secrets (5 min)
- [ ] Test deployment (2 min)
- [ ] Verify site live

### Week 1
- [ ] Add Google Analytics 4 property
  - Get Measurement ID (G-XXXXXXXXXX)
  - Update line 148 in src/index.mjs
  - Push to deploy
  - Check GA real-time in 5 min
  
- [ ] Add Google Search Console
  - Get verification code
  - Update line 147 in src/index.mjs
  - Push to deploy
  - Verify in GSC

- [ ] Start link building (docs/LINK_BUILDING.md)
  - Submit to Reddit, Forums, Deal aggregators
  - Target 50+ backlinks Month 1

### Week 2
- [ ] Run scraper for live vouchers
  ```bash
  cd ~/discountvouchers-harvest
  npm install
  node scraper-advanced.mjs
  # Output: data/scraped-vouchers.sql
  wrangler d1 execute discountvouchers --file ./data/scraped-vouchers.sql --remote
  ```

- [ ] Set up continuous scraping (6-hour cron)

### Week 3+
- [ ] Code validation (test if codes work)
- [ ] Email newsletter setup
- [ ] Merchant listings sales outreach
- [ ] Monitor GA/GSC metrics

## File Structure

```
~/DiscountVouchers/          # Site repo (GitHub: dougs123/discountvouchers-site)
├── src/index.mjs            # Worker + frontend
├── schema.sql               # D1 schema
├── data/                    # Merchant/voucher seed data
├── docs/                    # Setup guides
├── .github/workflows/       # GitHub Actions CI/CD
└── wrangler.toml           # Cloudflare config

~/discountvouchers-harvest/  # Harvest repo (GitHub: dougs123/discountvouchers-harvest)
├── scraper-advanced.mjs     # Advanced scraper
├── merchants.json           # 5000 merchants
└── package.json
```

## Useful Commands

```bash
# Local development
cd ~/DiscountVouchers
npm run dev                  # Start local server on http://localhost:8787

# Check database
wrangler d1 shell discountvouchers --remote
> SELECT COUNT(*) FROM vouchers;
> SELECT COUNT(*) FROM merchants;

# View logs
wrangler tail discountvouchers

# Rebuild data
npm run build

# Deploy manually (if needed)
wrangler deploy

# Push changes (triggers GitHub Actions auto-deploy)
git add .
git commit -m "your message"
git push
```

## API Endpoints

```bash
# Search vouchers
curl https://discountvouchers.rewardspy.workers.dev/api/vouchers?q=asos&limit=5

# Get categories
curl https://discountvouchers.rewardspy.workers.dev/api/merchants

# Top merchants
curl https://discountvouchers.rewardspy.workers.dev/api/top-merchants

# Get voucher by code
curl https://discountvouchers.rewardspy.workers.dev/api/voucher/SAVE20
```

## Troubleshooting

**Site not loading?**
```bash
wrangler tail discountvouchers
# Check logs for errors
```

**Database query fails?**
```bash
wrangler d1 shell discountvouchers --remote
> SELECT * FROM merchants LIMIT 1;
```

**GitHub Actions not deploying?**
- Check: https://github.com/dougs123/discountvouchers-site/actions
- Verify secrets are set (Settings → Secrets)
- Check wrangler.toml database_id matches

## Support

- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [D1 Database](https://developers.cloudflare.com/d1/)
- [GitHub Actions](https://docs.github.com/en/actions)
- [Wrangler CLI](https://developers.cloudflare.com/wrangler/)

---

**Version**: 1.0.0  
**Last Updated**: 2026-07-15  
**Status**: ✅ Live and Deployed
