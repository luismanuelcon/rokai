import { useEffect, useState } from 'react';
import {
  RESERVATION_STATUS_LABEL,
  RATE_PERIOD_LABEL,
  planBreakdown,
  formatReservationDate,
  formatReservationTime,
  whatsappUrl,
  type ReservationStatus,
} from '@rokai/contracts';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { api } from '../../lib/api';
import { datetime, money } from '../../lib/format';
import type { ReservationItem } from '../../lib/types';
import { PageHeading } from './Shared';

interface Page {
  items: ReservationItem[];
  total: number;
  page: number;
  pageSize: number;
}

const STATUS_CLASS: Record<ReservationStatus, string> = {
  pending: 'warning',
  confirmed: 'ok',
  in_rental: 'busy',
  completed: '',
  cancelled: 'alert',
  no_show: 'alert',
};

function StatusPill({ status }: { status: ReservationStatus }) {
  return (
    <span className={`status ${STATUS_CLASS[status]}`}>{RESERVATION_STATUS_LABEL[status]}</span>
  );
}

function contactUrl(r: ReservationItem) {
  return whatsappUrl(
    r.phone,
    `Hola, ${r.customerName}. Te escribimos de ROKAI sobre tu reserva ${r.code} del ${formatReservationDate(r.date)} a las ${formatReservationTime(r.date, r.startTime)}`,
  );
}

