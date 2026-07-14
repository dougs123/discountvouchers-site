# DiscountVouchers.com

UK merchant voucher aggregator — collects and indexes discount codes from the top 5,000 UK retailers in one searchable, filterable interface.

## Architecture

```
Frontend (Vue/React)         CF Worker (index.mjs)        D1 Database
┌─────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│  Search/Browse  │◄────────┤  API Routes      │◄────────┤  merchants       │
│  Categories     │         │  - /api/vouchers │         │  vouchers        │
│  Top Merchants  │         │  - /api/merchants│         │  categories      │
│  Copy Code      │         │  - /top-merchants│         │  Indexes         │
└─────────────────┘         └──────────────────┘         └──────────────────┘
                                      ▲
                                      │
                          Scrape Pipeline (scripts/)
                          ┌──────────────────────┐
                          │ build-merchants.mjs  │
                          │ seed-merchants.mjs   │
                          │ scrape-vouchers.mjs  │
                          │ (CSV/API sources)    │
                          └──────────────────────┘
```

## Project Structure

```
DiscountVouchers/
├── src/
│   ├── index.mjs              # CF Worker main + frontend HTML
│   └── cors.mjs               # CORS helpers
├── scripts/
│   ├── build-merchants.mjs    # Generate 5000 merchant list
│   ├── seed-merchants.mjs     # Convert to SQL inserts
│   └── scrape-vouchers.mjs    # Scrape/aggregate vouchers
├── data/
│   ├── merchants.json         # Merchant master list
│   ├── seed-merchants.sql     # Bulk merchant inserts
│   └── seed-vouchers.sql      # Bulk voucher inserts
├── schema.sql                 # D1 schema (merchants/vouchers/categories)
├── wrangler.toml              # CF Workers config
├── package.json               # Dependencies
└── deploy.sh                  # Deployment script
```

## Setup & Development

### Local Development

```bash
# 1. Install dependencies
npm install

# 2. Build data
npm run build

# 3. Start dev server
npm run dev
# Visit: http://localhost:8787
```

### Database Setup

```bash
# 1. Create D1 database
wrangler d1 create discountvouchers

# 2. Create schema
wrangler d1 execute discountvouchers --file ./schema.sql

# 3. Seed merchants & vouchers
npm run seed
```

### Production Deployment

```bash
# One-command deploy (builds, seeds, deploys)
bash deploy.sh

# Or manual steps:
npm run build
wrangler migrate
wrangler deploy
```

## API Routes

### Search Vouchers
```
GET /api/vouchers?q=asos&category=Fashion&sort=newest&limit=20&offset=0

Response:
{
  "vouchers": [
    {
      "id": 1,
      "code": "SAVE20",
      "description": "20% off at ASOS",
      "merchant_name": "ASOS",
      "domain": "asos.com",
      "discount_type": "percentage",
      "discount_value": "20%",
      "expiry_date": "2026-12-31",
      "source": "merchant"
    }
  ],
  "total": 150,
  "limit": 20,
  "offset": 0
}
```

### Get Categories
```
GET /api/merchants

Response:
{
  "categories": ["Fashion", "Electronics", "Home", "Travel", "Groceries", ...]
}
```

### Top Merchants
```
GET /api/top-merchants

Response:
[
  {
    "id": 1,
    "name": "ASOS",
    "domain": "asos.com",
    "category": "Fashion",
    "voucher_count": 45
  }
]
```

## Data Pipeline

### 1. Merchant Discovery (`build-merchants.mjs`)
- Hardcoded top merchants (ASOS, Currys, John Lewis, etc.)
- Aggregated from public sources (Alexa, SimilarWeb rankings)
- Expanded to 5,000 merchants with category placeholders
- Output: `data/merchants.json`

### 2. Seed to Database (`seed-merchants.mjs`)
- Converts JSON → SQL INSERT statements
- Batched inserts (100 per statement for efficiency)
- Output: `data/seed-merchants.sql`

