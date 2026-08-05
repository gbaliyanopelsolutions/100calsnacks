(function () {
  'use strict';

  var FREE_SHIP_CENTS = 2500; // $25.00 — update to match store threshold

  // ── Cart API ────────────────────────────────────────────────────────────────
  function apiFetch(url, opts) {
    return fetch(url, Object.assign({
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
    }, opts || {})).then(function (r) {
      if (!r.ok) return r.json().then(function (e) { throw e; });
      return r.json();
    });
  }

  function fetchCart() {
    return apiFetch('/cart.js');
  }

  function addItem(variantId, qty) {
    return apiFetch('/cart/add.js', {
      method: 'POST',
      body: JSON.stringify({ id: variantId, quantity: qty || 1 })
    }).then(function () { return fetchCart(); });
  }

  function changeItem(key, qty) {
    return apiFetch('/cart/change.js', {
      method: 'POST',
      body: JSON.stringify({ id: key, quantity: qty })
    });
  }

  // ── Drawer ──────────────────────────────────────────────────────────────────
  function openDrawer() {
    var drawer  = document.getElementById('hc-cart-drawer');
    var overlay = document.getElementById('hc-cart-overlay');
    if (!drawer) return;
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    if (overlay) overlay.classList.add('visible');
    document.body.style.overflow = 'hidden';
    fetchCart().then(renderCart);
  }

  function closeDrawer() {
    var drawer  = document.getElementById('hc-cart-drawer');
    var overlay = document.getElementById('hc-cart-overlay');
    if (drawer) { drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); }
    if (overlay) overlay.classList.remove('visible');
    document.body.style.overflow = '';
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  function money(cents) {
    var n = (cents / 100).toFixed(2);
    return '$' + (n.slice(-3) === '.00' ? n.slice(0, -3) : n);
  }

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function renderCart(cart) {
    renderCount(cart.item_count);
    renderShippingBar(cart.total_price);
    renderItems(cart.items);
    renderFooter(cart);
    renderPreorder(cart.items);
    renderUpsell(cart.items);
    renderCartPage(cart);
  }

  function renderCount(count) {
    var badge = document.getElementById('hc-cart-count');
    if (badge) {
      badge.textContent = count + ' item' + (count !== 1 ? 's' : '');
      badge.style.display = count > 0 ? '' : 'none';
    }
    document.querySelectorAll('.hcnv-cart-btn, .hcnv-mob-cart').forEach(function (el) {
      var base = el.dataset.baseLabel || 'Cart';
      el.textContent = count > 0 ? base + ' (' + count + ')' : base;
    });
  }

  function renderShippingBar(totalCents) {
    var fill = document.getElementById('hc-shipping-fill');
    var tick = document.getElementById('hc-shipping-tick');
    var msg  = document.getElementById('hc-shipping-msg');
    if (!fill) return;
    var pct = Math.min(Math.round((totalCents / FREE_SHIP_CENTS) * 100), 100);
    fill.style.width = pct + '%';
    if (totalCents >= FREE_SHIP_CENTS) {
      if (tick) tick.classList.add('done');
      if (msg)  msg.innerHTML = '<strong style="color:var(--teal)">🎉 Free shipping unlocked!</strong>';
    } else {
      if (tick) tick.classList.remove('done');
      if (msg) {
        var rem = money(FREE_SHIP_CENTS - totalCents);
        msg.innerHTML = 'You\'re <strong>' + rem + '</strong> away from free shipping';
      }
    }
  }

  function renderItems(items) {
    var container = document.getElementById('hc-cart-items');
    if (!container) return;
    if (!items || items.length === 0) {
      container.innerHTML = '<div class="hc-cart-empty"><p>Your cart is empty.</p></div>';
      return;
    }
    var html = '';
    items.forEach(function (item) {
      var imgSrc = item.image ? item.image.replace(/(\.\w{3,4})(\?|$)/, '_128x128$1$2') : '';
      var img = imgSrc
        ? '<img src="' + esc(imgSrc) + '" alt="' + esc(item.product_title) + '" loading="lazy" width="64" height="64">'
        : '<span class="hc-ci-icon">🍫</span>';

      html += '<div class="hc-cart-item" data-key="' + esc(item.key) + '">';
      html += '<div class="hc-ci-img">' + img + '</div>';
      html += '<div class="hc-ci-body"><div class="hc-ci-top"><div>';
      html += '<div class="hc-ci-name">' + esc(item.product_title) + '</div>';
      if (item.variant_title && item.variant_title !== 'Default Title') {
        html += '<div class="hc-ci-variant">' + esc(item.variant_title) + '</div>';
      }
      if (item.selling_plan_allocation) {
        var planName = item.selling_plan_allocation.selling_plan
          ? item.selling_plan_allocation.selling_plan.name
          : 'Subscription';
        html += '<div class="hc-ci-tag hc-ci-tag--sub">' + esc(planName) + '</div>';
      }
      if (item.properties && item.properties._preorder) {
        html += '<div class="hc-ci-tag hc-ci-tag--preorder">Pre-Order</div>';
      }
      html += '</div>';
      html += '<button class="hc-ci-delete" data-key="' + esc(item.key) + '" aria-label="Remove ' + esc(item.product_title) + '">✕</button>';
      html += '</div>';
      html += '<div class="hc-ci-bottom">';
      html += '<div class="hc-ci-qty">';
      html += '<button class="hc-ci-qty-btn" data-key="' + esc(item.key) + '" data-qty="' + Math.max(0, item.quantity - 1) + '">−</button>';
      html += '<div class="hc-ci-qty-num">' + item.quantity + '</div>';
      html += '<button class="hc-ci-qty-btn" data-key="' + esc(item.key) + '" data-qty="' + (item.quantity + 1) + '">+</button>';
      html += '</div>';
      html += '<div class="hc-ci-price">' + money(item.line_price);
      if (item.original_line_price > item.line_price) {
        html += '<span class="hc-ci-price-orig">' + money(item.original_line_price) + '</span>';
      }
      html += '</div></div></div></div>';
    });
    container.innerHTML = html;
  }

  function renderFooter(cart) {
    var filled = document.getElementById('hc-cart-footer-filled');
    var empty  = document.getElementById('hc-cart-footer-empty');
    var hasItems = cart.item_count > 0;
    if (filled) filled.style.display = hasItems ? '' : 'none';
    if (empty)  empty.style.display  = hasItems ? 'none' : '';

    var subtotalEl = document.getElementById('hc-subtotal');
    var origEl     = document.getElementById('hc-subtotal-orig');
    var savingsEl  = document.getElementById('hc-savings-line');
    if (subtotalEl) subtotalEl.textContent = money(cart.total_price);
    if (origEl) {
      var hasDiscount = cart.original_total_price > cart.total_price;
      origEl.textContent  = hasDiscount ? money(cart.original_total_price) : '';
      origEl.style.display = hasDiscount ? '' : 'none';
    }
    if (savingsEl) {
      var saved = cart.original_total_price - cart.total_price;
      savingsEl.textContent  = saved > 0 ? 'You\'re saving ' + money(saved) + ' 🎉' : '';
      savingsEl.style.display = saved > 0 ? '' : 'none';
    }
  }

  function renderCartPage(cart) {
    var pageItems = document.getElementById('hcp-items');
    if (!pageItems) return;

    if (cart.item_count === 0) { window.location.reload(); return; }

    var html = '';
    cart.items.forEach(function (item) {
      var imgSrc = item.image ? item.image.replace(/(\.\w{3,4})(\?|$)/, '_200x200$1$2') : '';
      var img = imgSrc
        ? '<img src="' + esc(imgSrc) + '" alt="' + esc(item.product_title) + '" loading="lazy" width="100" height="100">'
        : '<span class="hc-ci-icon">🍫</span>';
      html += '<div class="hc-cart-item hcp-item" data-key="' + esc(item.key) + '">';
      html += '<div class="hc-ci-img">' + img + '</div>';
      html += '<div class="hc-ci-body"><div class="hc-ci-top"><div>';
      html += '<div class="hc-ci-name">' + esc(item.product_title) + '</div>';
      if (item.variant_title && item.variant_title !== 'Default Title') {
        html += '<div class="hc-ci-variant">' + esc(item.variant_title) + '</div>';
      }
      if (item.selling_plan_allocation) {
        var planName = item.selling_plan_allocation.selling_plan
          ? item.selling_plan_allocation.selling_plan.name
          : 'Subscription';
        html += '<div class="hc-ci-tag hc-ci-tag--sub">' + esc(planName) + '</div>';
      }
      if (item.properties && item.properties._preorder) {
        html += '<div class="hc-ci-tag hc-ci-tag--preorder">Pre-Order</div>';
      }
      html += '</div><button class="hc-ci-delete" data-key="' + esc(item.key) + '" aria-label="Remove ' + esc(item.product_title) + '">✕</button></div>';
      html += '<div class="hc-ci-bottom">';
      html += '<div class="hc-ci-qty">';
      html += '<button class="hc-ci-qty-btn" data-key="' + esc(item.key) + '" data-qty="' + Math.max(0, item.quantity - 1) + '">−</button>';
      html += '<div class="hc-ci-qty-num">' + item.quantity + '</div>';
      html += '<button class="hc-ci-qty-btn" data-key="' + esc(item.key) + '" data-qty="' + (item.quantity + 1) + '">+</button>';
      html += '</div><div class="hc-ci-price">' + money(item.line_price);
      if (item.original_line_price > item.line_price) {
        html += '<span class="hc-ci-price-orig">' + money(item.original_line_price) + '</span>';
      }
      html += '</div></div></div></div>';
    });
    pageItems.innerHTML = html;

    var subtotalEl = document.getElementById('hcp-subtotal');
    var origEl     = document.getElementById('hcp-subtotal-orig');
    var savingsEl  = document.getElementById('hcp-savings-line');
    var countEl    = document.getElementById('hcp-title-count');
    var noteEl     = document.getElementById('hcp-shipping-note');
    if (subtotalEl) subtotalEl.textContent = money(cart.total_price);
    if (origEl) {
      var hasDiscount = cart.original_total_price > cart.total_price;
      origEl.textContent   = hasDiscount ? money(cart.original_total_price) : '';
      origEl.style.display = hasDiscount ? '' : 'none';
    }
    if (savingsEl) {
      var saved = cart.original_total_price - cart.total_price;
      savingsEl.textContent   = saved > 0 ? 'You\'re saving ' + money(saved) + ' 🎉' : '';
      savingsEl.style.display = saved > 0 ? '' : 'none';
    }
    if (countEl) countEl.textContent = cart.item_count + ' item' + (cart.item_count !== 1 ? 's' : '');
    if (noteEl) noteEl.innerHTML = cart.total_price >= 2500
      ? '<span style="color:var(--teal)">🎉 Free shipping included!</span>'
      : 'Shipping calculated at checkout';

    var preorderEl = document.getElementById('hcp-preorder-notice');
    if (preorderEl) {
      var hasPreorder = cart.items.some(function (i) { return i.properties && i.properties._preorder; });
      preorderEl.style.display = hasPreorder ? 'flex' : 'none';
    }

    var upsell = document.getElementById('hcp-rebuy-section');
    if (upsell) {
      var cartIds = cart.items.map(function (i) { return String(i.product_id); });
      var visible = 0;
      upsell.querySelectorAll('.hc-rebuy-card').forEach(function (card) {
        var hide = cartIds.indexOf(card.dataset.productId) !== -1;
        card.style.display = hide ? 'none' : '';
        if (!hide) visible++;
      });
      upsell.style.display = visible > 0 ? '' : 'none';
    }
  }

  function renderPreorder(items) {
    var notice = document.getElementById('hc-preorder-notice');
    if (!notice) return;
    var has = items && items.some(function (i) { return i.properties && i.properties._preorder; });
    notice.style.display = has ? 'flex' : 'none';
  }

  function renderUpsell(items) {
    var section = document.getElementById('hc-rebuy-section');
    if (!section) return;
    var cartIds = (items || []).map(function (i) { return String(i.product_id); });
    var cards = section.querySelectorAll('.hc-rebuy-card');
    var visible = 0;
    cards.forEach(function (card) {
      var pid = card.dataset.productId;
      if (cartIds.indexOf(pid) !== -1) {
        card.style.display = 'none';
      } else {
        card.style.display = '';
        visible++;
      }
    });
    section.style.display = visible > 0 ? '' : 'none';
  }

  // ── Button loading state ────────────────────────────────────────────────────
  function setLoading(btn, on) {
    if (!btn) return;
    if (on) {
      btn.dataset.orig = btn.innerHTML;
      btn.innerHTML = '…';
      btn.disabled = true;
    } else {
      if (btn.dataset.orig !== undefined) btn.innerHTML = btn.dataset.orig;
      btn.disabled = false;
    }
  }

  // ── ATC — intercept form submits (capture phase) ────────────────────────────
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || !form.action) return;
    if (form.action.indexOf('cart/add') === -1) return;
    if (!form.querySelector('input[name="id"]')) return;
    e.preventDefault();
    e.stopPropagation();
    var btn = form.querySelector('[type="submit"]');
    setLoading(btn, true);
    fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
      body: new FormData(form)
    })
      .then(function (r) { return r.ok ? r.json() : r.json().then(function (err) { throw err; }); })
      .then(function () { return fetchCart(); })
      .then(function (cart) { setLoading(btn, false); renderCart(cart); openDrawer(); })
      .catch(function () { setLoading(btn, false); });
  }, true);

  // ── Click delegation ────────────────────────────────────────────────────────
  document.addEventListener('click', function (e) {
    var t = e.target;

    // Close — button or overlay
    if (t.closest('#hc-cart-close') || t.id === 'hc-cart-overlay') {
      closeDrawer(); return;
    }

    // Open — nav cart buttons
    if (t.closest('.hcnv-cart-btn') || t.closest('.hcnv-mob-cart')) {
      e.preventDefault(); openDrawer(); return;
    }

    // Product grid standalone ATC (.hc-add-btn with data-variant-id, not inside a form)
    var addBtn = t.closest('.hc-add-btn');
    if (addBtn && addBtn.dataset.variantId && !addBtn.closest('form')) {
      var variantId = parseInt(addBtn.dataset.variantId, 10);
      if (!variantId) return;
      setLoading(addBtn, true);
      addItem(variantId, 1).then(function (cart) {
        setLoading(addBtn, false);
        renderCart(cart);
        openDrawer();
      }).catch(function () { setLoading(addBtn, false); });
      return;
    }

    // Qty change
    var qtyBtn = t.closest('.hc-ci-qty-btn');
    if (qtyBtn) {
      var key = qtyBtn.dataset.key;
      var qty = parseInt(qtyBtn.dataset.qty, 10);
      var row = qtyBtn.closest('.hc-cart-item');
      if (row) { row.style.opacity = '.4'; row.style.pointerEvents = 'none'; }
      changeItem(key, qty).then(renderCart);
      return;
    }

    // Remove item
    var delBtn = t.closest('.hc-ci-delete');
    if (delBtn) {
      var key = delBtn.dataset.key;
      var row = delBtn.closest('.hc-cart-item');
      if (row) {
        row.style.transition = 'opacity .22s, transform .22s';
        row.style.opacity = '0';
        row.style.transform = 'translateX(20px)';
      }
      setTimeout(function () { changeItem(key, 0).then(renderCart); }, 200);
      return;
    }

    // Upsell add button
    var rebuyBtn = t.closest('.hc-rebuy-add');
    if (rebuyBtn && !rebuyBtn.classList.contains('added')) {
      var variantId = parseInt(rebuyBtn.dataset.variantId, 10);
      if (!variantId) return;
      setLoading(rebuyBtn, true);
      addItem(variantId, 1).then(function (cart) {
        rebuyBtn.textContent = '✓ Added';
        rebuyBtn.classList.add('added');
        rebuyBtn.disabled = false;
        renderCart(cart);
      }).catch(function () { setLoading(rebuyBtn, false); });
      return;
    }

    // Quiz CTA (#hcqa-rpc-cta) — requires data-variant-id set by quiz JS
    var quizCta = document.getElementById('hcqa-rpc-cta');
    if (quizCta && t === quizCta) {
      var variantId = parseInt(quizCta.dataset.variantId, 10);
      if (!variantId) return; // no variant → quiz JS fallback (navigate to productUrl) handles it
      e.stopImmediatePropagation();
      setLoading(quizCta, true);
      addItem(variantId, 1).then(function (cart) {
        setLoading(quizCta, false);
        renderCart(cart);
        openDrawer();
      }).catch(function () { setLoading(quizCta, false); });
      return;
    }

    // Secondary ATC band — scrolling sticky bar above footer (.satc-btn)
    var satcBtn = t.closest('.satc-btn');
    if (satcBtn) {
      var variantId = parseInt(satcBtn.dataset.variantId, 10);
      if (!variantId) return;
      setLoading(satcBtn, true);
      addItem(variantId, 1).then(function (cart) {
        setLoading(satcBtn, false);
        renderCart(cart);
        openDrawer();
      }).catch(function () { setLoading(satcBtn, false); });
      return;
    }

    // Sticky ATC button on product page
    var stickyBtn = t.closest('.sticky-btn');
    if (stickyBtn) {
      var variantInput = document.querySelector('form[action*="cart/add"] input[name="id"]');
      if (!variantInput) return;
      var variantId = parseInt(variantInput.value, 10);
      setLoading(stickyBtn, true);
      addItem(variantId, 1).then(function (cart) {
        setLoading(stickyBtn, false);
        renderCart(cart);
        openDrawer();
      }).catch(function () { setLoading(stickyBtn, false); });
      return;
    }

    // Continue shopping
    if (t.closest('#hc-continue-btn')) {
      closeDrawer(); return;
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeDrawer();
  });

  // ── Init ────────────────────────────────────────────────────────────────────
  function init() {
    document.querySelectorAll('.hcnv-cart-btn, .hcnv-mob-cart').forEach(function (el) {
      if (!el.dataset.baseLabel) {
        el.dataset.baseLabel = el.textContent.trim().replace(/\s*\(\d+\)\s*$/, '');
      }
    });
    fetchCart().then(function (cart) {
      renderCount(cart.item_count);
      renderShippingBar(cart.total_price);
      renderUpsell(cart.items);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  document.addEventListener('shopify:section:load', init);

})();
