(function () {
  var QUESTIONS = [];
  var RESULTS = {};
  var currentQ = 0;
  var answers = [];
  var currentResult = null;
  var currentScores = null;
  var shareText = '';

  /*
   * ---------------------------------------------------------
   * BUILD QUESTIONS
   * ---------------------------------------------------------
   */

  function buildQuestions() {
    QUESTIONS = [];

    var nodes = document.querySelectorAll('.hcqa-question');

    nodes.forEach(function (node) {
      QUESTIONS.push({
        text: node.dataset.text || '',
        weight: parseInt(node.dataset.weight, 10) || 1,
        isTiebreaker: node.dataset.tiebreaker === 'true',

        answers: [
          {
            text: node.dataset.aText || '',
            type: node.dataset.aType || 'E'
          },
          {
            text: node.dataset.bText || '',
            type: node.dataset.bType || 'S'
          },
          {
            text: node.dataset.cText || '',
            type: node.dataset.cType || 'C'
          }
        ]
      });
    });
  }


  /*
   * ---------------------------------------------------------
   * BUILD RESULTS
   * ---------------------------------------------------------
   */

  function buildResults() {
    RESULTS = {};

    var nodes = document.querySelectorAll('.hcqa-rtype');

    nodes.forEach(function (node) {
      var t = node.dataset.type;

      if (!t) {
        return;
      }

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
          {
            n: node.dataset.m1n || '100',
            l: node.dataset.m1l || 'Cal'
          },
          {
            n: node.dataset.m2n || '5g',
            l: node.dataset.m2l || 'Protein'
          },
          {
            n: node.dataset.m3n || '4g',
            l: node.dataset.m3l || 'Fiber'
          },
          {
            n: node.dataset.m4n || '0g',
            l: node.dataset.m4l || 'Sugar'
          }
        ],

        why: [
          node.dataset.why1,
          node.dataset.why2,
          node.dataset.why3
        ].filter(Boolean),

        snackClock: node.dataset.snackClock || '',
        snackWhen: node.dataset.snackWhen || '',
        snackTime: node.dataset.snackTime || '',
        snackSub: node.dataset.snackSub || '',

        shareText:
          node.dataset.share ||
          'My Gut-Brain Score is {score}. What\'s yours?',

        variantId: parseInt(
          node.dataset.variantId || '0',
          10
        )
      };
    });
  }


  /*
   * ---------------------------------------------------------
   * SHOW SCREEN
   * ---------------------------------------------------------
   */

  function showScreen(id) {
    document
      .querySelectorAll('.hcqa-screen')
      .forEach(function (s) {
        s.classList.remove('active');
      });

    var screen = document.getElementById(id);

    if (screen) {
      screen.classList.add('active');
    }

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

    var nr = document.getElementById('nav-retake');
    var nt = document.getElementById('nav-tagline');

    if (nr) {
      nr.style.display =
        id === 'hcqa-screen-result' ? 'block' : 'none';
    }

    if (nt) {
      nt.style.display =
        id === 'hcqa-screen-result' ? 'none' : 'block';
    }
  }


  /*
   * ---------------------------------------------------------
   * START QUIZ
   * ---------------------------------------------------------
   */

  function startQuiz() {
    currentQ = 0;
    answers = [];

    showScreen('hcqa-screen-questions');

    renderQ();
  }


  /*
   * ---------------------------------------------------------
   * CONTACT FORM POPUP
   * ---------------------------------------------------------
   */

  function openContactModal() {
    var modal = document.getElementById(
      'hcqa-contact-modal'
    );

    var form = document.getElementById(
      'hcqa-contact-form'
    );

    var feedback = document.getElementById(
      'hcqa-contact-feedback'
    );

    if (!modal) {
      return;
    }

    /*
     * Reset form every time popup opens
     */
    if (form) {
      form.reset();
    }

    if (feedback) {
      feedback.textContent = '';
      feedback.className =
        'hcqa-contact-feedback';
    }

    modal.classList.add('active');

    modal.setAttribute(
      'aria-hidden',
      'false'
    );

    /*
     * Focus first field
     */
    setTimeout(function () {
      var firstInput =
        document.getElementById(
          'hcqa-contact-name'
        );

      if (firstInput) {
        firstInput.focus();
      }
    }, 100);
  }


  function closeContactModal() {
    var modal = document.getElementById(
      'hcqa-contact-modal'
    );

    if (!modal) {
      return;
    }

    modal.classList.remove('active');

    modal.setAttribute(
      'aria-hidden',
      'true'
    );
  }


  /*
   * ---------------------------------------------------------
   * SUBMIT CONTACT FORM
   * ---------------------------------------------------------
   */

  function submitContactForm() {
    var form = document.getElementById(
      'hcqa-contact-form'
    );

    var submitBtn = document.getElementById(
      'hcqa-contact-submit'
    );

    var feedback = document.getElementById(
      'hcqa-contact-feedback'
    );

    if (!form || !submitBtn || !feedback) {
      return;
    }

    /*
     * Browser validation
     *
     * Required fields:
     * Name
     * Email
     * Phone
     * Message
     */
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    var formData = new FormData(form);

    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    submitBtn.textContent = 'Submitting...';

    feedback.textContent = '';
    feedback.className =
      'hcqa-contact-feedback';


    /*
     * Shopify contact form submission
     */
    fetch(form.action, {
      method: 'POST',
      body: formData,
      headers: {
        Accept: 'application/json'
      },
      credentials: 'same-origin'
    })
      .then(function (response) {

        /*
         * Shopify can return HTML depending
         * on theme/form configuration.
         *
         * We only need to make sure request
         * itself was successful.
         */
        if (!response.ok) {
          throw new Error(
            'Contact form submission failed.'
          );
        }

        return response;
      })

      .then(function () {

        /*
         * Close contact popup
         */
        closeContactModal();

        /*
         * Reset submit button
         */
        submitBtn.disabled = false;
        submitBtn.classList.remove(
          'loading'
        );

        submitBtn.textContent =
          'Start Quiz →';


        /*
         * IMPORTANT:
         *
         * Quiz opens ONLY after contact
         * form submission succeeds.
         */
        startQuiz();
      })

      .catch(function (error) {

        console.error(
          'HCQA Contact Form Error:',
          error
        );

        submitBtn.disabled = false;

        submitBtn.classList.remove(
          'loading'
        );

        submitBtn.textContent =
          'Start Quiz →';

        feedback.className =
          'hcqa-contact-feedback error';

        feedback.textContent =
          'Something went wrong. Please try again.';
      });
  }


  /*
   * ---------------------------------------------------------
   * QUESTION RENDER
   * ---------------------------------------------------------
   */

  function pad(n) {
    return (n < 10 ? '0' : '') + n;
  }


  function renderQ() {
    var q = QUESTIONS[currentQ];
    var total = QUESTIONS.length;

    var label =
      document.getElementById(
        'hcqa-q-label'
      );

    var count =
      document.getElementById(
        'hcqa-q-count'
      );

    var num =
      document.getElementById(
        'hcqa-q-num'
      );

    var text =
      document.getElementById(
        'hcqa-q-text'
      );

    var barFill =
      document.getElementById(
        'hcqa-q-bar-fill'
      );

    var back =
      document.getElementById(
        'hcqa-q-back'
      );

    var dots =
      document.getElementById(
        'hcqa-q-dots'
      );

    var grid =
      document.getElementById(
        'hcqa-q-answers'
      );

    if (!q || !label) {
      return;
    }


    /*
     * Question information
     */
    label.textContent =
      'Question ' + (currentQ + 1);

    count.textContent =
      (currentQ + 1) +
      ' of ' +
      total;

    num.textContent =
      pad(currentQ + 1) +
      ' / ' +
      pad(total);

    text.textContent =
      q.text;


    /*
     * Progress bar
     */
    barFill.style.width =
      ((currentQ + 1) / total * 100) +
      '%';


    /*
     * Back button
     */
    back.style.visibility =
      currentQ > 0
        ? 'visible'
        : 'hidden';


    /*
     * Question dots
     */
    dots.innerHTML = '';

    for (
      var i = 0;
      i < total;
      i++
    ) {
      var d =
        document.createElement(
          'div'
        );

      d.className =
        'hcqa-q-dot' +
        (
          i < currentQ
            ? ' done'
            : i === currentQ
              ? ' active'
              : ''
        );

      dots.appendChild(d);
    }


    /*
     * Answers
     */
    grid.innerHTML = '';

    var letters = [
      'A',
      'B',
      'C'
    ];

    q.answers.forEach(
      function (a, i) {

        var btn =
          document.createElement(
            'button'
          );

        btn.type = 'button';

        btn.className =
          'hcqa-q-btn' +
          (
            answers[currentQ] === i
              ? ' selected'
              : ''
          );

        btn.innerHTML =
          '<span class="hcqa-q-letter">' +
          letters[i] +
          '</span>' +

          '<span class="hcqa-q-answer-text">' +
          a.text +
          '</span>';


        (function (idx) {

          btn.addEventListener(
            'click',
            function () {
              pickAnswer(idx);
            }
          );

        })(i);


        grid.appendChild(btn);
      }
    );
  }


  /*
   * ---------------------------------------------------------
   * PICK ANSWER
   * ---------------------------------------------------------
   */

  function pickAnswer(idx) {

    answers[currentQ] = idx;

    document
      .querySelectorAll('.hcqa-q-btn')
      .forEach(function (b, i) {

        b.classList.toggle(
          'selected',
          i === idx
        );

      });


    setTimeout(function () {

      if (
        currentQ <
        QUESTIONS.length - 1
      ) {

        currentQ++;

        renderQ();

      } else {

        calcResult();

      }

    }, 260);
  }


  /*
   * ---------------------------------------------------------
   * PREVIOUS QUESTION
   * ---------------------------------------------------------
   */

  function prevQ() {

    if (currentQ > 0) {

      currentQ--;

      renderQ();

    }
  }


  /*
   * ---------------------------------------------------------
   * CALCULATE RESULT
   * ---------------------------------------------------------
   */

  function calcResult() {

    var scores = {
      E: 0,
      S: 0,
      C: 0
    };


    answers.forEach(
      function (ansIdx, qIdx) {

        var question =
          QUESTIONS[qIdx];

        if (
          !question ||
          !question.answers[ansIdx]
        ) {
          return;
        }

        scores[
          question.answers[
            ansIdx
          ].type
        ] += question.weight;

      }
    );


    var winner;


    /*
     * Find winner
     */
    if (
      scores.E > scores.S &&
      scores.E > scores.C
    ) {

      winner = 'E';

    } else if (
      scores.S > scores.E &&
      scores.S > scores.C
    ) {

      winner = 'S';

    } else if (
      scores.C > scores.E &&
      scores.C > scores.S
    ) {

      winner = 'C';

    } else {

      /*
       * Tie breaker
       */
      var tbIdx = -1;

      for (
        var ti = 0;
        ti < QUESTIONS.length;
        ti++
      ) {

        if (
          QUESTIONS[ti]
            .isTiebreaker
        ) {

          tbIdx = ti;

          break;
        }
      }


      /*
       * If no tie breaker exists,
       * use highest weight question.
       */
      if (tbIdx < 0) {

        var maxW = 0;

        for (
          var tj = 0;
          tj < QUESTIONS.length;
          tj++
        ) {

          if (
            QUESTIONS[tj].weight >
            maxW
          ) {

            maxW =
              QUESTIONS[tj].weight;

            tbIdx = tj;
          }
        }
      }


      winner =
        (
          tbIdx >= 0 &&
          answers[tbIdx] !== undefined
        )
          ? QUESTIONS[tbIdx]
              .answers[
                answers[tbIdx]
              ].type
          : 'E';
    }


    /*
     * Calculate percentages
     */
    var total =
      scores.E +
      scores.S +
      scores.C;


    /*
     * Avoid division by zero
     */
    if (!total) {
      total = 1;
    }


    var ePct =
      Math.round(
        scores.E /
        total *
        100
      );

    var sPct =
      Math.round(
        scores.S /
        total *
        100
      );

    var cPct =
      Math.round(
        scores.C /
        total *
        100
      );


    /*
     * Gut Brain Score
     */
    var gbs =
      Math.min(
        98,
        Math.max(
          58,
          Math.round(
            (
              scores[winner] /
              total
            ) *
              100 +
              15
          )
        )
      );


    currentScores = {
      E: ePct,
      S: sPct,
      C: cPct,
      gbs: gbs
    };


    currentResult =
      winner;


    displayResult(
      winner,
      currentScores
    );


    showScreen(
      'hcqa-screen-result'
    );
  }


  /*
   * ---------------------------------------------------------
   * HELPERS
   * ---------------------------------------------------------
   */

  function setBar(
    id,
    pct,
    color
  ) {

    var el =
      document.getElementById(id);

    if (el) {

      el.style.width =
        pct + '%';

      el.style.background =
        color;
    }
  }


  function setText(
    id,
    val
  ) {

    var el =
      document.getElementById(id);

    if (el) {
      el.textContent =
        val;
    }
  }


  function scoreLabel(s) {

    if (s >= 85) {
      return 'Highly Attuned';
    }

    if (s >= 70) {
      return 'Well Balanced';
    }

    if (s >= 58) {
      return 'Developing';
    }

    return 'Just Getting Started';
  }


  /*
   * ---------------------------------------------------------
   * DISPLAY RESULT
   * ---------------------------------------------------------
   */

  function displayResult(
    type,
    sc
  ) {

    var r =
      RESULTS[type];

    if (!r) {
      return;
    }


    var s =
      sc || {
        E: 60,
        S: 50,
        C: 50,
        gbs: 72
      };


    var gbs =
      s.gbs;


    /*
     * Result page
     */
    var resultPage =
      document.getElementById(
        'hcqa-result-page'
      );

    var hero =
      document.getElementById(
        'hcqa-score-hero'
      );


    if (resultPage) {

      resultPage.style.background =
        r.pageBg;
    }


    if (hero) {

      hero.style.background =
        r.heroBg;

      hero.setAttribute(
        'data-bg-word',
        r.bgWord
      );
    }


    /*
     * Result type
     */
    setText(
      'hcqa-r-icon',
      r.icon
    );

    setText(
      'hcqa-r-type',
      r.type
    );


    var tl =
      document.getElementById(
        'hcqa-r-tagline'
      );

    if (tl) {

      tl.textContent =
        r.tagline;

      tl.style.color =
        r.accentColor;
    }


    setText(
      'hcqa-r-desc',
      r.desc
    );


    /*
     * Gut Brain Score
     */
    setText(
      'hcqa-gbs-num',
      gbs
    );

    setText(
      'hcqa-gbs-title',
      gbs + ' / 100'
    );

    setText(
      'hcqa-gbs-sub',
      scoreLabel(gbs)
    );


    var fill =
      document.getElementById(
        'hcqa-gbs-fill'
      );


    if (fill) {

      fill.style.stroke =
        r.accentColor;

      setTimeout(
        function () {

          fill.style.strokeDashoffset =
            201 -
            (
              gbs /
              100 *
              201
            );

        },
        400
      );
    }


    /*
     * Breakdown
     */
    setText(
      'hcqa-bd-e',
      s.E + '%'
    );

    setText(
      'hcqa-bd-s',
      s.S + '%'
    );

    setText(
      'hcqa-bd-c',
      s.C + '%'
    );


    setTimeout(
      function () {

        setBar(
          'hcqa-bd-e-bar',
          s.E,
          type === 'E'
            ? r.accentColor
            : 'rgba(255,255,255,0.18)'
        );


        setBar(
          'hcqa-bd-s-bar',
          s.S,
          type === 'S'
            ? r.accentColor
            : 'rgba(255,255,255,0.18)'
        );


        setBar(
          'hcqa-bd-c-bar',
          s.C,
          type === 'C'
            ? r.accentColor
            : 'rgba(255,255,255,0.18)'
        );

      },
      500
    );


    /*
     * Product card
     */
    var lbl =
      document.getElementById(
        'hcqa-rpc-label'
      );


    if (lbl) {

      lbl.textContent =
        'Your Best Snack Match';

      lbl.style.color =
        r.accentColor;
    }


    setText(
      'hcqa-rpc-name',
      r.product
    );

    setText(
      'hcqa-rpc-sub',
      r.productSub
    );


    var recType =
      document.getElementById(
        'hcqa-rpc-recommended-type'
      );


    if (recType) {

      recType.textContent =
        r.type;

      recType.style.color =
        r.accentColor;

      recType.style.borderColor =
        'rgba(' +
        r.accentRgb +
        ',0.4)';
    }


    var vis =
      document.getElementById(
        'hcqa-rpc-visual'
      );


    if (vis) {

      vis.style.background =
        r.productBg;

      vis.textContent =
        r.productEmoji;
    }


    /*
     * Macros
     */
    r.macros.forEach(
      function (m, i) {

        setText(
          'hcqa-m' +
          (i + 1) +
          'n',
          m.n
        );

        setText(
          'hcqa-m' +
          (i + 1) +
          'l',
          m.l
        );

      }
    );


    /*
     * Why it works
     */
    var wl =
      document.getElementById(
        'hcqa-rpc-why-list'
      );


    if (wl) {

      wl.innerHTML = '';

      r.why.forEach(
        function (w) {

          var li =
            document.createElement(
              'li'
            );

          li.className =
            'hcqa-rpc-why-item';


          var check =
            document.createElement(
              'span'
            );

          check.className =
            'hcqa-rpc-why-check';

          check.textContent =
            '✓';

          check.style.color =
            r.accentColor;


          var txt =
            document.createElement(
              'span'
            );

          txt.textContent =
            w;


          li.appendChild(check);
          li.appendChild(txt);

          wl.appendChild(li);
        }
      );
    }


    /*
     * Add to cart
     */
    var cta =
      document.getElementById(
        'hcqa-rpc-cta'
      );


    if (cta) {

      cta.textContent =
        'Add to Cart →';

      cta.style.background =
        'var(--teal)';

      cta.style.color =
        '#0F1213';

      cta.dataset.variantId =
        String(
          r.variantId || ''
        );
    }


    /*
     * Snack moment
     */
    var clock =
      document.getElementById(
        'hcqa-moment-clock'
      );


    if (clock) {
      clock.textContent =
        r.snackClock;
    }


    var mlbl =
      document.getElementById(
        'hcqa-moment-card-label'
      );


    if (mlbl) {

      mlbl.textContent =
        'When to Snack';

      mlbl.style.color =
        r.accentColor;
    }


    setText(
      'hcqa-moment-card-value',
      r.snackWhen
    );


    var timeEl =
      document.getElementById(
        'hcqa-moment-card-time'
      );


    if (timeEl) {

      timeEl.textContent =
        r.snackTime;

      timeEl.style.color =
        r.accentColor;

      timeEl.style.borderColor =
        'rgba(' +
        r.accentRgb +
        ',0.35)';

      timeEl.style.background =
        'rgba(' +
        r.accentRgb +
        ',0.08)';
    }


    setText(
      'hcqa-moment-card-sub',
      r.snackSub
    );


    var mc =
      document.getElementById(
        'hcqa-moment-card'
      );


    if (mc) {

      mc.style.borderLeftColor =
        r.accentColor;

      mc.style.background =
        'rgba(' +
        r.accentRgb +
        ',0.08)';
    }


    /*
     * Email section
     */
    var esub =
      document.getElementById(
        'hcqa-email-submit'
      );


    if (esub) {

      esub.style.background =
        r.accentColor;

      esub.style.color =
        '#0F1213';
    }


    [
      'hcqa-ec1',
      'hcqa-ec2',
      'hcqa-ec3',
      'hcqa-ec4'
    ].forEach(
      function (id) {

        var el =
          document.getElementById(id);

        if (el) {

          el.style.color =
            r.accentColor;
        }
      }
    );


    /*
     * Share text
     */
    shareText =
      r.shareText
        ? r.shareText.replace(
            '{score}',
            gbs
          )
        : '';


    /*
     * Reset email feedback
     */
    var fb =
      document.getElementById(
        'hcqa-email-feedback'
      );


    if (fb) {
      fb.textContent = '';
    }


    var ei =
      document.getElementById(
        'hcqa-email-input'
      );


    if (ei) {
      ei.value = '';
    }


    /*
     * Hide current result from other types
     */
    document
      .querySelectorAll(
        '.hcqa-other-chip'
      )
      .forEach(
        function (chip) {

          chip.style.display =
            chip.dataset.peek === type
              ? 'none'
              : '';
        }
      );
  }


  /*
   * ---------------------------------------------------------
   * COPY TEXT
   * ---------------------------------------------------------
   */

  function copyText(t) {

    if (
      navigator.clipboard &&
      window.isSecureContext
    ) {

      navigator.clipboard.writeText(t);

    } else {

      var el =
        document.createElement(
          'textarea'
        );

      el.value = t;

      el.style.position =
        'fixed';

      el.style.left =
        '-9999px';

      document.body.appendChild(
        el
      );

      el.select();

      document.execCommand(
        'copy'
      );

      document.body.removeChild(
        el
      );
    }
  }


  /*
   * ---------------------------------------------------------
   * SHARE TWITTER
   * ---------------------------------------------------------
   */

  function shareTwitter() {

    if (shareText) {

      window.open(
        'https://twitter.com/intent/tweet?text=' +
        encodeURIComponent(
          shareText
        ),
        '_blank'
      );
    }
  }


  /*
   * ---------------------------------------------------------
   * SHARE INSTAGRAM
   * ---------------------------------------------------------
   */

  function shareInstagram() {

    copyText(
      shareText
    );

    alert(
      'Caption copied! Open Instagram and paste into your story.'
    );
  }


  /*
   * ---------------------------------------------------------
   * COPY SCORE
   * ---------------------------------------------------------
   */

  function copyScore() {

    copyText(
      shareText
    );


    var btn =
      document.getElementById(
        'hcqa-btn-copy'
      );


    if (!btn) {
      return;
    }


    var orig =
      btn.innerHTML;


    btn.innerHTML =
      '✓ Copied!';


    btn.classList.add(
      'copied'
    );


    setTimeout(
      function () {

        btn.innerHTML =
          orig;

        btn.classList.remove(
          'copied'
        );

      },
      2000
    );
  }


  /*
   * ---------------------------------------------------------
   * PEEK RESULT
   * ---------------------------------------------------------
   */

  function peekResult(type) {

    currentResult =
      type;


    var fakeS = {
      E: 40,
      S: 40,
      C: 40,
      gbs: 72
    };


    fakeS[type] =
      75;


    displayResult(
      type,
      fakeS
    );


    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }


  /*
   * ---------------------------------------------------------
   * RETAKE
   * ---------------------------------------------------------
   */

  function retake() {

    currentQ = 0;

    answers = [];

    showScreen(
      'hcqa-screen-entry'
    );
  }


  /*
   * ---------------------------------------------------------
   * RESULT EMAIL
   * ---------------------------------------------------------
   */

  function submitEmail() {

    var input =
      document.getElementById(
        'hcqa-email-input'
      );

    var fb =
      document.getElementById(
        'hcqa-email-feedback'
      );


    if (!input || !fb) {
      return;
    }


    var email =
      input.value.trim();


    if (
      !email ||
      email.indexOf('@') < 0 ||
      email.indexOf('.') < 0
    ) {

      fb.style.color =
        '#E66443';

      fb.textContent =
        'Please enter a valid email address.';

      return;
    }


    var r =
      currentResult
        ? RESULTS[currentResult]
        : null;


    fb.style.color =
      r
        ? r.accentColor
        : 'var(--teal)';


    fb.textContent =
      'Your Gut-Brain Guide is on its way!';


    input.value = '';
  }


  /*
   * ---------------------------------------------------------
   * INITIALIZE QUIZ
   * ---------------------------------------------------------
   */

  function initQuiz() {

    var wrap =
      document.querySelector(
        '.hc-quiz-app'
      );


    if (
      !wrap ||
      wrap.dataset.quizInit
    ) {
      return;
    }


    wrap.dataset.quizInit =
      '1';


    /*
     * Build data
     */
    buildQuestions();

    buildResults();


    /*
     * Quiz buttons
     */
    var startBtn =
      document.getElementById(
        'hcqa-start-btn'
      );

    var navRetake =
      document.getElementById(
        'nav-retake'
      );

    var backBtn =
      document.getElementById(
        'hcqa-q-back'
      );

    var retakeBtn =
      document.getElementById(
        'hcqa-retake-btn'
      );

    var twitterBtn =
      document.getElementById(
        'hcqa-btn-twitter'
      );

    var igBtn =
      document.getElementById(
        'hcqa-btn-instagram'
      );

    var copyBtn =
      document.getElementById(
        'hcqa-btn-copy'
      );

    var ctaBtn =
      document.getElementById(
        'hcqa-rpc-cta'
      );

    var emailBtn =
      document.getElementById(
        'hcqa-email-submit'
      );


    /*
     * -------------------------------------------------------
     * CONTACT FORM ELEMENTS
     * -------------------------------------------------------
     */

    var contactModal =
      document.getElementById(
        'hcqa-contact-modal'
      );

    var contactClose =
      document.getElementById(
        'hcqa-contact-close'
      );

    var contactOverlay =
      document.getElementById(
        'hcqa-contact-overlay'
      );

    var contactForm =
      document.getElementById(
        'hcqa-contact-form'
      );


    /*
     * IMPORTANT:
     *
     * Start button DOES NOT directly start quiz.
     *
     * It opens contact form popup first.
     */
    if (startBtn) {

      startBtn.addEventListener(
        'click',
        function () {

          openContactModal();

        }
      );
    }


    /*
     * Close contact popup
     */
    if (contactClose) {

      contactClose.addEventListener(
        'click',
        function () {

          closeContactModal();

        }
      );
    }


    /*
     * Close popup by clicking overlay
     */
    if (contactOverlay) {

      contactOverlay.addEventListener(
        'click',
        function () {

          closeContactModal();

        }
      );
    }


    /*
     * Contact form submit
     */
    if (contactForm) {

      contactForm.addEventListener(
        'submit',
        function (event) {

          event.preventDefault();

          submitContactForm();

        }
      );
    }


    /*
     * ESC key closes popup
     */
    document.addEventListener(
      'keydown',
      function (event) {

        if (
          event.key === 'Escape' &&
          contactModal &&
          contactModal.classList.contains(
            'active'
          )
        ) {

          closeContactModal();

        }
      }
    );


    /*
     * Other quiz buttons
     */
    if (navRetake) {

      navRetake.addEventListener(
        'click',
        retake
      );
    }


    if (backBtn) {

      backBtn.addEventListener(
        'click',
        prevQ
      );
    }


    if (retakeBtn) {

      retakeBtn.addEventListener(
        'click',
        retake
      );
    }


    if (twitterBtn) {

      twitterBtn.addEventListener(
        'click',
        shareTwitter
      );
    }


    if (igBtn) {

      igBtn.addEventListener(
        'click',
        shareInstagram
      );
    }


    if (copyBtn) {

      copyBtn.addEventListener(
        'click',
        copyScore
      );
    }


    /*
     * Add to cart
     */
    if (ctaBtn) {

      ctaBtn.addEventListener(
        'click',
        function () {

          if (
            currentResult &&
            RESULTS[currentResult]
          ) {

            if (
              RESULTS[currentResult]
                .variantId
            ) {

              /*
               * 100cal-cart.js handles
               * ATC using data-variant-id.
               */
              return;
            }


            window.location.href =
              RESULTS[currentResult]
                .productUrl;
          }

        }
      );
    }


    /*
     * Result email
     */
    if (emailBtn) {

      emailBtn.addEventListener(
        'click',
        submitEmail
      );
    }


    /*
     * Other result types
     */
    document
      .querySelectorAll(
        '.hcqa-other-chip'
      )
      .forEach(
        function (chip) {

          chip.addEventListener(
            'click',
            function () {

              peekResult(
                chip.dataset.peek
              );

            }
          );

        }
      );
  }


  /*
   * ---------------------------------------------------------
   * DOM READY
   * ---------------------------------------------------------
   */

  document.addEventListener(
    'DOMContentLoaded',
    initQuiz
  );


  /*
   * Shopify Theme Editor
   */
  document.addEventListener(
    'shopify:section:load',
    initQuiz
  );

})();