import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { api } from '../../lib/api';
import { countdown, useTicker } from '../../lib/countdown';
import { documentShort } from '../../lib/documents';
import { datetime, money } from '../../lib/format';
import type { Rental } from '../../lib/types';
import { PageHeading } from './Shared';

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

function RentalDialog({
  rental,
  onClose,
  onFinished,
}: {
  rental: Rental;
  onClose: () => void;
  onFinished: () => void;
}) {
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function finish() {
    setBusy(true);
    setError('');
    try {
      await api(`/rentals/${rental.id}/finish`, { method: 'POST', json: { notes } });
      onFinished();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo finalizar.');
    } finally {
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

      {rental.endedAt ? (
        <>
          <div className="summary-row">
            <span>Devolución</span>
            <strong>{datetime(rental.endedAt)}</strong>
          </div>
          <div className="summary-row">
            <span>Finalizó</span>
            <strong>{rental.endedByName}</strong>
          </div>
          <p className="small-copy">Novedades: {rental.notes || 'Sin novedades'}</p>
        </>
      ) : (
        <>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <p className="small-copy muted">
            El total final será {money(rental.priceCents)}. No se aplican recargos automáticos: el
            negocio aún no ha definido esa regla.
          </p>
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
            <button className="button dark" disabled={busy} onClick={() => void finish()}>
              {busy ? 'Guardando…' : 'Confirmar devolución'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

export function RentalTable({
  title,
  subtitle,
  rentals,
  onNew,
  onReload,
  notify,
  showHeading = true,
}: {
  title: string;
  subtitle: string;
  rentals: Rental[];
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
                  <th>Alquiler / cliente</th>
                  <th>Equipos</th>
                  <th>Inicio / duración</th>
                  <th>Valor</th>
                  <th>Estado</th>
                  <th>Acción</th>
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
          onClose={() => {
            setSelected(null);
          }}
          onFinished={() => {
            setSelected(null);
            notify('Devolución registrada.');
            void onReload();
          }}
        />
      )}
    </>
  );
}
