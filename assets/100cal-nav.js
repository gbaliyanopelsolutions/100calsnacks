(function () {
  'use strict';

  var _docHandlersInit = false;

  function initNav() {
    var shopItem    = document.querySelector('.hcnv-shop-item');
    var mmOverlay   = document.querySelector('.hcnv-mm-overlay');
    var shopTrigger = document.querySelector('.hcnv-shop-trigger');
    var mobDrawer   = document.querySelector('.hcnv-mob-drawer');
    var mobOverlay  = document.querySelector('.hcnv-mob-overlay');
    var mobHam      = document.querySelector('.hcnv-mob-ham');
    var mobClose    = document.querySelector('.hcnv-mob-close');

    if (!shopItem && !mobHam) return;

    function openMenu() {
      if (!shopItem) return;
      shopItem.classList.add('open');
      if (mmOverlay) mmOverlay.classList.add('visible');
      if (shopTrigger) shopTrigger.setAttribute('aria-expanded', 'true');
    }

    function closeMenu() {
      if (!shopItem) return;
      shopItem.classList.remove('open');
      if (mmOverlay) mmOverlay.classList.remove('visible');
      if (shopTrigger) shopTrigger.setAttribute('aria-expanded', 'false');
    }

    function openMobMenu() {
      if (mobDrawer) mobDrawer.classList.add('open');
      if (mobOverlay) mobOverlay.classList.add('visible');
      if (mobHam) mobHam.classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    function closeMobMenu() {
      if (mobDrawer) mobDrawer.classList.remove('open');
      if (mobOverlay) mobOverlay.classList.remove('visible');
      if (mobHam) mobHam.classList.remove('open');
      document.body.style.overflow = '';
    }

    if (shopTrigger) {
      shopTrigger.addEventListener('click', function (e) {
        e.stopPropagation();
        shopItem.classList.contains('open') ? closeMenu() : openMenu();
      });
    }

    if (mmOverlay) {
      mmOverlay.addEventListener('click', closeMenu);
    }

    if (shopItem) {
      shopItem.addEventListener('mouseenter', function () {
        if (window.innerWidth > 767) openMenu();
      });
      shopItem.addEventListener('mouseleave', function () {
        setTimeout(function () {
          if (shopItem && !shopItem.matches(':hover')) closeMenu();
        }, 120);
      });
    }

    if (mobHam) {
      mobHam.addEventListener('click', function () {
        mobDrawer && mobDrawer.classList.contains('open') ? closeMobMenu() : openMobMenu();
      });
    }

    if (mobOverlay) {
      mobOverlay.addEventListener('click', closeMobMenu);
    }

    if (mobClose) {
      mobClose.addEventListener('click', closeMobMenu);
    }

    if (mobDrawer) {
      mobDrawer.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', closeMobMenu);
      });
    }

    // Close desktop mega menu when any link inside it is clicked
    if (shopItem) {
      shopItem.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', closeMenu);
      });
    }

    // ── Search ─────────────────────────────────────────────────────────────────
    var searchPanel  = document.getElementById('hcnv-search-panel');
    var searchInput  = document.getElementById('hcnv-search-input');
    var searchResults = document.getElementById('hcnv-search-results');
    var searchClear  = document.getElementById('hcnv-search-clear');
    var searchClose  = document.getElementById('hcnv-search-close');
    var searchBtns   = document.querySelectorAll('.hcnv-search-btn');

    var _searchTimer   = null;
    var _searchCtrl    = null;
    var _searchActive  = -1;

    function openSearch() {
      if (!searchPanel) return;
      closeMenu();
      searchPanel.classList.add('open');
      searchPanel.setAttribute('aria-hidden', 'false');
      searchBtns.forEach(function (b) { b.setAttribute('aria-expanded', 'true'); });
      setTimeout(function () { if (searchInput) searchInput.focus(); }, 50);
    }

    function closeSearch() {
      if (!searchPanel) return;
      searchPanel.classList.remove('open');
      searchPanel.setAttribute('aria-hidden', 'true');
      searchBtns.forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
      if (searchInput) searchInput.value = '';
      if (searchClear) searchClear.hidden = true;
      if (searchResults) searchResults.innerHTML = '';
      _searchActive = -1;
    }

    function moneyFmt(amount) {
      return '$' + parseFloat(amount).toFixed(2).replace(/\.00$/, '');
    }

    function escHtml(s) {
      return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function renderSearchResults(data) {
      if (!searchResults) return;
      var res = data && data.resources && data.resources.results;
      if (!res) { searchResults.innerHTML = ''; return; }
      var products = res.products || [];
      var articles = res.articles || [];
      var q = searchInput ? searchInput.value.trim() : '';
      var html = '';

      if (!products.length && !articles.length) {
        searchResults.innerHTML = '<div class="hcnv-sr-empty">No results for &ldquo;' + escHtml(q) + '&rdquo;</div>';
        return;
      }

      if (products.length) {
        html += '<div class="hcnv-sr-section"><div class="hcnv-sr-label">Products</div>';
        products.slice(0, 4).forEach(function (p) {
          var imgUrl = p.featured_image && p.featured_image.url
            ? p.featured_image.url.replace(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i, '_80x80.$1$2')
            : null;
          var img = imgUrl
            ? '<img src="' + escHtml(imgUrl) + '" alt="' + escHtml(p.title) + '" class="hcnv-sr-img" width="52" height="52" loading="lazy">'
            : '<div class="hcnv-sr-img-placeholder">🍫</div>';
          var hasSale = p.compare_at_price && parseFloat(p.compare_at_price) > parseFloat(p.price);
          var priceHtml = '<div class="hcnv-sr-price">'
            + (hasSale ? '<span class="hcnv-sr-price-sale">' + moneyFmt(p.price) + '</span><span class="hcnv-sr-price-orig">' + moneyFmt(p.compare_at_price) + '</span>' : moneyFmt(p.price))
            + '</div>';
          html += '<a href="' + escHtml(p.url) + '" class="hcnv-sr-item">'
            + img
            + '<div class="hcnv-sr-info"><div class="hcnv-sr-title">' + escHtml(p.title) + '</div>'
            + (p.vendor ? '<div class="hcnv-sr-sub">' + escHtml(p.vendor) + '</div>' : '')
            + '</div>' + priceHtml + '</a>';
        });
        html += '</div>';
      }

      if (articles.length) {
        html += '<div class="hcnv-sr-section"><div class="hcnv-sr-label">Articles</div>';
        articles.slice(0, 3).forEach(function (a) {
          html += '<a href="' + escHtml(a.url) + '" class="hcnv-sr-item">'
            + '<div class="hcnv-sr-img-placeholder" style="font-size:18px">📝</div>'
            + '<div class="hcnv-sr-info"><div class="hcnv-sr-title">' + escHtml(a.title) + '</div></div>'
            + '</a>';
        });
        html += '</div>';
      }

      html += '<a href="/search?q=' + encodeURIComponent(q) + '" class="hcnv-sr-all">→ View all results for &ldquo;' + escHtml(q) + '&rdquo;</a>';
      searchResults.innerHTML = html;
      _searchActive = -1;
    }

    function doSearch(q) {
      if (_searchCtrl) _searchCtrl.abort();
      _searchCtrl = new AbortController();
      if (searchResults) searchResults.innerHTML = '<div class="hcnv-sr-loading">Searching…</div>';
      var params = new URLSearchParams({
        'q': q,
        'resources[type]': 'product,article',
        'resources[limit]': '5',
        'resources[options][fields]': 'title,product_type,variants.title,vendor'
      });
      fetch('/search/suggest.json?' + params.toString(), {
        signal: _searchCtrl.signal,
        headers: { 'Accept': 'application/json' }
      })
        .then(function (r) { return r.json(); })
        .then(renderSearchResults)
        .catch(function () {});
    }

    function searchGetItems() {
      return searchResults ? Array.from(searchResults.querySelectorAll('.hcnv-sr-item, .hcnv-sr-all')) : [];
    }

    function searchSetActive(idx) {
      searchGetItems().forEach(function (el) { el.classList.remove('hcnv-sr-active'); });
      var items = searchGetItems();
      if (idx >= 0 && idx < items.length) {
        items[idx].classList.add('hcnv-sr-active');
        items[idx].scrollIntoView({ block: 'nearest' });
      }
      _searchActive = idx;
    }

    if (searchInput) {
      searchInput.addEventListener('input', function () {
        var q = searchInput.value.trim();
        if (searchClear) searchClear.hidden = !q;
        clearTimeout(_searchTimer);
        if (!q) { if (searchResults) searchResults.innerHTML = ''; _searchActive = -1; return; }
        _searchTimer = setTimeout(function () { doSearch(q); }, 220);
      });

      searchInput.addEventListener('keydown', function (e) {
        var items = searchGetItems();
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          searchSetActive(Math.min(_searchActive + 1, items.length - 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          searchSetActive(Math.max(_searchActive - 1, -1));
        } else if (e.key === 'Enter' && _searchActive >= 0 && items[_searchActive]) {
          e.preventDefault();
          items[_searchActive].click();
        }
      });
    }

    if (searchClear) {
      searchClear.addEventListener('click', function () {
        if (searchInput) searchInput.value = '';
        searchClear.hidden = true;
        if (searchResults) searchResults.innerHTML = '';
        _searchActive = -1;
        if (searchInput) searchInput.focus();
      });
    }

    if (searchClose) searchClose.addEventListener('click', closeSearch);

    searchBtns.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        searchPanel && searchPanel.classList.contains('open') ? closeSearch() : openSearch();
      });
    });

    if (!_docHandlersInit) {
      _docHandlersInit = true;

      // Re-query DOM on each event so stale closures don't break after section reloads
      document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        var si = document.querySelector('.hcnv-shop-item');
        var ov = document.querySelector('.hcnv-mm-overlay');
        var tr = document.querySelector('.hcnv-shop-trigger');
        if (si) si.classList.remove('open');
        if (ov) ov.classList.remove('visible');
        if (tr) tr.setAttribute('aria-expanded', 'false');
        var md = document.querySelector('.hcnv-mob-drawer');
        var mo = document.querySelector('.hcnv-mob-overlay');
        var mh = document.querySelector('.hcnv-mob-ham');
        if (md) md.classList.remove('open');
        if (mo) mo.classList.remove('visible');
        if (mh) mh.classList.remove('open');
        document.body.style.overflow = '';
        // Also close search
        var sp = document.getElementById('hcnv-search-panel');
        var si2 = document.getElementById('hcnv-search-input');
        if (sp) { sp.classList.remove('open'); sp.setAttribute('aria-hidden', 'true'); }
        if (si2) si2.value = '';
        document.querySelectorAll('.hcnv-search-btn').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
      });

      document.addEventListener('click', function (e) {
        var si = document.querySelector('.hcnv-shop-item');
        if (si && !si.contains(e.target)) {
          si.classList.remove('open');
          var ov = document.querySelector('.hcnv-mm-overlay');
          if (ov) ov.classList.remove('visible');
          var tr = document.querySelector('.hcnv-shop-trigger');
          if (tr) tr.setAttribute('aria-expanded', 'false');
        }
        // Close search when clicking outside the panel and search buttons
        var sp = document.getElementById('hcnv-search-panel');
        if (sp && sp.classList.contains('open') && !sp.contains(e.target) && !e.target.closest('.hcnv-search-btn')) {
          sp.classList.remove('open');
          sp.setAttribute('aria-hidden', 'true');
          document.querySelectorAll('.hcnv-search-btn').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', initNav);
  document.addEventListener('shopify:section:load', initNav);
})();
