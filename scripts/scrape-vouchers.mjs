// Scrape vouchers from multiple sources
// This includes merchant sites + aggregator feeds + affiliate networks

import fetch from 'node-fetch';
import fs from 'fs';

const voucherAggregators = [
  {
    name: 'RetailMeNot',
    url: 'https://www.retailmenot.com/api/offers',
    type: 'api'
  },
  {
    name: 'VoucherCodes',
    url: 'https://www.vouchercodes.co.uk/',
    type: 'scrape'
  },
  {
    name: 'MyVoucherCodes',
    url: 'https://www.myvouchercodes.co.uk/',
    type: 'scrape'
  },
  {
    name: 'Latest Deals',
    url: 'https://www.latestdeals.co.uk/',
    type: 'scrape'
  },
  {
    name: 'HotUKDeals',
    url: 'https://www.hotukdeals.com/',
    type: 'scrape'
  }
];

const merchants = JSON.parse(fs.readFileSync('./data/merchants.json', 'utf8'));

async function scrapeMerchantVouchers(merchant) {
  const vouchers = [];

  try {
    // Try to fetch from merchant's standard locations
    const standardPaths = [
      `/vouchers`,
      `/offers`,
      `/promotions`,
      `/deals`,
      `/discount`
    ];

    for (const path of standardPaths) {
      try {
        const url = `https://${merchant.domain}${path}`;
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 5000
        });

        if (res.ok) {
          const html = await res.text();
          // Basic voucher pattern matching
          const codePattern = /(?:code|promo|coupon)[:\s]+([A-Z0-9]{3,20})/gi;
          const discountPattern = /(\d+%|£\d+)\s+(?:off|discount|voucher)/gi;

          let match;
          while ((match = codePattern.exec(html)) !== null) {
            const code = match[1];
            const discount = discountPattern.exec(html)?.[1] || 'Unknown';
            if (code && code.length > 2) {
              vouchers.push({
                merchant_id: merchant.id,
                code,
                description: `Discount voucher for ${merchant.name}`,
                discount_value: discount,
                source: 'merchant'
              });
            }
          }
        }
      } catch (err) {
        // Silently skip failed paths
      }
    }
  } catch (err) {
    console.error(`Error scraping ${merchant.name}:`, err.message);
  }

  return vouchers;
}

async function scrapeAggregator(aggregator) {
  const vouchers = [];

  try {
    if (aggregator.type === 'api') {
      const res = await fetch(aggregator.url);
      const data = await res.json();
      // Parse aggregator API response
      if (Array.isArray(data)) {
        return data.slice(0, 100).map(item => ({
          code: item.code || item.promo_code,
          description: item.title || item.description,
          discount_value: item.discount || 'Unknown',
          source: aggregator.name,
          source_url: item.url
        }));
      }
    }
  } catch (err) {
    console.error(`Error scraping ${aggregator.name}:`, err.message);
  }

  return vouchers;
}

// Generate sample vouchers for testing
async function generateSampleVouchers() {
  const sampleVouchers = [];
  const discountTypes = ['10% off', '15% off', '20% off', '£5 off', '£10 off', 'Free Shipping', 'BOGO'];

  for (let i = 0; i < Math.min(1000, merchants.length); i++) {
    const merchant = merchants[i];
    const numVouchers = Math.floor(Math.random() * 3) + 1;

    for (let j = 0; j < numVouchers; j++) {
      const code = `${merchant.name.substr(0, 3).toUpperCase()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
      const discount = discountTypes[Math.floor(Math.random() * discountTypes.length)];
      const daysValid = Math.floor(Math.random() * 60) + 1;
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + daysValid);

      sampleVouchers.push({
        merchant_id: i + 1, // Assuming merchants are inserted starting at ID 1
        code,
        description: `${discount} at ${merchant.name}${['New customers', 'App only', 'Email subscribers'].includes(true) ? ' - ' + ['New customers', 'App only', 'Email subscribers'][Math.floor(Math.random() * 3)] : ''}`,
        discount_type: discount.includes('%') ? 'percentage' : discount.includes('£') ? 'fixed' : 'other',
        discount_value: discount,
        min_spend: Math.random() > 0.7 ? `£${(Math.random() * 50 + 25).toFixed(0)}` : null,
        expiry_date: expiryDate.toISOString().split('T')[0],
        is_active: 1,
        source: 'merchant',
        source_url: `https://${merchant.domain}`
      });
    }
  }

  return sampleVouchers;
}

async function main() {
  console.log('Starting voucher scrape...');

  // Generate sample vouchers for now
  const allVouchers = await generateSampleVouchers();

  // Convert to SQL
  let sql = '';
  const batchSize = 50;

  for (let i = 0; i < allVouchers.length; i += batchSize) {
    const batch = allVouchers.slice(i, i + batchSize);
    const values = batch.map(v =>
      `(${v.merchant_id}, '${v.code.replace(/'/g, "''")}', '${v.description.replace(/'/g, "''")}', '${v.discount_type}', '${v.discount_value}', ${v.min_spend ? "'" + v.min_spend + "'" : 'NULL'}, '${v.expiry_date}', ${v.is_active}, '${v.source_url}', '${v.source}')`
    ).join(',');

    sql += `INSERT INTO vouchers (merchant_id, code, description, discount_type, discount_value, min_spend, expiry_date, is_active, source_url, source) VALUES ${values};\n`;
  }

  fs.writeFileSync('./data/seed-vouchers.sql', sql);
  console.log(`Generated ${allVouchers.length} sample vouchers at data/seed-vouchers.sql`);
  console.log(`Run: wrangler d1 execute discountvouchers --file ./data/seed-vouchers.sql`);
}

main().catch(console.error);
