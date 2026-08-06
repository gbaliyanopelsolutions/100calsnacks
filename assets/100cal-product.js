(function () {
  'use strict';

  var APP_SEL = '.shopify_subscriptions_app_block';

  // Prices come from Shopify's own product JSON rather than from the
  // subscriptions app block. The block re-renders itself on its own schedule
  // (and swaps its DOM node when it does), so anything scraped from it goes
  // stale the moment a shopper changes variant. The JSON has every variant's
  // one-time price and selling plan allocations up front, so a variant change
  // is a synchronous re-render with no waiting and nothing to poll for.
  var _product   = null;   // /products/<handle>.js payload
  var _loading   = false;
  var _sample    = '';     // a formatted price to copy the shop's money format from
  var _state     = { mode: 'ot', planId: '' };
  var _planIds   = '';     // plan ids currently in the frequency dropdown
  var _unsub     = null;   // theme pubsub unsubscriber
  var _mo        = null;   // watches the app block re-rendering itself
  var _debounce  = null;
  var _retry     = null;
  var _retries   = 0;
  var _built     = false;

  var MAX_RETRIES = 40;    // ~10s at 250ms

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function cleanPrice(s) {
    // Strip trailing " USD" from Shopify's formatted price strings
    return (s || '').replace(/\s*USD\s*/gi, '').trim();
  }

  function appBlock(root) {
    return (root || document).querySelector(APP_SEL);
  }

  function productInfo() {
    return document.querySelector('product-info');
  }

  function productForm() {
    return document.querySelector('product-form form')
      || document.querySelector('form[action*="/cart/add"]');
  }

  function currentVariantId() {
    var form = productForm();
    var input = form && form.querySelector('input[name="id"]');
    return input ? String(input.value || '') : '';
  }

  function fire(el, type) {
    el.dispatchEvent(new Event(type, { bubbles: true }));
  }

  // ── Hiding the app's own UI ──────────────────────────────────────
  // The app replaces its block node when it re-renders, so an inline style
  // doesn't stick. A stylesheet rule keyed off <html> covers whichever node is
  // on the page. visibility:hidden rather than display:none keeps the block in
  // the DOM so the app's own JS keeps working.
  function installHideRule() {
    if (document.getElementById('hc-sub-hide')) return;
    var st = document.createElement('style');
    st.id = 'hc-sub-hide';
    st.textContent = 'html.hc-sub-active ' + APP_SEL + '{'
      + 'position:absolute!important;visibility:hidden!important;'
      + 'width:1px!important;height:1px!important;overflow:hidden!important;'
      + 'pointer-events:none!important;}';
    document.head.appendChild(st);
  }

  function hideAppBlock(on) {
    if (on) installHideRule();
    document.documentElement.classList.toggle('hc-sub-active', !!on);
  }

  // ── Money ────────────────────────────────────────────────────────
  // Copy whatever format the shop already renders instead of guessing at
  // currency symbols and separators.
  function moneySample() {
    if (_sample) return _sample;

    var candidates = [];
    var s = appBlock();
    var r = s && s.querySelector('input[data-variant-price]');
    if (r) candidates.push(r.getAttribute('data-variant-price'));
    var pi = productInfo();
    var pe = pi && (pi.querySelector('.price-item') || pi.querySelector('.buy-box-price'));
    if (pe) candidates.push(pe.textContent);

    for (var i = 0; i < candidates.length; i++) {
      var m = cleanPrice(candidates[i]).match(/[^\d\s]*\s?\d[\d.,]*/);
      if (m) { _sample = m[0]; return _sample; }
    }
    return '$0.00';
  }

  function money(cents) {
    var amount = (Number(cents) || 0) / 100;
    var m = String(moneySample()).match(/^([^\d]*)([\d.,]+)(.*)$/);
    if (!m) return '$' + amount.toFixed(2);

    var num     = m[2];
    var decSep  = /[.,]\d{2}$/.test(num) ? num.charAt(num.length - 3) : '.';
    var thouSep = decSep === ',' ? '.' : ',';
    var parts   = amount.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thouSep);

    return cleanPrice(m[1] + parts.join(decSep) + m[3]);
  }

  // ── Price data ───────────────────────────────────────────────────
  function loadProduct() {
    if (_product || _loading) return;
    var pi = productInfo();
    var url = pi && pi.dataset.url;
    if (!url || typeof fetch !== 'function') return;

    _loading = true;
    fetch(url.split('?')[0] + '.js', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        _loading = false;
        if (!data || !data.variants) return;
        _product = data;
        refresh();
      })
      .catch(function () { _loading = false; });
  }

  function planName(id) {
    var groups = (_product && _product.selling_plan_groups) || [];
    for (var g = 0; g < groups.length; g++) {
      var plans = groups[g].selling_plans || [];
      for (var p = 0; p < plans.length; p++) {
        if (String(plans[p].id) === String(id)) return plans[p].name || '';
      }
    }
    return '';
  }

  function pctOff(price, base) {
    if (!base || price >= base) return 0;
    return Math.round((1 - price / base) * 100);
  }

  // Prices for the variant currently in the form, straight from the JSON.
  function jsonPrices() {
    if (!_product) return null;

    var id = currentVariantId();
    var variant = null;
    for (var i = 0; i < _product.variants.length; i++) {
      if (String(_product.variants[i].id) === id) { variant = _product.variants[i]; break; }
    }
    if (!variant) return null;

    var out  = { oneTime: money(variant.price), plans: [], badge: '' };
    var best = 0;

    (variant.selling_plan_allocations || []).forEach(function (a) {
      var pct  = pctOff(a.price, variant.price);
      var name = planName(a.selling_plan_id);
      if (pct > best) best = pct;
      if (pct > 0 && name.indexOf('%') === -1) name += ', ' + pct + '% off';
      out.plans.push({
        id:    String(a.selling_plan_id),
        name:  name,
        price: money(a.price),
        orig:  a.price < variant.price ? money(variant.price) : ''
      });
    });

    out.badge = best > 0 ? best + '% off' : 'Save';
    return out;
  }

  // Fallback while the JSON is still in flight (or if it never arrives):
  // read whatever the app block is currently advertising.
  function scrapePrices() {
    var section = appBlock();
    if (!section) return null;

    var out = { oneTime: '', plans: [], badge: 'Save' };

    var ot = section.querySelector('input[data-radio-type="one_time_purchase"]');
    out.oneTime = cleanPrice(ot ? ot.getAttribute('data-variant-price') : '');

    Array.prototype.forEach.call(section.querySelectorAll('input[data-radio-type="selling_plan"]'), function (r) {
      var lbl    = r.closest('label');
      var nameEl = lbl ? lbl.querySelector('.title_and_price_wrapper > span') : null;
      out.plans.push({
        id:    String(r.getAttribute('data-selling-plan-id') || ''),
        name:  nameEl ? nameEl.textContent.trim() : '',
        price: cleanPrice(r.getAttribute('data-variant-price') || ''),
        orig:  cleanPrice(r.getAttribute('data-variant-compare-at-price') || '')
      });
    });

    // e.g. "Subscribe for 10% off" → badge: "10% off"
    var gnEl = section.querySelector('.group_name');
    var pctM = gnEl ? gnEl.textContent.match(/(\d+%\s*off)/i) : null;
    if (pctM) out.badge = pctM[1];

    return (out.oneTime || out.plans.length) ? out : null;
  }

  function currentData() {
    return jsonPrices() || scrapePrices();
  }

  // ── Cart wiring ──────────────────────────────────────────────────
  // The selling plan is put on the form ourselves rather than left to the app.
  // The app only stamps its hidden input in response to its own radios, and
  // after it re-renders those radios are new nodes — a subscription selection
  // made before that would silently add as a one-time purchase.
  function setSellingPlan(id) {
    var form = productForm();
    if (!form) return;

    var inputs = Array.prototype.slice.call(form.querySelectorAll('[name="selling_plan"]'));
    if (!inputs.length) {
      if (!id) return;
      var made = document.createElement('input');
      made.type = 'hidden';
      made.name = 'selling_plan';
      made.className = 'hc-selling-plan';
      form.appendChild(made);
      inputs = [made];
    }

    inputs.forEach(function (i) {
      i.value = id || '';
      // Disabled inputs are left out of FormData, so a one-time purchase can't
      // carry an empty selling_plan into /cart/add.
      i.disabled = !id;
    });
  }

  // Keep the app's own radios in step, looking them up live — the node they
  // live in may have been replaced since the shopper last clicked.
  function syncAppRadios() {
    var section = appBlock();
    if (!section) return;

    var target = _state.mode === 'sub' && _state.planId
      ? section.querySelector('input[data-radio-type="selling_plan"][data-selling-plan-id="' + _state.planId + '"]')
      : section.querySelector('input[data-radio-type="one_time_purchase"]');
    if (!target) return;

    target.checked = true;
    fire(target, 'input');
    fire(target, 'change');
  }

  function applySelection() {
    syncAppRadios();
    // After the app's handlers have run, so ours is the value that sticks.
    setSellingPlan(_state.mode === 'sub' ? _state.planId : '');
    setTimeout(function () {
      setSellingPlan(_state.mode === 'sub' ? _state.planId : '');
    }, 100);
  }

  // ── Overlay ──────────────────────────────────────────────────────
  function priceBlock(price, orig, id) {
    var s = '<div class="pt-price"' + (id ? ' id="' + id + '"' : '') + '>' + esc(price || '');
    if (orig) s += '<span class="pt-price-orig">' + esc(orig) + '</span>';
    return s + '</div>';
  }

  function build(data) {
    var section = appBlock();
    if (!section || _built) return;

    var html = '<div class="hc-sub-ui">'
      + '<div class="purchase-toggle">'

        // Row 1: one-time
        + '<div class="pt-option selected" id="hc-pt-ot"'
          + ' role="radio" aria-checked="true" tabindex="0">'
          + '<div class="pt-radio checked"></div>'
          + '<span class="pt-label">One-time purchase</span>'
          + priceBlock('', '', 'hc-ot-price')
        + '</div>'

        // Row 2: subscribe
        + '<div class="pt-option" id="hc-pt-sub"'
          + ' role="radio" aria-checked="false" tabindex="0">'
          + '<div class="pt-radio"></div>'
          + '<span class="pt-label">Subscribe &amp; Save'
            + '<span class="pt-sub-label">Auto-renews, skip or cancel anytime</span>'
          + '</span>'
          + '<span class="pt-badge hc-sub-badge"></span>'
          + priceBlock('', '', 'hc-sub-price')
        + '</div>'

      + '</div>'
      + '<div class="hc-sf-wrap" id="hc-sf-wrap" style="display:none">'
        + '<div class="hc-sf-label">Delivery Frequency</div>'
        + '<select class="hc-sf-select" id="hc-sf-select"></select>'
      + '</div>'
    + '</div>';

    section.insertAdjacentHTML('beforebegin', html);
    hideAppBlock(true);
    _built = true;

    var ptOT     = document.getElementById('hc-pt-ot');
    var ptSub    = document.getElementById('hc-pt-sub');
    var sfSelect = document.getElementById('hc-sf-select');

    ptOT.addEventListener('click', function () { pick('ot'); });
    ptSub.addEventListener('click', function () { pick('sub', sfSelect.value); });
    sfSelect.addEventListener('change', function () { pick('sub', sfSelect.value); });

    // Keyboard navigation
    [ptOT, ptSub].forEach(function (el) {
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); ptSub.focus(); }
        if (e.key === 'ArrowUp'   || e.key === 'ArrowLeft')  { e.preventDefault(); ptOT.focus(); }
      });
    });

    applyPrices(data);
    observe();
  }

  function pick(mode, planId) {
    _state.mode = mode;
    if (mode === 'sub' && planId) _state.planId = String(planId);
    applyPrices(currentData());
    applySelection();
  }

  // Updates the overlay in place. Rebuilding it on every variant change is what
  // made the shopper's selection and the app's radios drift apart.
  function applyPrices(data) {
    if (!_built || !data) return;

    var ptOT     = document.getElementById('hc-pt-ot');
    var ptSub    = document.getElementById('hc-pt-sub');
    var sfWrap   = document.getElementById('hc-sf-wrap');
    var sfSelect = document.getElementById('hc-sf-select');
    var otPrice  = document.getElementById('hc-ot-price');
    var subPrice = document.getElementById('hc-sub-price');
    var badge    = document.querySelector('.hc-sub-badge');
    if (!ptOT || !ptSub) return;

    var plans = data.plans || [];

    // Frequency options — only rebuilt when the plans themselves change, so the
    // dropdown keeps its selection across variant changes.
    var ids = plans.map(function (p) { return p.id; }).join(',');
    if (ids !== _planIds) {
      _planIds = ids;
      sfSelect.innerHTML = plans.map(function (p) {
        return '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>';
      }).join('');
    }

    // Keep the shopper's plan if the new variant still offers it
    var plan = null;
    for (var i = 0; i < plans.length; i++) {
      if (plans[i].id === _state.planId) { plan = plans[i]; break; }
    }
    if (!plan) plan = plans[0] || null;
    _state.planId = plan ? plan.id : '';
    if (plan) sfSelect.value = plan.id;

    if (!plans.length) _state.mode = 'ot';

    otPrice.innerHTML = esc(data.oneTime || '');
    if (plan) {
      subPrice.innerHTML = esc(plan.price)
        + (plan.orig ? '<span class="pt-price-orig">' + esc(plan.orig) + '</span>' : '');
    } else {
      subPrice.innerHTML = '';
    }
    if (badge) badge.textContent = data.badge || 'Save';

    var isSub = _state.mode === 'sub';
    ptSub.style.display = plans.length ? '' : 'none';
    ptOT.classList.toggle('selected', !isSub);
    ptSub.classList.toggle('selected', isSub);
    ptOT.setAttribute('aria-checked', String(!isSub));
    ptSub.setAttribute('aria-checked', String(isSub));
    ptOT.querySelector('.pt-radio').classList.toggle('checked', !isSub);
    ptSub.querySelector('.pt-radio').classList.toggle('checked', isSub);
    sfWrap.style.display = isSub && plans.length ? '' : 'none';
  }

  function refresh() {
    var data = currentData();
    if (!data) return;
    if (!_built) { build(data); } else { applyPrices(data); }
    applySelection();
  }

  // The app re-rendering its block gives us new radios to check, and the block
  // may be a brand new node — so watch an ancestor, not the block itself.
  function observe() {
    if (_mo) _mo.disconnect();
    var section = appBlock();
    if (!section) return;

    _mo = new MutationObserver(function () {
      clearTimeout(_debounce);
      _debounce = setTimeout(function () {
        hideAppBlock(true);
        applySelection();
        if (!_product) applyPrices(currentData());   // scrape fallback only
      }, 150);
    });
    _mo.observe(section.closest('product-info') || section.parentNode || document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-variant-price', 'data-variant-compare-at-price', 'data-selling-plan-id']
    });
  }

  // Retry until the app block is on the page and we have something to price
  function tryBuild() {
    clearTimeout(_retry);
    if (_built) { _retries = 0; return; }

    var data = currentData();
    if (data) { build(data); }
    if (_built) { _retries = 0; return; }

    if (++_retries > MAX_RETRIES) {
      // Never managed to read the app's options — leave the app's own UI on
      // screen rather than showing the shopper no subscription options at all.
      _retries = 0;
      hideAppBlock(false);
      return;
    }
    _retry = setTimeout(tryBuild, 250);
  }

  function init() {
    clearTimeout(_retry);
    if (_mo) { _mo.disconnect(); _mo = null; }
    document.querySelectorAll('.hc-sub-ui').forEach(function (el) { el.remove(); });
    _built   = false;
    _retries = 0;
    _planIds = '';
    _sample  = '';

    if (_unsub) { _unsub(); _unsub = null; }
    if (typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
      _unsub = subscribe(PUB_SUB_EVENTS.variantChange, function () { refresh(); });
    }

    loadProduct();
    setTimeout(tryBuild, 100);
  }

  // Fallback for variant changes that don't come through the theme's pubsub
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t && t.name === 'id' && t.closest('form[action*="/cart/add"]')) refresh();
  });

  // Last word before the theme serialises the form. Document-level capture runs
  // ahead of product-form's own submit handler, so whatever the app did to the
  // selling_plan input in between doesn't decide what lands in the cart.
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!_built || !form || form !== productForm()) return;
    setSellingPlan(_state.mode === 'sub' ? _state.planId : '');
  }, true);

  document.addEventListener('DOMContentLoaded', init);
  document.addEventListener('shopify:section:load', init);
})();
