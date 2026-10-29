import { useEffect, useState, type FormEvent } from 'react';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { api } from '../../lib/api';
import { datetime } from '../../lib/format';
import type { AdminData, AdminUser, Notification } from '../../lib/types';
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
  refreshSession,
  onReload,
  notify,
}: {
  admin: AdminData;
  currentUserId: number;
  refreshSession: () => Promise<void>;
  onReload: () => Promise<void>;
  notify: (m: string) => void;
}) {
  const [tab, setTab] = useState<Tab>('rates');
  const [settings, setSettings] = useState(admin.settings);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [error, setError] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRole, setUserRole] = useState<'admin' | 'collaborator'>('collaborator');
  const [userError, setUserError] = useState('');
  const [userBusy, setUserBusy] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

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

  function openUserForm(user?: AdminUser) {
    setUserError('');
    setEditingUser(user ?? null);
    setUserName(user?.name ?? '');
    setUserEmail(user?.email ?? '');
    setUserPassword('');
    setUserRole(user?.role ?? 'collaborator');
    setCreatingUser(true);
  }

  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (userBusy) return;
    setUserBusy(true);
    setUserError('');
    try {
      if (editingUser) {
        await api(`/admin/users/${editingUser.id}`, {
          method: 'PATCH',
          json: {
            name: userName,
            email: userEmail,
            role: userRole,
            ...(userPassword ? { password: userPassword } : {}),
          },
        });
      } else {
        await api('/admin/users', {
          method: 'POST',
          json: { name: userName, email: userEmail, password: userPassword, role: userRole },
        });
      }
      setCreatingUser(false);
      setEditingUser(null);
      setUserName('');
      setUserEmail('');
      setUserPassword('');
      setUserRole('collaborator');
      notify(editingUser ? 'Usuario actualizado.' : 'Usuario creado.');
      if (editingUser?.id === currentUserId) await refreshSession();
      await onReload();
    } catch (e) {
      setUserError(e instanceof Error ? e.message : 'No se pudo crear el usuario.');
    } finally {
      setUserBusy(false);
    }
  }

  async function deleteUser() {
    if (!deletingUser || deleteBusy) return;
    setDeleteBusy(true);
    setUserError('');
    try {
      await api(`/admin/users/${deletingUser.id}`, { method: 'DELETE' });
      setDeletingUser(null);
      notify('Usuario eliminado.');
      await onReload();
    } catch (e) {
      setUserError(e instanceof Error ? e.message : 'No se pudo eliminar el usuario.');
    } finally {
      setDeleteBusy(false);
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
          <div className="toolbar">
            <div>
              <h2>Personas autorizadas</h2>
              <p className="small-copy muted">
                Administradores gestionan la estación. Colaboradores registran y atienden
                alquileres.
              </p>
            </div>
            <button
              className="button small"
              onClick={() => {
                openUserForm();
              }}
            >
              Nuevo usuario <Icon name="plus" />
            </button>
          </div>
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
                          collaborator: 'Colaborador',
                        }[u.role]
                      }
                    </td>
                    <td>{u.active ? 'Activo' : 'Inactivo'}</td>
                    <td>
                      <div className="row-actions">
                        <button className="button small outline" onClick={() => openUserForm(u)}>
                          Editar
                        </button>
                        {u.id === currentUserId ? (
                          <span className="small-copy muted">Tu cuenta</span>
                        ) : (
                          <>
                            <button
                              className="button small outline"
                              onClick={() => void toggleUser(u.id, !u.active)}
                            >
                              {u.active ? 'Desactivar' : 'Activar'}
                            </button>
                            <button
                              className="button small subtle"
                              onClick={() => {
                                setUserError('');
                                setDeletingUser(u);
                              }}
                            >
                              Eliminar
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {creatingUser && (
        <Modal
          title={editingUser ? 'Editar usuario' : 'Crear usuario'}
          onClose={() => {
            setCreatingUser(false);
            setEditingUser(null);
          }}
        >
          <form onSubmit={(e) => void saveUser(e)}>
            {userError && (
              <div className="form-error" role="alert">
                {userError}
              </div>
            )}
            <div className="field">
              <label htmlFor="user-name">Nombre</label>
              <input
                id="user-name"
                autoComplete="name"
                required
                maxLength={120}
                value={userName}
                onChange={(e) => {
                  setUserName(e.target.value);
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="user-email">Correo</label>
              <input
                id="user-email"
                type="email"
                autoComplete="email"
                required
                value={userEmail}
                onChange={(e) => {
                  setUserEmail(e.target.value);
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="user-password">Contraseña temporal</label>
              <input
                id="user-password"
                type="password"
                autoComplete="new-password"
                minLength={userPassword ? 12 : undefined}
                maxLength={256}
                required={!editingUser}
                disabled={editingUser?.id === currentUserId}
                value={userPassword}
                onChange={(e) => {
                  setUserPassword(e.target.value);
                }}
              />
              <small>
                {editingUser?.id === currentUserId
                  ? 'La contraseña propia no se cambia desde esta pantalla.'
                  : editingUser
                    ? 'Déjala vacía para conservarla; si la cambias, usa al menos 12 caracteres.'
                    : 'Mínimo 12 caracteres.'}
              </small>
            </div>
            <div className="field">
              <label htmlFor="user-role">Perfil</label>
              <select
                id="user-role"
                value={userRole}
                disabled={editingUser?.id === currentUserId}
                onChange={(e) => {
                  setUserRole(e.target.value as 'admin' | 'collaborator');
                }}
              >
                <option value="collaborator">Colaborador · operación de alquileres</option>
                <option value="admin">Administrador · acceso completo</option>
              </select>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="button outline"
                onClick={() => {
                  setCreatingUser(false);
                }}
              >
                Cancelar
              </button>
              <button type="submit" className="button dark" disabled={userBusy}>
                {userBusy ? 'Guardando…' : editingUser ? 'Guardar cambios' : 'Crear usuario'}{' '}
                <Icon name="check" />
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deletingUser && (
        <Modal
          title="Eliminar usuario"
          onClose={() => {
            setDeletingUser(null);
          }}
        >
          {userError && (
            <div className="form-error" role="alert">
              {userError}
            </div>
          )}
          <p className="small-copy">
            ¿Eliminar a <strong>{deletingUser.name}</strong> ({deletingUser.email})? La auditoría
            existente se conserva. Si tiene alquileres registrados, tendrás que desactivarlo en vez
            de eliminarlo.
          </p>
          <div className="modal-actions">
            <button
              type="button"
              className="button outline"
              onClick={() => {
                setDeletingUser(null);
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="button danger"
              disabled={deleteBusy}
              onClick={() => void deleteUser()}
            >
              {deleteBusy ? 'Eliminando…' : 'Eliminar usuario'}
            </button>
          </div>
        </Modal>
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
