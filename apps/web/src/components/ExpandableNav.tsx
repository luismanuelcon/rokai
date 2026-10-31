import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from './Icon';

export interface ExpandableNavItem<T extends string> {
  value: T;
  label: string;
  icon?: string;
  /** Si existe, la opción es un enlace en vez de un cambio de vista. */
  href?: string;
}

/**
 * Navegación adaptable: lista vertical en móvil y barra completa en escritorio.
 * Un solo patrón para los menús
 * secundarios del portal: operación y administración.
 *
 * Se pliega sola en pantallas estrechas y nace abierta en escritorio, donde hay
 * sitio de sobra. En móvil todas las opciones se muestran completas y permiten desplazamiento vertical.
 */
export function ExpandableNav<T extends string>({
  label,
  items,
  active,
  onSelect,
  triggerIcon,
  className,
}: {
  label: string;
  items: ExpandableNavItem<T>[];
  active?: T;
  onSelect?: (value: T) => void;
  triggerIcon?: string;
  className?: string;
}) {
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  );

  // En escritorio hay ancho para todo; al estrechar la ventana se repliega.
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 1024px)');
    const sync = () => {
      setOpen(wide.matches);
    };
    wide.addEventListener('change', sync);
    return () => {
      wide.removeEventListener('change', sync);
    };
  }, []);

  useEffect(() => {
    if (!open || window.matchMedia('(min-width: 1024px)').matches) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !window.matchMedia('(min-width: 1024px)').matches) return;
    const current = track.current?.querySelector('[aria-current="page"]');
    if (!(current instanceof HTMLElement)) return;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    current.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto',
      inline: 'nearest',
      block: 'nearest',
    });
  }, [open, active]);

  /** Flechas, Inicio y Fin recorren la barra sin salir de ella. */
  function onTrackKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    const items = [...(track.current?.querySelectorAll<HTMLElement>('.xnav-item') ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (index < 0) return;
    event.preventDefault();
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : (index +
              (event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1) +
              items.length) %
            items.length;
    items[next]?.focus();
  }

  const current = items.find((item) => item.value === active);
  const closeAfterSelection = () => {
    if (window.matchMedia('(min-width: 1024px)').matches) return;
    setOpen(false);
    trigger.current?.focus();
  };

  return (
    <div className={`xnav${className ? ` ${className}` : ''}`} ref={root}>
      <button
        ref={trigger}
        type="button"
        className={`xnav-trigger${open ? ' is-open' : ''}`}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${label}${current ? `: ${current.label}` : ''}`}
        onClick={() => {
          setOpen((v) => !v);
        }}
      >
        <Icon name={triggerIcon ?? current?.icon ?? 'grid'} />
        <span className="xnav-trigger-label">{label}</span>
        <span className="xnav-trigger-value">{current?.label ?? 'Ver secciones'}</span>
        <Icon name="chevron" />
      </button>

      {/* `grid-template-rows` de 0fr a 1fr anima el alto real sin fijar píxeles. */}
      <div
        className={`xnav-panel${open ? ' is-open' : ''}`}
        id={panelId}
        aria-hidden={!open}
        inert={!open}
      >
        <div className="xnav-panel-inner">
          <nav aria-label={label}>
            <div className="navrail-track" ref={track} onKeyDown={onTrackKeyDown}>
              {items.map((item) =>
                item.href ? (
                  <a
                    key={item.value}
                    className="xnav-item"
                    href={item.href}
                    aria-current={item.value === active ? 'page' : undefined}
                    tabIndex={open ? 0 : -1}
                    onClick={closeAfterSelection}
                  >
                    {item.icon && <Icon name={item.icon} />}
                    {item.label}
                  </a>
                ) : (
                  <button
                    key={item.value}
                    type="button"
                    className="xnav-item"
                    aria-current={item.value === active ? 'page' : undefined}
                    tabIndex={open ? 0 : -1}
                    onClick={() => {
                      onSelect?.(item.value);
                      closeAfterSelection();
                    }}
                  >
                    {item.icon && <Icon name={item.icon} />}
                    {item.label}
                  </button>
                ),
              )}
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}
