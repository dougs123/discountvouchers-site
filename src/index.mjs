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
          headers: { 'Content-Type': 'text/html' }
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
    SELECT v.*, m.name as merchant_name, m.domain, m.logo_url
    FROM vouchers v
    JOIN merchants m ON v.merchant_id = m.id
    ${where}
    ORDER BY ${sort === 'discount' ? 'v.discount_value DESC' : 'v.scraped_at DESC'}
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
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function handleGetMerchants(req, env) {
  const { results } = await env.DB.prepare(
    `SELECT DISTINCT category FROM merchants WHERE is_active = 1 ORDER BY category`
  ).all();

  return new Response(JSON.stringify({
    categories: results?.map(r => r.category).filter(Boolean) || []
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
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

  return new Response(JSON.stringify(voucher), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function handleTopMerchants(req, env) {
  const { results } = await env.DB.prepare(`
    SELECT m.id, m.name, m.domain, m.logo_url, m.category,
           COUNT(v.id) as voucher_count
    FROM merchants m
    LEFT JOIN vouchers v ON m.id = v.merchant_id AND v.is_active = 1
    WHERE m.is_active = 1
    GROUP BY m.id
    ORDER BY voucher_count DESC
    LIMIT 20
  `).all();

  return new Response(JSON.stringify(results || []), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

const frontendHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="google-site-verification" content="discountvouchers-verification-code">
  <title>DiscountVouchers - Save on UK Retail with Verified Voucher Codes</title>
  <meta name="description" content="Find and share verified voucher codes from 5000+ UK merchants. Search by brand, filter by discount, copy codes instantly. Updated daily.">

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
      --primary: #6366f1;
      --primary-dark: #4f46e5;
      --secondary: #ec4899;
      --success: #10b981;
      --danger: #ef4444;
      --warning: #f59e0b;
      --bg-dark: #0f172a;
      --bg-light: #f8fafc;
      --border: #e2e8f0;
      --text-dark: #1e293b;
      --text-light: #64748b;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
      background: var(--bg-light);
      color: var(--text-dark);
      line-height: 1.6;
    }

    /* Navigation */
    nav {
      background: white;
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }

    nav .navbar {
      max-width: 1400px;
      margin: 0 auto;
      padding: 0 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      height: 70px;
    }

    .logo {
      font-size: 1.5rem;
      font-weight: 800;
      background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
    }

    .nav-links {
      display: flex;
      gap: 2rem;
      list-style: none;
    }

    .nav-links a {
      text-decoration: none;
      color: var(--text-light);
      font-weight: 500;
      transition: color 0.3s;
    }

    .nav-links a:hover {
      color: var(--primary);
    }

    /* Hero Section */
    .hero {
      background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
      color: white;
      padding: 4rem 1.5rem;
      text-align: center;
      position: relative;
      overflow: hidden;
    }

    .hero::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -50%;
      width: 100%;
      height: 100%;
      background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
      pointer-events: none;
    }

    .hero-content {
      max-width: 1400px;
      margin: 0 auto;
      position: relative;
      z-index: 1;
    }

    .hero h1 {
      font-size: 3.5rem;
      font-weight: 800;
      margin-bottom: 1rem;
      letter-spacing: -0.02em;
    }

    .hero p {
      font-size: 1.25rem;
      opacity: 0.95;
      margin-bottom: 2rem;
      max-width: 600px;
      margin-left: auto;
      margin-right: auto;
    }

    .hero-stats {
      display: flex;
      justify-content: center;
      gap: 4rem;
      margin-top: 2rem;
      flex-wrap: wrap;
    }

    .stat {
      text-align: center;
    }

    .stat-number {
      font-size: 2rem;
      font-weight: 800;
    }

    .stat-label {
      font-size: 0.9rem;
      opacity: 0.85;
    }

    /* Search Section */
    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 3rem 1.5rem;
    }

    .search-section {
      margin-bottom: 3rem;
    }

    .search-bar {
      display: grid;
      grid-template-columns: 1fr 200px 150px auto;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .search-bar input,
    .search-bar select {
      padding: 0.875rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 1rem;
      background: white;
      color: var(--text-dark);
      transition: border-color 0.3s, box-shadow 0.3s;
    }

    .search-bar input:focus,
    .search-bar select:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
    }

    .search-bar button {
      padding: 0.875rem 2rem;
      background: var(--primary);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      transition: background 0.3s, transform 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    .search-bar button:hover {
      background: var(--primary-dark);
      transform: translateY(-2px);
    }

    .search-bar button:active {
      transform: translateY(0);
    }

    /* Top Merchants */
    .merchants-section {
      background: white;
      border-radius: 12px;
      padding: 2rem;
      margin-bottom: 3rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      border: 1px solid var(--border);
    }

    .section-title {
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 1.5rem;
      color: var(--text-dark);
    }

    .merchants-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 1rem;
    }

    .merchant-tile {
      text-align: center;
      padding: 1.25rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.3s;
      background: white;
    }

    .merchant-tile:hover {
      border-color: var(--primary);
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
      transform: translateY(-2px);
    }

    .merchant-tile img {
      max-width: 100%;
      max-height: 50px;
      margin-bottom: 0.75rem;
      object-fit: contain;
    }

    .merchant-tile .name {
      font-weight: 600;
      font-size: 0.9rem;
      margin-bottom: 0.5rem;
      color: var(--text-dark);
    }

    .merchant-tile .count {
      color: var(--primary);
      font-size: 0.8rem;
      font-weight: 600;
    }

    /* Vouchers Grid */
    .vouchers-section {
      margin-bottom: 2rem;
    }

    .results-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      padding: 0 0.5rem;
    }

    .result-count {
      color: var(--text-light);
      font-size: 0.95rem;
    }

    .vouchers-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1.5rem;
    }

    .voucher-card {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      border: 1px solid var(--border);
      transition: all 0.3s;
      display: flex;
      flex-direction: column;
    }

    .voucher-card:hover {
      box-shadow: 0 8px 16px rgba(0,0,0,0.1);
      transform: translateY(-4px);
      border-color: var(--primary);
    }

    .voucher-badge {
      display: inline-block;
      background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 20px;
      font-weight: 700;
      font-size: 1.1rem;
      margin-bottom: 0.75rem;
      align-self: flex-start;
    }

    .voucher-card .merchant {
      color: var(--text-light);
      font-size: 0.85rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 0.75rem;
    }

    .voucher-card .description {
      color: var(--text-dark);
      font-size: 0.95rem;
      margin-bottom: 1rem;
      flex-grow: 1;
    }

    .voucher-card .code {
      background: linear-gradient(135deg, var(--bg-light) 0%, #f1f5f9 100%);
      padding: 1rem;
      border-radius: 8px;
      border: 2px dashed var(--border);
      font-family: 'Courier New', monospace;
      font-weight: 700;
      margin-bottom: 1rem;
      cursor: pointer;
      text-align: center;
      user-select: all;
      transition: all 0.3s;
      font-size: 1.1rem;
      letter-spacing: 1px;
    }

    .voucher-card .code:hover {
      background: linear-gradient(135deg, #e0e7ff 0%, #f3e8ff 100%);
      border-color: var(--primary);
      transform: scale(1.02);
    }

    .voucher-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.8rem;
    }

    .voucher-card .expiry {
      color: var(--text-light);
    }

    .voucher-card .expiry.soon {
      color: var(--danger);
      font-weight: 600;
    }

    .copy-hint {
      color: var(--primary);
      font-size: 0.75rem;
      text-align: center;
      margin-top: 0.5rem;
      opacity: 0.7;
    }

    /* Status Messages */
    .loading {
      text-align: center;
      padding: 3rem 1rem;
      color: var(--text-light);
    }

    .loading::after {
      content: '';
      display: inline-block;
      width: 20px;
      height: 20px;
      margin-left: 0.5rem;
      border: 3px solid var(--border);
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .error {
      color: var(--danger);
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.2);
      padding: 1rem;
      border-radius: 8px;
      margin: 1rem 0;
    }

    .empty {
      text-align: center;
      padding: 3rem 1rem;
      color: var(--text-light);
    }

    /* Footer */
    footer {
      background: var(--bg-dark);
      color: #94a3b8;
      padding: 3rem 1.5rem;
      text-align: center;
      font-size: 0.9rem;
      margin-top: 4rem;
      border-top: 1px solid rgba(255,255,255,0.1);
    }

    footer a {
      color: #cbd5e1;
      text-decoration: none;
      transition: color 0.3s;
    }

    footer a:hover {
      color: white;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .hero h1 { font-size: 2rem; }
      .hero p { font-size: 1rem; }
      .hero-stats { gap: 2rem; }
      .stat-number { font-size: 1.5rem; }
      .search-bar {
        grid-template-columns: 1fr;
      }
      .nav-links { display: none; }
      .vouchers-grid {
        grid-template-columns: 1fr;
      }
      .hero-stats { flex-direction: column; gap: 1rem; }
    }
  </style>
</head>
<body>
  <!-- Navigation -->
  <nav>
    <div class="navbar">
      <div class="logo" onclick="location.reload()">
        <span>💰</span> DiscountVouchers
      </div>
      <ul class="nav-links">
        <li><a href="#search">Search</a></li>
        <li><a href="#merchants">Merchants</a></li>
        <li><a href="#vouchers">Deals</a></li>
      </ul>
    </div>
  </nav>

  <!-- Hero Section -->
  <div class="hero">
    <div class="hero-content">
      <h1>Save on Every Purchase</h1>
      <p>Discover verified voucher codes from 5,000+ UK retailers. Copy, use, save.</p>
      <div class="hero-stats">
        <div class="stat">
          <div class="stat-number">5,000+</div>
          <div class="stat-label">UK Merchants</div>
        </div>
        <div class="stat">
          <div class="stat-number">2,000+</div>
          <div class="stat-label">Active Vouchers</div>
        </div>
        <div class="stat">
          <div class="stat-number">16</div>
          <div class="stat-label">Categories</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Main Content -->
  <div class="container">
    <!-- Search Section -->
    <div class="search-section" id="search">
      <h2 class="section-title">Find Your Next Deal</h2>
      <div class="search-bar">
        <input type="text" id="search-input" placeholder="Search ASOS, Currys, Argos...">
        <select id="category">
          <option value="">All Categories</option>
        </select>
        <select id="sort">
          <option value="newest">Newest</option>
          <option value="discount">Best Deals</option>
        </select>
        <button onclick="search()">🔍 Search</button>
      </div>
    </div>

    <!-- Top Merchants -->
    <div class="merchants-section" id="merchants">
      <h2 class="section-title">Top Merchants</h2>
      <div id="topMerchants" class="merchants-grid"></div>
    </div>

    <!-- Vouchers -->
    <div class="vouchers-section" id="vouchers">
      <div class="results-header">
        <h2 class="section-title">Latest Deals</h2>
        <span class="result-count" id="resultCount"></span>
      </div>
      <div id="vouchersContainer"></div>
    </div>
  </div>

  <!-- Footer -->
  <footer>
    <p><strong>DiscountVouchers</strong> — Save on 5,000+ UK retailers</p>
    <p style="margin-top: 1rem; opacity: 0.7;">Always verify codes work before checkout. Terms apply per merchant. <a href="#">Terms</a> • <a href="#">Privacy</a></p>
  </footer>

  <script>
    var currentPage = 0;
    var pageSize = 20;

    function el(tag, className, text) {
      var node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined && text !== null) node.textContent = text;
      return node;
    }

    function track(eventName, params) {
      if (window.gtag) { gtag('event', eventName, params || {}); }
    }

    async function loadVouchers() {
      var searchInput = document.getElementById('search-input');
      var categorySelect = document.getElementById('category');
      var sortSelect = document.getElementById('sort');
      var container = document.getElementById('vouchersContainer');

      var params = new URLSearchParams({
        q: searchInput ? searchInput.value : '',
        category: categorySelect ? categorySelect.value : '',
        sort: sortSelect ? sortSelect.value : 'newest',
        limit: pageSize,
        offset: currentPage * pageSize
      });

      try {
        if (container) {
          container.innerHTML = '';
          container.appendChild(el('div', 'loading', 'Loading vouchers...'));
        }

        var res = await fetch('/api/vouchers?' + params.toString());
        var data = await res.json();

        var resultCount = document.getElementById('resultCount');
        if (resultCount) {
          resultCount.textContent = (data.total || 0) + ' vouchers found';
        }

        renderVouchers(data.vouchers || []);
      } catch (err) {
        console.error('Error loading vouchers:', err);
        if (container) {
          container.innerHTML = '';
          container.appendChild(el('div', 'error', 'Failed to load vouchers. Please try again.'));
        }
      }
    }

    async function loadTopMerchants() {
      var wrap = document.getElementById('topMerchants');
      try {
        var res = await fetch('/api/top-merchants');
        var merchants = await res.json();

        wrap.innerHTML = '';
        if (!merchants.length) {
          wrap.appendChild(el('div', 'empty', 'No merchants found'));
          return;
        }

        merchants.forEach(function (m) {
          var tile = el('div', 'merchant-tile');
          if (m.logo_url) {
            var img = document.createElement('img');
            img.src = m.logo_url;
            img.alt = m.name;
            tile.appendChild(img);
          } else {
            var initials = el('div', null, (m.name || '').substr(0, 3).toUpperCase());
            initials.style.cssText = 'height:50px;display:flex;align-items:center;justify-content:center;font-weight:bold;background:#f1f5f9;border-radius:6px';
            tile.appendChild(initials);
          }
          tile.appendChild(el('div', 'name', m.name));
          tile.appendChild(el('div', 'count', m.voucher_count + ' codes'));
          tile.addEventListener('click', function () { filterByMerchant(m.name); });
          wrap.appendChild(tile);
        });
      } catch (err) {
        console.error('Failed to load merchants', err);
      }
    }

    function renderVouchers(vouchers) {
      var container = document.getElementById('vouchersContainer');
      container.innerHTML = '';

      if (!vouchers || !vouchers.length) {
        container.appendChild(el('div', 'empty', 'No vouchers match your search. Try a different term or browse by category.'));
        return;
      }

      var grid = el('div', 'vouchers-grid');

      vouchers.forEach(function (v) {
        var expiry = v.expiry_date ? new Date(v.expiry_date) : null;
        var isExpiringSoon = expiry && (expiry - new Date()) < 7 * 24 * 60 * 60 * 1000;

        var card = el('div', 'voucher-card');
        card.appendChild(el('div', 'voucher-badge', v.discount_value || 'Deal'));
        card.appendChild(el('div', 'merchant', v.merchant_name));
        card.appendChild(el('div', 'description', v.description));

        var codeBox = el('div', 'code', v.code || 'No code needed');
        codeBox.title = 'Click to copy';
        codeBox.addEventListener('click', function () { copyCode(codeBox, v.code, v.merchant_name); });
        card.appendChild(codeBox);

        card.appendChild(el('div', 'copy-hint', 'Click code to copy'));

        var meta = el('div', 'voucher-meta');
        var expiryText = v.expiry_date
          ? (isExpiringSoon ? 'Expires soon: ' : 'Expires: ') + new Date(v.expiry_date).toLocaleDateString()
          : 'No expiry';
        meta.appendChild(el('span', 'expiry' + (isExpiringSoon ? ' soon' : ''), expiryText));
        card.appendChild(meta);

        grid.appendChild(card);
      });

      container.appendChild(grid);
    }

    function copyCode(box, code, merchant) {
      if (!code) return;
      navigator.clipboard.writeText(code);
      track('voucher_code_copied', { code: code, merchant: merchant });

      var original = box.textContent;
      box.textContent = 'Copied!';
      box.style.background = 'var(--success)';
      box.style.color = 'white';
      setTimeout(function () {
        box.textContent = original;
        box.style.background = '';
        box.style.color = '';
      }, 1500);
    }

    function filterByMerchant(name) {
      track('merchant_clicked', { merchant_name: name });
      var categorySelect = document.getElementById('category');
      var searchInput = document.getElementById('search-input');
      if (categorySelect) categorySelect.value = '';
      if (searchInput) searchInput.value = name;
      search();
      var section = document.getElementById('vouchers');
      if (section) section.scrollIntoView({ behavior: 'smooth' });
    }

    function search() {
      currentPage = 0;
      var searchInput = document.getElementById('search-input');
      var categorySelect = document.getElementById('category');
      track('search', {
        search_term: searchInput ? searchInput.value : '',
        category: categorySelect ? categorySelect.value : ''
      });
      loadVouchers();
    }

    async function loadCategories() {
      try {
        var res = await fetch('/api/merchants');
        var data = await res.json();
        var select = document.getElementById('category');
        (data.categories || []).sort().forEach(function (cat) {
          var option = document.createElement('option');
          option.value = cat;
          option.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
          select.appendChild(option);
        });
      } catch (err) {
        console.error('Failed to load categories', err);
      }
    }

    document.getElementById('search-input').addEventListener('keypress', function (e) {
      if (e.key === 'Enter') search();
    });

    loadCategories();
    loadTopMerchants();
    loadVouchers();
  </script>
</body>
</html>`;
