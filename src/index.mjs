import { corsHeaders } from './cors.mjs';

export default {
  fetch: async (req, env) => {
    const url = new URL(req.url);

    // CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // API Routes
      if (url.pathname === '/api/vouchers') {
        return handleSearchVouchers(req, env, url);
      }

      if (url.pathname === '/api/merchants') {
        return handleGetMerchants(req, env);
      }

      if (url.pathname.startsWith('/api/voucher/')) {
        const code = url.pathname.replace('/api/voucher/', '');
        return handleGetVoucher(req, env, code);
      }

      if (url.pathname === '/api/top-merchants') {
        return handleTopMerchants(req, env);
      }

      if (url.pathname === '/api/stats') {
        return handleStats(req, env);
      }

      if (url.pathname === '/api/live-prices') {
        return handleLivePrices(req, env, url);
      }

      // robots.txt
      if (url.pathname === '/robots.txt') {
        return new Response(`User-agent: *
Allow: /
Disallow: /api/*
Disallow: /?utm_*
Sitemap: https://discountvouchers.rewardspy.workers.dev/sitemap.xml`, {
          headers: { 'Content-Type': 'text/plain' }
        });
      }

      // sitemap.xml
      if (url.pathname === '/sitemap.xml') {
        const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://discountvouchers.rewardspy.workers.dev/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;
        return new Response(sitemap, {
          headers: { 'Content-Type': 'application/xml' }
        });
      }

      // Frontend
      if (url.pathname === '/' || url.pathname === '') {
        return new Response(frontendHTML, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=300'
          }
        });
      }

      return new Response('Not Found', { status: 404 });
    } catch (err) {
      console.error(err);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

const apiHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=120'
};

