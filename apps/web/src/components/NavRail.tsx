import { useEffect, useRef } from 'react';
import { Icon } from './Icon';

export interface NavRailItem<T extends string> {
  value: T;
  icon: string;
  label: string;
}

/**
 * Navegación horizontal con desplazamiento táctil. La acción principal queda
 * fuera de la pista que se desplaza, para que nunca se pierda de vista.
 */
export function NavRail<T extends string>({
  label,
  items,
  cta,
  active,
  onSelect,
}: {
  label: string;
  items: NavRailItem<T>[];
  cta?: NavRailItem<T>;
  active: T;
  onSelect: (value: T) => void;
}) {
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const current = track.current?.querySelector('[aria-current="page"]');
    if (!(current instanceof HTMLElement)) return;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // `nearest` en ambos ejes: mover el eje vertical haría saltar la página.
    current.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto',
      inline: 'nearest',
      block: 'nearest',
    });
  }, [active]);

  return (
    <nav className="navrail" aria-label={label}>
      {cta && (
        <button
          type="button"
          className="navrail-cta"
          aria-current={active === cta.value ? 'page' : undefined}
          onClick={() => {
            onSelect(cta.value);
          }}
        >
          <Icon name={cta.icon} />
          {cta.label}
        </button>
      )}
      <div className="navrail-track" ref={track}>
        {items.map((item) => (
          <button
            key={item.value}
            type="button"
            className="navrail-item"
            aria-current={active === item.value ? 'page' : undefined}
            onClick={() => {
              onSelect(item.value);
            }}
          >
            <Icon name={item.icon} />
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
