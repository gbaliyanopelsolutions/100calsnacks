(function () {
  var QUESTIONS = [];
  var RESULTS = {};
  var currentQ = 0;
  var answers = [];
  var currentResult = null;
  var currentScores = null;
  var shareText = '';

  function buildQuestions() {
    QUESTIONS = [];
    var nodes = document.querySelectorAll('.hcqa-question');
    nodes.forEach(function (node) {
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

  function buildResults() {
    RESULTS = {};
    var nodes = document.querySelectorAll('.hcqa-rtype');
    nodes.forEach(function (node) {
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

  function showScreen(id) {
    document.querySelectorAll('.hcqa-screen').forEach(function (s) { s.classList.remove('active'); });
    var screen = document.getElementById(id);
    if (screen) screen.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    var nr = document.getElementById('nav-retake');
    var nt = document.getElementById('nav-tagline');
    if (nr) nr.style.display = id === 'hcqa-screen-result' ? 'block' : 'none';
    if (nt) nt.style.display = id === 'hcqa-screen-result' ? 'none' : 'block';
  }

  function startQuiz() {
    currentQ = 0;
    answers = [];
    showScreen('hcqa-screen-questions');
    renderQ();
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function renderQ() {
    var q = QUESTIONS[currentQ];
    var total = QUESTIONS.length;
    var label = document.getElementById('hcqa-q-label');
    var count = document.getElementById('hcqa-q-count');
    var num = document.getElementById('hcqa-q-num');
    var text = document.getElementById('hcqa-q-text');
    var barFill = document.getElementById('hcqa-q-bar-fill');
    var back = document.getElementById('hcqa-q-back');
    var dots = document.getElementById('hcqa-q-dots');
    var grid = document.getElementById('hcqa-q-answers');
    if (!q || !label) return;
    label.textContent = 'Question ' + (currentQ + 1);
    count.textContent = (currentQ + 1) + ' of ' + total;
    num.textContent = pad(currentQ + 1) + ' / ' + pad(total);
    text.textContent = q.text;
    barFill.style.width = ((currentQ + 1) / total * 100) + '%';
    back.style.visibility = currentQ > 0 ? 'visible' : 'hidden';
    dots.innerHTML = '';
    for (var i = 0; i < total; i++) {
      var d = document.createElement('div');
      d.className = 'hcqa-q-dot' + (i < currentQ ? ' done' : i === currentQ ? ' active' : '');
      dots.appendChild(d);
    }
    grid.innerHTML = '';
    var letters = ['A', 'B', 'C'];
    q.answers.forEach(function (a, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hcqa-q-btn' + (answers[currentQ] === i ? ' selected' : '');
      btn.innerHTML =
        '<span class="hcqa-q-letter">' + letters[i] + '</span>' +
        '<span class="hcqa-q-answer-text">' + a.text + '</span>';
      (function (idx) {
        btn.addEventListener('click', function () { pickAnswer(idx); });
      })(i);
      grid.appendChild(btn);
    });
  }

  function pickAnswer(idx) {
    answers[currentQ] = idx;
    document.querySelectorAll('.hcqa-q-btn').forEach(function (b, i) {
      b.classList.toggle('selected', i === idx);
    });
    setTimeout(function () {
      if (currentQ < QUESTIONS.length - 1) { currentQ++; renderQ(); }
      else { calcResult(); }
    }, 260);
  }

  function prevQ() { if (currentQ > 0) { currentQ--; renderQ(); } }

  function calcResult() {
    var scores = { E: 0, S: 0, C: 0 };
    answers.forEach(function (ansIdx, qIdx) {
      scores[QUESTIONS[qIdx].answers[ansIdx].type] += QUESTIONS[qIdx].weight;
    });
    var winner;
    if (scores.E > scores.S && scores.E > scores.C) winner = 'E';
    else if (scores.S > scores.E && scores.S > scores.C) winner = 'S';
    else if (scores.C > scores.E && scores.C > scores.S) winner = 'C';
    else {
      var tbIdx = -1;
      for (var ti = 0; ti < QUESTIONS.length; ti++) {
        if (QUESTIONS[ti].isTiebreaker) { tbIdx = ti; break; }
      }
      if (tbIdx < 0) {
        var maxW = 0;
        for (var tj = 0; tj < QUESTIONS.length; tj++) {
          if (QUESTIONS[tj].weight > maxW) { maxW = QUESTIONS[tj].weight; tbIdx = tj; }
        }
      }
      winner = (tbIdx >= 0 && answers[tbIdx] !== undefined)
        ? QUESTIONS[tbIdx].answers[answers[tbIdx]].type
        : 'E';
    }
    var total = scores.E + scores.S + scores.C;
    var ePct = Math.round(scores.E / total * 100);
    var sPct = Math.round(scores.S / total * 100);
    var cPct = Math.round(scores.C / total * 100);
    var gbs = Math.min(98, Math.max(58, Math.round((scores[winner] / total) * 100 + 15)));
    currentScores = { E: ePct, S: sPct, C: cPct, gbs: gbs };
    currentResult = winner;
    displayResult(winner, currentScores);
    showScreen('hcqa-screen-result');
  }

  function setBar(id, pct, color) {
    var el = document.getElementById(id);
    if (el) { el.style.width = pct + '%'; el.style.background = color; }
  }

  function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function scoreLabel(s) {
    if (s >= 85) return 'Highly Attuned';
    if (s >= 70) return 'Well Balanced';
    if (s >= 58) return 'Developing';
    return 'Just Getting Started';
  }

  function displayResult(type, sc) {
    var r = RESULTS[type];
    if (!r) return;
    var s = sc || { E: 60, S: 50, C: 50, gbs: 72 };
    var gbs = s.gbs;

    var resultPage = document.getElementById('hcqa-result-page');
    var hero = document.getElementById('hcqa-score-hero');
    if (resultPage) resultPage.style.background = r.pageBg;
    if (hero) { hero.style.background = r.heroBg; hero.setAttribute('data-bg-word', r.bgWord); }

    setText('hcqa-r-icon', r.icon);
    setText('hcqa-r-type', r.type);
    var tl = document.getElementById('hcqa-r-tagline');
    if (tl) { tl.textContent = r.tagline; tl.style.color = r.accentColor; }
    setText('hcqa-r-desc', r.desc);

    setText('hcqa-gbs-num', gbs);
    setText('hcqa-gbs-title', gbs + ' / 100');
    setText('hcqa-gbs-sub', scoreLabel(gbs));
    var fill = document.getElementById('hcqa-gbs-fill');
    if (fill) {
      fill.style.stroke = r.accentColor;
      setTimeout(function () { fill.style.strokeDashoffset = 201 - (gbs / 100 * 201); }, 400);
    }

    setText('hcqa-bd-e', s.E + '%');
    setText('hcqa-bd-s', s.S + '%');
    setText('hcqa-bd-c', s.C + '%');
    setTimeout(function () {
      setBar('hcqa-bd-e-bar', s.E, type === 'E' ? r.accentColor : 'rgba(255,255,255,0.18)');
      setBar('hcqa-bd-s-bar', s.S, type === 'S' ? r.accentColor : 'rgba(255,255,255,0.18)');
      setBar('hcqa-bd-c-bar', s.C, type === 'C' ? r.accentColor : 'rgba(255,255,255,0.18)');
    }, 500);

    var lbl = document.getElementById('hcqa-rpc-label');
    if (lbl) { lbl.textContent = 'Your Best Snack Match'; lbl.style.color = r.accentColor; }
    setText('hcqa-rpc-name', r.product);
    setText('hcqa-rpc-sub', r.productSub);
    var recType = document.getElementById('hcqa-rpc-recommended-type');
    if (recType) {
      recType.textContent = r.type;
      recType.style.color = r.accentColor;
      recType.style.borderColor = 'rgba(' + r.accentRgb + ',0.4)';
    }
    var vis = document.getElementById('hcqa-rpc-visual');
    if (vis) { vis.style.background = r.productBg; vis.textContent = r.productEmoji; }

    r.macros.forEach(function (m, i) {
      setText('hcqa-m' + (i + 1) + 'n', m.n);
      setText('hcqa-m' + (i + 1) + 'l', m.l);
    });

    var wl = document.getElementById('hcqa-rpc-why-list');
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

    var cta = document.getElementById('hcqa-rpc-cta');
    if (cta) {
      cta.textContent = 'Add to Cart →';
      cta.style.background = 'var(--teal)';
      cta.style.color = '#0F1213';
      cta.dataset.variantId = String(r.variantId || '');
    }

    var clock = document.getElementById('hcqa-moment-clock');
    if (clock) clock.textContent = r.snackClock;
    var mlbl = document.getElementById('hcqa-moment-card-label');
    if (mlbl) { mlbl.textContent = 'When to Snack'; mlbl.style.color = r.accentColor; }
    setText('hcqa-moment-card-value', r.snackWhen);
    var timeEl = document.getElementById('hcqa-moment-card-time');
    if (timeEl) {
      timeEl.textContent = r.snackTime;
      timeEl.style.color = r.accentColor;
      timeEl.style.borderColor = 'rgba(' + r.accentRgb + ',0.35)';
      timeEl.style.background = 'rgba(' + r.accentRgb + ',0.08)';
    }
    setText('hcqa-moment-card-sub', r.snackSub);
    var mc = document.getElementById('hcqa-moment-card');
    if (mc) { mc.style.borderLeftColor = r.accentColor; mc.style.background = 'rgba(' + r.accentRgb + ',0.08)'; }

    var esub = document.getElementById('hcqa-email-submit');
    if (esub) { esub.style.background = r.accentColor; esub.style.color = '#0F1213'; }
    ['hcqa-ec1', 'hcqa-ec2', 'hcqa-ec3', 'hcqa-ec4'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.style.color = r.accentColor;
    });

    shareText = r.shareText ? r.shareText.replace('{score}', gbs) : '';

    var fb = document.getElementById('hcqa-email-feedback');
    if (fb) fb.textContent = '';
    var ei = document.getElementById('hcqa-email-input');
    if (ei) ei.value = '';

    document.querySelectorAll('.hcqa-other-chip').forEach(function (chip) {
      chip.style.display = chip.dataset.peek === type ? 'none' : '';
    });
  }

  function copyText(t) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(t);
    } else {
      var el = document.createElement('textarea');
      el.value = t;
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
  }

  function shareTwitter() {
    if (shareText) window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(shareText), '_blank');
  }

  function shareInstagram() {
    copyText(shareText);
    alert('Caption copied! Open Instagram and paste into your story.');
  }

  function copyScore() {
    copyText(shareText);
    var btn = document.getElementById('hcqa-btn-copy');
    if (!btn) return;
    var orig = btn.innerHTML;
    btn.innerHTML = '✓ Copied!';
    btn.classList.add('copied');
    setTimeout(function () { btn.innerHTML = orig; btn.classList.remove('copied'); }, 2000);
  }

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
    showScreen('hcqa-screen-entry');
  }

  function submitEmail() {
    var input = document.getElementById('hcqa-email-input');
    var fb = document.getElementById('hcqa-email-feedback');
    if (!input || !fb) return;
    var email = input.value.trim();
    if (!email || email.indexOf('@') < 0 || email.indexOf('.') < 0) {
      fb.style.color = '#E66443';
      fb.textContent = 'Please enter a valid email address.';
      return;
    }
    var r = currentResult ? RESULTS[currentResult] : null;
    fb.style.color = r ? r.accentColor : 'var(--teal)';
    fb.textContent = 'Your Gut-Brain Guide is on its way!';
    input.value = '';
  }

  function initQuiz() {
    var wrap = document.querySelector('.hc-quiz-app');
    if (!wrap || wrap.dataset.quizInit) return;
    wrap.dataset.quizInit = '1';

    buildQuestions();
    buildResults();

    var startBtn = document.getElementById('hcqa-start-btn');
    var navRetake = document.getElementById('nav-retake');
    var backBtn = document.getElementById('hcqa-q-back');
    var retakeBtn = document.getElementById('hcqa-retake-btn');
    var twitterBtn = document.getElementById('hcqa-btn-twitter');
    var igBtn = document.getElementById('hcqa-btn-instagram');
    var copyBtn = document.getElementById('hcqa-btn-copy');
    var ctaBtn = document.getElementById('hcqa-rpc-cta');
    var emailBtn = document.getElementById('hcqa-email-submit');

    if (startBtn) startBtn.addEventListener('click', startQuiz);
    if (navRetake) navRetake.addEventListener('click', retake);
    if (backBtn) backBtn.addEventListener('click', prevQ);
    if (retakeBtn) retakeBtn.addEventListener('click', retake);
    if (twitterBtn) twitterBtn.addEventListener('click', shareTwitter);
    if (igBtn) igBtn.addEventListener('click', shareInstagram);
    if (copyBtn) copyBtn.addEventListener('click', copyScore);
    if (ctaBtn) ctaBtn.addEventListener('click', function () {
      if (currentResult && RESULTS[currentResult]) {
        if (RESULTS[currentResult].variantId) return; // 100cal-cart.js handles ATC via data-variant-id
        window.location.href = RESULTS[currentResult].productUrl;
      }
    });
    if (emailBtn) emailBtn.addEventListener('click', submitEmail);

    document.querySelectorAll('.hcqa-other-chip').forEach(function (chip) {
      chip.addEventListener('click', function () { peekResult(chip.dataset.peek); });
    });
  }

  document.addEventListener('DOMContentLoaded', initQuiz);
  document.addEventListener('shopify:section:load', initQuiz);
})();