async function handleSearchVouchers(req, env, url) {
  const search = url.searchParams.get('q') || '';
  const category = url.searchParams.get('category') || '';
  const sort = url.searchParams.get('sort') || 'newest';
  const limit = Math.min(parseInt(url.searchParams.get('limit')) || 20, 100);
  const offset = parseInt(url.searchParams.get('offset')) || 0;

  let where = `
    WHERE v.is_active = 1 AND (v.expiry_date IS NULL OR v.expiry_date > DATE('now'))
  `;

  const filterParams = [];

  if (search) {
    where += ` AND (v.description LIKE ? OR m.name LIKE ?)`;
    filterParams.push(`%${search}%`, `%${search}%`);
  }

  if (category) {
    where += ` AND m.category = ?`;
    filterParams.push(category);
  }

  const query = `
    SELECT v.*, m.name as merchant_name, m.domain, m.logo_url, m.category
    FROM vouchers v
    JOIN merchants m ON v.merchant_id = m.id
    ${where}
    ORDER BY ${sort === 'discount' ? 'v.discount_value DESC' : 'v.scraped_at DESC, v.id DESC'}
    LIMIT ? OFFSET ?
  `;

  const { results } = await env.DB.prepare(query).bind(...filterParams, limit, offset).all();

  const countResult = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM vouchers v
     JOIN merchants m ON v.merchant_id = m.id
     ${where}`
  ).bind(...filterParams).first();

  return new Response(JSON.stringify({
    vouchers: results || [],
    total: countResult?.total || 0,
    limit,
    offset
  }), { headers: apiHeaders });
}

async function handleGetMerchants(req, env) {
  const { results } = await env.DB.prepare(
    `SELECT DISTINCT category FROM merchants WHERE is_active = 1 ORDER BY category`
  ).all();

  return new Response(JSON.stringify({
    categories: results?.map(r => r.category).filter(Boolean) || []
  }), { headers: apiHeaders });
}

async function handleGetVoucher(req, env, code) {
  const voucher = await env.DB.prepare(
    `SELECT v.*, m.name as merchant_name, m.domain FROM vouchers v
     JOIN merchants m ON v.merchant_id = m.id
     WHERE v.code = ? AND v.is_active = 1`
  ).bind(code).first();

  if (!voucher) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify(voucher), { headers: apiHeaders });
}

async function handleTopMerchants(req, env) {
  const { results } = await env.DB.prepare(`
    SELECT m.id, m.name, m.domain, m.logo_url, m.category,
           COUNT(v.id) as voucher_count
    FROM merchants m
    JOIN vouchers v ON m.id = v.merchant_id AND v.is_active = 1
    WHERE m.is_active = 1
    GROUP BY m.id
    ORDER BY voucher_count DESC, m.name ASC
    LIMIT 24
  `).all();

  return new Response(JSON.stringify(results || []), { headers: apiHeaders });
}

async function handleStats(req, env) {
  const merchants = await env.DB.prepare(
    `SELECT COUNT(*) as c FROM merchants WHERE is_active = 1`
  ).first();
  const vouchers = await env.DB.prepare(
    `SELECT COUNT(*) as c FROM vouchers WHERE is_active = 1 AND (expiry_date IS NULL OR expiry_date > DATE('now'))`
  ).first();
  const categories = await env.DB.prepare(
    `SELECT COUNT(DISTINCT category) as c FROM merchants WHERE category IS NOT NULL`
  ).first();

  return new Response(JSON.stringify({
    merchants: merchants?.c || 0,
    vouchers: vouchers?.c || 0,
    categories: categories?.c || 0
  }), { headers: apiHeaders });
}

// Live multi-merchant prices via Redbrain's legacy Shopping API — free GraphQL,
// no auth (shopping.redbrainapis.com). Offers filtered to IN_STOCK; tracking
// links carry Redbrain's own affiliate tags until we wrap our own.
const REDBRAIN_ENDPOINT = 'https://shopping.redbrainapis.com/graphql';
const REDBRAIN_SEARCH_QUERY = `query searchOffers($input: SearchOfferRequest!) {
  searchOffers(input: $input) {
    offers {
      title availability
      merchant { name logo { URL } }
      pricing { price { value currency } }
      images { URL }
      links { tracking deep }
    }
  }
}`;

function safeHttpUrl(u) {
  return typeof u === 'string' && /^https?:\/\//i.test(u) ? u : null;
}

async function handleLivePrices(req, env, url) {
  const q = (url.searchParams.get('q') || '').trim().slice(0, 120);
  if (!q) return new Response(JSON.stringify({ offers: [] }), { headers: apiHeaders });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(REDBRAIN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; DiscountVouchers/1.0)'
      },
      body: JSON.stringify({
        operationName: 'searchOffers',
        query: REDBRAIN_SEARCH_QUERY,
        variables: { input: { q, locales: ['en_GB'] } }
      }),
      signal: controller.signal
    });
    if (!res.ok) throw new Error('redbrain ' + res.status);
    const json = await res.json();
    const raw = json?.data?.searchOffers?.offers || [];
    const offers = [];
    for (const o of raw) {
      if (String(o?.availability || '').toUpperCase() !== 'IN_STOCK') continue;
      const price = o?.pricing?.price;
      const link = safeHttpUrl(o?.links?.tracking) || safeHttpUrl(o?.links?.deep);
      if (!o?.title || !o?.merchant?.name || !price || typeof price.value !== 'number' || !link) continue;
      offers.push({
        title: String(o.title).slice(0, 140),
        merchant: String(o.merchant.name).slice(0, 60),
        logo: safeHttpUrl(o.merchant?.logo?.URL),
        price: price.value,
        currency: price.currency || 'GBP',
        image: safeHttpUrl(o.images?.[0]?.URL),
        url: link
      });
      if (offers.length >= 12) break;
    }
    return new Response(JSON.stringify({ offers }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' }
    });
  } catch (_) {
    // Degrade quietly — vouchers still work without live prices.
    return new Response(JSON.stringify({ offers: [] }), { headers: apiHeaders });
  } finally {
    clearTimeout(timer);
  }
}

// NOTE: frontendHTML is a server-side template literal. The client-side
// <script> below must not contain backticks, ${ sequences, or backslash
// escapes - they would be consumed server-side and break the served JS.
const frontendHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="google-site-verification" content="discountvouchers-verification-code">
  <title>DiscountVouchers — UK Voucher Codes in One Place</title>
  <meta name="description" content="Voucher codes and deals from top UK retailers, all in one place. Search by shop, browse by category, copy codes in one click.">
  <meta property="og:title" content="DiscountVouchers — UK Voucher Codes in One Place">
  <meta property="og:description" content="Voucher codes and deals from top UK retailers. Search by shop, browse by category, copy codes in one click.">
  <meta property="og:type" content="website">
  <link rel="icon" href='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🏷️</text></svg>'>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">

  <!-- Google Analytics -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-DISCOUNTVOUCHERS"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-DISCOUNTVOUCHERS', {
      'anonymize_ip': true,
      'page_path': window.location.pathname
    });
  </script>

  <style>
    :root {
      --accent: #0bbf64;
      --accent-dark: #059a4f;
      --accent-soft: rgba(11, 191, 100, 0.12);
      --ink: #16181d;
      --bg: #f7f6f2;
      --card: #ffffff;
      --border: #e6e3da;
      --text: #23262d;
      --muted: #6f7480;
      --danger: #e2483d;
      --shadow: 0 1px 2px rgba(22, 24, 29, 0.05);
      --shadow-lift: 0 12px 28px rgba(22, 24, 29, 0.12);
      --radius: 14px;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --ink: #f2f3f5;
        --bg: #0e1013;
        --card: #16191f;
        --border: #262b33;
        --text: #e8eaed;
        --muted: #9aa1ad;
        --accent-soft: rgba(11, 191, 100, 0.16);
        --shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
        --shadow-lift: 0 12px 28px rgba(0, 0, 0, 0.5);
      }
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    html { scroll-behavior: smooth; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }

    h1, h2, h3, .logo { font-family: 'Outfit', 'Inter', sans-serif; }

    /* ===== Nav ===== */
    nav {
      position: sticky;
      top: 0;
      z-index: 100;
      background: color-mix(in srgb, var(--bg) 82%, transparent);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
    }

    .navbar {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 1.25rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      height: 64px;
    }

    .logo {
      font-size: 1.35rem;
      font-weight: 800;
      color: var(--ink);
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      letter-spacing: -0.02em;
    }

    .logo .tag {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border-radius: 9px;
      background: var(--accent);
      color: #fff;
      font-size: 1rem;
      transform: rotate(-8deg);
    }

    .nav-links {
      display: flex;
      gap: 1.75rem;
      list-style: none;
      align-items: center;
    }

    .nav-links a {
      text-decoration: none;
      color: var(--muted);
      font-weight: 600;
      font-size: 0.92rem;
      transition: color 0.2s;
    }

    .nav-links a:hover { color: var(--ink); }

    /* ===== Hero ===== */
    .hero {
      max-width: 1200px;
      margin: 0 auto;
      padding: 4.5rem 1.25rem 2.5rem;
      text-align: center;
    }

    .hero h1 {
      font-size: clamp(2.2rem, 5.5vw, 3.8rem);
      font-weight: 800;
      line-height: 1.08;
      letter-spacing: -0.03em;
      color: var(--ink);
      max-width: 750px;
      margin: 0 auto 1rem;
    }

    .hero h1 .hl {
      color: var(--accent);
      position: relative;
      white-space: nowrap;
    }

    .hero p.sub {
      font-size: 1.1rem;
      color: var(--muted);
      max-width: 540px;
      margin: 0 auto 2rem;
    }

    .hero-search {
      max-width: 640px;
      margin: 0 auto;
      display: flex;
      background: var(--card);
      border: 1.5px solid var(--border);
      border-radius: 999px;
      padding: 0.4rem 0.4rem 0.4rem 1.4rem;
      box-shadow: var(--shadow-lift);
      transition: border-color 0.25s;
    }

    .hero-search:focus-within { border-color: var(--accent); }

    .hero-search input {
      flex: 1;
      border: none;
      background: transparent;
      font-size: 1.05rem;
      color: var(--text);
      outline: none;
      min-width: 0;
      font-family: inherit;
    }

    .hero-search input::placeholder { color: var(--muted); }

    .hero-search button {
      background: var(--accent);
      color: #fff;
      border: none;
      border-radius: 999px;
      padding: 0.8rem 1.7rem;
      font-weight: 700;
      font-size: 0.98rem;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.2s, transform 0.15s;
      flex-shrink: 0;
    }

    .hero-search button:hover { background: var(--accent-dark); }
    .hero-search button:active { transform: scale(0.97); }

    .hero-stats {
      display: flex;
      justify-content: center;
      gap: 2.5rem;
      margin-top: 2.25rem;
      flex-wrap: wrap;
    }

    .stat { display: flex; align-items: baseline; gap: 0.45rem; }

    .stat b {
      font-family: 'Outfit', sans-serif;
      font-size: 1.35rem;
      font-weight: 800;
      color: var(--ink);
    }

    .stat span { color: var(--muted); font-size: 0.9rem; }

    /* ===== Merchant ticker ===== */
    .ticker-wrap {
      overflow: hidden;
      border-top: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
      padding: 0.8rem 0;
      margin-top: 3rem;
      -webkit-mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent);
      mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent);
    }

    .ticker {
      display: inline-flex;
      white-space: nowrap;
      animation: ticker 40s linear infinite;
    }

    .ticker:hover { animation-play-state: paused; }

    @keyframes ticker {
      from { transform: translateX(0); }
      to { transform: translateX(-50%); }
    }

    .ticker span {
      display: inline-flex;
      align-items: center;
      color: var(--muted);
      font-weight: 600;
      font-size: 0.92rem;
      padding: 0 1.1rem;
      cursor: pointer;
      transition: color 0.2s;
    }

    .ticker span:hover { color: var(--accent); }

    .ticker span::after {
      content: "·";
      margin-left: 2.2rem;
      color: var(--border);
    }

    /* ===== Layout ===== */
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 1.25rem;
    }

    section { padding: 2.5rem 0 0; }

    .section-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.25rem;
      flex-wrap: wrap;
    }

    .section-head h2 {
      font-size: 1.45rem;
      font-weight: 800;
      color: var(--ink);
      letter-spacing: -0.02em;
    }

    .result-count { color: var(--muted); font-size: 0.9rem; font-weight: 500; }

    /* ===== Category pills ===== */
    .pills {
      display: flex;
      gap: 0.6rem;
      overflow-x: auto;
      padding-bottom: 0.5rem;
      scrollbar-width: none;
    }

    .pills::-webkit-scrollbar { display: none; }

    .pill {
      border: 1.5px solid var(--border);
      background: var(--card);
      color: var(--text);
      border-radius: 999px;
      padding: 0.45rem 1.1rem;
      font-size: 0.88rem;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      font-family: inherit;
      transition: all 0.2s;
    }

    .pill:hover { border-color: var(--accent); color: var(--accent); }

    .pill.active {
      background: var(--ink);
      border-color: var(--ink);
      color: var(--bg);
    }

    /* ===== Merchant chips ===== */
    .merchants-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 0.8rem;
    }

    .merchant-tile {
      display: flex;
      align-items: center;
      gap: 0.7rem;
      padding: 0.8rem 1rem;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: var(--shadow);
    }

    .merchant-tile:hover {
      border-color: var(--accent);
      transform: translateY(-2px);
      box-shadow: var(--shadow-lift);
    }

    .avatar {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 0.78rem;
      color: #fff;
      flex-shrink: 0;
      font-family: 'Outfit', sans-serif;
    }

    .merchant-tile .m-info { min-width: 0; }

    .merchant-tile .name {
      font-weight: 700;
      font-size: 0.88rem;
      color: var(--ink);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .merchant-tile .count { color: var(--muted); font-size: 0.76rem; }

    /* ===== Voucher ticket cards ===== */
    .vouchers-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
      gap: 1.25rem;
    }

    .offers-strip {
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: 225px;
      gap: 1rem;
      overflow-x: auto;
      padding-bottom: 0.6rem;
      scroll-snap-type: x proximity;
    }

    .offer-card {
      scroll-snap-align: start;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 0.9rem;
      text-decoration: none;
      color: var(--text);
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
      box-shadow: var(--shadow);
      transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
    }

    .offer-card:hover {
      transform: translateY(-3px);
      box-shadow: var(--shadow-lift);
      border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
    }

    .offer-img {
      width: 100%;
      height: 110px;
      object-fit: contain;
      background: #fff;
      border-radius: 8px;
    }

    .offer-price {
      font-family: 'Outfit', sans-serif;
      font-weight: 800;
      font-size: 1.2rem;
      color: var(--accent);
    }

    .offer-title {
      font-size: 0.82rem;
      line-height: 1.35;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .offer-merchant {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--muted);
      margin-top: auto;
    }

    .offer-logo {
      height: 16px;
      max-width: 70px;
      object-fit: contain;
    }

    .offers-note {
      font-size: 0.75rem;
      color: var(--muted);
      margin-top: 0.5rem;
    }

    .voucher-card {
      position: relative;
      overflow: hidden;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 1.35rem 1.35rem 1.1rem;
      display: flex;
      flex-direction: column;
      box-shadow: var(--shadow);
      transition: transform 0.25s, box-shadow 0.25s, border-color 0.25s;
    }

    .voucher-card:hover {
      transform: translateY(-4px);
      box-shadow: var(--shadow-lift);
      border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
    }

    .card-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 0.6rem;
      margin-bottom: 0.6rem;
    }

    .deal-value {
      font-family: 'Outfit', sans-serif;
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--accent);
      letter-spacing: -0.02em;
      line-height: 1.15;
    }

    .cat-tag {
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
      background: var(--accent-soft);
      color: var(--accent-dark);
      border-radius: 6px;
      padding: 0.2rem 0.55rem;
      white-space: nowrap;
      flex-shrink: 0;
    }

    @media (prefers-color-scheme: dark) {
      .cat-tag { color: var(--accent); }
    }

    .voucher-card .merchant {
      font-weight: 700;
      color: var(--ink);
      font-size: 0.95rem;
    }

    .voucher-card .description {
      color: var(--muted);
      font-size: 0.88rem;
      margin: 0.35rem 0 1.1rem;
      flex-grow: 1;
    }

    /* perforated divider with punch holes */
    .code-row {
      position: relative;
      border-top: 2px dashed var(--border);
      margin: 0 -1.35rem;
      padding: 0.95rem 1.35rem 0;
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }

    .code-row::before, .code-row::after {
      content: "";
      position: absolute;
      top: -13px;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: var(--bg);
      border: 1px solid var(--border);
    }

    .code-row::before { left: -14px; }
    .code-row::after { right: -14px; }

    .code {
      flex: 1;
      font-family: 'Courier New', monospace;
      font-weight: 700;
      font-size: 1.02rem;
      letter-spacing: 0.08em;
      color: var(--ink);
      background: var(--accent-soft);
      border: 1.5px dashed color-mix(in srgb, var(--accent) 50%, transparent);
      border-radius: 9px;
      padding: 0.5rem 0.8rem;
      text-align: center;
      user-select: all;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
    }

    .code.nocode {
      background: transparent;
      border-color: var(--border);
      color: var(--muted);
      font-family: 'Inter', sans-serif;
      font-weight: 600;
      letter-spacing: 0;
      font-size: 0.88rem;
    }

    .copy-btn {
      background: var(--ink);
      color: var(--bg);
      border: none;
      border-radius: 9px;
      padding: 0.55rem 1rem;
      font-weight: 700;
      font-size: 0.85rem;
      cursor: pointer;
      font-family: inherit;
      flex-shrink: 0;
      transition: background 0.2s, transform 0.15s;
    }

    .copy-btn:hover { background: var(--accent-dark); color: #fff; }
    .copy-btn:active { transform: scale(0.95); }
    .copy-btn.done { background: var(--accent); color: #fff; }

    .voucher-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 0.8rem;
      font-size: 0.78rem;
      color: var(--muted);
    }

    .expiry.soon { color: var(--danger); font-weight: 600; }

    /* ===== Load more ===== */
    .load-more-wrap { text-align: center; padding: 2rem 0 0.5rem; }

    .load-more {
      background: transparent;
      border: 1.5px solid var(--border);
      color: var(--ink);
      border-radius: 999px;
      padding: 0.7rem 2.2rem;
      font-weight: 700;
      font-size: 0.92rem;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.2s;
    }

    .load-more:hover { border-color: var(--accent); color: var(--accent); }

    /* ===== Skeletons ===== */
    .skeleton {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      height: 210px;
      position: relative;
      overflow: hidden;
    }

    .skeleton::after {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--muted) 8%, transparent), transparent);
      animation: shimmer 1.3s infinite;
    }

    @keyframes shimmer {
      from { transform: translateX(-100%); }
      to { transform: translateX(100%); }
    }

    /* ===== States ===== */
    .empty, .error-box {
      text-align: center;
      padding: 3rem 1rem;
      color: var(--muted);
      background: var(--card);
      border: 1px dashed var(--border);
      border-radius: var(--radius);
    }

    .error-box { color: var(--danger); }

    /* ===== Toast ===== */
    #toasts {
      position: fixed;
      bottom: 1.5rem;
      left: 50%;
      transform: translateX(-50%);
      z-index: 200;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      align-items: center;
      pointer-events: none;
    }

    .toast {
      background: var(--ink);
      color: var(--bg);
      padding: 0.7rem 1.3rem;
      border-radius: 999px;
      font-weight: 600;
      font-size: 0.9rem;
      box-shadow: var(--shadow-lift);
      animation: toast-in 0.25s ease;
    }

    @keyframes toast-in {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* ===== Footer ===== */
    footer {
      margin-top: 4rem;
      border-top: 1px solid var(--border);
      padding: 2.5rem 1.25rem 3rem;
    }

    .foot-inner {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      gap: 2rem;
      flex-wrap: wrap;
      color: var(--muted);
      font-size: 0.88rem;
    }

    .foot-inner .brand { font-weight: 800; color: var(--ink); font-family: 'Outfit', sans-serif; font-size: 1.05rem; }

    .foot-inner p { max-width: 420px; margin-top: 0.4rem; }

    /* ===== Responsive ===== */
    @media (max-width: 700px) {
      .nav-links { display: none; }
      .hero { padding-top: 3rem; }
      .hero-search { flex-direction: row; }
      .hero-search button { padding: 0.7rem 1.2rem; }
      .hero-stats { gap: 1.4rem; }
      .vouchers-grid { grid-template-columns: 1fr; }
      .merchants-grid { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>
  <nav>
    <div class="navbar">
      <a class="logo" href="#top"><span class="tag">🏷️</span>DiscountVouchers</a>
      <ul class="nav-links">
        <li><a href="#categories">Categories</a></li>
        <li><a href="#merchants">Merchants</a></li>
        <li><a href="#deals">Latest deals</a></li>
      </ul>
    </div>
  </nav>

  <header class="hero" id="top">
    <h1>Every UK voucher code.<br><span class="hl">One place.</span></h1>
    <p class="sub">Codes and deals from the UK&#39;s favourite shops, searchable in seconds. Find one, copy it, save at checkout.</p>

    <div class="hero-search">
      <input type="text" id="search-input" placeholder="Try ASOS, Currys, Boots…" autocomplete="off">
      <button id="search-btn">Search</button>
    </div>

    <div class="hero-stats" id="heroStats">
      <div class="stat"><b id="statMerchants">—</b><span>UK merchants</span></div>
      <div class="stat"><b id="statVouchers">—</b><span>live vouchers</span></div>
      <div class="stat"><b id="statCategories">—</b><span>categories</span></div>
    </div>
  </header>

  <div class="ticker-wrap">
    <div class="ticker" id="ticker"></div>
  </div>

  <main class="container">
    <section id="categories">
      <div class="section-head"><h2>Browse by category</h2></div>
      <div class="pills" id="pills"></div>
    </section>

    <section id="merchants">
      <div class="section-head"><h2>Popular merchants</h2></div>
      <div class="merchants-grid" id="topMerchants"></div>
    </section>

    <section id="livePrices" style="display:none">
      <div class="section-head">
        <h2 id="livePricesTitle">Live prices</h2>
        <span class="result-count" id="liveCount"></span>
      </div>
      <div class="offers-strip" id="offersStrip"></div>
      <p class="offers-note">Live in-stock prices from UK retailers, powered by Redbrain. Links open the retailer's site.</p>
    </section>

    <section id="deals">
      <div class="section-head">
        <h2 id="dealsTitle">Latest deals</h2>
        <div style="display:flex;align-items:center;gap:0.9rem">
          <span class="result-count" id="resultCount"></span>
          <select id="sort" class="pill" style="appearance:auto">
            <option value="newest">Newest</option>
            <option value="discount">Biggest discount</option>
          </select>
        </div>
      </div>
      <div id="vouchersContainer"></div>
      <div class="load-more-wrap" id="loadMoreWrap" style="display:none">
        <button class="load-more" id="loadMoreBtn">Show more deals</button>
      </div>
    </section>
  </main>

  <footer>
    <div class="foot-inner">
      <div>
        <div class="brand">🏷️ DiscountVouchers</div>
        <p>Voucher codes and deals from UK retailers, gathered in one place. Codes are supplied by merchants and third parties — always check terms at checkout.</p>
      </div>
      <div>© 2026 DiscountVouchers</div>
    </div>
  </footer>

  <div id="toasts"></div>

  <script>
    var state = { q: '', category: '', sort: 'newest', offset: 0, total: 0, pageSize: 20 };
    var AVATAR_COLORS = ['#0bbf64', '#5b6ee1', '#e2483d', '#e8930c', '#12a5b8', '#b04fd1', '#4a7dd4', '#d1417f'];

    function el(tag, className, text) {
      var node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined && text !== null) node.textContent = text;
      return node;
    }

    function track(eventName, params) {
      if (window.gtag) { gtag('event', eventName, params || {}); }
    }

    function toast(msg) {
      var wrap = document.getElementById('toasts');
      var t = el('div', 'toast', msg);
      wrap.appendChild(t);
      setTimeout(function () { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; }, 1800);
      setTimeout(function () { wrap.removeChild(t); }, 2200);
    }

    function avatarColor(name) {
      var sum = 0;
      for (var i = 0; i < name.length; i++) sum += name.charCodeAt(i);
      return AVATAR_COLORS[sum % AVATAR_COLORS.length];
    }

    function fmt(n) { return (n || 0).toLocaleString('en-GB'); }

    /* ---------- stats ---------- */
    async function loadStats() {
      try {
        var res = await fetch('/api/stats');
        var s = await res.json();
        document.getElementById('statMerchants').textContent = fmt(s.merchants);
        document.getElementById('statVouchers').textContent = fmt(s.vouchers);
        document.getElementById('statCategories').textContent = fmt(s.categories);
      } catch (e) { console.error(e); }
    }

    /* ---------- category pills ---------- */
    async function loadCategories() {
      try {
        var res = await fetch('/api/merchants');
        var data = await res.json();
        var wrap = document.getElementById('pills');
        wrap.innerHTML = '';

        var all = el('button', 'pill active', 'All');
        all.addEventListener('click', function () { setCategory('', all); });
        wrap.appendChild(all);

        (data.categories || []).forEach(function (cat) {
          var p = el('button', 'pill', cat);
          p.addEventListener('click', function () { setCategory(cat, p); });
          wrap.appendChild(p);
        });
      } catch (e) { console.error(e); }
    }

    function setCategory(cat, pillEl) {
      state.category = cat;
      state.offset = 0;
      document.querySelectorAll('.pill').forEach(function (p) { p.classList.remove('active'); });
      if (pillEl) pillEl.classList.add('active');
      track('category_selected', { category: cat || 'all' });
      loadVouchers(false);
      document.getElementById('deals').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /* ---------- merchants ---------- */
    async function loadTopMerchants() {
      try {
        var res = await fetch('/api/top-merchants');
        var merchants = await res.json();

        var wrap = document.getElementById('topMerchants');
        wrap.innerHTML = '';

        merchants.forEach(function (m) {
          var tile = el('div', 'merchant-tile');
          var av = el('div', 'avatar', (m.name || '').substr(0, 2).toUpperCase());
          av.style.background = avatarColor(m.name || '');
          tile.appendChild(av);
          var info = el('div', 'm-info');
          info.appendChild(el('div', 'name', m.name));
          info.appendChild(el('div', 'count', m.voucher_count + ' codes'));
          tile.appendChild(info);
          tile.addEventListener('click', function () { searchMerchant(m.name); });
          wrap.appendChild(tile);
        });

        // ticker: duplicate list twice for a seamless loop
        var ticker = document.getElementById('ticker');
        ticker.innerHTML = '';
        var names = merchants.map(function (m) { return m.name; });
        names.concat(names).forEach(function (n) {
          var s = el('span', null, n);
          s.addEventListener('click', function () { searchMerchant(n); });
          ticker.appendChild(s);
        });
      } catch (e) { console.error(e); }
    }

    function searchMerchant(name) {
      track('merchant_clicked', { merchant_name: name });
      document.getElementById('search-input').value = name;
      state.q = name;
      state.category = '';
      state.offset = 0;
      document.querySelectorAll('.pill').forEach(function (p, i) { p.classList.toggle('active', i === 0); });
      loadVouchers(false);
      loadLivePrices(name);
      document.getElementById('deals').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /* ---------- vouchers ---------- */
    function skeletons(n) {
      var grid = el('div', 'vouchers-grid');
      for (var i = 0; i < n; i++) grid.appendChild(el('div', 'skeleton'));
      return grid;
    }

    async function loadVouchers(append) {
      var container = document.getElementById('vouchersContainer');
      var loadWrap = document.getElementById('loadMoreWrap');

      if (!append) {
        state.offset = 0;
        container.innerHTML = '';
        container.appendChild(skeletons(6));
      }

      var params = new URLSearchParams({
        q: state.q, category: state.category, sort: state.sort,
        limit: state.pageSize, offset: state.offset
      });

      try {
        var res = await fetch('/api/vouchers?' + params.toString());
        var data = await res.json();
        state.total = data.total || 0;

        document.getElementById('resultCount').textContent = fmt(state.total) + ' deals';
        document.getElementById('dealsTitle').textContent = state.q
          ? 'Deals for "' + state.q + '"'
          : (state.category ? state.category + ' deals' : 'Latest deals');

        renderVouchers(data.vouchers || [], append);

        var shown = state.offset + (data.vouchers || []).length;
        loadWrap.style.display = shown < state.total ? 'block' : 'none';
      } catch (err) {
        console.error(err);
        container.innerHTML = '';
        container.appendChild(el('div', 'error-box', 'Could not load deals — please try again.'));
      }
    }

    function renderVouchers(vouchers, append) {
      var container = document.getElementById('vouchersContainer');
      var grid;

      if (append) {
        grid = container.querySelector('.vouchers-grid');
      } else {
        container.innerHTML = '';
        if (!vouchers.length) {
          container.appendChild(el('div', 'empty', 'No deals match that search. Try another shop name or browse a category.'));
          return;
        }
        grid = el('div', 'vouchers-grid');
        container.appendChild(grid);
      }

      vouchers.forEach(function (v) {
        var expiry = v.expiry_date ? new Date(v.expiry_date) : null;
        var soon = expiry && (expiry - new Date()) < 7 * 24 * 60 * 60 * 1000;

        var card = el('div', 'voucher-card');

        var top = el('div', 'card-top');
        top.appendChild(el('div', 'deal-value', v.discount_value || 'Deal'));
        if (v.category) top.appendChild(el('span', 'cat-tag', v.category));
        card.appendChild(top);

        card.appendChild(el('div', 'merchant', v.merchant_name));
        card.appendChild(el('div', 'description', v.description));

        var row = el('div', 'code-row');
        if (v.code) {
          var codeBox = el('div', 'code', v.code);
          var btn = el('button', 'copy-btn', 'Copy');
          btn.addEventListener('click', function () {
            navigator.clipboard.writeText(v.code);
            track('voucher_code_copied', { code: v.code, merchant: v.merchant_name });
            btn.textContent = 'Copied';
            btn.classList.add('done');
            toast('Code copied — paste it at checkout');
            setTimeout(function () { btn.textContent = 'Copy'; btn.classList.remove('done'); }, 1800);
          });
          row.appendChild(codeBox);
          row.appendChild(btn);
        } else {
          row.appendChild(el('div', 'code nocode', 'No code needed — deal applied on site'));
        }
        card.appendChild(row);

        var meta = el('div', 'voucher-meta');
        var expText = v.expiry_date
          ? (soon ? 'Ends soon — ' : 'Ends ') + new Date(v.expiry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
          : 'No expiry listed';
        meta.appendChild(el('span', 'expiry' + (soon ? ' soon' : ''), expText));
        if (v.min_spend) meta.appendChild(el('span', null, 'Min spend ' + v.min_spend));
        card.appendChild(meta);

        grid.appendChild(card);
      });
    }

    /* ---------- live prices (Redbrain) ---------- */
    function priceLabel(o) {
      var sym = o.currency === 'GBP' ? '£' : (o.currency === 'USD' ? '$' : (o.currency === 'EUR' ? '€' : o.currency + ' '));
      return sym + (o.price || 0).toFixed(2);
    }

    async function loadLivePrices(q) {
      var section = document.getElementById('livePrices');
      var strip = document.getElementById('offersStrip');
      if (!q) { section.style.display = 'none'; strip.innerHTML = ''; return; }
      try {
        var res = await fetch('/api/live-prices?q=' + encodeURIComponent(q));
        var data = await res.json();
        var offers = data.offers || [];
        if (!offers.length) { section.style.display = 'none'; strip.innerHTML = ''; return; }
        strip.innerHTML = '';
        document.getElementById('livePricesTitle').textContent = 'Live prices for "' + q + '"';
        document.getElementById('liveCount').textContent = offers.length + ' offers';
        offers.forEach(function (o) {
          var a = document.createElement('a');
          a.className = 'offer-card';
          a.href = o.url;
          a.target = '_blank';
          a.rel = 'nofollow sponsored noopener';
          a.addEventListener('click', function () { track('live_offer_click', { merchant: o.merchant }); });
          if (o.image) {
            var img = document.createElement('img');
            img.className = 'offer-img';
            img.src = o.image;
            img.alt = o.title;
            img.loading = 'lazy';
            img.addEventListener('error', function () { img.style.display = 'none'; });
            a.appendChild(img);
          }
          a.appendChild(el('div', 'offer-price', priceLabel(o)));
          a.appendChild(el('div', 'offer-title', o.title));
          var m = el('div', 'offer-merchant');
          if (o.logo) {
            var lg = document.createElement('img');
            lg.className = 'offer-logo';
            lg.src = o.logo;
            lg.alt = '';
            lg.addEventListener('error', function () { lg.style.display = 'none'; });
            m.appendChild(lg);
          }
          m.appendChild(el('span', null, o.merchant));
          a.appendChild(m);
          strip.appendChild(a);
        });
        section.style.display = 'block';
      } catch (err) {
        section.style.display = 'none';
      }
    }

    /* ---------- search wiring ---------- */
    var debounceTimer = null;

    function doSearch() {
      state.q = document.getElementById('search-input').value.trim();
      state.offset = 0;
      track('search', { search_term: state.q, category: state.category });
      loadVouchers(false);
      loadLivePrices(state.q);
    }

    document.getElementById('search-input').addEventListener('input', function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(doSearch, 350);
    });

    document.getElementById('search-input').addEventListener('keypress', function (e) {
      if (e.key === 'Enter') { clearTimeout(debounceTimer); doSearch(); }
    });

    document.getElementById('search-btn').addEventListener('click', function () {
      clearTimeout(debounceTimer);
      doSearch();
      document.getElementById('deals').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    document.getElementById('sort').addEventListener('change', function (e) {
      state.sort = e.target.value;
      loadVouchers(false);
    });

    document.getElementById('loadMoreBtn').addEventListener('click', function () {
      state.offset += state.pageSize;
      track('load_more', { offset: state.offset });
      loadVouchers(true);
    });

    /* ---------- boot ---------- */
    loadStats();
    loadCategories();
    loadTopMerchants();
    loadVouchers(false);
  </script>
</body>
</html>`;
