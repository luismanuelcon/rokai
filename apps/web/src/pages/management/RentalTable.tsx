import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { api } from '../../lib/api';
import { countdown, useTicker } from '../../lib/countdown';
import { documentShort } from '../../lib/documents';
import { datetime, lateCharge, money } from '../../lib/format';
import type { Rental } from '../../lib/types';
import { PageHeading } from './Shared';

type PaymentMethod = NonNullable<Rental['paymentMethod']>;

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
};

function RentalRow({ rental, onSelect }: { rental: Rental; onSelect: () => void }) {
  const active = !rental.endedAt;
  const timer = active ? countdown(rental.startedAt, rental.dueAt) : null;
  const cls = timer?.overdue ? 'alert' : active ? 'busy' : '';

  return (
    <tr>
      <td>
        <strong>
          #{String(rental.id).padStart(4, '0')} · {rental.customerName}
        </strong>
        <small>Registró: {rental.createdByName}</small>
      </td>
      <td>
        {rental.equipment
          .filter((e) => e.kind === 'scooter')
          .map((e) => (
            <div key={e.code}>{e.code}</div>
          ))}
      </td>
      <td>
        {datetime(rental.startedAt)}
        <br />
        <small>{rental.minutes} minutos</small>
      </td>
      <td>{money(rental.finalPriceCents ?? rental.priceCents)}</td>
      <td>
        {timer ? (
          <div className={`countdown${timer.overdue ? ' is-overdue' : ''}`}>
            <span className="countdown-clock" aria-live="off">
              {timer.label}
            </span>
            <span className="countdown-caption">
              {timer.overdue ? 'tiempo cumplido' : 'restante'}
            </span>
            <span
              className="countdown-bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(timer.progress * 100)}
              aria-label="Tiempo consumido del alquiler"
            >
              <span style={{ width: `${String(timer.progress * 100)}%` }} />
            </span>
          </div>
        ) : (
          <span className={`status ${cls}`}>Finalizado</span>
        )}
      </td>
      <td>
        <button className="button small outline" onClick={onSelect}>
          {rental.endedAt ? 'Ver detalle' : 'Devolución'}
        </button>
      </td>
    </tr>
  );
}

const PAYMENT_METHODS: [PaymentMethod, string][] = [
  ['cash', 'Efectivo'],
  ['transfer', 'Transferencia'],
];

