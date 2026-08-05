(() => {
  if (window.__hundredCalSectionsReady) return;
  window.__hundredCalSectionsReady = true;

  const applyNavShadow = () => {
    document.querySelectorAll('[data-100cal-nav]').forEach((nav) => {
      nav.style.boxShadow = window.scrollY > 10 ? '0 2px 24px rgba(0,0,0,0.12)' : 'none';
    });
  };

  const initStickyBar = () => {
    const stickyBar = document.querySelector('.sticky-bar');
    if (!stickyBar) return;

    const section = stickyBar.dataset.section;
    const buyBox = document.getElementById('buy-box');
    const priceTarget = document.getElementById(`price-${section}`);
    const submitButton = document.getElementById(`ProductSubmitButton-${section}`);
    const stickyButton = stickyBar.querySelector('.sticky-btn');
    const stickyPrice = stickyBar.querySelector('.sticky-price');

    const updateStickyPrice = () => {
      if (!stickyPrice || !priceTarget) return;
      stickyPrice.textContent = priceTarget.innerText.trim();
    };

    const syncStickyButton = () => {
      if (!stickyButton || !submitButton) return;
      stickyButton.disabled = submitButton.disabled;
    };

    const updateStickyVisibility = () => {
      if (!buyBox || !stickyBar) return;
      const boxBottom = buyBox.getBoundingClientRect().bottom;
      const show = boxBottom < window.innerHeight - 80;
      stickyBar.classList.toggle('visible', show);
    };

    // stickyButton click is handled exclusively by 100cal-cart.js delegation.
    // syncStickyButton() below mirrors the disabled state from the real submit button.

    updateStickyPrice();
    syncStickyButton();
    updateStickyVisibility();

    window.addEventListener('scroll', () => {
      updateStickyVisibility();
    }, { passive: true });

    window.addEventListener('resize', updateStickyVisibility);

    if (priceTarget) {
      new MutationObserver(updateStickyPrice).observe(priceTarget, { childList: true, subtree: true });
    }

    if (submitButton) {
      new MutationObserver(syncStickyButton).observe(submitButton, { attributes: true, attributeFilter: ['disabled'] });
    }
  };

  window.addEventListener('scroll', applyNavShadow, { passive: true });
  document.addEventListener('shopify:section:load', () => {
    applyNavShadow();
    initStickyBar();
  });
  document.addEventListener('DOMContentLoaded', () => {
    applyNavShadow();
    initStickyBar();
  });
})();
