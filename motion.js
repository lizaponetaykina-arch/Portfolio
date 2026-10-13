/* Independent of the gallery module: motion never waits for a dependency. */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const targets = [...document.querySelectorAll('.section-heading, .case-copy > *, .media-card, .story-heading, .visual-intro, .service-grid article, .about-copy, .about-photo, .steps li, .contact-copy > *, .contact-photo')];
  const portrait = document.querySelector('.hero-portrait');
  const portraitImage = portrait?.querySelector('img');
  let portraitAnimation;
  if (portraitImage && !reduced.matches) {
    // The portrait is visible by default, even when decoding is slow or fails.
    portraitImage.decode().then(() => {
      if (!reduced.matches && scrollY === 0) {
        portraitAnimation = portrait.animate([
          { opacity: .65, transform: 'translateY(6px)' },
          { opacity: 1, transform: 'translateY(0)' }
        ], { duration: 550, easing: 'cubic-bezier(.16,1,.3,1)' });
      }
    }).catch(() => {});
  }
  reduced.addEventListener('change', () => {
    if (reduced.matches) {
      portraitAnimation?.cancel();
    }
  });
  let observer;
  function setupReveals() {
    observer?.disconnect();
    targets.forEach(el => el.classList.remove('reveal-wait', 'reveal-in'));
    if (reduced.matches || !('IntersectionObserver' in window)) return;
    observer = new IntersectionObserver(entries => {
      for (const {target, isIntersecting, boundingClientRect: rect} of entries) {
        if (isIntersecting) {
          target.classList.add('reveal-in');
          target.classList.remove('reveal-wait');
        } else if (rect.top > innerHeight + 80 || rect.bottom < -80) {
          target.classList.remove('reveal-in');
          target.classList.add('reveal-wait');
        }
      }
    }, {rootMargin: '0px 0px -40px 0px', threshold: 0});
    // Do not hide content that the reader can already see on load or a deep link.
    targets.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top > innerHeight || rect.bottom < 0) el.classList.add('reveal-wait');
      observer.observe(el);
    });
  }
  document.addEventListener('focusin', ({target}) => {
    target.closest('.reveal-wait')?.classList.remove('reveal-wait');
  });
  const scenes = [...document.querySelectorAll('[data-comparison="scroll"]')].map(el => ({
    el, sticky: el.querySelector('.comparison-sticky'),
    before: el.querySelector('.compare-before'), after: el.querySelector('.compare-after')
  }));
  let scheduled = false;
  function render() {
    scheduled = false;
    const y = scrollY;
    scenes.forEach(scene => {
      if (!scene.enabled) return;
      const linear = Math.max(0, Math.min(1, ((y - scene.start) / scene.distance - .1) / .8));
      const progress = linear * linear * (3 - 2 * linear);
      scene.before.style.transform = `translate3d(${-110 * progress}%,0,0)`;
      scene.after.style.transform = `translate3d(${110 * (1 - progress)}%,0,0)`;
      // Offstage frames stay in the lightbox collection but not in the tab order.
      [scene.before, scene.after].forEach((layer, index) => {
        const hidden = index === 0 ? progress >= .5 : progress < .5;
        layer.inert = hidden;
        layer.setAttribute('aria-hidden', String(hidden));
      });
    });
  }
  function measure() {
    const header = document.querySelector('.header').offsetHeight;
    scenes.forEach(scene => {
      scene.enabled = !reduced.matches && innerHeight > 620;
      scene.el.classList.toggle('is-scroll-scene', scene.enabled);
    });
    scenes.forEach(scene => {
      scene.start = scene.el.getBoundingClientRect().top + scrollY - header;
      scene.distance = Math.max(1, scene.el.offsetHeight - scene.sticky.offsetHeight);
      if (!scene.enabled) [scene.before, scene.after].forEach(layer => {
        layer.style.removeProperty('transform'); layer.inert = false; layer.removeAttribute('aria-hidden');
      });
    });
    render();
  }
  addEventListener('scroll', () => {
    if (!scheduled) { scheduled = true; requestAnimationFrame(render); }
  }, {passive: true});
  addEventListener('resize', measure, {passive: true});
  // ResizeObserver only measures layout changes; scrolling never forces layout.
  new ResizeObserver(measure).observe(document.querySelector('main'));
  reduced.addEventListener('change', () => { setupReveals(); measure(); });
  setupReveals(); measure();
})();
