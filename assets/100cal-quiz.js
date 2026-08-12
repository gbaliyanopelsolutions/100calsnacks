/* ============================================================
 * 100cal-quiz.js
 * Gut-Brain Quiz + AJAX contact-form gate
 * ============================================================ */

(function () {
  'use strict';

  var QUESTIONS = [];
  var RESULTS = {};

  var currentQ = 0;
  var answers = [];
  var currentResult = null;
  var currentScores = null;
  var shareText = '';

  var appEl = null;
  var modalEl = null;
  var lastFocused = null;

  var openQuizOnError = true;
  var askOncePerSession = true;

  var SESSION_KEY = 'hcqa_contact_done';


  /* ---------------------------------------------------------
   * SMALL HELPERS
   * ------------------------------------------------------- */

  function byId(id) {
    return document.getElementById(id);
  }

  function setText(id, val) {
    var el = byId(id);
    if (el) el.textContent = val;
  }

  function pad(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function sessionGet(key) {
    try { return window.sessionStorage.getItem(key); } catch (e) { return null; }
  }

  function sessionSet(key, val) {
    try { window.sessionStorage.setItem(key, val); } catch (e) {}
  }

  function each(list, fn) {
    Array.prototype.forEach.call(list, fn);
  }


  /* ---------------------------------------------------------
   * BUILD QUESTIONS
   * ------------------------------------------------------- */

  function buildQuestions() {
    QUESTIONS = [];

    each(document.querySelectorAll('.hcqa-question'), function (node) {
      QUESTIONS.push({
        text: node.dataset.text || '',
        weight: parseInt(node.dataset.weight, 10) || 1,
        isTiebreaker: node.dataset.tiebreaker === 'true',
        answers: [
          { text: node.dataset.aText || '', type: node.dataset.aType || 'E' },
          { text: node.dataset.bText || '', type: node.dataset.bType || 'S' },
          { text: node.dataset.cText || '', type: node.dataset.cType || 'C' }
        ]
      });
    });
  }


  /* ---------------------------------------------------------
   * BUILD RESULTS
   * ------------------------------------------------------- */

  function buildResults() {
    RESULTS = {};

    each(document.querySelectorAll('.hcqa-rtype'), function (node) {
      var t = node.dataset.type;
      if (!t) return;

      RESULTS[t] = {
        icon: node.dataset.icon || '',
        type: node.dataset.name || '',
        tagline: node.dataset.tagline || '',
        desc: node.dataset.desc || '',

        accentColor: node.dataset.accent || '#66CCCC',
        accentRgb: node.dataset.accentRgb || '102,204,204',

        pageBg: node.dataset.pageBg || '#0F1213',
        heroBg: node.dataset.heroBg || '#0F1213',
        bgWord: node.dataset.bgWord || '',

        product: node.dataset.product || '',
        productSub: node.dataset.productSub || '',
        productUrl: node.dataset.productUrl || '/collections/all',
        productEmoji: node.dataset.productEmoji || '',
        productBg: node.dataset.productBg || '#1A1A1A',

        macros: [
          { n: node.dataset.m1n || '100', l: node.dataset.m1l || 'Cal' },
          { n: node.dataset.m2n || '5g',  l: node.dataset.m2l || 'Protein' },
          { n: node.dataset.m3n || '4g',  l: node.dataset.m3l || 'Fiber' },
          { n: node.dataset.m4n || '0g',  l: node.dataset.m4l || 'Sugar' }
        ],

        why: [node.dataset.why1, node.dataset.why2, node.dataset.why3].filter(Boolean),

        snackClock: node.dataset.snackClock || '',
        snackWhen: node.dataset.snackWhen || '',
        snackTime: node.dataset.snackTime || '',
        snackSub: node.dataset.snackSub || '',

        shareText: node.dataset.share || 'My Gut-Brain Score is {score}. What\'s yours?',

        variantId: parseInt(node.dataset.variantId || '0', 10)
      };
    });
  }


  /* ---------------------------------------------------------
   * SCREENS
   * ------------------------------------------------------- */

  function showScreen(id) {
    each(document.querySelectorAll('.hcqa-screen'), function (s) {
      s.classList.remove('active');
    });

    var screen = byId(id);
    if (screen) screen.classList.add('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });

    var nr = byId('nav-retake');
    var nt = byId('nav-tagline');

    if (nr) nr.style.display = id === 'hcqa-screen-result' ? 'block' : 'none';
    if (nt) nt.style.display = id === 'hcqa-screen-result' ? 'none' : 'block';
  }

  function startQuiz() {
    currentQ = 0;
    answers = [];
    showScreen('hcqa-screen-questions');
    renderQ();
  }


  /* ---------------------------------------------------------
   * CONTACT MODAL
   * ------------------------------------------------------- */

  /*
   * The modal is moved to <body> on init. A `position: fixed`
   * element trapped inside a section that has a transformed or
   * `overflow: hidden` ancestor gets clipped or mispositioned —
   * this is the single most common reason a modal "does not open".
   */
  function relocateModal() {
    var modal = appEl.querySelector('.hcqa-contact-modal');
    if (!modal) return;

    /* Drop stale copies left behind by a previous section render */
    each(document.querySelectorAll('body > .hcqa-contact-modal'), function (m) {
      if (m !== modal && m.parentNode) m.parentNode.removeChild(m);
    });

    document.body.appendChild(modal);
    modalEl = modal;
  }

  function openContactModal() {
    if (!modalEl) return;

    lastFocused = document.activeElement;

    var form = byId('hcqa-contact-form');
    if (form) {
      form.reset();
      clearFieldErrors(form);
    }

    setFeedback('', '');

    modalEl.classList.add('active');
    modalEl.setAttribute('aria-hidden', 'false');
    document.body.classList.add('hcqa-modal-open');

    setTimeout(function () {
      var first = byId('hcqa-contact-name');
      if (first) first.focus();
    }, 60);
  }

  function closeContactModal() {
    if (!modalEl) return;

    modalEl.classList.remove('active');
    modalEl.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('hcqa-modal-open');

    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  function trapFocus(event) {
    if (event.key !== 'Tab' || !modalEl || !modalEl.classList.contains('active')) return;

    var focusables = modalEl.querySelectorAll(
      'button, input, textarea, select, a[href], [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables.length) return;

    var first = focusables[0];
    var last = focusables[focusables.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }


  /* ---------------------------------------------------------
   * CONTACT FORM — FEEDBACK + VALIDATION
   * ------------------------------------------------------- */

  function setFeedback(message, state) {
    var fb = byId('hcqa-contact-feedback');
    if (!fb) return;

    fb.textContent = message || '';
    fb.className = 'hcqa-contact-feedback' + (state ? ' ' + state : '');
  }

  function clearFieldErrors(form) {
    each(form.querySelectorAll('.hcqa-contact-field'), function (f) {
      f.classList.remove('has-error');
    });
  }

  function markInvalidFields(form) {
    clearFieldErrors(form);

    each(form.querySelectorAll('input, textarea'), function (el) {
      if (el.willValidate && !el.checkValidity()) {
        var field = el.closest('.hcqa-contact-field');
        if (field) field.classList.add('has-error');
      }
    });
  }

  function setLoading(isLoading) {
    var btn = byId('hcqa-contact-submit');
    if (!btn) return;

    if (!btn.dataset.label) btn.dataset.label = btn.textContent.trim();

    btn.disabled = isLoading;
    btn.classList.toggle('loading', isLoading);
    btn.textContent = isLoading ? 'Sending…' : btn.dataset.label;
  }


  /* ---------------------------------------------------------
   * CONTACT FORM — AJAX SUBMIT
   * ------------------------------------------------------- */

  /*
   * Reads the HTML Shopify sends back and looks for a REAL error
   * element with real text in it. The old string search for
   * `indexOf('errors')` matched theme CSS/JS on every single page,
   * so every submission was flagged as failed.
   */
  function extractError(html) {
    if (!html) return '';

    var doc;
    try {
      doc = new DOMParser().parseFromString(html, 'text/html');
    } catch (e) {
      return '';
    }

    var selectors = [
      '.form-status-list',
      '.form__message--error',
      '.form-message--error',
      'ul.errors',
      'ol.errors',
      'div.errors',
      '.errors',
      '#ContactFormErrors',
      '[id$="-form-error"]'
    ];

    var nodes = doc.querySelectorAll(selectors.join(','));
    var message = '';

    each(nodes, function (node) {
      if (message) return;

      var text = (node.textContent || '').replace(/\s+/g, ' ').trim();

      /* Empty placeholders and Liquid leftovers are not errors */
      if (!text || text.length > 400 || text.indexOf('{{') !== -1) return;

      message = text;
    });

    return message;
  }

  function evaluateResponse(res) {
    /* Shopify redirects a good submission to ?contact_posted=true */
    if (res.url && res.url.indexOf('contact_posted=true') !== -1) {
      return { success: true };
    }

    if (res.status === 429) {
      return { success: false, message: 'Too many attempts. Wait a moment and try again.' };
    }

    var message = extractError(res.html);
    if (message) return { success: false, message: message };

    if (!res.ok) {
      return { success: false, message: 'The form did not send (error ' + res.status + '). Try again.' };
    }

    /*
     * 200 back, no error markup: Shopify accepted it. Some themes
     * strip the query string on redirect, so this is the fallback.
     */
    return { success: true };
  }

  function submitContactForm() {
    var form = byId('hcqa-contact-form');
    if (!form) return;

    if (!form.checkValidity()) {
      markInvalidFields(form);
      form.reportValidity();
      setFeedback('Fill in every field before you start.', 'error');
      return;
    }

    clearFieldErrors(form);
    setFeedback('', '');
    setLoading(true);

    var action = (form.getAttribute('action') || '/contact').split('#')[0];

    fetch(action, {
      method: 'POST',
      body: new FormData(form),
      credentials: 'same-origin',
      redirect: 'follow',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'text/html'
      }
    })
      .then(function (response) {
        return response.text().then(function (html) {
          return {
            ok: response.ok,
            status: response.status,
            url: response.url || '',
            html: html
          };
        });
      })
      .then(function (res) {
        var verdict = evaluateResponse(res);

        if (!verdict.success) {
          var err = new Error(verdict.message);
          err.shopifyMessage = verdict.message;
          throw err;
        }

        onContactSuccess();
      })
      .catch(function (error) {
        console.error('HCQA contact form:', error);
        setLoading(false);

        /*
         * A validation error from Shopify is shown and blocks entry.
         * A network/CORS failure should not cost you the quiz session,
         * so it falls through when "open quiz on error" is enabled.
         */
        if (error.shopifyMessage) {
          setFeedback(error.shopifyMessage, 'error');
          return;
        }

        if (openQuizOnError) {
          setFeedback('Could not reach the server — continuing to the quiz.', 'error');
          setTimeout(function () {
            closeContactModal();
            startQuiz();
          }, 900);
        } else {
          setFeedback('Something went wrong. Try again.', 'error');
        }
      });
  }

  function onContactSuccess() {
    setLoading(false);
    setFeedback('Thanks — opening your quiz.', 'success');
    sessionSet(SESSION_KEY, '1');

    document.dispatchEvent(new CustomEvent('hcqa:contact-submitted'));

    setTimeout(function () {
      closeContactModal();
      startQuiz();
    }, 500);
  }


  /* ---------------------------------------------------------
   * QUESTION RENDER
   * ------------------------------------------------------- */

  function renderQ() {
    var q = QUESTIONS[currentQ];
    var total = QUESTIONS.length;

    var label   = byId('hcqa-q-label');
    var count   = byId('hcqa-q-count');
    var num     = byId('hcqa-q-num');
    var text    = byId('hcqa-q-text');
    var barFill = byId('hcqa-q-bar-fill');
    var back    = byId('hcqa-q-back');
    var dots    = byId('hcqa-q-dots');
    var grid    = byId('hcqa-q-answers');

    if (!q || !label || !grid) return;

    label.textContent = 'Question ' + (currentQ + 1);
    if (count) count.textContent = (currentQ + 1) + ' of ' + total;
    if (num) num.textContent = pad(currentQ + 1) + ' / ' + pad(total);
    if (text) text.textContent = q.text;

    if (barFill) barFill.style.width = ((currentQ + 1) / total * 100) + '%';
    if (back) back.style.visibility = currentQ > 0 ? 'visible' : 'hidden';

    if (dots) {
      dots.innerHTML = '';
      for (var i = 0; i < total; i++) {
        var d = document.createElement('div');
        d.className = 'hcqa-q-dot' +
          (i < currentQ ? ' done' : i === currentQ ? ' active' : '');
        dots.appendChild(d);
      }
    }

    grid.innerHTML = '';
    var letters = ['A', 'B', 'C'];

    q.answers.forEach(function (a, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hcqa-q-btn' + (answers[currentQ] === i ? ' selected' : '');

      var letter = document.createElement('span');
      letter.className = 'hcqa-q-letter';
      letter.textContent = letters[i];

      var txt = document.createElement('span');
      txt.className = 'hcqa-q-answer-text';
      txt.textContent = a.text;

      btn.appendChild(letter);
      btn.appendChild(txt);

      btn.addEventListener('click', function () {
        pickAnswer(i);
      });

      grid.appendChild(btn);
    });
  }

  function pickAnswer(idx) {
    answers[currentQ] = idx;

    each(document.querySelectorAll('.hcqa-q-btn'), function (b, i) {
      b.classList.toggle('selected', i === idx);
    });

    setTimeout(function () {
      if (currentQ < QUESTIONS.length - 1) {
        currentQ++;
        renderQ();
      } else {
        calcResult();
      }
    }, 260);
  }

  function prevQ() {
    if (currentQ > 0) {
      currentQ--;
      renderQ();
    }
  }


  /* ---------------------------------------------------------
   * SCORING
   * ------------------------------------------------------- */

  function calcResult() {
    var scores = { E: 0, S: 0, C: 0 };

    answers.forEach(function (ansIdx, qIdx) {
      var question = QUESTIONS[qIdx];
      if (!question || !question.answers[ansIdx]) return;
      scores[question.answers[ansIdx].type] += question.weight;
    });

    var winner;

    if (scores.E > scores.S && scores.E > scores.C) {
      winner = 'E';
    } else if (scores.S > scores.E && scores.S > scores.C) {
      winner = 'S';
    } else if (scores.C > scores.E && scores.C > scores.S) {
      winner = 'C';
    } else {
      var tbIdx = -1;

      for (var ti = 0; ti < QUESTIONS.length; ti++) {
        if (QUESTIONS[ti].isTiebreaker) { tbIdx = ti; break; }
      }

      if (tbIdx < 0) {
        var maxW = 0;
        for (var tj = 0; tj < QUESTIONS.length; tj++) {
          if (QUESTIONS[tj].weight > maxW) {
            maxW = QUESTIONS[tj].weight;
            tbIdx = tj;
          }
        }
      }

      winner = (tbIdx >= 0 && answers[tbIdx] !== undefined)
        ? QUESTIONS[tbIdx].answers[answers[tbIdx]].type
        : 'E';
    }

    var total = scores.E + scores.S + scores.C;
    if (!total) total = 1;

    var gbs = Math.min(98, Math.max(58,
      Math.round((scores[winner] / total) * 100 + 15)
    ));

    currentScores = {
      E: Math.round(scores.E / total * 100),
      S: Math.round(scores.S / total * 100),
      C: Math.round(scores.C / total * 100),
      gbs: gbs
    };

    currentResult = winner;

    displayResult(winner, currentScores);
    showScreen('hcqa-screen-result');
  }

  function setBar(id, pct, color) {
    var el = byId(id);
    if (!el) return;
    el.style.width = pct + '%';
    el.style.background = color;
  }

  function scoreLabel(s) {
    if (s >= 85) return 'Highly Attuned';
    if (s >= 70) return 'Well Balanced';
    if (s >= 58) return 'Developing';
    return 'Just Getting Started';
  }


  /* ---------------------------------------------------------
   * RESULT DISPLAY
   * ------------------------------------------------------- */

  function displayResult(type, sc) {
    var r = RESULTS[type];
    if (!r) return;

    var s = sc || { E: 60, S: 50, C: 50, gbs: 72 };
    var gbs = s.gbs;

    var resultPage = byId('hcqa-result-page');
    var hero = byId('hcqa-score-hero');

    if (resultPage) resultPage.style.background = r.pageBg;

    if (hero) {
      hero.style.background = r.heroBg;
      hero.setAttribute('data-bg-word', r.bgWord);
    }

    setText('hcqa-r-icon', r.icon);
    setText('hcqa-r-type', r.type);

    var tl = byId('hcqa-r-tagline');
    if (tl) {
      tl.textContent = r.tagline;
      tl.style.color = r.accentColor;
    }

    setText('hcqa-r-desc', r.desc);

    setText('hcqa-gbs-num', gbs);
    setText('hcqa-gbs-title', gbs + ' / 100');
    setText('hcqa-gbs-sub', scoreLabel(gbs));

    var fill = byId('hcqa-gbs-fill');
    if (fill) {
      fill.style.stroke = r.accentColor;
      fill.style.strokeDashoffset = 201;
      setTimeout(function () {
        fill.style.strokeDashoffset = 201 - (gbs / 100 * 201);
      }, 400);
    }

    setText('hcqa-bd-e', s.E + '%');
    setText('hcqa-bd-s', s.S + '%');
    setText('hcqa-bd-c', s.C + '%');

    setTimeout(function () {
      var dim = 'rgba(255,255,255,0.18)';
      setBar('hcqa-bd-e-bar', s.E, type === 'E' ? r.accentColor : dim);
      setBar('hcqa-bd-s-bar', s.S, type === 'S' ? r.accentColor : dim);
      setBar('hcqa-bd-c-bar', s.C, type === 'C' ? r.accentColor : dim);
    }, 500);

    var lbl = byId('hcqa-rpc-label');
    if (lbl) {
      lbl.textContent = 'Your Best Snack Match';
      lbl.style.color = r.accentColor;
    }

    setText('hcqa-rpc-name', r.product);
    setText('hcqa-rpc-sub', r.productSub);

    var recType = byId('hcqa-rpc-recommended-type');
    if (recType) {
      recType.textContent = r.type;
      recType.style.color = r.accentColor;
      recType.style.borderColor = 'rgba(' + r.accentRgb + ',0.4)';
    }

    var vis = byId('hcqa-rpc-visual');
    if (vis) {
      vis.style.background = r.productBg;
      vis.textContent = r.productEmoji;
    }

    r.macros.forEach(function (m, i) {
      setText('hcqa-m' + (i + 1) + 'n', m.n);
      setText('hcqa-m' + (i + 1) + 'l', m.l);
    });

    var wl = byId('hcqa-rpc-why-list');
    if (wl) {
      wl.innerHTML = '';

      r.why.forEach(function (w) {
        var li = document.createElement('li');
        li.className = 'hcqa-rpc-why-item';

        var check = document.createElement('span');
        check.className = 'hcqa-rpc-why-check';
        check.textContent = '✓';
        check.style.color = r.accentColor;

        var txt = document.createElement('span');
        txt.textContent = w;

        li.appendChild(check);
        li.appendChild(txt);
        wl.appendChild(li);
      });
    }

    var cta = byId('hcqa-rpc-cta');
    if (cta) {
      cta.textContent = 'Add to Cart →';
      cta.style.background = 'var(--teal)';
      cta.style.color = '#0F1213';
      cta.dataset.variantId = String(r.variantId || '');
    }

    var clock = byId('hcqa-moment-clock');
    if (clock) clock.textContent = r.snackClock;

    var mlbl = byId('hcqa-moment-card-label');
    if (mlbl) {
      mlbl.textContent = 'When to Snack';
      mlbl.style.color = r.accentColor;
    }

    setText('hcqa-moment-card-value', r.snackWhen);

    var timeEl = byId('hcqa-moment-card-time');
    if (timeEl) {
      timeEl.textContent = r.snackTime;
      timeEl.style.color = r.accentColor;
      timeEl.style.borderColor = 'rgba(' + r.accentRgb + ',0.35)';
      timeEl.style.background = 'rgba(' + r.accentRgb + ',0.08)';
    }

    setText('hcqa-moment-card-sub', r.snackSub);

    var mc = byId('hcqa-moment-card');
    if (mc) {
      mc.style.borderLeftColor = r.accentColor;
      mc.style.background = 'rgba(' + r.accentRgb + ',0.08)';
    }

    var esub = byId('hcqa-email-submit');
    if (esub) {
      esub.style.background = r.accentColor;
      esub.style.color = '#0F1213';
    }

    ['hcqa-ec1', 'hcqa-ec2', 'hcqa-ec3', 'hcqa-ec4'].forEach(function (id) {
      var el = byId(id);
      if (el) el.style.color = r.accentColor;
    });

    shareText = r.shareText ? r.shareText.replace('{score}', gbs) : '';

    var fb = byId('hcqa-email-feedback');
    if (fb) fb.textContent = '';

    var ei = byId('hcqa-email-input');
    if (ei) ei.value = '';

    each(document.querySelectorAll('.hcqa-other-chip'), function (chip) {
      chip.style.display = chip.dataset.peek === type ? 'none' : '';
    });
  }


  /* ---------------------------------------------------------
   * SHARE
   * ------------------------------------------------------- */

  function copyText(t) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(t);
      return;
    }

    var el = document.createElement('textarea');
    el.value = t;
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }

  function shareTwitter() {
    if (!shareText) return;
    window.open(
      'https://twitter.com/intent/tweet?text=' + encodeURIComponent(shareText),
      '_blank'
    );
  }

  function shareInstagram() {
    copyText(shareText);
    alert('Caption copied. Open Instagram and paste it into your story.');
  }

  function copyScore() {
    copyText(shareText);

    var btn = byId('hcqa-btn-copy');
    if (!btn) return;

    var orig = btn.innerHTML;
    btn.innerHTML = '✓ Copied';
    btn.classList.add('copied');

    setTimeout(function () {
      btn.innerHTML = orig;
      btn.classList.remove('copied');
    }, 2000);
  }


  /* ---------------------------------------------------------
   * PEEK / RETAKE / RESULT EMAIL
   * ------------------------------------------------------- */

  function peekResult(type) {
    currentResult = type;

    var fakeS = { E: 40, S: 40, C: 40, gbs: 72 };
    fakeS[type] = 75;

    displayResult(type, fakeS);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function retake() {
    currentQ = 0;
    answers = [];

    /* Already gave their details this session — go straight in */
    if (askOncePerSession && sessionGet(SESSION_KEY) === '1') {
      startQuiz();
      return;
    }

    showScreen('hcqa-screen-entry');
  }

  function submitEmail() {
    var input = byId('hcqa-email-input');
    var fb = byId('hcqa-email-feedback');
    if (!input || !fb) return;

    var email = input.value.trim();

    if (!email || email.indexOf('@') < 0 || email.indexOf('.') < 0) {
      fb.style.color = '#E66443';
      fb.textContent = 'Enter a valid email address.';
      return;
    }

    var r = currentResult ? RESULTS[currentResult] : null;
    fb.style.color = r ? r.accentColor : 'var(--teal)';
    fb.textContent = 'Your Gut-Brain Guide is on its way.';

    input.value = '';
  }


  /* ---------------------------------------------------------
   * INIT
   * ------------------------------------------------------- */

  function handleStartClick() {
    if (askOncePerSession && sessionGet(SESSION_KEY) === '1') {
      startQuiz();
      return;
    }
    openContactModal();
  }

  function initQuiz() {
    var wrap = document.querySelector('.hc-quiz-app');
    if (!wrap || wrap.dataset.quizInit === '1') return;

    wrap.dataset.quizInit = '1';
    appEl = wrap;

    openQuizOnError = wrap.dataset.openQuizOnError !== 'false';
    askOncePerSession = wrap.dataset.askOnce !== 'false';

    buildQuestions();
    buildResults();
    relocateModal();

    var startBtn = byId('hcqa-start-btn');
    if (startBtn) startBtn.addEventListener('click', handleStartClick);

    var contactClose = byId('hcqa-contact-close');
    if (contactClose) contactClose.addEventListener('click', closeContactModal);

    var contactOverlay = byId('hcqa-contact-overlay');
    if (contactOverlay) contactOverlay.addEventListener('click', closeContactModal);

    var contactForm = byId('hcqa-contact-form');
    if (contactForm) {
      contactForm.addEventListener('submit', function (event) {
        event.preventDefault();
        submitContactForm();
      });

      each(contactForm.querySelectorAll('input, textarea'), function (el) {
        el.addEventListener('input', function () {
          var field = el.closest('.hcqa-contact-field');
          if (field) field.classList.remove('has-error');
        });
      });
    }

    document.addEventListener('keydown', function (event) {
      if (!modalEl || !modalEl.classList.contains('active')) return;
      if (event.key === 'Escape') closeContactModal();
      trapFocus(event);
    });

    var navRetake = byId('nav-retake');
    if (navRetake) navRetake.addEventListener('click', retake);

    var backBtn = byId('hcqa-q-back');
    if (backBtn) backBtn.addEventListener('click', prevQ);

    var retakeBtn = byId('hcqa-retake-btn');
    if (retakeBtn) retakeBtn.addEventListener('click', retake);

    var twitterBtn = byId('hcqa-btn-twitter');
    if (twitterBtn) twitterBtn.addEventListener('click', shareTwitter);

    var igBtn = byId('hcqa-btn-instagram');
    if (igBtn) igBtn.addEventListener('click', shareInstagram);

    var copyBtn = byId('hcqa-btn-copy');
    if (copyBtn) copyBtn.addEventListener('click', copyScore);

    var ctaBtn = byId('hcqa-rpc-cta');
    if (ctaBtn) {
      ctaBtn.addEventListener('click', function () {
        if (!currentResult || !RESULTS[currentResult]) return;

        /* 100cal-cart.js handles ATC via data-variant-id */
        if (RESULTS[currentResult].variantId) return;

        window.location.href = RESULTS[currentResult].productUrl;
      });
    }

    var emailBtn = byId('hcqa-email-submit');
    if (emailBtn) emailBtn.addEventListener('click', submitEmail);

    each(document.querySelectorAll('.hcqa-other-chip'), function (chip) {
      chip.addEventListener('click', function () {
        peekResult(chip.dataset.peek);
      });
    });

    /*
     * No-JS / hard-redirect fallback: Shopify bounced back with
     * ?contact_posted=true, so send them into the quiz and tidy the URL.
     */
    if (window.location.search.indexOf('contact_posted=true') !== -1) {
      sessionSet(SESSION_KEY, '1');
      startQuiz();

      if (window.history && window.history.replaceState) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }

  function boot() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initQuiz);
    } else {
      initQuiz();
    }
  }

  boot();

  document.addEventListener('shopify:section:load', function () {
    initQuiz();
  });

  document.addEventListener('shopify:section:unload', function () {
    if (modalEl && modalEl.parentNode === document.body) {
      document.body.removeChild(modalEl);
    }
    modalEl = null;
    document.body.classList.remove('hcqa-modal-open');
  });

})();
