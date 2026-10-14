/* Native page scroll; readable defaults when motion is unavailable. */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  const targets = [...document.querySelectorAll('.section-heading, .case-copy > *, .media-card, .story-heading, .visual-intro, .service-card, .story-side, .story-series-heading, .about-copy, .about-photo, .steps li, .contact-photo, .contact-copy > p, .contact-copy > .button, .contact-links')];
  // Entrance motifs play once, when their own content enters the reading area.
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
  // The head script hides the portrait (portrait-wait) so it never shows before its entrance;
  // after 3 s it shows it anyway, and then the photo simply stays without an entrance.
  const showPortrait = () => root.classList.remove('portrait-wait');
  if (portraitImage && root.classList.contains('portrait-wait')) {
    portraitImage.decode().then(() => {
      if (!root.classList.contains('portrait-wait')) return;
      if (!reduced.matches && scrollY === 0) {
        portraitAnimation = portrait.animate([
          { opacity: 0, transform: 'translate3d(24px,0,0)', clipPath: 'inset(0 0 0 22% round 18px)' },
          { opacity: 1, transform: 'translate3d(0,0,0)', clipPath: 'inset(0 0 0 0 round 18px)' }
        ], { duration: 1100, easing: 'cubic-bezier(.22,.7,.2,1)' });
      }
      showPortrait();
    }, showPortrait);
  }
  reduced.addEventListener('change', () => {
    if (reduced.matches) {
      portraitAnimation?.cancel();
      showPortrait();
      endIntro();
    }
  });
  // Smooth anchor scrolling only after load: a deep link (#contact) opens in place.
  addEventListener('load', () => requestAnimationFrame(() => root.classList.add('smooth-scroll')), {once: true});
  let observers = [];
  const seen = new WeakSet();
  function showImmediately(el) {
    seen.add(el);
    el.classList.remove('reveal-wait', 'motif-wait', 'motif-play');
    observers.forEach(o => o.unobserve(el));
  }
  function setupReveals() {
    observers.forEach(o => o.disconnect());
    targets.forEach(el => el.classList.remove('reveal-wait', 'reveal-in'));
    motifs.forEach(el => el.classList.remove('motif-wait', 'motif-play'));
    if (reduced.matches || !('IntersectionObserver' in window)) return;
    const reveal = (entries, observer) => {
      for (const {target, isIntersecting} of entries) {
        if (!isIntersecting) continue;
        const motif = motifs.includes(target);
        const [wait, shown] = motif ? ['motif-wait', 'motif-play'] : ['reveal-wait', 'reveal-in'];
        if (target.classList.contains(wait)) {
          target.classList.add(shown);
          target.classList.remove(wait);
        }
        seen.add(target);
        observer.unobserve(target);
      }
    };
    const observer = new IntersectionObserver(reveal, {rootMargin: '0px 0px 40px 0px', threshold: 0});
    // The tall side-entering story cards (the COVID pair) start once their top reaches the middle of
    // the screen, so the 1.5 s entrance plays while the card is in view, not before it.
    const lateObserver = new IntersectionObserver(reveal, {rootMargin: '0px 0px -50% 0px', threshold: 0});
    observers = [observer, lateObserver];
    // Visible and previously read content never disappears on return.
    [...targets, ...motifs].forEach(el => {
      const rect = el.getBoundingClientRect();
      if (seen.has(el) || (rect.top < innerHeight && rect.bottom > 0)) {
        seen.add(el);
        return;
      }
      el.classList.add(motifs.includes(el) ? 'motif-wait' : 'reveal-wait');
      (el.classList.contains('story-side') ? lateObserver : observer).observe(el);
    });
  }
  // Safari restores the scroll position after the check above (reload at the bottom of the page),
  // and a deep link may jump after it too. Such a first scroll without the reader's input shows
  // what it lands on at once; scroll events run before the observer reports, so nothing replays.
  let interacted = false;
  let loadedAt = Infinity;
  addEventListener('load', () => { loadedAt = performance.now(); }, {once: true});
  ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(type =>
    addEventListener(type, () => { interacted = true; }, {capture: true, passive: true, once: true}));
  addEventListener('scroll', () => {
    // Restoration happens while loading or right after load; later scrolls are the reader's.
    if (interacted || performance.now() - loadedAt > 1000) return;
    [...targets, ...motifs].forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top < innerHeight && rect.bottom > 0) showImmediately(el);
    });
  }, {passive: true, once: true});
  document.addEventListener('focusin', ({target}) => {
    const reveal = target.closest('.reveal-wait');
    if (reveal) showImmediately(reveal);
    // Keyboard focus must not land on a button that is still hidden or wiping in.
    const motif = target.closest('[data-motif]');
    if (motif) showImmediately(motif);
    if (target.closest('.hero')) endIntro();
  });
  const scenes = [...document.querySelectorAll('[data-comparison="scroll"]')].map(el => ({
    el, sticky: el.querySelector('.comparison-sticky'),
    before: el.querySelector('.compare-before'), after: el.querySelector('.compare-after')
  }));
  // Native lazy loading can ignore the translated, clipped "after" image until
  // the reader has already scrolled it into view. Warm BOTH responsive images
  // from the untransformed scene, roughly two screens before it is reached.
  const prepareComparison = scene => {
    scene.querySelectorAll('.phone-frame img').forEach(img => { img.loading = 'eager'; });
  };
  if ('IntersectionObserver' in window) {
    const comparisonLoader = new IntersectionObserver((entries, observer) => {
      entries.forEach(({target, isIntersecting}) => {
        if (!isIntersecting) return;
        prepareComparison(target);
        observer.unobserve(target);
      });
    }, {rootMargin: `${Math.max(1200, innerHeight * 2)}px 0px`, threshold: 0});
    scenes.forEach(({el}) => comparisonLoader.observe(el));
  } else {
    scenes.forEach(({el}) => prepareComparison(el));
  }
  // The back-to-top button appears once the first screen has been scrolled past.
  const toTop = document.querySelector('.to-top');
  let scheduled = false;
  function render() {
    scheduled = false;
    const y = scrollY;
    toTop?.classList.toggle('is-hidden', y < innerHeight * .8);
    scenes.forEach(scene => {
      if (!scene.enabled) return;
      const linear = Math.max(0, Math.min(1, ((y - scene.start) / scene.distance - .1) / .8));
      const progress = linear * linear * (3 - 2 * linear);
      scene.before.style.transform = `translate3d(${-110 * progress}%,0,0)`;
      scene.after.style.transform = `translate3d(${110 * (1 - progress)}%,0,0)`;
      scene.el.classList.toggle('is-after', progress >= .5);
      // A short edge fade avoids a hard cut, without masking the resting phone.
      scene.el.style.setProperty('--edge-strength', Math.min(1, progress * 8, (1 - progress) * 8));
      // Expose only the frame currently being read.
      [scene.before, scene.after].forEach((layer, index) => {
        const hidden = index === 0 ? progress >= .5 : progress < .5;
        layer.inert = hidden;
        layer.setAttribute('aria-hidden', String(hidden));
      });
    });
  }
  // Freeze reading geometry through mobile browser-toolbar/keyboard height changes.
  // A width change (rotation or split view) starts a new layout; desktop remains resizable.
  const viewportProbe = document.createElement('div');
  viewportProbe.className = 'viewport-probe';
  viewportProbe.setAttribute('aria-hidden', 'true');
  document.body.append(viewportProbe);
  const coarsePointer = matchMedia('(pointer: coarse)');
  let readingWidth;
  let readingHeight;
  function measure() {
    const width = document.documentElement.clientWidth;
    if (readingWidth !== width || !coarsePointer.matches) {
      readingWidth = width;
      readingHeight = viewportProbe.getBoundingClientRect().height;
      root.style.setProperty('--reading-height', `${readingHeight}px`);
    }
    const scrollLayout = !reduced.matches && readingHeight > 620;
    root.classList.toggle('scroll-layout', scrollLayout);
    const header = document.querySelector('.header').offsetHeight;
    scenes.forEach(scene => {
      scene.enabled = scrollLayout;
      scene.el.classList.toggle('is-scroll-scene', scene.enabled);
    });
    scenes.forEach(scene => {
      scene.start = scene.el.getBoundingClientRect().top + scrollY - header;
      scene.distance = Math.max(1, scene.el.offsetHeight - scene.sticky.offsetHeight);
      if (!scene.enabled) { scene.el.style.removeProperty('--edge-strength'); scene.el.classList.remove('is-after'); }
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
