(function () {
  function initToc() {
    var toc = document.querySelector('.hc-policy-toc');
    if (!toc || toc.dataset.tocInit) return;
    toc.dataset.tocInit = '1';

    var links = toc.querySelectorAll('.hcpt-link');
    var sections = document.querySelectorAll('.hcpc-section');
    var clicking = false;
    var clickTimer;

    function setActive(link) {
      links.forEach(function (l) { l.classList.remove('active'); });
      if (link) link.classList.add('active');
    }

    links.forEach(function (link) {
      link.addEventListener('click', function () {
        setActive(link);
        clicking = true;
        clearTimeout(clickTimer);
        clickTimer = setTimeout(function () { clicking = false; }, 1000);
      });
    });

    if (!sections.length) return;

    var obs = new IntersectionObserver(function (entries) {
      if (clicking) return;
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var id = entry.target.id;
          setActive(toc.querySelector('.hcpt-link[href="#' + id + '"]'));
        }
      });
    }, { threshold: 0.4, rootMargin: '-80px 0px -60% 0px' });

    sections.forEach(function (s) { obs.observe(s); });
  }

  document.addEventListener('DOMContentLoaded', initToc);
  document.addEventListener('shopify:section:load', initToc);
})();
