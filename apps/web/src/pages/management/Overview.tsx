import { formatReservationDate } from '@rokai/contracts';
import { Icon } from '../../components/Icon';
import { time } from '../../lib/format';
import { useTicker } from '../../lib/countdown';
import type { Dashboard, SessionUser } from '../../lib/types';
import { PageHeading } from './Shared';
import { RentalTable } from './RentalTable';

export function Overview({
  dash,
  isAdmin,
  onNew,
  onReload,
  onRefresh,
  refreshing,
  lastUpdatedAt,
  notify,
}: {
  dash: Dashboard;
  user: SessionUser;
  isAdmin: boolean;
  onNew: () => void;
  onReload: () => Promise<void>;
  onRefresh: () => Promise<void>;
  refreshing: boolean;
  lastUpdatedAt: string | null;
  notify: (m: string) => void;
}) {
  const active = dash.rentals.filter((r) => !r.endedAt);
  useTicker(1000, active.length > 0);
  const overdue = active.filter((r) => Date.parse(r.dueAt) <= Date.now());
  const free = (kind: 'scooter' | 'helmet') =>
    dash.equipment.filter((e) => e.kind === kind && !e.busy && e.status === 'available').length;

  const completed = dash.completedTrips;

  return (
    <>
      <PageHeading
        title="Resumen"
        action={
          <div className="overview-refresh">
            <button
              type="button"
              className="button outline"
              disabled={refreshing}
              aria-busy={refreshing}
              onClick={() => void onRefresh().catch(() => {})}
            >
              <Icon name="history" />
              {refreshing ? 'Actualizando…' : 'Actualizar resumen'}
            </button>
            <p role="status" aria-live="polite">
              {refreshing ? (
                'Consultando los datos más recientes…'
              ) : lastUpdatedAt ? (
                <>
                  Última actualización:{' '}
                  <time dateTime={lastUpdatedAt}>
                    {new Intl.DateTimeFormat('es-CO', {
                      timeZone: 'America/Bogota',
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    }).format(new Date(lastUpdatedAt))}
                  </time>{' '}
                  · Bogotá
                </>
              ) : (
                'Sin actualización registrada'
              )}
            </p>
          </div>
        }
      />
      <div className="metrics overview-metrics" aria-busy={refreshing}>
        <div className="metric">
          <div>
            <p>Alquileres activos</p>
            <strong>{active.length}</strong>
          </div>
          <div className="icon-box">
            <Icon name="clock" />
          </div>
        </div>
        <div className="metric">
          <div>
            <p>Tiempo cumplido</p>
            <strong>{overdue.length}</strong>
          </div>
          <div className="icon-box">
            <Icon name="bell" />
          </div>
        </div>
        <div className="metric">
          <div>
            <p>Patinetas disponibles</p>
            <strong>{free('scooter')}</strong>
          </div>
          <div className="icon-box">
            <Icon name="scooter" />
          </div>
        </div>
        <div className="metric">
          <div>
            <p>Cascos disponibles</p>
            <strong>{free('helmet')}</strong>
          </div>
          <div className="icon-box">
            <Icon name="helmet" />
          </div>
        </div>
        <section className="metric completed-trips" aria-labelledby="completed-trips-title">
          <div className="completed-trips-total">
            <div className="icon-box">
              <Icon name="check" />
            </div>
            <div>
              <p id="completed-trips-title">Viajes completados del día</p>
              <strong>{completed.count}</strong>
              <span className="completed-trips-unit">alquileres devueltos</span>
            </div>
          </div>
          <div className="completed-trips-period">
            <p>{formatReservationDate(completed.date)}</p>
            <p>
              {completed.firstStartedAt ? (
                <>
                  Desde el primer alquiler,{' '}
                  <time dateTime={completed.firstStartedAt}>{time(completed.firstStartedAt)}</time>
                  {completed.closedAt ? (
                    <>
                      {' '}
                      · Cierre:{' '}
                      <time dateTime={completed.closedAt}>{time(completed.closedAt)}</time>
                    </>
                  ) : (
                    ' · Jornada abierta'
                  )}
                </>
              ) : (
                'Aún no hay alquileres registrados en esta jornada.'
              )}
            </p>
            <small>Hora de Bogotá · Cada alquiler cuenta como un viaje.</small>
          </div>
        </section>
      </div>

      <RentalTable
        title="Alquileres activos"
        rentals={active}
        lateFeePerMinuteCents={dash.lateFeePerMinuteCents}
        isAdmin={isAdmin}
        onNew={onNew}
        onReload={onReload}
        notify={notify}
        showHeading={false}
      />
    </>
  );
}
