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

      // Frontend
      if (url.pathname === '/') {
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

  let query = `
    SELECT v.*, m.name as merchant_name, m.domain, m.logo_url
    FROM vouchers v
    JOIN merchants m ON v.merchant_id = m.id
    WHERE v.is_active = 1 AND (v.expiry_date IS NULL OR v.expiry_date > DATE('now'))
  `;

  const params = [];

  if (search) {
    query += ` AND (v.description LIKE ? OR m.name LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }

  if (category) {
    query += ` AND m.category = ?`;
    params.push(category);
  }

  query += ` ORDER BY ${sort === 'discount' ? 'v.discount_value DESC' : 'v.scraped_at DESC'}`;
  query += ` LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const { results } = await env.DB.prepare(query).bind(...params).all();

  const countResult = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM vouchers v
     JOIN merchants m ON v.merchant_id = m.id
     WHERE v.is_active = 1 AND (v.expiry_date IS NULL OR v.expiry_date > DATE('now'))`
  ).first();

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
  <title>DiscountVouchers - UK Merchant Vouchers & Codes</title>

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
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      color: #333;
    }
    header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 2rem 1rem;
      text-align: center;
    }
    header h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
    header p { font-size: 1.1rem; opacity: 0.9; }

    .container { max-width: 1200px; margin: 0 auto; padding: 2rem 1rem; }

    .search-bar {
      display: flex;
      gap: 1rem;
      margin-bottom: 2rem;
      flex-wrap: wrap;
    }
    .search-bar input,
    .search-bar select {
      padding: 0.75rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 1rem;
      flex: 1;
      min-width: 200px;
    }
    .search-bar button {
      padding: 0.75rem 2rem;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
    }
    .search-bar button:hover { background: #764ba2; }

    .vouchers-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .voucher-card {
      background: white;
      border-radius: 8px;
      padding: 1.5rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      border-left: 4px solid #667eea;
    }
    .voucher-card h3 {
      color: #667eea;
      margin-bottom: 0.5rem;
      font-size: 1.1rem;
    }
    .voucher-card .merchant { color: #666; font-size: 0.9rem; margin-bottom: 0.5rem; }
    .voucher-card .description { margin-bottom: 1rem; }
    .voucher-card .code {
      background: #f0f0f0;
      padding: 0.75rem;
      border-radius: 4px;
      font-family: monospace;
      font-weight: bold;
      margin-bottom: 1rem;
      cursor: pointer;
      text-align: center;
      transition: background 0.2s;
    }
    .voucher-card .code:hover { background: #e0e0e0; }
    .voucher-card .expiry { font-size: 0.85rem; color: #999; }
    .voucher-card .expiry.soon { color: #ff6b6b; }

    .top-merchants {
      background: white;
      border-radius: 8px;
      padding: 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .top-merchants h2 { margin-bottom: 1.5rem; color: #333; }
    .merchants-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 1rem;
    }
    .merchant-tile {
      text-align: center;
      padding: 1rem;
      border: 1px solid #eee;
      border-radius: 4px;
      cursor: pointer;
      transition: border-color 0.2s;
    }
    .merchant-tile:hover { border-color: #667eea; }
    .merchant-tile img {
      max-width: 100%;
      max-height: 60px;
      margin-bottom: 0.5rem;
    }
    .merchant-tile .name { font-weight: bold; font-size: 0.9rem; }
    .merchant-tile .count { color: #667eea; font-size: 0.8rem; }

    .loading { text-align: center; padding: 2rem; }
    .error { color: #ff6b6b; background: #ffe0e0; padding: 1rem; border-radius: 4px; }
    .empty { text-align: center; padding: 2rem; color: #999; }

    footer {
      background: #333;
      color: #999;
      padding: 2rem;
      text-align: center;
      font-size: 0.9rem;
    }
  </style>
</head>
<body>
  <header>
    <h1>DiscountVouchers</h1>
    <p>Discover the latest voucher codes & deals from top UK merchants</p>
  </header>

  <div class="container">
    <div class="search-bar">
      <input type="text" id="search" placeholder="Search vouchers or merchants...">
      <select id="category">
        <option value="">All Categories</option>
      </select>
      <select id="sort">
        <option value="newest">Newest First</option>
        <option value="discount">Best Discounts</option>
      </select>
      <button onclick="search()">Search</button>
    </div>

    <div class="top-merchants" id="topMerchants"></div>

    <div id="vouchersContainer"></div>
  </div>

  <footer>
    <p>&copy; 2026 DiscountVouchers. Always check merchant websites for terms & conditions.</p>
  </footer>

  <script>
    let currentPage = 0;
    const pageSize = 20;

    async function loadVouchers() {
      const search = document.getElementById('search').value;
      const category = document.getElementById('category').value;
      const sort = document.getElementById('sort').value;

      const params = new URLSearchParams({
        q: search,
        category,
        sort,
        limit: pageSize,
        offset: currentPage * pageSize
      });

      try {
        const res = await fetch(\`/api/vouchers?\${params}\`);
        const data = await res.json();
        renderVouchers(data.vouchers);
      } catch (err) {
        document.getElementById('vouchersContainer').innerHTML = '<div class="error">Failed to load vouchers</div>';
      }
    }

    async function loadTopMerchants() {
      try {
        const res = await fetch('/api/top-merchants');
        const merchants = await res.json();

        const html = '<h2>Top Merchants</h2><div class="merchants-grid">' +
          merchants.map(m => \`
            <div class="merchant-tile" onclick="filterByMerchant('\${m.name}')">
              \${m.logo_url ? '<img src="' + m.logo_url + '" alt="' + m.name + '">' : '<div style="height:60px;display:flex;align-items:center;justify-content:center;font-weight:bold">' + m.name.substr(0, 3).toUpperCase() + '</div>'}
              <div class="name">\${m.name}</div>
              <div class="count">\${m.voucher_count} vouchers</div>
            </div>
          \`).join('') + '</div>';

        document.getElementById('topMerchants').innerHTML = html;
      } catch (err) {
        console.error('Failed to load merchants', err);
      }
    }

    function renderVouchers(vouchers) {
      if (!vouchers.length) {
        document.getElementById('vouchersContainer').innerHTML = '<div class="empty">No vouchers found</div>';
        return;
      }

      const html = '<div class="vouchers-grid">' +
        vouchers.map(v => {
          const expiry = v.expiry_date ? new Date(v.expiry_date) : null;
          const isExpiringSoon = expiry && (expiry - new Date()) < 7 * 24 * 60 * 60 * 1000;
          return \`
            <div class="voucher-card">
              <h3>\${v.discount_value || 'Special Offer'}</h3>
              <div class="merchant">\${v.merchant_name}</div>
              <div class="description">\${v.description}</div>
              <div class="code" onclick="copyCode('\${v.code}')">\${v.code || 'No code needed'}</div>
              \${v.expiry_date ? '<div class="expiry \${isExpiringSoon ? 'soon' : ''}">Expires: ' + new Date(v.expiry_date).toLocaleDateString() + '</div>' : '<div class="expiry">No expiry</div>'}
            </div>
          \`;
        }).join('') + '</div>';

      document.getElementById('vouchersContainer').innerHTML = html;
    }

    function copyCode(code) {
      navigator.clipboard.writeText(code);
      gtag('event', 'voucher_code_copied', {
        'code': code
      });
      alert('Voucher code copied: ' + code);
    }

    function filterByMerchant(name) {
      gtag('event', 'merchant_clicked', {
        'merchant_name': name
      });
      document.getElementById('search').value = name;
      search();
    }

    function search() {
      currentPage = 0;
      gtag('event', 'search', {
        'search_term': document.getElementById('search').value,
        'category': document.getElementById('category').value
      });
      loadVouchers();
    }

    async function loadCategories() {
      try {
        const res = await fetch('/api/merchants');
        const data = await res.json();
        const select = document.getElementById('category');
        data.categories.forEach(cat => {
          const option = document.createElement('option');
          option.value = cat;
          option.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
          select.appendChild(option);
        });
      } catch (err) {
        console.error('Failed to load categories', err);
      }
    }

    // Initial load
    loadCategories();
    loadTopMerchants();
    loadVouchers();
  </script>
</body>
</html>`;
