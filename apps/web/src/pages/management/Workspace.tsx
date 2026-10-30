import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Icon } from '../../components/Icon';
import { NavRail, type NavRailItem } from '../../components/NavRail';
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

/** Fuera de la pista desplazable: el registro es la acción más frecuente. */
const CTA: NavRailItem<View> = { value: 'new', icon: 'plus', label: 'Registrar alquiler' };

// Orden por frecuencia de uso durante la atención, no por jerarquía de menú.
const NAV: NavRailItem<View>[] = [
  { value: 'active', icon: 'clock', label: 'Alquileres activos' },
  { value: 'overview', icon: 'grid', label: 'Resumen' },
  { value: 'fleet', icon: 'scooter', label: 'Disponibilidad' },
  { value: 'history', icon: 'history', label: 'Historial' },
  { value: 'reports', icon: 'chart', label: 'Reportes' },
  { value: 'admin', icon: 'settings', label: 'Administración' },
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

  const visible = NAV.filter((item) => isAdmin || !ADMIN_ONLY.includes(item.value));

  return (
    <>
      <header className="appbar glass-nav">
        <div className="appbar-inner">
          <Link className="appbar-brand" to="/" aria-label="ROKAI, inicio">
            <img src="/assets/logo-inverse.webp" alt="ROKAI" width={108} height={36} />
          </Link>
          <div className="appbar-user">
            <span className="nav-user">{user.name}</span>
            <button
              className="iconbutton"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              onClick={() => void logout()}
            >
              <Icon name="logout" />
            </button>
          </div>
          <NavRail label="Gestión" items={visible} cta={CTA} active={view} onSelect={setView} />
        </div>
      </header>

      <div className="offline" id="offline">
        {online
          ? ''
          : 'Sin conexión. Conserva esta página abierta; reintenta cuando vuelva la conexión.'}
      </div>

      <div className="management">
        <main id="main" className="workspace">
          {view === 'overview' && (
            <Overview
              dash={dash}
              user={user}
              isAdmin={isAdmin}
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
              lateFeePerMinuteCents={dash.lateFeePerMinuteCents}
              isAdmin={isAdmin}
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
              lateFeePerMinuteCents={dash.lateFeePerMinuteCents}
              isAdmin={isAdmin}
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
