const viewer = document.getElementById('viewer');
const viewerImage = document.getElementById('viewer-image');
const caption = document.getElementById('viewer-caption');
const original = document.getElementById('viewer-original');
const zoom = document.getElementById('viewer-zoom');
const viewerContent = viewer.querySelector('.viewer-content');
const viewerStatus = document.getElementById('viewer-status');

function resetZoom() {
  viewerContent.classList.remove('is-zoomed');
  zoom.setAttribute('aria-pressed', 'false');
  zoom.textContent = 'Увеличить';
  viewerContent.scrollTo(0, 0);
}

viewerImage.addEventListener('load', () => { viewerStatus.textContent = ''; });
viewerImage.addEventListener('error', () => {
  viewerStatus.textContent = 'Изображение не загрузилось. Попробуйте открыть оригинал по ссылке ниже.';
});

zoom.addEventListener('click', () => {
  const expanded = viewerContent.classList.toggle('is-zoomed');
  zoom.setAttribute('aria-pressed', String(expanded));
  zoom.textContent = expanded ? 'Вписать' : 'Увеличить';
  viewerContent.scrollTo(0, 0);
});

document.querySelectorAll('[data-viewer]').forEach(link => {
  link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || !viewer.showModal) return;
    event.preventDefault();
    resetZoom();
    viewerStatus.textContent = 'Загрузка изображения…';
    viewerImage.src = link.href;
    viewerImage.alt = link.dataset.caption;
    caption.textContent = link.dataset.caption;
    original.href = link.href;
    viewer.showModal();
    if (viewerImage.complete && viewerImage.naturalWidth) viewerStatus.textContent = '';
  });
});

// The default CSS stays visible: animation never depends on a hidden-page class.
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
const activeEntrances = new Set();

function enter(element, delay = 0) {
  if (motionPreference.matches || !element.animate) return;
  const animation = element.animate([
    { opacity: 0, transform: 'translateY(12px)' },
    { opacity: 1, transform: 'translateY(0)' }
  ], { duration: 460, delay, easing: 'cubic-bezier(.23, 1, .32, 1)', fill: 'backwards' });
  activeEntrances.add(animation);
  animation.finished.then(() => activeEntrances.delete(animation)).catch(() => activeEntrances.delete(animation));
}

const heroElements = document.querySelectorAll('.hero .eyebrow, .hero h1, .hero-portrait, .hero-description, .hero .button, .hero-next');
heroElements.forEach((element, index) => enter(element, Math.min(index * 45, 180)));

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      enter(entry.target);
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' });
  document.querySelectorAll('.section-heading, .case-copy, .case-image, .service-grid article, .about-copy, .about-photo, .steps li, .contact-copy, .contact-photo').forEach(element => observer.observe(element));
}

document.addEventListener('focusin', event => {
  // Keyboard users get immediate focus and readable content even during an entrance.
  activeEntrances.forEach(animation => {
    if (animation.effect.target.contains(event.target)) animation.cancel();
  });
});

motionPreference.addEventListener('change', event => {
  if (event.matches) activeEntrances.forEach(animation => animation.cancel());
});

viewer.querySelector('.viewer-close').addEventListener('click', () => viewer.close());
viewer.addEventListener('click', event => {
  const bounds = viewer.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) viewer.close();
});
