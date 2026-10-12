import PhotoSwipeLightbox from './vendor/photoswipe/photoswipe-lightbox.esm.min.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
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
  paddingFn: () => ({ top: 56, bottom: 56, left: 8, right: 8 }),
  imageClickAction: 'zoom', tapAction: false, doubleTapAction: 'zoom',
  closeOnVerticalDrag: false, pinchToClose: false, clickToCloseNonZoomable: false,
  closeTitle: 'Закрыть', zoomTitle: 'Увеличить или уменьшить',
  arrowPrevTitle: 'Предыдущее изображение', arrowNextTitle: 'Следующее изображение',
  errorMsg: 'Изображение не загрузилось. Закройте просмотр и попробуйте ещё раз.',
  indexIndicatorSep: ' / ',
});
lightbox.addFilter('itemData', data => {
  data.alt = data.element?.dataset.caption || data.alt || '';
  data.framePosition = data.element?.dataset.framePosition;
  return data;
});
lightbox.on('contentLoadImage', ({content}) => {
  const position = content.data.framePosition;
  if (position && content.element) {
    content.element.style.objectFit = 'cover';
    content.element.style.objectPosition = `${position}% center`;
  }
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
lightbox.on('uiRegister', () => { lightbox.pswp.element.setAttribute('aria-label', 'Просмотр изображений'); });
lightbox.init();
