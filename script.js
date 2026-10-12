import PhotoSwipeLightbox from './vendor/photoswipe/photoswipe-lightbox.esm.min.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const activeEntrances = new Set();
const lightbox = new PhotoSwipeLightbox({
  gallery: '[data-gallery]', children: 'a[data-viewer]',
  pswpModule: () => import('./vendor/photoswipe/photoswipe.esm.min.js'),
  bgOpacity: 1, showHideAnimationType: 'none',
  showAnimationDuration: 0,
  hideAnimationDuration: 0,
  zoomAnimationDuration: reducedMotion.matches ? 0 : 220,
  initialZoomLevel: 'fit',
  secondaryZoomLevel: level => Math.max(level.fit * 2.5, 1),
  maxZoomLevel: level => Math.max(level.fit * 4, 2),
  paddingFn: viewport => ({ top: 64, bottom: viewport.y < 500 ? 80 : 110, left: 8, right: 8 }),
  imageClickAction: 'zoom', tapAction: false, doubleTapAction: 'zoom',
  closeOnVerticalDrag: false, pinchToClose: false, clickToCloseNonZoomable: false,
  closeTitle: 'Закрыть', zoomTitle: 'Увеличить или уменьшить',
  arrowPrevTitle: 'Предыдущее изображение', arrowNextTitle: 'Следующее изображение',
  errorMsg: 'Изображение не загрузилось. Откройте его по ссылке внизу.',
  indexIndicatorSep: ' / ',
});
lightbox.addFilter('itemData', data => {
  data.alt = data.element?.dataset.caption || data.alt || '';
  return data;
});
let pageOverflow = '';
let inertStates = [];
let galleryOpener = null;
document.addEventListener('click', event => {
  const link = event.target.closest('a[data-viewer]');
  if (link && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) galleryOpener = link;
}, true);
lightbox.on('beforeOpen', () => {
  pageOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  inertStates = [...document.querySelectorAll('body > header, body > main, body > footer, body > .skip-link')]
    .map(element => [element, element.inert]);
  inertStates.forEach(([element]) => { element.inert = true; });
  const duration = reducedMotion.matches ? 0 : 220;
  lightbox.pswp.options.zoomAnimationDuration = duration;
});
lightbox.on('close', () => {
  inertStates.forEach(([element, inert]) => { element.inert = inert; });
});
lightbox.on('destroy', () => {
  document.body.style.overflow = pageOverflow;
  inertStates.forEach(([element, inert]) => { element.inert = inert; });
  const opener = galleryOpener;
  requestAnimationFrame(() => opener?.focus({ preventScroll: true }));
});
lightbox.on('uiRegister', () => {
  lightbox.pswp.element.setAttribute('aria-label', 'Просмотр изображений');
  lightbox.pswp.ui.registerElement({
    name: 'caption', order: 9, isButton: false, appendTo: 'root',
    onInit: (element, pswp) => {
      const text = document.createElement('p');
      const label = document.createElement('span');
      const original = document.createElement('a');
      original.textContent = 'Открыть изображение ↗';
      original.target = '_blank'; original.rel = 'noopener noreferrer';
      text.append(label, document.createElement('br'), original);
      element.append(text);
      pswp.on('change', () => {
        label.textContent = pswp.currSlide.data.alt;
        original.href = pswp.currSlide.data.src;
      });
    },
  });
});
lightbox.init();

document.querySelectorAll('[data-story-case]').forEach(section => {
  const track = section.querySelector('.story-track');
  const cards = [...track.children];
  const controls = section.querySelector('.story-controls');
  const previous = controls.querySelector('[data-step="-1"]');
  const next = controls.querySelector('[data-step="1"]');
  const count = controls.querySelector('.story-count');
  controls.hidden = false;
  let index = 0;
  let positions = [];
  const update = () => {
    index = positions.reduce((closest, value, i) => Math.abs(value - track.scrollLeft) < Math.abs(positions[closest] - track.scrollLeft) ? i : closest, 0);
    previous.disabled = track.scrollLeft < 2;
    next.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 2;
    count.textContent = track.scrollWidth <= track.clientWidth + 2 ? '5 сторис' : `${index + 1} / ${cards.length}`;
  };
  const measure = () => {
    positions = cards.map(card => card.offsetLeft - cards[0].offsetLeft);
    update();
  };
  controls.addEventListener('click', event => {
    const button = event.target.closest('[data-step]');
    if (!button || button.disabled) return;
    const target = Math.max(0, Math.min(cards.length - 1, index + Number(button.dataset.step)));
    track.scrollTo({ left: positions[target], behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  });
  track.addEventListener('keydown', event => {
    if (event.target !== track || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const target = event.key === 'Home' ? 0 : event.key === 'End' ? cards.length - 1 : Math.max(0, Math.min(cards.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)));
    track.scrollTo({ left: positions[target], behavior: 'instant' });
  });
  track.addEventListener('scroll', update, { passive: true });
  new ResizeObserver(measure).observe(track);
  measure();
});

function enter(element) {
  if (reducedMotion.matches || !element.animate) return;
  const animation = element.animate([{ opacity: 0, transform: 'translateY(22px)' }, { opacity: 1, transform: 'translateY(0)' }],
    { duration: 620, easing: 'cubic-bezier(.2,.7,.2,1)' });
  activeEntrances.add(animation);
  animation.finished.catch(() => {}).finally(() => activeEntrances.delete(animation));
}
if ('IntersectionObserver' in window) {
  const entrances = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      enter(entry.target);
      entrances.unobserve(entry.target);
    });
  }, { threshold: 0, rootMargin: `0px 0px -${Math.round(window.innerHeight * .24)}px 0px` });
  document.querySelectorAll('.section-heading h2, .case h3, .metrics, .story-heading h3, .service-grid h3, .steps h3, .about-copy h2, .contact h2')
    .forEach(element => entrances.observe(element));
}
document.addEventListener('focusin', event => {
  activeEntrances.forEach(animation => {
    if (animation.effect.target.contains(event.target)) animation.cancel();
  });
});

