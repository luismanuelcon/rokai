import { money } from '../../lib/format';
import type { AdminData, Dashboard } from '../../lib/types';
import { PageHeading } from './Shared';

export function Reports({ dash, admin }: { dash: Dashboard; admin: AdminData }) {
  const finished = dash.rentals.filter((r) => r.endedAt);
  const total = finished.reduce((sum, r) => sum + (r.finalPriceCents ?? 0), 0);
  const minutes = finished.reduce((sum, r) => sum + r.minutes, 0);

  return (
    <>
      <PageHeading
        title="La estación en números."
        subtitle="Valores de alquileres finalizados. No representa confirmación de pagos."
      />
      <div className="metrics">
        <div className="metric">
          <div>
            <p>Valor finalizado acumulado</p>
            <strong>{money(total)}</strong>
          </div>
        </div>
        <div className="metric">
          <div>
            <p>Alquileres finalizados</p>
            <strong>{finished.length}</strong>
          </div>
        </div>
        <div className="metric">
          <div>
            <p>Duración contratada</p>
            <strong>{minutes} min</strong>
          </div>
        </div>
      </div>
      <div className="panel">
        <h2>Alquileres por responsable</h2>
        {admin.users.map((u) => (
          <div className="summary-row" key={u.id}>
            <span>{u.name}</span>
            <strong>
              {dash.rentals.filter((r) => r.createdByName === u.name).length} alquileres
            </strong>
          </div>
        ))}
      </div>
    </>
  );
}
