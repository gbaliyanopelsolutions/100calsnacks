(function () {
  'use strict';

  var APP_SEL = '.shopify_subscriptions_app_block';

  var _mo        = null;   // watches the app block for self-updates
  var _debounce  = null;
  var _poll      = null;   // waits for the app block to catch up after a variant change
  var _retry     = null;   // waits for the app block to render at all
  var _unsub     = null;   // theme pubsub unsubscriber
  var _liveSig   = '';     // live block's fingerprint at build time — detects self-updates
  var _builtSig  = '';     // fingerprint of the prices actually on screen
  var _state     = null;   // { mode: 'ot' | 'sub', freq: <index> } — survives rebuilds

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

  // Fingerprint of every price the app block is advertising. Lets us tell a real
  // variant price change from the DOM churn our own rebuild causes.
  function priceSig(source) {
    if (!source) return '';
    return Array.prototype.map.call(source.querySelectorAll('input[data-radio-type]'), function (r) {
      return [
        r.getAttribute('data-radio-type'),
        r.getAttribute('data-selling-plan-id') || '',
        r.getAttribute('data-variant-price') || '',
        r.getAttribute('data-variant-compare-at-price') || ''
      ].join(':');
    }).join('|');
  }

  // Prices are read from `source`, which may be freshly fetched section HTML
  // rather than the live block — the app doesn't always restamp itself.
  function readPrices(source) {
    var out = { oneTime: '', plans: {}, badge: 'Save' };
    if (!source) return out;

    var ot = source.querySelector('input[data-radio-type="one_time_purchase"]');
    out.oneTime = cleanPrice(ot ? ot.getAttribute('data-variant-price') : '');

    Array.prototype.forEach.call(source.querySelectorAll('input[data-radio-type="selling_plan"]'), function (r) {
      var lbl    = r.closest('label');
      var nameEl = lbl ? lbl.querySelector('.title_and_price_wrapper > span') : null;
      out.plans[r.getAttribute('data-selling-plan-id') || ''] = {
        name:  nameEl ? nameEl.textContent.trim() : '',
        price: cleanPrice(r.getAttribute('data-variant-price') || ''),
        orig:  cleanPrice(r.getAttribute('data-variant-compare-at-price') || '')
      };
    });

    // e.g. "Subscribe for 10% off" → badge: "10% off"
    var gnEl = source.querySelector('.group_name');
    var pctM = gnEl ? gnEl.textContent.match(/(\d+%\s*off)/i) : null;
    if (pctM) out.badge = pctM[1];

    return out;
  }

  function teardown() {
    if (_mo) { _mo.disconnect(); _mo = null; }
    clearTimeout(_debounce);
    document.querySelectorAll('.hc-sub-ui').forEach(function (el) { el.remove(); });
    var s = appBlock();
    if (s) delete s.dataset.hcBuild;
  }

  // `priceSource` overrides where prices are read from; defaults to the live block.
  function buildSubToggle(priceSource) {
    var section = appBlock();
    if (!section || section.dataset.hcBuild) return;

    // ── Find live app inputs (these are the ones the app's JS listens to) ──
    var radioOT    = section.querySelector('input[data-radio-type="one_time_purchase"]');
    var planRadios = Array.prototype.slice.call(section.querySelectorAll('input[data-radio-type="selling_plan"]'));

    // App hasn't rendered yet — retry
    if (!radioOT && !planRadios.length) return;
    section.dataset.hcBuild = '1';

    var priced = readPrices(priceSource || section);
    var otPrice   = priced.oneTime;
    var badgeText = priced.badge;

    // ── Selling plans: live radio for wiring, price from the price source ──
    var plans = planRadios.map(function (r) {
      var id  = r.getAttribute('data-selling-plan-id') || '';
      var p   = priced.plans[id];
      if (!p) {
        // Price source didn't list this plan — fall back to the live radio.
        var lbl    = r.closest('label');
        var nameEl = lbl ? lbl.querySelector('.title_and_price_wrapper > span') : null;
        p = {
          name:  nameEl ? nameEl.textContent.trim() : '',
          price: cleanPrice(r.getAttribute('data-variant-price') || ''),
          orig:  cleanPrice(r.getAttribute('data-variant-compare-at-price') || '')
        };
      }
      return { id: id, radio: r, name: p.name, price: p.price, orig: p.orig };
    });

    var p0 = plans[0] || {};

    // ── Frequency dropdown ─────────────────────────────────────────
    var freqHtml = '';
    if (plans.length) {
      freqHtml = '<div class="hc-sf-wrap" id="hc-sf-wrap" style="display:none">'
        + '<div class="hc-sf-label">Delivery Frequency</div>'
        + '<select class="hc-sf-select" id="hc-sf-select">';
      plans.forEach(function (p) {
        freqHtml += '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>';
      });
      freqHtml += '</select></div>';
    }

    // ── Price block helper ─────────────────────────────────────────
    function priceBlock(price, orig, id) {
      if (!price) return '';
      var s = '<div class="pt-price"' + (id ? ' id="' + id + '"' : '') + '>'
        + esc(price);
      if (orig) s += '<span class="pt-price-orig">' + esc(orig) + '</span>';
      return s + '</div>';
    }

    // ── Build .purchase-toggle HTML ────────────────────────────────
    var html = '<div class="hc-sub-ui">'
      + '<div class="purchase-toggle">'

        // Row 1: one-time
        + '<div class="pt-option selected" id="hc-pt-ot"'
          + ' role="radio" aria-checked="true" tabindex="0">'
          + '<div class="pt-radio checked"></div>'
          + '<span class="pt-label">One-time purchase</span>'
          + priceBlock(otPrice, '', 'hc-ot-price')
        + '</div>'

        // Row 2: subscribe
        + '<div class="pt-option" id="hc-pt-sub"'
          + ' role="radio" aria-checked="false" tabindex="0">'
          + '<div class="pt-radio"></div>'
          + '<span class="pt-label">Subscribe &amp; Save'
            + '<span class="pt-sub-label">Auto-renews, skip or cancel anytime</span>'
          + '</span>'
          + '<span class="pt-badge hc-sub-badge">' + esc(badgeText) + '</span>'
          + priceBlock(p0.price, p0.orig, 'hc-sub-price')
        + '</div>'

      + '</div>'
      + freqHtml
    + '</div>';

    // Insert before the app's section; hide that section in place
    // (visibility:hidden keeps it in the layout/DOM so app-block.js
    //  can still respond to events and update the selling_plan input)
    section.insertAdjacentHTML('beforebegin', html);
    section.style.cssText = 'position:absolute;visibility:hidden;width:1px;height:1px;overflow:hidden;';

    // ── Wire DOM references ────────────────────────────────────────
    var ptOT     = document.getElementById('hc-pt-ot');
    var ptSub    = document.getElementById('hc-pt-sub');
    var sfWrap   = document.getElementById('hc-sf-wrap');
    var sfSelect = document.getElementById('hc-sf-select');
    var subPrEl  = document.getElementById('hc-sub-price');

    function fire(el, type) {
      el.dispatchEvent(new Event(type, { bubbles: true }));
    }

    function activatePlan(idx) {
      var p = plans[idx];
      if (!p) return;
      // Tell the app's JS which plan the user chose
      p.radio.checked = true;
      fire(p.radio, 'input');
      fire(p.radio, 'change');
      // Update displayed price
      if (subPrEl) {
        subPrEl.innerHTML = esc(p.price)
          + (p.orig ? '<span class="pt-price-orig">' + esc(p.orig) + '</span>' : '');
      }
    }

    function pickOT() {
      ptOT.classList.add('selected');    ptOT.setAttribute('aria-checked', 'true');
      ptSub.classList.remove('selected'); ptSub.setAttribute('aria-checked', 'false');
      ptOT.querySelector('.pt-radio').classList.add('checked');
      ptSub.querySelector('.pt-radio').classList.remove('checked');
      if (sfWrap) sfWrap.style.display = 'none';
      _state = { mode: 'ot', freq: sfSelect ? sfSelect.selectedIndex : 0 };
      // Tell app's JS: one-time selected → it clears selling_plan
      if (radioOT) { radioOT.checked = true; fire(radioOT, 'input'); fire(radioOT, 'change'); }
    }

    function pickSub(idx) {
      ptSub.classList.add('selected');    ptSub.setAttribute('aria-checked', 'true');
      ptOT.classList.remove('selected');  ptOT.setAttribute('aria-checked', 'false');
      ptSub.querySelector('.pt-radio').classList.add('checked');
      ptOT.querySelector('.pt-radio').classList.remove('checked');
      if (sfWrap) sfWrap.style.display = '';
      _state = { mode: 'sub', freq: idx || 0 };
      activatePlan(idx || 0);
    }

    ptOT.addEventListener('click', pickOT);
    ptSub.addEventListener('click', function () {
      pickSub(sfSelect ? sfSelect.selectedIndex : 0);
    });

    if (sfSelect) {
      sfSelect.addEventListener('change', function () {
        pickSub(sfSelect.selectedIndex);
      });
    }

    // Keyboard navigation
    [ptOT, ptSub].forEach(function (el, i) {
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); ptSub.focus(); }
        if (e.key === 'ArrowUp'   || e.key === 'ArrowLeft')  { e.preventDefault(); ptOT.focus(); }
      });
    });

    // Re-apply whatever the shopper had selected before the rebuild, and keep the
    // app's own radios in sync either way so selling_plan can't go stale.
    if (_state && _state.mode === 'sub' && plans.length) {
      if (sfSelect) sfSelect.selectedIndex = Math.min(_state.freq || 0, plans.length - 1);
      pickSub(sfSelect ? sfSelect.selectedIndex : 0);
    } else {
      pickOT();
    }

    // Track both: the live block's state (so the observer can ignore mutations
    // that change no price) and what is actually rendered on screen (so a later
    // variant change is compared against what the shopper is looking at).
    _liveSig  = priceSig(section);
    _builtSig = priceSig(priceSource || section);

    // Rebuild when the app restamps itself. It updates the data-variant-price
    // attributes in place on variant change, so attributes must be observed —
    // childList alone never fires.
    if (_mo) _mo.disconnect();
    _mo = new MutationObserver(function () {
      clearTimeout(_debounce);
      _debounce = setTimeout(function () {
        var s = appBlock();
        if (!s || priceSig(s) === _liveSig) return;
        teardown();
        tryBuild();
      }, 150);
    });
    _mo.observe(section, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-variant-price', 'data-variant-compare-at-price', 'data-selling-plan-id']
    });
  }

  // Retry until the app renders its radio inputs
  function tryBuild(priceSource) {
    clearTimeout(_retry);
    var section = appBlock();
    if (!section) return;
    buildSubToggle(priceSource);
    if (!section.dataset.hcBuild) {
      _retry = setTimeout(function () { tryBuild(priceSource); }, 250);
    }
  }

  // On variant change the theme swaps the price/media but leaves the app block
  // alone, so the overlay keeps showing the old variant's prices. Rebuild it.
  //
  // `html` is the freshly fetched section markup from product-info.js. Its app
  // block is server-rendered for the new variant, which is authoritative — we
  // don't have to wait for (or trust) the app to restamp the live one.
  function onVariantChange(html) {
    clearTimeout(_poll);
    if (!appBlock()) return;

    var fresh = html ? appBlock(html) : null;
    if (fresh && priceSig(fresh) !== _builtSig) {
      teardown();
      tryBuild(fresh);
      return;
    }

    // No usable fetched markup — wait for the live block to restamp itself.
    var waited = 0;
    (function wait() {
      var s = appBlock();
      if (s && priceSig(s) !== _liveSig) {
        teardown();
        tryBuild();
        return;
      }
      waited += 150;
      if (waited < 2500) _poll = setTimeout(wait, 150);
    })();
  }

  function init() {
    // Clean up from any previous section reload
    clearTimeout(_poll);
    clearTimeout(_retry);
    teardown();
    _liveSig  = '';
    _builtSig = '';

    if (_unsub) { _unsub(); _unsub = null; }
    if (typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
      _unsub = subscribe(PUB_SUB_EVENTS.variantChange, function (event) {
        onVariantChange(event && event.data && event.data.html);
      });
    }

    setTimeout(tryBuild, 100);
  }

  // Fallback for variant changes that don't come through the theme's pubsub
  // (and for the app block node being replaced wholesale).
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t && t.name === 'id' && t.closest('form[action*="/cart/add"]')) onVariantChange(null);
  });

  document.addEventListener('DOMContentLoaded', init);
  document.addEventListener('shopify:section:load', init);
})();
