import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { SessionProvider, useSession } from './lib/session';
import { PublicPage } from './pages/PublicPage';

// La portada es lo único que necesita el visitante: el resto (panel de gestión,
// banderas, formularios) se descarga solo cuando se entra en esas rutas.
const LegalPage = lazy(() => import('./pages/LegalPage').then((m) => ({ default: m.LegalPage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const Workspace = lazy(() =>
  import('./pages/management/Workspace').then((m) => ({ default: m.Workspace })),
);

const TrackingPage = lazy(() =>
  import('./pages/TrackingPage').then((m) => ({ default: m.TrackingPage })),
);
const ReservationPage = lazy(() =>
  import('./pages/ReservationPage').then((m) => ({ default: m.ReservationPage })),
);

function ManagementRoute() {
  const { user, loading, error, refresh } = useSession();
  if (error && !user)
    return (
      <main className="loading">
        <p role="alert">{error}</p>
        <button className="button primary" onClick={() => void refresh().catch(() => {})}>
          Reintentar
        </button>
      </main>
    );
  if (loading) return <main className="loading">Verificando sesión…</main>;
  return user ? <Workspace /> : <Navigate to="/login" replace />;
}

function LoginRoute() {
  const { user, loading, error, refresh } = useSession();
  if (error && !user)
    return (
      <main className="loading">
        <p role="alert">{error}</p>
        <button className="button primary" onClick={() => void refresh().catch(() => {})}>
          Reintentar
        </button>
      </main>
    );
  if (loading) return <main className="loading">Verificando sesión…</main>;
  return user ? <Navigate to="/gestion" replace /> : <LoginPage />;
}

export function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <Suspense fallback={<main className="loading">Cargando…</main>}>
          <Routes>
            <Route path="/" element={<PublicPage />} />
            <Route path="/reservar" element={<ReservationPage />} />
            <Route path="/alquiler/seguimiento/:token" element={<TrackingPage />} />
            <Route path="/terminos" element={<LegalPage />} />
            <Route path="/privacidad" element={<LegalPage />} />
            <Route path="/cookies" element={<LegalPage />} />
            <Route path="/login" element={<LoginRoute />} />
            <Route path="/gestion" element={<ManagementRoute />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </SessionProvider>
    </BrowserRouter>
  );
}
