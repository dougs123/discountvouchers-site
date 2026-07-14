#!/bin/bash
set -e

echo "🚀 Deploying DiscountVouchers..."

# 1. Build merchants and vouchers data
echo "📊 Building merchant and voucher data..."
node scripts/build-merchants.mjs
node scripts/scrape-vouchers.mjs

# 2. Initialize D1 database
echo "🗄️  Initializing D1 database..."
wrangler d1 execute discountvouchers --file ./schema.sql --remote 2>/dev/null || true

# 3. Seed data
echo "🌱 Seeding merchants..."
wrangler d1 execute discountvouchers --file ./data/seed-merchants.sql --remote 2>/dev/null || true

echo "🌱 Seeding vouchers..."
wrangler d1 execute discountvouchers --file ./data/seed-vouchers.sql --remote 2>/dev/null || true

# 4. Deploy to Cloudflare Workers
echo "☁️  Deploying to Cloudflare Workers..."
wrangler deploy

echo "✅ Deployment complete!"
echo "🔗 Visit: https://discountvouchers.workers.dev"
