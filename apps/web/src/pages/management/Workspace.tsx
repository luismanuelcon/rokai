import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Icon } from '../../components/Icon';
import { api } from '../../lib/api';
import { useSession } from '../../lib/session';
import type { AdminData, Dashboard } from '../../lib/types';
import { Overview } from './Overview';
import { NewRental } from './NewRental';
import { RentalTable } from './RentalTable';
import { Fleet } from './Fleet';
import { Reports } from './Reports';
import { AdminPanel } from './AdminPanel';

export type View = 'overview' | 'new' | 'active' | 'history' | 'fleet' | 'reports' | 'admin';

const NAV: [View, string, string][] = [
  ['overview', 'grid', 'Resumen'],
  ['new', 'plus', 'Registrar alquiler'],
  ['active', 'clock', 'Alquileres activos'],
  ['history', 'history', 'Historial'],
  ['fleet', 'scooter', 'Flota y cascos'],
  ['reports', 'chart', 'Reportes'],
  ['admin', 'settings', 'Administración'],
];

const ADMIN_ONLY: View[] = ['reports', 'admin'];

export function Workspace() {
  const { user, logout, refresh } = useSession();
  const [view, setView] = useState<View>('overview');
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [admin, setAdmin] = useState<AdminData | null>(null);
  const [toast, setToast] = useState('');
  const [online, setOnline] = useState(navigator.onLine);

  const isAdmin = user?.role === 'admin';

  const reload = useCallback(async () => {
    setDash(await api<Dashboard>('/dashboard'));
    if (isAdmin) setAdmin(await api<AdminData>('/admin/data'));
  }, [isAdmin]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine);
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  const notify = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => {
      setToast('');
    }, 4500);
  }, []);

  if (!dash || !user) return <main className="loading">Cargando la estación…</main>;

  const visible = NAV.filter(([v]) => isAdmin || !ADMIN_ONLY.includes(v));

  return (
    <>
      <header className="topbar">
        <div className="container nav">
          <Link className="brand" to="/" aria-label="ROKAI, inicio">
            <img src="/assets/logo.png" alt="ROKAI" width={151} height={50} />
          </Link>
          <div className="nav-actions">
            <span className="small-copy nav-user">{user.name}</span>
            <button className="iconbutton" aria-label="Cerrar sesión" onClick={() => void logout()}>
              <Icon name="logout" />
            </button>
          </div>
        </div>
      </header>

      <div className="offline" id="offline">
        {online
          ? ''
          : 'Sin conexión. Conserva esta página abierta; reintenta cuando vuelva la conexión.'}
      </div>

      <div className="management">
        <aside className="sidebar" aria-label="Gestión">
          <span className="eyebrow">Estación Arboletes</span>
          {visible.map(([v, icon, label]) => (
            <button
              key={v}
              className={view === v ? 'active' : ''}
              aria-current={view === v ? 'page' : undefined}
              onClick={() => {
                setView(v);
              }}
            >
              <Icon name={icon} />
              {label}
            </button>
          ))}
        </aside>

        <main id="main" className="workspace">
          {view === 'overview' && (
            <Overview
              dash={dash}
              user={user}
              onNew={() => {
                setView('new');
              }}
              onReload={reload}
              notify={notify}
            />
          )}
          {view === 'new' && (
            <NewRental
              dash={dash}
              onDone={async () => {
                await reload();
                setView('active');
                notify('Alquiler iniciado. ¡A rodar!');
              }}
            />
          )}
          {view === 'active' && (
            <RentalTable
              title="Aventuras en curso."
              subtitle="Registra la devolución cuando el cliente regrese."
              rentals={dash.rentals.filter((r) => !r.endedAt)}
              onNew={() => {
                setView('new');
              }}
              onReload={reload}
              notify={notify}
            />
          )}
          {view === 'history' && (
            <RentalTable
              title="Cada paseo cuenta."
              subtitle="Historial conservado de los alquileres finalizados."
              rentals={dash.rentals.filter((r) => r.endedAt)}
              onNew={() => {
                setView('new');
              }}
              onReload={reload}
              notify={notify}
            />
          )}
          {view === 'fleet' && (
            <Fleet dash={dash} isAdmin={isAdmin} onReload={reload} notify={notify} />
          )}
          {view === 'reports' && admin && <Reports dash={dash} admin={admin} />}
          {view === 'admin' && admin && (
            <AdminPanel
              admin={admin}
              currentUserId={user.id}
              refreshSession={refresh}
              onReload={reload}
              notify={notify}
            />
          )}
        </main>
      </div>

      <div id="toast" role="status" aria-live="polite">
        {toast}
      </div>
    </>
  );
}
