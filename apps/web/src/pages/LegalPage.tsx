import { Link, useLocation } from 'react-router';
import { Footer, PublicHeader } from '../components/Chrome';
import { Icon } from '../components/Icon';
import { useAsync } from '../lib/useAsync';
import type { PublicData } from '../lib/types';

const DOCS: Record<string, { key: string; title: string }> = {
  '/terminos': { key: 'terms', title: 'Términos y condiciones' },
  '/privacidad': { key: 'privacy', title: 'Privacidad y tratamiento de datos' },
  '/cookies': { key: 'cookies', title: 'Política de cookies' },
};

export function LegalPage() {
  const { pathname } = useLocation();
  const doc = DOCS[pathname];
  const { data, loading } = useAsync<PublicData>('/public');

  if (loading) return <main className="loading">Cargando…</main>;

  return (
    <>
      <PublicHeader />
      <main className="container legal" id="main">
        <span className="eyebrow">Información ROKAI</span>
        <h1>{doc?.title ?? 'Documento'}</h1>
        {/* El texto se renderiza como párrafos: nunca se interpreta HTML. */}
        <div className="legal-copy">
          {(data?.settings[doc?.key ?? ''] ?? '').split('\n').map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <Link className="button outline" to="/">
          Volver al inicio
          <Icon name="arrow" />
        </Link>
      </main>
      <Footer />
    </>
  );
}