function RentalDialog({
  rental,
  lateFeePerMinuteCents,
  isAdmin,
  onClose,
  onFinished,
  onDeleted,
}: {
  rental: Rental;
  lateFeePerMinuteCents: number;
  isAdmin: boolean;
  onClose: () => void;
  onFinished: () => void;
  onDeleted: () => void;
}) {
  const [notes, setNotes] = useState('');
  const [payment, setPayment] = useState<PaymentMethod | ''>('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Se recalcula con el reloj: el recargo depende del minuto en que se cierre.
  useTicker(1000, !rental.endedAt);
  const late = rental.endedAt
    ? { minutes: rental.lateMinutes ?? 0, cents: rental.lateFeeCents ?? 0 }
    : lateCharge(rental.dueAt, lateFeePerMinuteCents);
  const total = rental.finalPriceCents ?? rental.priceCents + late.cents;

  async function finish() {
    if (!payment) {
      setError('Selecciona el método de pago.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api(`/rentals/${rental.id}/finish`, {
        method: 'POST',
        json: { notes, paymentMethod: payment },
      });
      onFinished();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo finalizar.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError('');
    try {
      await api(`/admin/rentals/${rental.id}`, { method: 'DELETE' });
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar el registro.');
      setBusy(false);
    }
  }

  return (
    <Modal
      title={rental.endedAt ? 'Detalle del alquiler' : 'Registrar devolución'}
      onClose={onClose}
    >
      <div className="notice">
        #{String(rental.id).padStart(4, '0')} · {rental.customerName}
      </div>
      <div className="summary-row">
        <span>Documento</span>
        <strong>
          {documentShort(rental.customerDocumentType)} {rental.customerDocument}
        </strong>
      </div>
      <div className="summary-row">
        <span>Teléfono</span>
        <strong>{rental.customerPhone ?? 'No registrado'}</strong>
      </div>
      <div className="summary-row">
        <span>Equipos</span>
        <strong>{rental.equipment.map((e) => e.code).join(', ')}</strong>
      </div>
      <div className="summary-row">
        <span>Inicio</span>
        <strong>{datetime(rental.startedAt)}</strong>
      </div>
      <div className="summary-row">
        <span>Total contratado</span>
        <strong>{money(rental.priceCents)}</strong>
      </div>

      {late.minutes > 0 && (
        <div className="summary-row">
          <span>
            Recargo por retraso
            <small className="muted"> · {late.minutes} min</small>
          </span>
          <strong className={late.cents > 0 ? 'is-surcharge' : undefined}>
            {late.cents > 0 ? `+ ${money(late.cents)}` : 'Sin cobro'}
          </strong>
        </div>
      )}

      <div className="summary-row is-total">
        <span>Total a cobrar</span>
        <strong>{money(total)}</strong>
      </div>

      {rental.endedAt ? (
        <>
          <div className="summary-row">
            <span>Devolución</span>
            <strong>{datetime(rental.endedAt)}</strong>
          </div>
          <div className="summary-row">
            <span>Método de pago</span>
            <strong>
              {rental.paymentMethod ? PAYMENT_LABEL[rental.paymentMethod] : 'No registrado'}
            </strong>
          </div>
          <div className="summary-row">
            <span>Finalizó</span>
            <strong>{rental.endedByName}</strong>
          </div>
          <p className="small-copy">Novedades: {rental.notes || 'Sin novedades'}</p>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
        </>
      ) : (
        <>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <fieldset className="field choice-group">
            <legend className="field-label">Método de pago</legend>
            <div className="choice-row">
              {PAYMENT_METHODS.map(([value, label]) => (
                <label className="choice" key={value}>
                  <input
                    type="radio"
                    name="payment-method"
                    value={value}
                    checked={payment === value}
                    onChange={() => {
                      setPayment(value);
                      setError('');
                    }}
                  />
                  <span>
                    <Icon name={value === 'cash' ? 'cash' : 'transfer'} />
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="field">
            <label htmlFor="return-notes">Novedades de devolución (opcional)</label>
            <textarea
              id="return-notes"
              maxLength={2000}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
              }}
            />
          </div>
          <div className="modal-actions">
            <button className="button outline" onClick={onClose}>
              Cancelar
            </button>
            <button
              className="button dark"
              disabled={busy || !payment}
              onClick={() => void finish()}
            >
              {busy ? 'Guardando…' : `Cobrar ${money(total)}`}
            </button>
          </div>
        </>
      )}

      {/* El borrado existe para limpiar pruebas: separado del flujo normal y
          detrás de una confirmación explícita. */}
      {isAdmin && (
        <div className="danger-zone">
          {confirmDelete ? (
            <>
              <p className="small-copy">
                Se eliminará el registro <strong>#{String(rental.id).padStart(4, '0')}</strong> y
                sus notificaciones. El equipo quedará libre y la traza de auditoría se conserva.
                Esta acción no se puede deshacer.
              </p>
              <div className="modal-actions">
                <button
                  type="button"
                  className="button small outline"
                  disabled={busy}
                  onClick={() => {
                    setConfirmDelete(false);
                  }}
                >
                  Conservar
                </button>
                <button
                  type="button"
                  className="button small danger"
                  disabled={busy}
                  onClick={() => void remove()}
                >
                  {busy ? 'Eliminando…' : 'Eliminar definitivamente'}
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              className="button small subtle"
              onClick={() => {
                setError('');
                setConfirmDelete(true);
              }}
            >
              <Icon name="trash" />
              Eliminar registro
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}

export function RentalTable({
  title,
  subtitle,
  rentals,
  lateFeePerMinuteCents,
  isAdmin,
  onNew,
  onReload,
  notify,
  showHeading = true,
}: {
  title: string;
  subtitle: string;
  rentals: Rental[];
  lateFeePerMinuteCents: number;
  isAdmin: boolean;
  onNew: () => void;
  onReload: () => Promise<void>;
  notify: (m: string) => void;
  showHeading?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Rental | null>(null);
  // Un solo intervalo mantiene vivos todos los contadores de la tabla.
  useTicker(
    1000,
    rentals.some((r) => !r.endedAt),
  );

  const q = search.toLowerCase();
  const filtered = q
    ? rentals.filter((r) =>
        `${r.id} ${r.customerName} ${r.equipment.map((e) => e.code).join(' ')}`
          .toLowerCase()
          .includes(q),
      )
    : rentals;

  return (
    <>
      {showHeading && (
        <PageHeading
          title={title}
          subtitle={subtitle}
          action={
            <button className="button" onClick={onNew}>
              <Icon name="plus" />
              Nuevo alquiler
            </button>
          }
        />
      )}
      <div className="panel">
        <div className="toolbar">
          <h2>{showHeading ? 'Registro de alquileres' : title}</h2>
          <input
            type="search"
            placeholder="Buscar cliente o código…"
            aria-label="Buscar alquileres"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
          />
        </div>
        {filtered.length === 0 ? (
          <div className="empty">
            <Icon name="scooter" />
            <h3>Aquí comienza el próximo paseo.</h3>
            <p>No hay alquileres en esta vista.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Alquiler / cliente</th>
                  <th scope="col">Equipos</th>
                  <th scope="col">Inicio / duración</th>
                  <th scope="col">Valor</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <RentalRow
                    key={r.id}
                    rental={r}
                    onSelect={() => {
                      setSelected(r);
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <RentalDialog
          rental={selected}
          lateFeePerMinuteCents={lateFeePerMinuteCents}
          isAdmin={isAdmin}
          onClose={() => {
            setSelected(null);
          }}
          onFinished={() => {
            setSelected(null);
            notify('Devolución registrada.');
            void onReload();
          }}
          onDeleted={() => {
            setSelected(null);
            notify('Registro eliminado.');
            void onReload();
          }}
        />
      )}
    </>
  );
}
