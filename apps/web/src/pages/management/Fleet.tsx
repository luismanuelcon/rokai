import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { api } from '../../lib/api';
import type { Dashboard, Equipment } from '../../lib/types';
import { PageHeading } from './Shared';

const LABELS: Record<Equipment['status'], string> = {
  available: 'Disponible',
  maintenance: 'Mantenimiento',
  inactive: 'Inactivo',
};

export function Fleet({
  dash,
  isAdmin,
  onReload,
  notify,
}: {
  dash: Dashboard;
  isAdmin: boolean;
  onReload: () => Promise<void>;
  notify: (m: string) => void;
}) {
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [status, setStatus] = useState<Equipment['status']>('available');

  async function save() {
    if (!editing) return;
    try {
      await api(`/admin/equipment/${editing.id}`, { method: 'PATCH', json: { status } });
      setEditing(null);
      notify('Estado del equipo actualizado.');
      await onReload();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'No se pudo actualizar.');
    }
  }

  return (
    <>
      <PageHeading title="Disponibilidad de equipos" />
      <div className="fleet-grid">
        {dash.equipment.map((e) => (
          <article className="fleet-card" key={e.id}>
            <span
              className={`status ${e.busy ? 'busy' : e.status === 'available' ? 'ok' : e.status === 'maintenance' ? 'warning' : 'alert'}`}
            >
              {e.busy ? 'En alquiler' : LABELS[e.status]}
            </span>
            <br />
            <Icon name={e.kind === 'scooter' ? 'scooter' : 'helmet'} />
            <h3>{e.code}</h3>
            <p className="small-copy">
              {e.kind === 'scooter' ? 'Patineta eléctrica' : 'Casco de protección'}
            </p>
            {isAdmin && !e.busy && (
              <button
                className="button small outline"
                onClick={() => {
                  setEditing(e);
                  setStatus(e.status);
                }}
              >
                Cambiar estado
              </button>
            )}
          </article>
        ))}
      </div>

      {editing && (
        <Modal
          title={`Estado de ${editing.code}`}
          onClose={() => {
            setEditing(null);
          }}
        >
          <div className="field">
            <label htmlFor="equipment-status">Estado</label>
            <select
              id="equipment-status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as Equipment['status']);
              }}
            >
              {Object.entries(LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="modal-actions">
            <button
              className="button outline"
              onClick={() => {
                setEditing(null);
              }}
            >
              Cancelar
            </button>
            <button className="button dark" onClick={() => void save()}>
              Guardar cambios
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
