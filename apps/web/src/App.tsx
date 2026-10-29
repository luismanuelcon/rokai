import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { SessionProvider, useSession } from './lib/session';
import { PublicPage } from './pages/PublicPage';
import { LegalPage } from './pages/LegalPage';
import { LoginPage } from './pages/LoginPage';
import { Workspace } from './pages/management/Workspace';

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
        <Routes>
          <Route path="/" element={<PublicPage />} />
          <Route path="/terminos" element={<LegalPage />} />
          <Route path="/privacidad" element={<LegalPage />} />
          <Route path="/cookies" element={<LegalPage />} />
          <Route path="/login" element={<LoginRoute />} />
          <Route path="/gestion" element={<ManagementRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SessionProvider>
    </BrowserRouter>
  );
}