// Button comparisons have no scroll behavior, transitions, or hidden auto mode.
document.querySelectorAll('[data-comparison="buttons"]').forEach(scene => {
  scene.classList.add('is-enhanced', 'is-button-comparison');
  const controls = scene.querySelector('.compare-controls');
  controls.hidden = false;
  const before = scene.querySelector('.compare-before');
  const after = scene.querySelector('.compare-after');
  const select = state => {
    before.hidden = state === 'after';
    after.hidden = state === 'before';
    after.style.transform = 'none';
    controls.querySelectorAll('[data-state]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.state === state)));
  };
  controls.addEventListener('click', event => {
    const button = event.target.closest('[data-state]');
    if (!button) return;
    select(button.dataset.state);
    scene.querySelector('.compare-announcement').textContent = button.dataset.state === 'after' ? 'Показан визуал после' : 'Показан визуал до';
  });
  select('before');
});

// Only the automotive comparison is animated; scrolling remains native.
const scene = document.querySelector('[data-comparison="scroll"]');
const sticky = scene.querySelector('.comparison-sticky');
const before = scene.querySelector('.compare-before');
const after = scene.querySelector('.compare-after');
const instruction = scene.querySelector('.comparison-instruction');
let sceneStart = 0;
let sceneDistance = 1;
let scrollEnabled = false;
let scheduled = false;

function renderScroll() {
  scheduled = false;
  if (!scrollEnabled) return;
  const normalized = (window.scrollY - sceneStart) / sceneDistance;
  const progress = Math.max(0, Math.min(1, (normalized - .12) / .72));
  before.style.transform = `translateX(${-12 * progress}%)`;
  before.style.opacity = String(1 - progress * .65);
  after.style.transform = `translateX(${110 * (1 - progress)}%)`;
  before.setAttribute('aria-hidden', String(progress >= .99));
  after.setAttribute('aria-hidden', String(progress <= .01));
}
function scheduleScroll() {
  if (scheduled || !scrollEnabled) return;
  scheduled = true;
  requestAnimationFrame(renderScroll);
}
function measureScene() {
  const headerHeight = document.querySelector('.header').offsetHeight;
  scrollEnabled = !reducedMotion.matches && window.innerHeight > 620;
  scene.classList.toggle('is-enhanced', scrollEnabled);
  scene.classList.toggle('is-scroll-scene', scrollEnabled);
  if (scrollEnabled && sticky.offsetHeight > window.innerHeight - headerHeight + 2) {
    scrollEnabled = false;
    scene.classList.remove('is-scroll-scene', 'is-enhanced');
  }
  sceneStart = scene.getBoundingClientRect().top + window.scrollY - headerHeight;
  sceneDistance = Math.max(1, scene.offsetHeight - sticky.offsetHeight);
  instruction.textContent = scrollEnabled ? 'Листайте вниз. Новый визуал появляется справа — прямо на ваших глазах.' : 'Оформление аккаунта до и после.';
  if (scrollEnabled) renderScroll();
  else [before, after].forEach(layer => {
    layer.style.removeProperty('transform');
    layer.style.removeProperty('opacity');
    layer.removeAttribute('aria-hidden');
  });
}
window.addEventListener('scroll', scheduleScroll, { passive: true });
window.addEventListener('resize', measureScene, { passive: true });
new ResizeObserver(measureScene).observe(document.querySelector('main'));
document.querySelectorAll('details').forEach(detail => detail.addEventListener('toggle', measureScene));
reducedMotion.addEventListener('change', () => {
  activeEntrances.forEach(animation => animation.cancel());
  if (lightbox.pswp) {
    lightbox.pswp.options.zoomAnimationDuration = reducedMotion.matches ? 0 : 220;
  }
  measureScene();
});
measureScene();
