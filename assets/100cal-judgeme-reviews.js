/**
 * Fills the 100Cal reviews grid with real Judge.me reviews.
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
 * Only the text nodes are touched. No classes, styles or elements are added or
 * removed, so nothing here can move the design.
 */
(function () {
  'use strict';

  var WIDGET_ENDPOINT = 'https://judge.me/reviews/reviews_for_widget';
  var PER_PAGE = 20;

  /** Text a card falls back to when Judge.me has no equivalent field. */
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
      var mapped = payload.map(normalise).filter(Boolean);
      return mapped.length ? mapped : [];
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

  function fromEndpoint(grid) {
    var shop = grid.getAttribute('data-shop-domain');
    var productId = grid.getAttribute('data-product-id');
    if (!shop || !productId) return Promise.resolve([]);

    var url =
      WIDGET_ENDPOINT +
      '?url=' + encodeURIComponent(shop) +
      '&shop_domain=' + encodeURIComponent(shop) +
      '&platform=shopify' +
      '&page=1' +
      '&per_page=' + PER_PAGE +
      '&product_id=' + encodeURIComponent(productId);

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

  function fill(grid, reviews) {
    var minRating = Number(grid.getAttribute('data-min-rating')) || 0;
    var productTitle = grid.getAttribute('data-product-title') || '';
    var verifiedLabel = grid.getAttribute('data-verified-label') || '';
    var cards = grid.querySelectorAll('[data-judgeme-card]');

    var usable = reviews.filter(function (review) {
      return review.rating >= minRating && review.body;
    });

    for (var i = 0; i < cards.length && i < usable.length; i++) {
      var review = usable[i];
      var card = cards[i];

      var stars = card.querySelector('.r-stars');
      var quote = card.querySelector('.r-quote');
      var name = card.querySelector('.r-name');
      var product = card.querySelector('.r-product');

      if (stars) stars.textContent = starString(review.rating);
      if (quote) quote.textContent = '“' + review.body + '”';
      if (name && review.name) name.textContent = review.name;
      if (product) {
        product.textContent = review.verified && verifiedLabel
          ? verifiedLabel + ' · ' + productTitle
          : productTitle;
      }
    }
  }

  function init() {
    var grid = document.querySelector('[data-judgeme-reviews]');
    if (!grid) return;

    var inline = fromMetafield();
    if (inline.length) {
      fill(grid, inline);
      return;
    }

    fromEndpoint(grid).then(function (reviews) {
      if (reviews.length) fill(grid, reviews);
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
