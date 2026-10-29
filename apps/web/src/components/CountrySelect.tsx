import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { COUNTRIES, type Country } from '../lib/phone';
import { FLAGS } from '../lib/flags';
import { Icon } from './Icon';

function Flag({ iso, name }: { iso: string; name: string }) {
  const src = FLAGS[iso];
  if (!src) return null;
  return (
    <img
      className="flag"
      src={src}
      alt=""
      aria-hidden="true"
      width={20}
      height={15}
      data-country={name}
    />
  );
}

/**
 * Combobox accesible con banderas. Un `<select>` nativo no admite imágenes y los
 * emoji de bandera no se renderizan en Windows, que es donde opera la estación.
 */
export function CountrySelect({
  iso,
  onChange,
  label = 'Indicativo del país',
}: {
  iso: string;
  onChange: (dial: string, iso: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  // Se selecciona por ISO, no por indicativo: +1 lo comparten Canadá y Estados Unidos.
  const selected: Country = COUNTRIES.find((c) => c.iso === iso) ?? (COUNTRIES[0] as Country);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === '') return COUNTRIES;
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.iso.toLowerCase() === q,
    );
  }, [query]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
    else setQuery('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  function choose(country: Country) {
    onChange(country.dial, country.iso);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const target = results[highlight];
      if (target) choose(target);
    }
  }

  return (
    <div className="country-select" ref={rootRef}>
      <button
        type="button"
        className="country-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${selected.name} ${selected.dial}`}
        onClick={() => {
          setOpen((v) => !v);
          setHighlight(Math.max(results.indexOf(selected), 0));
        }}
      >
        <Flag iso={selected.iso} name={selected.name} />
        <span className="country-dial">{selected.dial}</span>
        <Icon name="chevron" />
      </button>

      {open && (
        <div className="country-popover">
          <input
            ref={searchRef}
            type="search"
            className="country-search"
            placeholder="Buscar país…"
            aria-label="Buscar país"
            aria-controls={listId}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlight(0);
            }}
            onKeyDown={onKeyDown}
          />
          <ul className="country-list" id={listId} role="listbox" aria-label={label}>
            {results.map((country, i) => (
              <li key={country.iso}>
                <button
                  type="button"
                  role="option"
                  aria-selected={country.iso === selected.iso}
                  className={i === highlight ? 'is-highlighted' : ''}
                  onPointerEnter={() => {
                    setHighlight(i);
                  }}
                  onClick={() => {
                    choose(country);
                  }}
                >
                  <Flag iso={country.iso} name={country.name} />
                  <span className="country-name">{country.name}</span>
                  <span className="country-dial">{country.dial}</span>
                </button>
              </li>
            ))}
            {results.length === 0 && <li className="country-empty">Sin resultados</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
