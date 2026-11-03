import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { api, ApiError } from '../lib/api';
import { Brand } from '../components/Chrome';
import { Icon } from '../components/Icon';
import { datetime } from '../lib/format';

type Tracking = {
  status: 'active' | 'expired' | 'closed';
  serverNow: string;
  startedAt: string;
  preparationEndsAt: string;
  dueAt: string;
  minutes: number;
  scooterCount: number;
  whatsapp: string;
};
export function TrackingPage() {
  const { token } = useParams();
  const [data, setData] = useState<Tracking | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [preparationSeconds, setPreparationSeconds] = useState(0);
  const [error, setError] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const anchor = useRef({ remaining: 0, preparation: 0, at: 0 });
  useEffect(() => {
    let alive = true;
    let pending = false;
    let stopped = false;
    const controller = new AbortController();
    setData(null);
    setError('');
    setInvalid(false);
    async function refresh() {
      if (pending || stopped || document.hidden) return;
      pending = true;
      try {
        const result = await api<Tracking>(`/tracking/${encodeURIComponent(token ?? '')}`, {
          signal: controller.signal,
          credentials: 'omit',
          cache: 'no-store',
        });
        if (!alive) return;
        const remaining =
          result.status === 'closed'
            ? 0
            : Math.max(0, Date.parse(result.dueAt) - Date.parse(result.serverNow));
        const preparation =
          result.status === 'closed'
            ? 0
            : Math.max(0, Date.parse(result.preparationEndsAt) - Date.parse(result.serverNow));
        anchor.current = { remaining, preparation, at: performance.now() };
        setPreparationSeconds(Math.ceil(preparation / 1000));
        setSeconds(Math.ceil(remaining / 1000));
        setData(result);
        setError('');
      } catch (e) {
        if (!alive) return;
        if (e instanceof ApiError && [400, 404, 410].includes(e.status)) {
          setInvalid(true);
          setData(null);
          stopped = true;
          setError(
            'Este enlace no está disponible. Puede ser incorrecto o haber sido desactivado.',
          );
        } else
          setError(
            'No pudimos actualizar el seguimiento. Revisa tu conexión; el contador muestra la última información recibida.',
          );
      } finally {
        pending = false;
      }
    }
    void refresh();
    const tick = window.setInterval(() => {
      setPreparationSeconds(
        Math.max(
          0,
          Math.ceil((anchor.current.preparation - (performance.now() - anchor.current.at)) / 1000),
        ),
      );
      setSeconds(
        Math.max(
          0,
          Math.ceil((anchor.current.remaining - (performance.now() - anchor.current.at)) / 1000),
        ),
      );
    }, 1000);
    const poll = window.setInterval(() => void refresh(), 15000);
    const visible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      alive = false;
      controller.abort();
      clearInterval(tick);
      clearInterval(poll);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [token, attempt]);
  const state =
    data?.status === 'closed'
      ? 'closed'
      : seconds === 0
        ? 'expired'
        : seconds < 60
          ? 'urgent'
          : seconds <= 300
            ? 'warning'
            : 'active';
  const labels = {
    closed: 'Alquiler cerrado',
    expired: 'El tiempo de tu alquiler ha finalizado',
    urgent: 'Último minuto · regresa a la estación',
    warning: 'Tu recorrido está por terminar',
    active: 'Disfruta tu recorrido',
  };
  const whatsapp = data?.whatsapp?.replace(/\D/g, '');
  return (
    <main className="tracking-page">
      <Brand />
      <section className={`tracking-public-card is-${state}`}>
        <span className="eyebrow">Tu recorrido ROKAI</span>
        {error && (
          <div role="alert" className="notice">
            {error}
          </div>
        )}
        {!data ? (
          <>
            <h1>
              {invalid
                ? 'Enlace no disponible'
                : error
                  ? 'No pudimos conectar'
                  : 'Preparando tu recorrido…'}
            </h1>
            {!error && <p role="status">Consultando el tiempo de tu alquiler.</p>}
            {error && !invalid && (
              <button className="button" onClick={() => setAttempt((n) => n + 1)}>
                Reintentar
              </button>
            )}
          </>
        ) : (
          <>
            <h1 aria-live="polite">
              {preparationSeconds > 0 ? 'Alístate para tu recorrido' : labels[state]}
            </h1>
            {preparationSeconds > 0 && (
              <p role="status">
                Tienes {preparationSeconds} segundos de preparación. El tiempo mostrado incluye esta
                cortesía.
              </p>
            )}
            <div className="tracking-clock" aria-label="Tiempo restante">
              <strong>
                {String(Math.floor(seconds / 60)).padStart(2, '0')}:
                {String(seconds % 60).padStart(2, '0')}
              </strong>
              <span>minutos : segundos</span>
            </div>
            <p>
              {state === 'closed'
                ? 'Gracias por rodar con ROKAI. ¡Te esperamos de nuevo!'
                : seconds === 0
                  ? 'Acércate a la estación para devolver el equipo.'
                  : 'Regresa antes de que finalice el tiempo de tu alquiler.'}
            </p>
            <dl className="tracking-facts">
              <div>
                <dt>Inicio</dt>
                <dd>{datetime(data.startedAt)}</dd>
              </div>
              <div>
                <dt>Regreso previsto</dt>
                <dd>{datetime(data.dueAt)}</dd>
              </div>
              <div>
                <dt>Duración contratada</dt>
                <dd>{data.minutes} minutos</dd>
              </div>
              <div>
                <dt>Patinetas</dt>
                <dd>{data.scooterCount}</dd>
              </div>
            </dl>
            <p className="small-copy muted">Horas de Colombia.</p>
            {whatsapp && (
              <a
                className="button"
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon name="whatsapp" />
                Contactar a ROKAI
              </a>
            )}
          </>
        )}
      </section>
    </main>
  );
}
