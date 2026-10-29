import { Icon } from '../../components/Icon';
import { minutesLeft } from '../../lib/format';
import type { Dashboard, SessionUser } from '../../lib/types';
import { PageHeading } from './Shared';
import { RentalTable } from './RentalTable';

export function Overview({
  dash,
  user,
  onNew,
  onReload,
  notify,
}: {
  dash: Dashboard;
  user: SessionUser;
  onNew: () => void;
  onReload: () => Promise<void>;
  notify: (m: string) => void;
}) {
  const active = dash.rentals.filter((r) => !r.endedAt);
  const overdue = active.filter((r) => minutesLeft(r.dueAt) < 0);
  const free = (kind: 'scooter' | 'helmet') =>
    dash.equipment.filter((e) => e.kind === kind && !e.busy && e.status === 'available').length;

  return (
    <>
      <PageHeading
        title={`Hola, ${user.name.split(' ')[0] ?? ''}.`}
        subtitle="Todo lo que necesitas para poner la estación en movimiento."
        action={
          <button className="button" onClick={onNew}>
            <Icon name="plus" />
            Nuevo alquiler
          </button>
        }
      />
      <div className="metrics">
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
      </div>

      <RentalTable
        title="Ahora en recorrido"
        subtitle="Alquileres que siguen en la calle."
        rentals={active}
        onNew={onNew}
        onReload={onReload}
        notify={notify}
        showHeading={false}
      />
    </>
  );
}
