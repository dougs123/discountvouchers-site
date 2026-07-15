# GitHub Setup - DiscountVouchers

## Create Two Repos (Like Rockhopping)

### 1. discountvouchers-site (This repo)
Go to https://github.com/new
- Repository name: `discountvouchers-site`
- Description: "DiscountVouchers Worker + Frontend"
- Public
- DO NOT initialize with README

Then:
```bash
cd ~/DiscountVouchers
git remote add origin https://github.com/dougs123/discountvouchers-site.git
git branch -M main
git push -u origin main
```

### 2. discountvouchers-harvest (Scraper Pipeline)
Create new repo at https://github.com/new
- Repository name: `discountvouchers-harvest`
- Description: "DiscountVouchers Data Pipeline & Scraper"
- Public

Then:
```bash
mkdir -p ~/discountvouchers-harvest
cd ~/discountvouchers-harvest
git init
git remote add origin https://github.com/dougs123/discountvouchers-harvest.git

# Copy scripts to harvest repo
cp ~/DiscountVouchers/scripts/scraper-advanced.mjs .
cp ~/DiscountVouchers/data/merchants.json .

# Create harvest README
cat > README.md << 'EOF'
# DiscountVouchers Harvest

Data pipeline and scraper for DiscountVouchers.com

## Scripts
- `scraper-advanced.mjs` — Scrape vouchers from merchant sites + aggregators
- `merchants.json` — Master merchant list (5,000 merchants)

## Usage
```bash
npm install
node scraper-advanced.mjs
```

Output goes to `data/scraped-vouchers.sql` → load into D1
EOF

# Add to site repo
cat > .gitignore << 'EOF'
node_modules/
data/*.sql
*.log
.env
EOF

git add .
git commit -m "Initial discountvouchers-harvest setup"
git push -u origin main
```

## GitHub + Cloudflare Deployment

### Auto-deploy from site repo
In https://github.com/dougs123/discountvouchers-site:
1. Settings → Secrets and variables → Actions
2. Add:
   - `CLOUDFLARE_API_TOKEN` (get from CF dashboard)
   - `CLOUDFLARE_ACCOUNT_ID` (your CF account)

3. Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to Cloudflare

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install
      - run: npm run build
      - name: Deploy
        run: npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

Now: `git push` → auto-deploys to Cloudflare Workers

## Status

✅ Site repo ready (~/DiscountVouchers)
⏳ Create both repos on GitHub (manual step)
⏳ Push both repos
⏳ Set up GitHub secrets for CI/CD
✅ Auto-deploy enabled once secrets added

## Commands to Run

```bash
# 1. Create site repo on GitHub at https://github.com/new
# 2. Push site code
cd ~/DiscountVouchers
git remote add origin https://github.com/dougs123/discountvouchers-site.git
git branch -M main
git push -u origin main

# 3. Create harvest repo on GitHub at https://github.com/new
# 4. Set up harvest repo (see above)

# 5. Add GitHub secrets (via GitHub UI)

# 6. Test deployment
cd ~/DiscountVouchers
echo "Test change" >> README.md
git add README.md
git commit -m "Test auto-deploy"
git push
# Check Actions tab to see deployment status
```

Done! Now every push to main = auto-deployed to Cloudflare.
