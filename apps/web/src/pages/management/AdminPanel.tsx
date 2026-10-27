import { useEffect, useState, type FormEvent } from 'react';
import { Icon } from '../../components/Icon';
import { api } from '../../lib/api';
import { datetime } from '../../lib/format';
import type { AdminData, Notification } from '../../lib/types';
import { Rates } from './Rates';
import { PageHeading } from './Shared';

type Tab = 'rates' | 'users' | 'faqs' | 'settings' | 'notifications' | 'audit';

const TABS: [Tab, string][] = [
  ['rates', 'Tarifas'],
  ['users', 'Usuarios'],
  ['faqs', 'Preguntas frecuentes'],
  ['settings', 'Información y legales'],
  ['notifications', 'Notificaciones'],
  ['audit', 'Trazabilidad'],
];

const SETTING_FIELDS: [string, string][] = [
  ['location', 'Ubicación'],
  ['mapsUrl', 'Enlace del mapa (Cómo llegar)'],
  ['hours', 'Horario de atención'],
  ['whatsapp', 'WhatsApp en formato internacional'],
  ['instagram', 'Usuario de Instagram'],
  ['email', 'Correo de contacto'],
];

const LEGAL_FIELDS: [string, string][] = [
  ['terms', 'Términos y condiciones'],
  ['privacy', 'Privacidad y tratamiento de datos'],
  ['cookies', 'Política de cookies'],
];

export function AdminPanel({
  admin,
  currentUserId,
  onReload,
  notify,
}: {
  admin: AdminData;
  currentUserId: number;
  onReload: () => Promise<void>;
  notify: (m: string) => void;
}) {
  const [tab, setTab] = useState<Tab>('rates');
  const [settings, setSettings] = useState(admin.settings);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    setSettings(admin.settings);
  }, [admin.settings]);

  useEffect(() => {
    if (tab !== 'notifications') return;
    void api<Notification[]>('/admin/notifications').then(setNotifications);
  }, [tab]);

  async function toggleUser(id: number, active: boolean) {
    try {
      await api(`/admin/users/${id}`, { method: 'PATCH', json: { active } });
      notify(active ? 'Usuario activado.' : 'Usuario desactivado.');
      await onReload();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'No se pudo actualizar.');
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    try {
      await api('/admin/settings', { method: 'PUT', json: settings });
      notify('Información pública actualizada.');
      await onReload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    }
  }

  return (
    <>
      <PageHeading
        title="Tu estación, tus ajustes."
        subtitle="Administra el equipo y la información que ven los visitantes."
      />
      <div className="admin-tabs">
        {TABS.map(([value, label]) => (
          <button
            key={value}
            className={`button small subtle${tab === value ? ' active' : ''}`}
            onClick={() => {
              setTab(value);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'rates' && <Rates rates={admin.rates} onReload={onReload} notify={notify} />}

      {tab === 'users' && (
        <div className="panel">
          <h2>Personas autorizadas</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Persona</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {admin.users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.name}</strong>
                      <small>{u.email}</small>
                    </td>
                    <td>
                      {
                        {
                          admin: 'Administrador',
                          worker: 'Trabajador',
                          operator: 'Operador turístico',
                        }[u.role]
                      }
                    </td>
                    <td>{u.active ? 'Activo' : 'Inactivo'}</td>
                    <td>
                      {u.id === currentUserId ? (
                        'Tu cuenta'
                      ) : (
                        <button
                          className="button small outline"
                          onClick={() => void toggleUser(u.id, !u.active)}
                        >
                          {u.active ? 'Desactivar' : 'Activar'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'faqs' && (
        <div className="panel">
          <h2>Preguntas públicas</h2>
          {admin.faqs.map((f) => (
            <div className="summary-row" key={f.id}>
              <div>
                <strong>{f.question}</strong>
                <p className="small-copy">
                  Orden {f.position} · {f.active ? 'Publicada' : 'Oculta'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'settings' && (
        <form className="panel" onSubmit={(e) => void saveSettings(e)}>
          <h2>Información pública</h2>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <div className="form-grid">
            {SETTING_FIELDS.map(([key, label]) => (
              <div className="field" key={key}>
                <label htmlFor={`s-${key}`}>{label}</label>
                <input
                  id={`s-${key}`}
                  value={settings[key] ?? ''}
                  onChange={(e) => {
                    setSettings((s) => ({ ...s, [key]: e.target.value }));
                  }}
                />
              </div>
            ))}
          </div>
          <h2>Documentos legales</h2>
          <p className="notice">
            Los textos iniciales indican lo pendiente; reemplázalos por los documentos aprobados
            antes de operar con datos reales.
          </p>
          {LEGAL_FIELDS.map(([key, label]) => (
            <div className="field" key={key}>
              <label htmlFor={`s-${key}`}>{label}</label>
              <textarea
                id={`s-${key}`}
                rows={6}
                maxLength={10000}
                value={settings[key] ?? ''}
                onChange={(e) => {
                  setSettings((s) => ({ ...s, [key]: e.target.value }));
                }}
              />
            </div>
          ))}
          <button type="submit" className="button dark">
            Guardar información <Icon name="check" />
          </button>
        </form>
      )}

      {tab === 'notifications' && (
        <div className="panel">
          <h2>Bandeja de salida</h2>
          <p className="small-copy muted">
            Los mensajes se encolan en la misma transacción del alquiler. Nada falla en silencio.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Plantilla</th>
                  <th>Canal</th>
                  <th>Destinatario</th>
                  <th>Programado</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {notifications.map((n) => (
                  <tr key={n.id}>
                    <td>{n.templateKey}</td>
                    <td>{n.channel}</td>
                    <td>{n.recipient}</td>
                    <td>{datetime(n.scheduledFor)}</td>
                    <td>
                      <span className={`status ${n.status === 'dead' ? 'alert' : 'busy'}`}>
                        {n.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="panel">
          <h2>Trazabilidad · últimas 300 operaciones</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Responsable</th>
                  <th>Acción</th>
                  <th>Entidad</th>
                </tr>
              </thead>
              <tbody>
                {admin.audit.map((a) => (
                  <tr key={a.id}>
                    <td>{datetime(a.createdAt)}</td>
                    <td>{a.name ?? 'Sistema'}</td>
                    <td>{a.action.replaceAll('_', ' ')}</td>
                    <td>
                      {a.entity} {a.entityId}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
