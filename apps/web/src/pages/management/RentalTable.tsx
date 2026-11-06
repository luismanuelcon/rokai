import { TrackingActions } from '../../components/TrackingActions';
import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { api } from '../../lib/api';
import { countdown, useTicker } from '../../lib/countdown';
import { documentShort } from '../../lib/documents';
import { datetime, lateCharge, money, time, toBogotaTime } from '../../lib/format';
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
        <TrackingActions rentalId={rental.id} />
      </td>
    </tr>
  );
}

function RentalCard({ rental, onSelect }: { rental: Rental; onSelect: () => void }) {
  const timer = rental.endedAt ? null : countdown(rental.startedAt, rental.dueAt);
  const ending =
    !!timer && !timer.overdue && new Date(rental.dueAt).getTime() - Date.now() <= 300_000;
  return (
    <article
      className={`rental-mobile-card${timer?.overdue ? ' is-overdue' : ending ? ' is-ending' : ''}`}
    >
      <header className="rental-card-heading">
        <small>Alquiler #{String(rental.id).padStart(4, '0')}</small>
        <h3>{rental.customerName}</h3>
      </header>
      <div className="rental-card-timer" aria-live="off">
        <span>
          {timer
            ? timer.overdue
              ? 'Tiempo excedido'
              : ending
                ? 'Por terminar · tiempo restante'
                : 'Tiempo restante'
            : 'Finalizado'}
        </span>
        {timer && (
          <>
            <strong>{timer.label}</strong>
            <small>
              {timer.label.replace('+', '').split(':').length === 3
                ? 'horas : min : seg'
                : 'min : seg'}
            </small>
            <span className="countdown-bar" aria-hidden="true">
              <span style={{ width: `${timer.progress * 100}%` }} />
            </span>
          </>
        )}
      </div>
      <dl className="rental-card-facts">
        <div>
          <dt>Patinetas</dt>
          <dd>
            {rental.equipment
              .filter((e) => e.kind === 'scooter')
              .map((e) => e.code)
              .join(' · ') || '—'}
          </dd>
        </div>
        <div>
          <dt>Plan</dt>
          <dd>
            {rental.minutes} min · {money(rental.finalPriceCents ?? rental.priceCents)}
          </dd>
        </div>
        <div>
          <dt>{rental.endedAt ? 'Devolución' : 'Regreso previsto'}</dt>
          <dd>{datetime(rental.endedAt ?? rental.dueAt)}</dd>
        </div>
        <div>
          <dt>Registró</dt>
          <dd>{rental.createdByName}</dd>
        </div>
      </dl>
      <button
        type="button"
        className="button outline"
        onClick={onSelect}
        aria-label={`${rental.endedAt ? 'Ver detalle' : 'Registrar devolución'} de ${rental.customerName}, alquiler ${rental.id}`}
      >
        {rental.endedAt ? 'Ver detalle' : 'Registrar devolución'}
        <Icon name="arrow" />
      </button>
      <TrackingActions rentalId={rental.id} />
    </article>
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
  const [deleteReason, setDeleteReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [returnTime, setReturnTime] = useState(() => toBogotaTime(rental.dueAt));

  // La vista previa usa la hora de devolución elegida, igual que el servidor.
  const late = rental.endedAt
    ? { minutes: rental.lateMinutes ?? 0, cents: rental.lateFeeCents ?? 0 }
    : lateCharge(rental.dueAt, returnTime, lateFeePerMinuteCents);
  const total = rental.finalPriceCents ?? rental.priceCents + late.cents;

  async function finish() {
    if (!payment) {
      setError('Selecciona el método de pago.');
      return;
    }
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(returnTime)) {
      setError('Indica una hora de devolución válida.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api(`/rentals/${rental.id}/finish`, {
        method: 'POST',
        json: { notes, paymentMethod: payment, returnTime },
      });
      onFinished();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo finalizar.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
    if (deleteReason.trim().length < 10 || deleteReason.trim().length > 1000) {
      setError('Explica el motivo de la eliminación con entre 10 y 1000 caracteres.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api(`/admin/rentals/${rental.id}`, {
        method: 'DELETE',
        json: { reason: deleteReason.trim() },
      });
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
      <TrackingActions rentalId={rental.id} />
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

      {!rental.endedAt && (
        <div className="return-time-layout">
          <div className="field">
            <label htmlFor="return-time">Hora real de devolución</label>
            <input
              id="return-time"
              type="time"
              required
              aria-describedby="return-time-due"
              value={returnTime}
              onChange={(event) => {
                setReturnTime(event.target.value);
              }}
            />
            <small id="return-time-due">Vencía a las {time(rental.dueAt)}</small>
          </div>
          <div className="return-time-fee" aria-live="polite">
            <span className="field-label">Recargo</span>
            <div className="return-time-fee-value">
              <strong className={late.cents > 0 ? 'is-surcharge' : undefined}>
                {late.cents > 0 ? `+ ${money(late.cents)}` : money(0)}
              </strong>
              <small>{late.minutes > 0 ? `${String(late.minutes)} min tarde` : 'A tiempo'}</small>
            </div>
          </div>
        </div>
      )}

      {rental.endedAt && late.minutes > 0 && (
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
                sus notificaciones. Se retirará de los reportes de alquileres y su enlace de
                seguimiento dejará de funcionar. Los cierres de caja guardados no se modificarán. La
                justificación quedará en Trazabilidad. Esta acción no se puede deshacer.
              </p>
              <div className="field">
                <label htmlFor="delete-rental-reason">Justificación de la eliminación</label>
                <textarea
                  id="delete-rental-reason"
                  rows={3}
                  required
                  minLength={10}
                  maxLength={1000}
                  disabled={busy}
                  value={deleteReason}
                  aria-describedby="delete-reason-hint"
                  onChange={(event) => setDeleteReason(event.target.value)}
                />
                <small id="delete-reason-hint">
                  Entre 10 y 1000 caracteres. Indica por qué debe eliminarse este registro.
                </small>
              </div>
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
                  disabled={busy || deleteReason.trim().length < 10}
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
  subtitle?: string;
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
  const ordered = [...filtered].sort((a, b) => {
    if (!a.endedAt && !b.endedAt) return Date.parse(a.dueAt) - Date.parse(b.dueAt);
    return 0;
  });

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
            <h3>{search ? 'Sin resultados' : 'Sin alquileres'}</h3>
          </div>
        ) : (
          <>
            <div className="rental-mobile-list">
              {ordered.map((r) => (
                <RentalCard key={r.id} rental={r} onSelect={() => setSelected(r)} />
              ))}
            </div>
            <div className="table-wrap rental-desktop-table">
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
                  {ordered.map((r) => (
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
          </>
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