function ReservationDialog({
  reservation,
  isAdmin,
  onClose,
  onChanged,
  onStartRental,
}: {
  reservation: ReservationItem;
  isAdmin: boolean;
  onClose: () => void;
  onChanged: (message: string) => void;
  onStartRental: (r: ReservationItem) => void;
}) {
  const [closing, setClosing] = useState<'cancelled' | 'no_show' | null>(null);
  const [reason, setReason] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const r = reservation;
  const open = r.status === 'pending' || r.status === 'confirmed';

  async function remove() {
    if (busy) return;
    if (deleteReason.trim().length < 10) {
      setError('Explica el motivo de la eliminación con al menos 10 caracteres.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api(`/admin/reservations/${String(r.id)}`, {
        method: 'DELETE',
        json: { reason: deleteReason.trim() },
      });
      onChanged(`Reserva ${r.code} eliminada.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar la reserva.');
      setBusy(false);
    }
  }

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await api(`/reservations/${String(r.id)}/status`, {
        method: 'POST',
        json: { status: 'confirmed' },
      });
      onChanged(`Reserva ${r.code} confirmada.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo confirmar la reserva.');
      setBusy(false);
    }
  }

  async function changeStatus() {
    if (!closing || busy) return;
    if (reason.trim().length < 5) {
      setError('Explica el motivo con al menos 5 caracteres.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api(`/reservations/${String(r.id)}/status`, {
        method: 'POST',
        json: { status: closing, reason: reason.trim() },
      });
      onChanged(
        closing === 'cancelled'
          ? `Reserva ${r.code} cancelada. El cupo quedó libre.`
          : `Reserva ${r.code} cerrada como no asistió.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar la reserva.');
      setBusy(false);
    }
  }

  return (
    <Modal title={`Reserva ${r.code}`} onClose={onClose}>
      <div className="summary-row">
        <span>Estado</span>
        <StatusPill status={r.status} />
      </div>
      <div className="summary-row">
        <span>Cliente</span>
        <strong>{r.customerName}</strong>
      </div>
      <div className="summary-row">
        <span>WhatsApp</span>
        <strong>{r.phone}</strong>
      </div>
      <div className="summary-row">
        <span>Fecha</span>
        <strong>{formatReservationDate(r.date)}</strong>
      </div>
      <div className="summary-row">
        <span>Horario</span>
        <strong>
          {formatReservationTime(r.date, r.startTime)} – {formatReservationTime(r.date, r.endTime)}
        </strong>
      </div>
      <div className="summary-row">
        <span>Plan</span>
        <strong>{r.planLabel}</strong>
      </div>
      <div className="summary-row">
        <span>Patinetas</span>
        <strong>
          {r.quantity} · {planBreakdown(r.quantity)}
        </strong>
      </div>
      <div className="summary-row">
        <span>Tarifa</span>
        <strong>{RATE_PERIOD_LABEL[r.ratePeriod]}</strong>
      </div>
      <div className="summary-row">
        <span>Creada</span>
        <strong>{datetime(r.createdAt)}</strong>
      </div>
      {r.rentalId && (
        <div className="summary-row">
          <span>Alquiler vinculado</span>
          <strong>#{String(r.rentalId).padStart(4, '0')}</strong>
        </div>
      )}
      {r.statusChangedAt && r.status !== 'pending' && (
        <div className="summary-row">
          <span>Último cambio</span>
          <strong>
            {datetime(r.statusChangedAt)}
            {r.statusChangedByName ? ` · ${r.statusChangedByName}` : ''}
          </strong>
        </div>
      )}
      {r.statusReason && <p className="small-copy">Motivo: {r.statusReason}</p>}
      <div className="summary-row is-total">
        <span>Valor reservado</span>
        <strong>{money(r.priceCents)}</strong>
      </div>
      <p className="small-copy muted">
        La reserva no registra pagos. El cobro se hace al iniciar y devolver el alquiler.
      </p>
      {r.status === 'pending' && (
        <p className="notice" role="note">
          Confírmala cuando llegue el WhatsApp del cliente con el código {r.code}. Mientras tanto,
          el horario sigue apartado.
        </p>
      )}

      {open && r.rateId === null && (
        <p className="notice" role="note">
          La tarifa original ya no existe. Al iniciar el alquiler podrás elegir una tarifa
          compatible con la duración y categoría reservadas, conservando el importe original.
        </p>
      )}
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}

      {closing ? (
        <div className="reservation-closing">
          <div className="field">
            <label htmlFor="reservation-reason">
              {closing === 'cancelled' ? 'Motivo de la cancelación' : 'Detalle de la no asistencia'}
            </label>
            <textarea
              id="reservation-reason"
              maxLength={500}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
              }}
            />
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="button outline"
              onClick={() => {
                setClosing(null);
                setError('');
              }}
            >
              Volver
            </button>
            <button
              type="button"
              className="button danger"
              disabled={busy}
              onClick={() => void changeStatus()}
            >
              {busy
                ? 'Guardando…'
                : closing === 'cancelled'
                  ? 'Cancelar reserva'
                  : 'Marcar no asistió'}
            </button>
          </div>
        </div>
      ) : (
        <div className="reservation-actions">
          <a
            className="button outline"
            href={contactUrl(r)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="whatsapp" />
            Escribir al cliente
          </a>
          {r.status === 'pending' && (
            <button type="button" className="button" disabled={busy} onClick={() => void confirm()}>
              <Icon name="check" />
              {busy ? 'Confirmando…' : 'Confirmar: recibí el WhatsApp'}
            </button>
          )}
          {open && (
            <>
              <button
                type="button"
                className={r.status === 'confirmed' ? 'button' : 'button outline'}
                onClick={() => onStartRental(r)}
                disabled={busy}
              >
                <Icon name="scooter" />
                Iniciar alquiler
              </button>
              <button
                type="button"
                className="button small subtle"
                onClick={() => {
                  setClosing('cancelled');
                }}
              >
                Cancelar reserva
              </button>
              <button
                type="button"
                className="button small subtle"
                onClick={() => {
                  setClosing('no_show');
                }}
              >
                No asistió
              </button>
            </>
          )}
        </div>
      )}

      {isAdmin && !closing && (
        <div className="danger-zone">
          {confirmDelete ? (
            <>
              <p className="small-copy">
                Se eliminará la reserva <strong>{r.code}</strong> y su cupo quedará libre.
                {r.rentalId ? ' El alquiler vinculado no se modifica.' : ''} La justificación
                quedará en Trazabilidad. Esta acción no se puede deshacer.
              </p>
              <div className="field">
                <label htmlFor="delete-reservation-reason">Justificación de la eliminación</label>
                <textarea
                  id="delete-reservation-reason"
                  rows={3}
                  required
                  minLength={10}
                  maxLength={1000}
                  disabled={busy}
                  value={deleteReason}
                  aria-describedby="delete-reservation-hint"
                  onChange={(event) => {
                    setDeleteReason(event.target.value);
                  }}
                />
                <small id="delete-reservation-hint">
                  Entre 10 y 1000 caracteres. Indica por qué debe eliminarse esta reserva.
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
              Eliminar reserva
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}

export function Reservations({
  isAdmin,
  notify,
  onStartRental,
}: {
  isAdmin: boolean;
  notify: (message: string) => void;
  onStartRental: (r: ReservationItem) => void;
}) {
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [date, setDate] = useState('');
  const [status, setStatus] = useState<ReservationStatus | ''>('');
  const [sort, setSort] = useState('start_asc');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<ReservationItem | null>(null);
  const [revision, setRevision] = useState(0);

  // La búsqueda espera a que el operario deje de escribir.
  useEffect(() => {
    const timer = setTimeout(() => {
      setTerm(search.trim());
      setPage(1);
    }, 300);
    return () => {
      clearTimeout(timer);
    };
  }, [search]);

  useEffect(() => {
    const query = new URLSearchParams({ page: String(page), sort });
    if (term) query.set('search', term);
    if (date) query.set('date', date);
    if (status) query.set('status', status);
    let cancelled = false;
    setLoading(true);
    api<Page>(`/reservations?${query.toString()}`)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError('');
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudo cargar.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [term, date, status, sort, page, revision]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const filtered = Boolean(search || date || status || sort !== 'start_asc');

  return (
    <>
      <PageHeading
        title="Reservas"
        subtitle="Reservas hechas desde el portal. Cada reserva confirmada ya bloquea su cupo."
      />
      <section className="panel reservations-panel" aria-busy={loading}>
        <div className="reservations-filters">
          <div className="field field-wide">
            <label htmlFor="reservation-search">Buscar</label>
            <input
              id="reservation-search"
              type="search"
              placeholder="Código, nombre o teléfono"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="reservation-date">Fecha</label>
            <input
              id="reservation-date"
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="reservation-status">Estado</label>
            <select
              id="reservation-status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as ReservationStatus | '');
                setPage(1);
              }}
            >
              <option value="">Todos</option>
              {(Object.keys(RESERVATION_STATUS_LABEL) as ReservationStatus[]).map((s) => (
                <option key={s} value={s}>
                  {RESERVATION_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="reservation-sort">Orden</label>
            <select
              id="reservation-sort"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
            >
              <option value="start_asc">Próximas primero</option>
              <option value="start_desc">Más lejanas primero</option>
              <option value="created_desc">Recién creadas</option>
            </select>
          </div>
          <button
            type="button"
            className="button small outline"
            disabled={!filtered}
            onClick={() => {
              setSearch('');
              setDate('');
              setStatus('');
              setSort('start_asc');
              setPage(1);
            }}
          >
            Limpiar filtros
          </button>
        </div>

        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}

        {data && data.items.length === 0 ? (
          <div className="empty">
            <h3>{filtered ? 'No hay reservas para estos filtros' : 'Aún no hay reservas'}</h3>
          </div>
        ) : (
          data && (
            <div
              className="table-wrap"
              tabIndex={0}
              role="region"
              aria-label="Listado de reservas, desplazamiento horizontal"
            >
              <table className="reservations-table">
                <thead>
                  <tr>
                    <th scope="col">Código</th>
                    <th scope="col">Cliente</th>
                    <th scope="col">Fecha y horario</th>
                    <th scope="col">Plan</th>
                    <th scope="col">Valor</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Creada</th>
                    <th scope="col">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong className="reservation-code">{r.code}</strong>
                      </td>
                      <td>
                        <strong>{r.customerName}</strong>
                        <small>{r.phone}</small>
                      </td>
                      <td>
                        {formatReservationDate(r.date)}
                        <small>
                          {formatReservationTime(r.date, r.startTime)} –{' '}
                          {formatReservationTime(r.date, r.endTime)}
                        </small>
                      </td>
                      <td>
                        {r.quantity} patineta{r.quantity > 1 ? 's' : ''}
                        <small>{planBreakdown(r.quantity)}</small>
                        <small>{r.durationMinutes} minutos</small>
                      </td>
                      <td className="reservation-amount">{money(r.priceCents)}</td>
                      <td>
                        <StatusPill status={r.status} />
                      </td>
                      <td>
                        <small>{datetime(r.createdAt)}</small>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="button small outline"
                          aria-label={`Ver reserva ${r.code} de ${r.customerName}`}
                          onClick={() => {
                            setSelected(r);
                          }}
                        >
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {data && data.total > 0 && (
          <nav className="expense-pagination" aria-label="Páginas de reservas">
            <span className="small-copy">
              {data.total} {data.total === 1 ? 'reserva' : 'reservas'} · página {page} de{' '}
              {totalPages}
            </span>
            <div>
              <button
                type="button"
                className="button small outline"
                disabled={page <= 1}
                onClick={() => {
                  setPage((p) => p - 1);
                }}
              >
                Anterior
              </button>
              <button
                type="button"
                className="button small outline"
                disabled={page >= totalPages}
                onClick={() => {
                  setPage((p) => p + 1);
                }}
              >
                Siguiente
              </button>
            </div>
          </nav>
        )}
      </section>

      {selected && (
        <ReservationDialog
          isAdmin={isAdmin}
          reservation={selected}
          onClose={() => {
            setSelected(null);
          }}
          onChanged={(message) => {
            setSelected(null);
            notify(message);
            setRevision((n) => n + 1);
          }}
          onStartRental={(r) => {
            setSelected(null);
            onStartRental(r);
          }}
        />
      )}
    </>
  );
}
