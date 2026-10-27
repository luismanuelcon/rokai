import { useState, type FormEvent } from 'react';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { api } from '../../lib/api';
import { money } from '../../lib/format';
import type { Rate } from '../../lib/types';

const PERIODS: [Rate['period'], string][] = [
  ['special', 'Martes a jueves'],
  ['weekend', 'Viernes a domingo y festivos'],
];
const PERIOD_LABEL = Object.fromEntries(PERIODS) as Record<Rate['period'], string>;

/** El contrato limita la duración a 1–480 minutos y el plan a 1 o 2 patinetas. */
const MAX_MINUTES = 480;
/** `Cents` tope 1.000.000.000 centavos. */
const MAX_PESOS = 10_000_000;

const DAY_IN_BOGOTA = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Bogota',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const DAY_LABEL = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const prettyDate = (iso: string) => DAY_LABEL.format(new Date(`${iso}T12:00:00Z`));

function validityLabel(rate: Rate): string {
  if (!rate.validFrom && !rate.validUntil) return 'Sin fecha límite';
  if (rate.validFrom && rate.validUntil)
    return `${prettyDate(rate.validFrom)} – ${prettyDate(rate.validUntil)}`;
  return rate.validFrom
    ? `Desde ${prettyDate(rate.validFrom)}`
    : `Hasta ${prettyDate(rate.validUntil!)}`;
}

/**
 * El portal público solo muestra tarifas activas y dentro de vigencia (RN-005),
 * así que el chip refleja esa visibilidad real y no solo la casilla `active`.
 */
function visibility(rate: Rate, today: string): { tone: string; label: string } {
  if (!rate.active) return { tone: 'alert', label: 'Inactiva' };
  if (rate.validFrom && rate.validFrom > today) return { tone: 'warning', label: 'Programada' };
  if (rate.validUntil && rate.validUntil < today) return { tone: 'busy', label: 'Vencida' };
  return { tone: 'ok', label: 'Vigente' };
}

const planLabel = (rate: Rate) =>
  `${rate.minutes} min · ${rate.quantity === 1 ? '1 patineta' : '2 patinetas'}`;

interface Draft {
  period: Rate['period'];
  minutes: string;
  quantity: string;
  pesos: string;
  active: string;
  validFrom: string;
  validUntil: string;
}

const BLANK: Draft = {
  period: 'special',
  minutes: '15',
  quantity: '1',
  pesos: '',
  active: 'true',
  validFrom: '',
  validUntil: '',
};

const draftOf = (rate: Rate): Draft => ({
  period: rate.period,
  minutes: String(rate.minutes),
  quantity: String(rate.quantity),
  pesos: String(Math.round(rate.priceCents / 100)),
  active: String(rate.active),
  validFrom: rate.validFrom ?? '',
  validUntil: rate.validUntil ?? '',
});

