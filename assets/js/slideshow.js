/**
 * slideshow.js
 * Hero image slideshow for the campaign site.
 *
 * TO ADD / CHANGE IMAGES:
 *   1. Drop your image files into the images/slideshow/ folder
 *   2. Edit the <div class="slide"> blocks in index.html to match your filenames
 *   The slideshow auto-detects however many slides are in #hero-slideshow.
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    const container = document.getElementById('hero-slideshow');
    const dotsWrap  = document.getElementById('slideshow-dots');
    const prevBtn   = document.querySelector('.slideshow-prev');
    const nextBtn   = document.querySelector('.slideshow-next');
    if (!container) return;

    const slides = Array.from(container.querySelectorAll('.slide'));
    if (slides.length === 0) return;

    let current  = 0;
    let timer    = null;
    const DELAY  = 5000; // ms between auto-advances

    // Build dot indicators
    if (dotsWrap) {
      slides.forEach((_, i) => {
        const dot = document.createElement('button');
        dot.className = 'slideshow-dot' + (i === 0 ? ' active' : '');
        dot.setAttribute('aria-label', 'Go to slide ' + (i + 1));
        dot.addEventListener('click', () => goTo(i));
        dotsWrap.appendChild(dot);
      });
    }

    function getDots() {
      return dotsWrap ? Array.from(dotsWrap.querySelectorAll('.slideshow-dot')) : [];
    }

    function goTo(index) {
      slides[current].classList.remove('active');
      getDots()[current] && getDots()[current].classList.remove('active');

      current = (index + slides.length) % slides.length;

      slides[current].classList.add('active');
      getDots()[current] && getDots()[current].classList.add('active');

      resetTimer();
    }

    function next() { goTo(current + 1); }
    function prev() { goTo(current - 1); }

    function resetTimer() {
      clearInterval(timer);
      timer = setInterval(next, DELAY);
    }

    if (prevBtn) prevBtn.addEventListener('click', prev);
    if (nextBtn) nextBtn.addEventListener('click', next);

    // Pause on hover
    container.addEventListener('mouseenter', () => clearInterval(timer));
    container.addEventListener('mouseleave', resetTimer);

    // Swipe support (mobile)
    let touchStartX = 0;
    container.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
    container.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 40) dx < 0 ? next() : prev();
    }, { passive: true });

    resetTimer();
  });
})();
