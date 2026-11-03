import { useEffect } from 'react';

const ACTION =
  'button, a[href], summary, [role="button"], input[type="checkbox"], input[type="radio"]';
const EXCLUDED = ':disabled, [aria-disabled="true"], [inert], [data-no-ripple]';
const DURATION = 620;

/** Delegación única: no modifica controles ni intercepta su comportamiento. */
export function ClickRipple() {
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const effects = new Map<HTMLElement, number>();
    const remove = (effect: HTMLElement) => {
      window.clearTimeout(effects.get(effect));
      effects.delete(effect);
      effect.remove();
    };
    const clear = () => [...effects.keys()].forEach(remove);
    const onMotionChange = () => {
      if (motion.matches) clear();
    };

    const onClick = (event: MouseEvent) => {
      if (motion.matches || !(event.target instanceof Element)) return;
      const control = event.target.closest<HTMLElement>(ACTION);
      if (!control || control.closest(EXCLUDED)) return;
      const rect = control.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      // detail=0 incluye activación por teclado y tecnologías de asistencia.
      const x = event.detail === 0 ? rect.left + rect.width / 2 : event.clientX;
      const y = event.detail === 0 ? rect.top + rect.height / 2 : event.clientY;
      const dialog = control.closest<HTMLDialogElement>('dialog[open]');
      const host = dialog ?? document.body;
      const effect = document.createElement('span');
      effect.className = 'click-wheel';
      effect.setAttribute('aria-hidden', 'true');
      // Un diálogo vive en la capa superior. Coordenadas relativas mantienen el
      // destello dentro de esa capa, incluso al desplazar un formulario largo.
      if (dialog) {
        const bounds = dialog.getBoundingClientRect();
        effect.style.position = 'absolute';
        effect.style.left = `${x - bounds.left - dialog.clientLeft + dialog.scrollLeft}px`;
        effect.style.top = `${y - bounds.top - dialog.clientTop + dialog.scrollTop}px`;
      } else {
        effect.style.left = `${x}px`;
        effect.style.top = `${y}px`;
      }
      // SVG constante, sin datos del usuario ni contenido de la página.
      effect.innerHTML =
        '<svg viewBox="0 0 80 80" focusable="false" aria-hidden="true"><circle class="click-wheel-halo" cx="40" cy="40" r="29"/><g class="click-wheel-spokes"><path d="M40 13v18m0 18v18M13 40h18m18 0h18M21 21l13 13m12 12 13 13M21 59l13-13m12-12 13-13"/><circle cx="40" cy="40" r="7"/></g><circle class="click-wheel-rim" cx="40" cy="40" r="28"/></svg>';
      if (effects.size >= 8) {
        const oldest = effects.keys().next().value;
        if (oldest) remove(oldest);
      }
      host.append(effect);
      effects.set(
        effect,
        window.setTimeout(() => remove(effect), DURATION),
      );
    };
    document.addEventListener('click', onClick, true);
    motion.addEventListener('change', onMotionChange);
    window.addEventListener('pagehide', clear);
    return () => {
      document.removeEventListener('click', onClick, true);
      motion.removeEventListener('change', onMotionChange);
      window.removeEventListener('pagehide', clear);
      clear();
    };
  }, []);
  return null;
}
