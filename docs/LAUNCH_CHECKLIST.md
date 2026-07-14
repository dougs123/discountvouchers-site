# DiscountVouchers Launch Checklist

## Live Status
✅ **Site Live**: https://discountvouchers.rewardspy.workers.dev
✅ **Database**: D1 with 4,999 merchants + 1,964 vouchers
✅ **API Endpoints**: All working (search, merchants, top-merchants, voucher lookup)
✅ **Frontend**: Fully functional with search, filters, category browse
✅ **GA Tracking**: Embedded (needs real ID)
✅ **GSC Verification**: Ready (needs real code)

## Pre-Launch Checklist

### Analytics Setup
- [ ] Get Google Analytics 4 property created
  - [ ] Copy Measurement ID (G-XXXXXXXXXX)
  - [ ] Update `src/index.mjs` line ~148
  - [ ] Run `wrangler deploy`
  - [ ] Verify in GA real-time within 5 min

- [ ] Get Google Search Console verification code
  - [ ] Copy meta tag content
  - [ ] Update `src/index.mjs` line ~147
  - [ ] Run `wrangler deploy`
  - [ ] Verify in GSC

### Custom Domain (Optional)
- [ ] Register discountvouchers.com or similar
- [ ] Point CNAME to discountvouchers.rewardspy.workers.dev
- [ ] Update Cloudflare Workers routes
- [ ] Update GA4 property domain setting

### Content & SEO
- [ ] Create README/landing page copy
- [ ] Add schema.org markup (Organization, BreadcrumbList)
- [ ] Generate sitemap.xml
- [ ] Create robots.txt
- [ ] Add 404 page handling

### Monetization Hooks
- [ ] Set up affiliate network accounts (Awin, CJ, etc.)
- [ ] Test affiliate link generation
- [ ] Add merchant listing form
- [ ] Set up payment processing (Stripe for listings)

### Link Building (Start Day 1)
- [ ] Submit to Reddit: r/beermoneyuk, r/ShoppingOnABudget
- [ ] Submit to deal aggregators: Latest Deals, HotUKDeals
- [ ] Post to forums: MumsNet, Digital Spy, Overclock
- [ ] Reach out to 10 UK money bloggers (guest post pitch)

### Monitoring
- [ ] Set up error alerting (Cloudflare dashboard)
- [ ] Monitor D1 database usage
- [ ] Check CF Workers analytics
- [ ] Set up uptime monitoring (Pingdom, Uptime Robot)

## Deployment Checklist (This is Already Done)

✅ Project structure created  
✅ D1 database initialized with schema  
✅ 4,999 merchants seeded  
✅ 1,964 vouchers seeded  
✅ Worker deployed  
✅ Frontend built  
✅ API endpoints working  
✅ CORS headers configured  
✅ Code committed to git  

## Testing Checklist

### API Tests
```bash
# Search vouchers
curl https://discountvouchers.rewardspy.workers.dev/api/vouchers?q=asos

# Get categories
curl https://discountvouchers.rewardspy.workers.dev/api/merchants

# Get top merchants
curl https://discountvouchers.rewardspy.workers.dev/api/top-merchants

# Get single voucher
curl https://discountvouchers.rewardspy.workers.dev/api/voucher/ASO6Z42I
```

### Frontend Tests
- [ ] Load homepage → See header, search bar
- [ ] Type in search box → Get results
- [ ] Select category → Filter by category
- [ ] Click "Newest First" → See latest vouchers
- [ ] Click voucher code → Copy to clipboard
- [ ] Click merchant tile → Filter by merchant
- [ ] Mobile responsive (test on phone/tablet)
- [ ] Check GA firing (DevTools Network tab)

## After Launch (Week 1)

### Monitor
- [ ] Daily unique visitors (GA)
- [ ] Search Console indexation (should see 5-10 pages)
- [ ] Top search queries (after 3 days of data)
- [ ] Top landing pages
- [ ] User behavior (bounce rate, session duration)

### Quick Fixes
- [ ] Fix any 404s from GSC Coverage
- [ ] Add noindex to /api/* routes
- [ ] Optimize slow queries
- [ ] Fix any mobile UX issues

### Optimization
- [ ] Write 5 pillar content pieces (blog posts)
- [ ] Create category landing pages
- [ ] Add structured data markup
- [ ] Set up email newsletter signup
- [ ] Create "Latest Deals" feed

## After Launch (Week 2-4)

### Scale
- [ ] Run advanced voucher scraper (live merchant sites)
- [ ] Implement continuous scraping (6-hour intervals)
- [ ] Add voucher code validation
- [ ] Set up merchant listing sales outreach
- [ ] Launch email newsletter

### Content
- [ ] Publish guest post on UK money blog
- [ ] Create 50+ long-tail keyword posts
- [ ] Set up editorial calendar
- [ ] Plan seasonal campaigns (Black Friday, Christmas, etc.)

### Backlinks
- [ ] Execute link building strategy (docs/LINK_BUILDING.md)
- [ ] Target 50+ backlinks in Month 1
- [ ] Track backlinks in Ahrefs/SEMrush
- [ ] Monitor domain authority growth

## Useful Commands

```bash
# View live site
open https://discountvouchers.rewardspy.workers.dev

# Deploy updates
cd ~/DiscountVouchers && wrangler deploy

# Check database
wrangler d1 shell discountvouchers --remote
> SELECT COUNT(*) FROM vouchers;
> SELECT COUNT(*) FROM merchants;

# View logs
wrangler tail discountvouchers

# Regenerate data
npm run build

# Commit changes
git add -A && git commit -m "your message"

# View git log
git log --oneline | head -10
```

## Support Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [D1 Database Docs](https://developers.cloudflare.com/d1/)
- [Google Analytics Help](https://support.google.com/analytics/)
- [Google Search Console Help](https://support.google.com/webmasters/)

## Next Major Features (Month 2+)

1. **Mobile App** — iOS/Android app for browsing vouchers
2. **Browser Extension** — Auto-apply codes at checkout
3. **Email Newsletter** — Weekly deals digest
4. **Slack Bot** — `/vouchers` command in Slack
5. **API for Partners** — Sell voucher data access
6. **Affiliate Marketplace** — Let merchants post their own deals
7. **Price Comparison** — Compare across multiple retailers
8. **Deal Alerts** — Notify users of new codes for favorite stores