### 3. Voucher Scraping (`scrape-vouchers.mjs`)
- Attempts to scrape merchant sites (`/vouchers`, `/offers`, `/promotions`, etc.)
- Falls back to aggregator APIs (RetailMeNot, VoucherCodes, etc.)
- Generates ~2,000 sample vouchers for testing
- Validates code format + expiry dates
- Output: `data/seed-vouchers.sql`

### 4. Load into D1
```bash
wrangler d1 execute discountvouchers --file ./schema.sql
wrangler d1 execute discountvouchers --file ./data/seed-merchants.sql
wrangler d1 execute discountvouchers --file ./data/seed-vouchers.sql
```

## Frontend Features

### Search
- Full-text search across voucher descriptions and merchant names
- Category filtering dropdown
- Sort by newest or best discount

### Browse
- Top 20 merchants carousel with voucher counts
- Grid display of all active vouchers
- Real-time expiry date highlighting (red if <7 days)

### Interaction
- Click voucher code to copy to clipboard
- Click merchant tile to filter by that store
- Responsive mobile/desktop layout
- Dark/light theme support (CSS variables)

## Schema

### merchants
```sql
id, name, domain, category, logo_url, affiliate_network, is_active, last_scraped_at, created_at
```

### vouchers
```sql
id, merchant_id, code, description, discount_type, discount_value, min_spend, expiry_date, 
is_active, source_url, source, scraped_at, created_at
```

### categories
```sql
id, name, slug
```

## Monetization Options

1. **Affiliate Commission**: Track clicks → merchant affiliate networks (Amazon Associates, CJ.com, etc.)
2. **Merchant Listings**: Premium placement for featured merchants (£50-200/month)
3. **Email Newsletter**: Weekly top deals → newsletter subscribers
4. **Ads**: Google AdSense or affiliate network banners
5. **API License**: Sell access to voucher data to comparison sites

## Link Building Strategy

### Free Channels
- Submit to [VoucherCodes.co.uk](https://www.vouchercodes.co.uk/), [RetailMeNot](https://www.retailmenot.com/)
- Reddit deal communities (r/beermoneyuk, r/ShoppingOnABudget)
- Deal aggregators (Latest Deals, HotUKDeals, Slickdeals)

### Paid Channels
- Sponsorships in money/retail blogs (£100-300 per post)
- Digital PR outreach → "best voucher sites" roundups
- Content syndication platforms (Outbrain, Taboola)

### Owned
- Build content: "Best ASOS Codes", "Currys Deals 2026", etc.
- Category buying guides with embedded vouchers
- Monthly "top deals" blog posts

## Roadmap

**Phase 1 (Live)**
- ✅ 5,000 merchant data layer
- ✅ 2,000+ initial vouchers
- ✅ Search/filter/browse
- ✅ Copy-to-clipboard UX

**Phase 2 (Week 2)**
- Real-time merchant scraping (scheduler)
- Code validation (test if codes are active)
- Expiry date automation
- Email digest feature

**Phase 3 (Month 2)**
- Affiliate link generation + click tracking
- Merchant listings revenue
- Advanced filters (min spend, new codes, etc.)
- Mobile app (iOS/Android)

**Phase 4 (Month 3+)**
- AI-powered recommendations
- Browser extension
- Slack integration
- API for third-party integrations

## Environment Variables

```
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_token
DB_BINDING=DB  # D1 binding name (from wrangler.toml)
```

## Troubleshooting

### D1 Database Not Found
```bash
wrangler d1 create discountvouchers --remote
```

### Seed SQL too large?
Split into smaller batches:
```bash
split -l 500 data/seed-merchants.sql data/merchants_
wrangler d1 execute discountvouchers --file data/merchants_aa --remote
wrangler d1 execute discountvouchers --file data/merchants_ab --remote
```

### Workers preview not loading?
```bash
npm run dev
# Check http://localhost:8787
```

## References

- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [D1 Database](https://developers.cloudflare.com/d1/)
- [UK Top Merchants by Alexa Rank](https://www.alexa.com/topsites/countries/GB)
- [RetailMeNot API](https://www.retailmenot.com/api)
- [VoucherCodes API](https://www.vouchercodes.co.uk/)

## License

MIT
