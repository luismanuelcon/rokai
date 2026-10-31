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

function ManagementRoute() {
  const { user, loading } = useSession();
  if (loading) return <main className="loading">Verificando sesión…</main>;
  return user ? <Workspace /> : <Navigate to="/login" replace />;
}

function LoginRoute() {
  const { user, loading } = useSession();
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
