/**
 * Fills the 100Cal reviews grid with real Judge.me reviews, and expands it in
 * place when the "read all" links are clicked.
 *
 * Judge.me exposes aggregate rating and review count to Liquid, but never the
 * individual reviews — those only exist inside its own widget. The section
 * therefore renders its authored cards server-side and this script swaps in
 * real review text once it has some, which keeps the layout identical and means
 * a failure here leaves the page exactly as it rendered.
 *
 * Sources are tried cheapest-first:
 *   1. the review_widget_data metafield, already inlined in the page
 *   2. Judge.me's widget endpoint, the same one its own preloader calls
 *
 * Extra cards are cloned from the three the section already rendered, so an
 * appended review carries the same classes and the same tag rhythm as an
 * authored one. Only text nodes are ever written. No classes or styles are
 * added or removed, so nothing here can move the design.
 */
(function () {
  'use strict';

  var WIDGET_ENDPOINT = 'https://judge.me/reviews/reviews_for_widget';
  var PER_PAGE = 20;

  /** The grid is three columns wide, so grow it a full row at a time. */
  var BATCH = 3;

  function textOf(node) {
    return node ? (node.textContent || '').replace(/\s+/g, ' ').trim() : '';
  }

  function starString(rating) {
    var filled = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
    return '★'.repeat(filled) + '☆'.repeat(5 - filled);
  }

  /**
   * Judge.me has shipped several shapes for a review over the years and the
   * widget payload is not a documented contract, so read every field by
   * probing the names it has used rather than assuming one.
   */
  function pick(source, keys) {
    for (var i = 0; i < keys.length; i++) {
      var value = source[keys[i]];
      if (value !== undefined && value !== null && value !== '') return value;
    }
    return '';
  }

  function normalise(raw) {
    if (!raw || typeof raw !== 'object') return null;

    var reviewer = raw.reviewer || raw.author || {};
    var name = pick(raw, ['reviewer_name', 'author_name', 'name']);
    if (!name && typeof reviewer === 'object') {
      name = pick(reviewer, ['name', 'display_name', 'first_name']);
    } else if (!name && typeof reviewer === 'string') {
      name = reviewer;
    }

    var body = pick(raw, ['body', 'content', 'review_body', 'text']);
    var rating = Number(pick(raw, ['rating', 'score', 'stars'])) || 0;
    var verified = Boolean(
      raw.verified === true ||
        raw.verified_buyer === true ||
        raw.is_verified_buyer === true ||
        raw.verified === 'buyer'
    );

    if (!body) return null;
    return { rating: rating, body: body, name: String(name || '').trim(), verified: verified };
  }

  /** Walks an unknown payload looking for the first array that holds reviews. */
  function findReviews(payload, depth) {
    if (!payload || depth > 4) return [];

    if (Array.isArray(payload)) {
      return payload.map(normalise).filter(Boolean);
    }

    if (typeof payload !== 'object') return [];

    var preferred = ['reviews', 'data', 'widget', 'reviewWidget', 'result'];
    for (var i = 0; i < preferred.length; i++) {
      if (payload[preferred[i]]) {
        var hit = findReviews(payload[preferred[i]], depth + 1);
        if (hit.length) return hit;
      }
    }

    var keys = Object.keys(payload);
    for (var j = 0; j < keys.length; j++) {
      if (preferred.indexOf(keys[j]) !== -1) continue;
      var found = findReviews(payload[keys[j]], depth + 1);
      if (found.length) return found;
    }

    return [];
  }

  /** Judge.me's endpoint answers with rendered widget HTML, not review JSON. */
  function parseWidgetHtml(html) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var nodes = doc.querySelectorAll('.jdgm-rev');
    var reviews = [];

    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var ratingNode = node.querySelector('.jdgm-rev__rating');
      var rating = Number(
        node.getAttribute('data-score') ||
          (ratingNode && ratingNode.getAttribute('data-score')) ||
          0
      );

      var body = textOf(node.querySelector('.jdgm-rev__body'));
      if (!body) continue;

      reviews.push({
        rating: rating,
        body: body,
        name: textOf(node.querySelector('.jdgm-rev__author')),
        verified: node.getAttribute('data-verified-buyer') === 'true' ||
          Boolean(node.querySelector('.jdgm-rev__buyer-badge'))
      });
    }

    return reviews;
  }

  function fromMetafield() {
    var tag = document.querySelector('script[data-judgeme-widget-data]');
    if (!tag) return [];
    try {
      return findReviews(JSON.parse(tag.textContent), 0);
    } catch (error) {
      return [];
    }
  }

  function fromEndpoint(state, page) {
    if (!state.shop || !state.productId) return Promise.resolve([]);

    var url =
      WIDGET_ENDPOINT +
      '?url=' + encodeURIComponent(state.shop) +
      '&shop_domain=' + encodeURIComponent(state.shop) +
      '&platform=shopify' +
      '&page=' + page +
      '&per_page=' + PER_PAGE +
      '&product_id=' + encodeURIComponent(state.productId);

    return fetch(url, { credentials: 'omit' })
      .then(function (response) {
        if (!response.ok) throw new Error('Judge.me responded ' + response.status);
        return response.text();
      })
      .then(function (raw) {
        // The endpoint returns {"html": "..."} but has served bare HTML before.
        try {
          var payload = JSON.parse(raw);
          var json = findReviews(payload, 0);
          if (json.length) return json;
          if (typeof payload.html === 'string') return parseWidgetHtml(payload.html);
          return [];
        } catch (error) {
          return parseWidgetHtml(raw);
        }
      })
      .catch(function () {
        return [];
      });
  }

  /** Writes one review into a card, leaving its tag and classes untouched. */
  function paint(state, card, review) {
    var stars = card.querySelector('.r-stars');
    var quote = card.querySelector('.r-quote');
    var name = card.querySelector('.r-name');
    var product = card.querySelector('.r-product');

    if (stars) stars.textContent = starString(review.rating);
    if (quote) quote.textContent = '“' + review.body + '”';
    if (name && review.name) name.textContent = review.name;
    if (product) {
      product.textContent = review.verified && state.verifiedLabel
        ? state.verifiedLabel + ' · ' + state.productTitle
        : state.productTitle;
    }
  }

  function take(state, count) {
    var out = [];
    while (out.length < count && state.pool.length) {
      var review = state.pool.shift();
      if (review.rating >= state.minRating && review.body) out.push(review);
    }
    return out;
  }

  /** True once the pool is empty and Judge.me has no further pages to give. */
  function isExhausted(state) {
    return !state.pool.length && state.noMorePages;
  }

  function setTriggersVisible(state, visible) {
    for (var i = 0; i < state.triggers.length; i++) {
      var trigger = state.triggers[i];
      // The footer is a bordered rule wrapping its link, so an orphaned border
      // would be left behind if only the link were hidden.
      var target = trigger.closest('.rev-footer') || trigger;
      target.style.display = visible ? '' : 'none';
    }
  }

  function appendBatch(state) {
    var reviews = take(state, BATCH);
    if (!reviews.length) return;

    for (var i = 0; i < reviews.length; i++) {
      // Cloning cycles through the three authored cards so appended rows keep
      // the same tag colours in the same order.
      var source = state.templates[state.rendered % state.templates.length];
      var card = source.cloneNode(true);
      card.removeAttribute('data-judgeme-card');
      paint(state, card, reviews[i]);
      state.grid.appendChild(card);
      state.rendered += 1;
    }
  }

  /**
   * The metafield and page one of the endpoint describe the same reviews, so
   * pages are merged by identity rather than appended blindly.
   */
  function addToPool(state, reviews) {
    for (var i = 0; i < reviews.length; i++) {
      var review = reviews[i];
      var key = review.name + '|' + review.body.slice(0, 120);
      if (state.seen[key]) continue;
      state.seen[key] = true;
      state.pool.push(review);
    }
  }

  /**
   * Walks forward through pages until there is a full row to show. A page can
   * contribute nothing once the min-rating filter and de-duplication have run,
   * so one fetch is not enough to conclude Judge.me is out of reviews.
   */
  function fetchUntilFilled(state, attempts) {
    if (state.pool.length >= BATCH || state.noMorePages || attempts >= 5) {
      state.loading = false;
      return Promise.resolve();
    }

    state.page += 1;

    return fromEndpoint(state, state.page).then(function (reviews) {
      if (!reviews.length) {
        state.noMorePages = true;
        state.loading = false;
        return;
      }
      addToPool(state, reviews);
      return fetchUntilFilled(state, attempts + 1);
    });
  }

  /** Tops the pool up before it runs dry. */
  function ensurePool(state) {
    if (state.pool.length >= BATCH || state.noMorePages || state.loading) {
      return Promise.resolve();
    }
    state.loading = true;
    return fetchUntilFilled(state, 0);
  }

  function onTrigger(state, event) {
    event.preventDefault();

    // Deliberately not gated on state.loading — a top-up may be in flight while
    // the pool still holds a full row, and swallowing the click would read as a
    // dead button.
    appendBatch(state);

    ensurePool(state).then(function () {
      if (isExhausted(state)) setTriggersVisible(state, false);
    });

    if (isExhausted(state)) setTriggersVisible(state, false);
  }

  function build(grid) {
    var cards = Array.prototype.slice.call(grid.querySelectorAll('[data-judgeme-card]'));

    return {
      grid: grid,
      templates: cards,
      rendered: 0,
      pool: [],
      seen: {},
      // Set by start() to the last page already accounted for, so topping up
      // never re-requests a page whose reviews are on screen.
      page: 0,
      loading: false,
      noMorePages: false,
      shop: grid.getAttribute('data-shop-domain'),
      productId: grid.getAttribute('data-product-id'),
      productTitle: grid.getAttribute('data-product-title') || '',
      verifiedLabel: grid.getAttribute('data-verified-label') || '',
      minRating: Number(grid.getAttribute('data-min-rating')) || 0,
      // A merchant-set link opts out of expanding and navigates instead, so
      // only the links Liquid marked as expanders are wired up here.
      triggers: Array.prototype.slice.call(document.querySelectorAll('[data-judgeme-more]'))
    };
  }

  function start(state, reviews, fromPage) {
    // Seeding from the metafield leaves page zero unfetched, so the first
    // top-up still asks for page one and de-duplicates what it already has.
    state.page = fromPage;
    addToPool(state, reviews);

    var initial = take(state, state.templates.length);
    for (var i = 0; i < initial.length; i++) {
      paint(state, state.templates[i], initial[i]);
    }

    // Cards with no review to show keep their authored copy, so the tag cycle
    // resumes from the full row on screen rather than the number replaced.
    state.rendered = state.templates.length;

    for (var j = 0; j < state.triggers.length; j++) {
      state.triggers[j].addEventListener('click', onTrigger.bind(null, state));
    }

    ensurePool(state).then(function () {
      if (isExhausted(state)) setTriggersVisible(state, false);
    });
  }

  function init() {
    var grid = document.querySelector('[data-judgeme-reviews]');
    if (!grid || grid.dataset.judgemeReady === 'true') return;
    grid.dataset.judgemeReady = 'true';

    var state = build(grid);
    if (!state.templates.length) return;

    var inline = fromMetafield();
    if (inline.length) {
      start(state, inline, 0);
      return;
    }

    fromEndpoint(state, 1).then(function (reviews) {
      if (reviews.length) {
        start(state, reviews, 1);
      } else {
        // Nothing to expand into, so the links would do nothing if clicked.
        state.noMorePages = true;
        setTriggersVisible(state, false);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // The theme editor re-renders sections in place, which drops the filled text.
  document.addEventListener('shopify:section:load', init);
})();
