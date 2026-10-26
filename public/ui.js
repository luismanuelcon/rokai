// Progressive motion: content stays visible if observers or animations are unavailable.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let observer;
const running = new Set();

function enter(element, delay = 0) {
  if (reducedMotion.matches || !element.animate) return;
  const animation = element.animate(
    [{ opacity: 0.35, transform: 'translateY(16px)' }, { opacity: 1, transform: 'translateY(0)' }],
    { duration: 440, delay, easing: 'cubic-bezier(.22,1,.36,1)' },
  );
  running.add(animation);
  animation.finished.catch(() => {}).finally(() => running.delete(animation));
}

export function revealGroup(container) {
  if (!container) return;
  [...container.children].forEach((element, index) => enter(element, Math.min(index, 3) * 45));
}

export function enhanceUI(root = document) {
  observer?.disconnect();
  for (const animation of running) animation.cancel();
  running.clear();
  root.querySelectorAll('.table-wrap').forEach((table) => {
    table.tabIndex = 0;
    table.setAttribute('role', 'region');
    table.setAttribute('aria-label', 'Tabla de datos, desplázate horizontalmente para ver todas las columnas');
  });
  if (reducedMotion.matches || !('IntersectionObserver' in window)) return;
  observer = new IntersectionObserver((entries) => {
    const visible = entries.filter(entry => entry.isIntersecting);
    visible.forEach((entry, index) => {
      observer.unobserve(entry.target);
      // Never animate a region while someone is interacting with it.
      if (!entry.target.contains(document.activeElement)) enter(entry.target, Math.min(index, 3) * 45);
    });
  }, { threshold: 0.12 });
  root.querySelectorAll('.trust-item,.section-heading,.step,.price-card,.experience-photo,.experience-text,.faq-layout,.station').forEach(element => observer.observe(element));
}

export function focusContent() {
  const heading = document.querySelector('#main h1');
  if (!heading) return;
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
}

export function closeMenu(restoreFocus = false) {
  const menu = document.querySelector('.navlinks');
  const trigger = document.querySelector('[data-action="menu"]');
  if (!menu?.classList.contains('open')) return;
  menu.classList.remove('open');
  trigger?.setAttribute('aria-expanded', 'false');
  trigger?.setAttribute('aria-label', 'Abrir menú');
  if (restoreFocus) trigger?.focus();
}

reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) {
    observer?.disconnect();
    for (const animation of running) animation.cancel();
    running.clear();
  }
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeMenu(true);
});
document.addEventListener('click', event => {
  if (!event.target.closest('.navlinks,[data-action="menu"]')) closeMenu();
});
