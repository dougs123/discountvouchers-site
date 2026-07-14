# Google Analytics & Search Console Setup

## Google Analytics 4 Setup

### 1. Create GA4 Property
1. Go to [Google Analytics](https://analytics.google.com/)
2. Click **Create** → **Property**
3. Property name: "DiscountVouchers"
4. Reporting timezone: UK
5. Currency: GBP
6. Get your **Measurement ID** (format: G-XXXXXXXXXX)

### 2. Add GA Tracking Code
Replace placeholder in `src/index.mjs`:
```javascript
<script async src="https://www.googletagmanager.com/gtag/js?id=G-YOUR-ID"></script>
<script>
  gtag('config', 'G-YOUR-ID');
</script>
```

### 3. Verify Tracking
1. Deploy updated code: `wrangler deploy`
2. Visit site in Chrome
3. Open DevTools → Network tab
4. Look for requests to `google-analytics.com`
5. Check GA4 Real-time reports (should show 1 active user)

### 4. Custom Events Already Configured
- `search`: Fired when user searches vouchers
  - `search_term`: The search query
  - `category`: Selected category filter
  
- `voucher_code_copied`: Fired when user copies a code
  - `code`: The voucher code
  
- `merchant_clicked`: Fired when user clicks a merchant
  - `merchant_name`: The merchant name

## Google Search Console Setup

### 1. Create GSC Property
1. Go to [Google Search Console](https://search.google.com/search-console/about)
2. Click **URL prefix** property
3. Enter: `https://discountvouchers.rewardspy.workers.dev`
4. Click **Continue**

### 2. Verify Ownership (via Meta Tag)
1. Copy verification meta tag from GSC
2. Paste into `src/index.mjs` head section:
```html
<meta name="google-site-verification" content="YOUR-VERIFICATION-CODE">
```
3. Deploy: `wrangler deploy`
4. Return to GSC and click **Verify**

### 3. Add Custom Domain (Optional)
If using custom domain (discountvouchers.com):
1. Add DNS TXT record from GSC
2. Wait 24-48 hours for DNS propagation
3. Verify in GSC

### 4. Submit Sitemap
GSC will auto-crawl, but manually submit:
1. Generate sitemap at `GET /sitemap.xml`
2. In GSC → Sitemaps → Add
3. Enter: `https://discountvouchers.rewardspy.workers.dev/sitemap.xml`

### 5. Check Search Performance
After 2-3 days:
1. Performance → See clicks, impressions, CTR
2. Coverage → Check indexed pages
3. Enhancement → Mobile usability, structured data

## Current Setup Status

✅ **GA Tracking Code**: Embedded (placeholder ID)
✅ **Custom Events**: search, voucher_code_copied, merchant_clicked
✅ **GSC Verification**: Meta tag in place (placeholder)
✅ **Deployed**: Live at discountvouchers.rewardspy.workers.dev

## Next Steps

### Immediate (This Week)
1. Get real GA4 Measurement ID
2. Get real GSC verification code
3. Update `src/index.mjs` with real IDs
4. Deploy: `wrangler deploy`
5. Verify in GA real-time within 5 minutes

### Week 2
1. Monitor GSC crawl stats
2. Check indexed pages (should be 1-10 initially)
3. Add structured data (schema.org)
4. Create robots.txt and sitemap.xml

### Week 3+
1. Monitor search impressions and CTR
2. Identify high-traffic keywords
3. Create content for long-tail keywords
4. Set up goal tracking (signups, clicks to merchants)

## Tracking URLs

**For affiliate testing**, add UTM params:
```
https://discountvouchers.rewardspy.workers.dev?utm_source=reddit&utm_medium=post&utm_campaign=deals
```

GA will automatically track:
- Source: reddit
- Medium: post
- Campaign: deals

## Debugging

Check GA data in DevTools console:
```javascript
// See what GA is tracking
console.log(window.dataLayer);

// Manually fire event
gtag('event', 'test_event', {
  'test_param': 'test_value'
});
```

Check GSC:
1. Real-time → See if bot is crawling
2. Coverage → Red errors show crawl issues
3. Mobile → Check mobile-friendly status
