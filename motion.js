/* Independent of the gallery module: motion never waits for a dependency. */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  const targets = [...document.querySelectorAll('.section-heading, .case-copy > *, .media-card, .story-heading, .visual-intro, .service-grid article, .about-copy, .about-photo, .steps li, .contact-photo')];
  // Motifs replay their CSS entrance (styles.css) each time they come back into view.
  const motifs = [...document.querySelectorAll('[data-motif]')];
  // The head script starts the hero entrance; ending it only drops finished animations,
  // so the class goes once they are done, whatever the tempo in styles.css.
  const endIntro = () => root.classList.remove('hero-intro');
  if (root.classList.contains('hero-intro')) {
    Promise.all(document.querySelector('.hero').getAnimations({subtree: true}).map(a => a.finished)).then(endIntro, endIntro);
  }
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
      endIntro();
    }
  });
  let observer;
  function setupReveals() {
    observer?.disconnect();
    targets.forEach(el => el.classList.remove('reveal-wait', 'reveal-in'));
    motifs.forEach(el => el.classList.remove('motif-wait', 'motif-play'));
    if (reduced.matches || !('IntersectionObserver' in window)) return;
    observer = new IntersectionObserver(entries => {
      for (const {target, isIntersecting, boundingClientRect: rect} of entries) {
        const motif = motifs.includes(target);
        const [wait, shown] = motif ? ['motif-wait', 'motif-play'] : ['reveal-wait', 'reveal-in'];
        if (isIntersecting) {
          // A motif plays only from its prepared state, never over text already on screen.
          if (motif && !target.classList.contains(wait)) continue;
          target.classList.add(shown);
          target.classList.remove(wait);
        } else if (rect.top > innerHeight + 80 || rect.bottom < -80) {
          target.classList.remove(shown);
          target.classList.add(wait);
        }
      }
    }, {rootMargin: '0px 0px -40px 0px', threshold: 0});
    // Do not hide content that the reader can already see on load or a deep link.
    [...targets, ...motifs].forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top > innerHeight || rect.bottom < 0) el.classList.add(motifs.includes(el) ? 'motif-wait' : 'reveal-wait');
      observer.observe(el);
    });
  }
  document.addEventListener('focusin', ({target}) => {
    target.closest('.reveal-wait')?.classList.remove('reveal-wait');
    // Keyboard focus must not land on a button that is still hidden or wiping in.
    target.closest('[data-motif]')?.classList.remove('motif-wait', 'motif-play');
    if (target.closest('.hero')) endIntro();
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