export function Rates({
  rates,
  onReload,
  notify,
}: {
  rates: Rate[];
  onReload: () => Promise<void>;
  notify: (m: string) => void;
}) {
  const [editing, setEditing] = useState<Rate | 'new' | null>(null);
  const [removing, setRemoving] = useState<Rate | null>(null);
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const today = DAY_IN_BOGOTA.format(new Date());

  function open(target: Rate | 'new') {
    setDraft(target === 'new' ? BLANK : draftOf(target));
    setError('');
    setEditing(target);
  }

  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
  };

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const pesos = Number(draft.pesos);
    if (!Number.isFinite(pesos) || pesos < 0 || pesos > MAX_PESOS) {
      setError(`Escribe un valor entre $0 y ${money(MAX_PESOS * 100)}.`);
      return;
    }
    if (draft.validFrom && draft.validUntil && draft.validFrom > draft.validUntil) {
      setError('La fecha final debe ser igual o posterior a la inicial.');
      return;
    }

    const validity = {
      validFrom: draft.validFrom || null,
      validUntil: draft.validUntil || null,
    };
    setBusy(true);
    setError('');
    try {
      if (editing === 'new') {
        await api('/admin/rates', {
          method: 'POST',
          json: {
            period: draft.period,
            minutes: Number(draft.minutes),
            quantity: Number(draft.quantity),
            priceCents: Math.round(pesos * 100),
            ...validity,
          },
        });
        notify('Tarifa creada.');
      } else if (editing) {
        await api(`/admin/rates/${editing.id}`, {
          method: 'PATCH',
          json: {
            priceCents: Math.round(pesos * 100),
            active: draft.active === 'true',
            ...validity,
          },
        });
        notify('Tarifa actualizada.');
      }
      setEditing(null);
      await onReload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la tarifa.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!removing || busy) return;
    setBusy(true);
    setError('');
    try {
      await api(`/admin/rates/${removing.id}`, { method: 'DELETE' });
      setRemoving(null);
      notify('Tarifa eliminada.');
      await onReload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar la tarifa.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <div className="toolbar">
        <div>
          <h2>Tarifas y vigencia</h2>
          <p className="small-copy muted">
            El portal público solo muestra las tarifas vigentes hoy. Los alquileres ya registrados
            conservan el precio con el que se firmaron.
          </p>
        </div>
        <button
          className="button small"
          onClick={() => {
            open('new');
          }}
        >
          Nueva tarifa <Icon name="plus" />
        </button>
      </div>

      {rates.length === 0 ? (
        <div className="empty">
          <Icon name="chart" />
          <h3>Todavía no hay tarifas</h3>
          <p>Crea la primera para que el portal público pueda mostrar precios.</p>
          <button
            className="button"
            onClick={() => {
              open('new');
            }}
          >
            Crear tarifa <Icon name="plus" />
          </button>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Período</th>
                <th>Plan</th>
                <th>Valor</th>
                <th>Vigencia</th>
                <th>Estado</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {rates.map((rate) => {
                const state = visibility(rate, today);
                return (
                  <tr key={rate.id}>
                    <td>{PERIOD_LABEL[rate.period]}</td>
                    <td>{planLabel(rate)}</td>
                    <td>{money(rate.priceCents)}</td>
                    <td>{validityLabel(rate)}</td>
                    <td>
                      <span className={`status ${state.tone}`}>{state.label}</span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="button small outline"
                          onClick={() => {
                            open(rate);
                          }}
                        >
                          Editar
                        </button>
                        <button
                          className="button small subtle"
                          onClick={() => {
                            setError('');
                            setRemoving(rate);
                          }}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <Modal
          title={editing === 'new' ? 'Nueva tarifa' : 'Editar tarifa'}
          onClose={() => {
            setEditing(null);
          }}
        >
          <form onSubmit={(e) => void save(e)}>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}

            {editing === 'new' ? (
              <>
                <div className="field">
                  <label htmlFor="rate-period">Período</label>
                  <select
                    id="rate-period"
                    value={draft.period}
                    onChange={(e) => {
                      set({ period: e.target.value as Rate['period'] });
                    }}
                  >
                    {PERIODS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="rate-minutes">Duración</label>
                    <input
                      id="rate-minutes"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={MAX_MINUTES}
                      required
                      value={draft.minutes}
                      onChange={(e) => {
                        set({ minutes: e.target.value });
                      }}
                    />
                    <small>Minutos, entre 1 y {MAX_MINUTES}.</small>
                  </div>
                  <div className="field">
                    <label htmlFor="rate-quantity">Plan</label>
                    <select
                      id="rate-quantity"
                      value={draft.quantity}
                      onChange={(e) => {
                        set({ quantity: e.target.value });
                      }}
                    >
                      <option value="1">1 patineta</option>
                      <option value="2">2 patinetas</option>
                    </select>
                  </div>
                </div>
              </>
            ) : (
              <p className="notice">
                {PERIOD_LABEL[editing.period]} · {planLabel(editing)}. El período, la duración y el
                plan no se editan: crea otra tarifa si cambian.
              </p>
            )}

            <div className="form-grid">
              <div className="field">
                <label htmlFor="rate-price">Valor</label>
                <input
                  id="rate-price"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={MAX_PESOS}
                  step={100}
                  required
                  value={draft.pesos}
                  onChange={(e) => {
                    set({ pesos: e.target.value });
                  }}
                />
                <small>Pesos colombianos, total del plan.</small>
              </div>
              {editing !== 'new' && (
                <div className="field">
                  <label htmlFor="rate-active">Estado</label>
                  <select
                    id="rate-active"
                    value={draft.active}
                    onChange={(e) => {
                      set({ active: e.target.value });
                    }}
                  >
                    <option value="true">Activa</option>
                    <option value="false">Inactiva</option>
                  </select>
                </div>
              )}
            </div>

            <div className="form-grid">
              <div className="field">
                <label htmlFor="rate-from">Vigente desde</label>
                <input
                  id="rate-from"
                  type="date"
                  value={draft.validFrom}
                  onChange={(e) => {
                    set({ validFrom: e.target.value });
                  }}
                />
              </div>
              <div className="field">
                <label htmlFor="rate-until">Vigente hasta</label>
                <input
                  id="rate-until"
                  type="date"
                  min={draft.validFrom || undefined}
                  value={draft.validUntil}
                  onChange={(e) => {
                    set({ validUntil: e.target.value });
                  }}
                />
              </div>
            </div>
            <p className="small-copy muted">Deja las fechas vacías para que no caduque.</p>

            <div className="modal-actions">
              <button
                type="button"
                className="button outline"
                onClick={() => {
                  setEditing(null);
                }}
              >
                Cancelar
              </button>
              <button type="submit" className="button dark" disabled={busy}>
                {busy ? 'Guardando…' : 'Guardar tarifa'} <Icon name="check" />
              </button>
            </div>
          </form>
        </Modal>
      )}

      {removing && (
        <Modal
          title="Eliminar tarifa"
          onClose={() => {
            setRemoving(null);
          }}
        >
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <p className="small-copy">
            Se borrará <strong>{PERIOD_LABEL[removing.period]}</strong> · {planLabel(removing)} por{' '}
            {money(removing.priceCents)}. La acción no se puede deshacer. Si la tarifa ya se aplicó
            en un alquiler, desactívala en lugar de borrarla.
          </p>
          <div className="modal-actions">
            <button
              type="button"
              className="button outline"
              onClick={() => {
                setRemoving(null);
              }}
            >
              Conservar
            </button>
            <button
              type="button"
              className="button danger"
              disabled={busy}
              onClick={() => void remove()}
            >
              {busy ? 'Eliminando…' : 'Eliminar tarifa'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
