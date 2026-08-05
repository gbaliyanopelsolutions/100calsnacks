(function () {
  'use strict';

  var _mo = null;
  var _rebuildTimer = null;

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function cleanPrice(s) {
    // Strip trailing " USD" from Shopify's formatted price strings
    return (s || '').replace(/\s*USD\s*/gi, '').trim();
  }

  function buildSubToggle() {
    var section = document.querySelector('.shopify_subscriptions_app_block');
    if (!section || section.dataset.hcBuild) return;

    // ── Find app inputs ────────────────────────────────────────────
    var radioOT    = section.querySelector('input[data-radio-type="one_time_purchase"]');
    var planRadios = Array.from(section.querySelectorAll('input[data-radio-type="selling_plan"]'));

    // App hasn't rendered yet — retry
    if (!radioOT && !planRadios.length) return;
    section.dataset.hcBuild = '1';

    // ── One-time price (from data attribute) ───────────────────────
    var otPrice = cleanPrice(radioOT ? radioOT.getAttribute('data-variant-price') : '');

    // ── Badge text from group heading ──────────────────────────────
    // e.g. "Subscribe for 10% off" → badge: "10% off"
    var gnEl = section.querySelector('.group_name');
    var pctM = gnEl ? gnEl.textContent.match(/(\d+%\s*off)/i) : null;
    var badgeText = pctM ? pctM[1] : 'Save';

    // ── Selling plans ──────────────────────────────────────────────
    var plans = planRadios.map(function (r) {
      var lbl    = r.closest('label');
      var nameEl = lbl ? lbl.querySelector('.title_and_price_wrapper > span') : null;
      return {
        id:    r.getAttribute('data-selling-plan-id') || '',
        radio: r,
        name:  nameEl ? nameEl.textContent.trim() : '',
        price: cleanPrice(r.getAttribute('data-variant-price') || ''),
        orig:  cleanPrice(r.getAttribute('data-variant-compare-at-price') || '')
      };
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
          + priceBlock(otPrice, '', '')
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
    var ptOT    = document.getElementById('hc-pt-ot');
    var ptSub   = document.getElementById('hc-pt-sub');
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
      // Tell app's JS: one-time selected → it clears selling_plan
      if (radioOT) { radioOT.checked = true; fire(radioOT, 'input'); fire(radioOT, 'change'); }
    }

    function pickSub(idx) {
      ptSub.classList.add('selected');    ptSub.setAttribute('aria-checked', 'true');
      ptOT.classList.remove('selected');  ptOT.setAttribute('aria-checked', 'false');
      ptSub.querySelector('.pt-radio').classList.add('checked');
      ptOT.querySelector('.pt-radio').classList.remove('checked');
      if (sfWrap) sfWrap.style.display = '';
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

    // Re-build overlay when app re-renders on variant change
    if (_mo) _mo.disconnect();
    _mo = new MutationObserver(function () {
      clearTimeout(_rebuildTimer);
      _rebuildTimer = setTimeout(function () {
        if (_mo) { _mo.disconnect(); _mo = null; }
        var s = document.querySelector('.shopify_subscriptions_app_block');
        if (s) {
          document.querySelectorAll('.hc-sub-ui').forEach(function (el) { el.remove(); });
          delete s.dataset.hcBuild;
          s.style.cssText = 'position:absolute;visibility:hidden;width:1px;height:1px;overflow:hidden;';
        }
        tryBuild();
      }, 200);
    });
    _mo.observe(section, { childList: true, subtree: true });
  }

  // Retry until the app renders its radio inputs
  function tryBuild() {
    var section = document.querySelector('.shopify_subscriptions_app_block');
    if (!section) return;
    buildSubToggle();
    if (!section.dataset.hcBuild) setTimeout(tryBuild, 250);
  }

  function init() {
    // Clean up from any previous section reload
    document.querySelectorAll('.hc-sub-ui').forEach(function (el) { el.remove(); });
    var section = document.querySelector('.shopify_subscriptions_app_block');
    if (section) delete section.dataset.hcBuild;
    setTimeout(tryBuild, 100);
  }

  document.addEventListener('DOMContentLoaded', init);
  document.addEventListener('shopify:section:load', init);
})();
