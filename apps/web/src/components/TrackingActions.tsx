import { useState } from 'react';
import { api } from '../lib/api';
import { Icon } from './Icon';

export function TrackingActions({
  rentalId,
  initialPath,
}: {
  rentalId: number;
  initialPath?: string | null;
}) {
  const [path, setPath] = useState(initialPath ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const url = path ? new URL(path, window.location.origin).href : '';
  async function load() {
    setBusy(true);
    setMessage('');
    try {
      const result = await api<{ path: string | null; revoked: boolean }>(
        `/rentals/${rentalId}/tracking`,
      );
      if (result.revoked) setMessage('Este enlace fue desactivado.');
      else setPath(result.path ?? '');
    } catch {
      setMessage('No pudimos obtener el enlace. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage('Enlace copiado');
    } catch {
      setMessage('Selecciona el enlace y cópialo manualmente.');
    }
  }
  return (
    <div className="tracking-actions">
      {!path ? (
        <button
          type="button"
          className="button small outline"
          disabled={busy}
          onClick={() => void load()}
        >
          {busy ? 'Cargando enlace…' : 'Compartir seguimiento'}
        </button>
      ) : (
        <>
          <label className="tracking-url">
            Enlace de seguimiento
            <input readOnly value={url} onFocus={(event) => event.currentTarget.select()} />
          </label>
          <div className="tracking-action-buttons">
            <button type="button" className="button small outline" onClick={() => void copy()}>
              <Icon name="copy" />
              Copiar enlace
            </button>
            <a
              className="button small"
              href={`https://wa.me/?text=${encodeURIComponent(`Tu alquiler ROKAI ya comenzó 🛴⚡ Consulta aquí el tiempo restante de tu recorrido: ${url}`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="whatsapp" />
              Enviar por WhatsApp
            </a>
          </div>
        </>
      )}
      {message && (
        <p role="status" className="small-copy">
          {message}
        </p>
      )}
    </div>
  );
}
