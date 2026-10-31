import { useEffect, useState } from 'react';
import { Footer, PublicHeader } from '../components/Chrome';
import { Icon } from '../components/Icon';
import { money } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import type { PublicData, Rate } from '../lib/types';

const TRUST = [
  ['clock', 'Fácil de alquilar', 'Te acompañamos en el registro'],
  ['helmet', 'Casco incluido', 'Tu seguridad va primero'],
  ['leaf', '100% eléctrico', 'Más brisa, menos ruido'],
  ['waves', 'Espíritu costero', 'Hecho para disfrutar'],
] as const;

const STEPS = [
  ['Elige tu tiempo', 'Un paseo corto o una hora para explorar. Tenemos un plan para ti.'],
  ['Visítanos en la estación', 'Nuestro equipo te recibe y realiza el registro con tu documento.'],
  ['Equípate y aprende', 'Recibe tu patineta, casco y una breve inducción de seguridad.'],
  ['Siente el aire', 'Recorre Arboletes a tu ritmo y devuelve el equipo al terminar.'],
] as const;

function RateSheet({
  rates,
  period,
  title,
}: {
  rates: Rate[];
  period: Rate['period'];
  title: string;
}) {
  const periodRates = rates.filter((rate) => rate.period === period);
  const singles = periodRates
    .filter((rate) => rate.quantity === 1)
    .sort((a, b) => a.minutes - b.minutes);

  return (
    <article className="rate-sheet">
      <header className="rate-sheet-heading">
        <h3>{title}</h3>
        <span>Precios por plan</span>
      </header>
      {singles.length === 0 ? (
        <p className="rate-sheet-empty">No hay tarifas vigentes para este período.</p>
      ) : (
        <table className="rate-table" aria-label={`Tarifas: ${title}`}>
          <thead>
            <tr>
              <th scope="col">Tiempo</th>
              <th scope="col">1 patineta</th>
              <th scope="col">2 patinetas</th>
            </tr>
          </thead>
          <tbody>
            {singles.map((rate) => {
              const pair = periodRates.find(
                (candidate) => candidate.quantity === 2 && candidate.minutes === rate.minutes,
              );
              return (
                <tr key={rate.id}>
                  <th scope="row">{rate.minutes === 60 ? '1 hora' : `${rate.minutes} min`}</th>
                  <td>{money(rate.priceCents)}</td>
                  <td>{pair ? money(pair.priceCents) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <a className="button small outline rate-sheet-action" href="#ubicacion">
        Visita la estación <Icon name="arrow" />
      </a>
    </article>
  );
}

export function PublicPage() {
  const { data, loading, error } = useAsync<PublicData>('/public');
  const [showLogoReveal, setShowLogoReveal] = useState(() => {
    if (
      typeof window === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return false;
    try {
      return window.sessionStorage.getItem('rokai-logo-reveal') !== 'played';
    } catch {
      return false;
    }
  });

  function dismissLogoReveal() {
    setShowLogoReveal(false);
    try {
      window.sessionStorage.setItem('rokai-logo-reveal', 'played');
    } catch {
      // El video solo se reproduce una vez cuando el almacenamiento está disponible.
    }
  }

  useEffect(() => {
    if (!showLogoReveal) return;
    const timeout = window.setTimeout(dismissLogoReveal, 6000);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [showLogoReveal]);

  // La portada es estática salvo tarifas, FAQ y datos de contacto: se pinta ya y
  // esas piezas se rellenan al llegar la respuesta, en vez de bloquear la página.
  const s = data?.settings ?? {};
  const rates = data?.rates ?? [];
  const faqs = data?.faqs ?? [];
  const whatsapp = s['whatsapp']?.replace(/\D/g, '') ?? '';
  // Solo https: evita abrir esquemas arbitrarios si el ajuste se corrompe.
  const mapsUrl = s['mapsUrl']?.startsWith('https://') ? s['mapsUrl'] : '';

  return (
    <>
      <PublicHeader />
      <main id="main" className="public-page">
        <section className="container hero">
          <div>
            <span className="badge">
              <span className="dot" />
              {s['location'] ?? 'Parque principal de Arboletes · Antioquia'}
            </span>
            <h1>
              Siente
              <br />
              el <em>aire.</em>
            </h1>
            <p>
              Menos prisa. Más brisa. Descubre Arboletes en patineta eléctrica y haz del camino tu
              parte favorita.
            </p>
            <div className="hero-actions">
              <a className="button" href="#tarifas">
                Encuentra tu plan
                <Icon name="arrow" />
              </a>
              <a className="button outline" href="#ubicacion">
                Cómo llegar
                <Icon name="pin" />
              </a>
            </div>
            <div className="hero-note">
              <Icon name="shield" />
              Alquiler presencial · Casco incluido · Pura libertad
            </div>
          </div>
          <div className="hero-visual">
            <img
              src="/assets/hero-rokai-atardecer.webp"
              srcSet="/assets/hero-rokai-atardecer-640.webp 640w, /assets/hero-rokai-atardecer.webp 1100w"
              sizes="(max-width: 900px) 100vw, 550px"
              alt="Una pareja con casco se toma una foto junto a sus dos patinetas ROKAI, frente al mar y al atardecer"
              width={1100}
              height={917}
              fetchPriority="high"
              decoding="async"
            />
            <div className="visual-top">
              <span className="dot" />
              Tu próximo plan está aquí
            </div>
            <div className="visual-bottom">
              <div>
                <span className="eyebrow">Dos ruedas. Mil momentos.</span>
                <div className="visual-title">La costa, a tu ritmo.</div>
                <p>ROKAI · Siente el aire</p>
              </div>
              <a href="#experiencia" className="visual-arrow" aria-label="Descubre la experiencia">
                <Icon name="arrow" />
              </a>
            </div>
            {showLogoReveal && (
              <div className="hero-logo-reveal">
                <video
                  autoPlay
                  muted
                  playsInline
                  preload="auto"
                  aria-hidden="true"
                  tabIndex={-1}
                  onEnded={dismissLogoReveal}
                  onError={dismissLogoReveal}
                >
                  <source src="/assets/rokai-logo-reveal.mp4" type="video/mp4" />
                </video>
                <button type="button" className="hero-logo-skip" onClick={dismissLogoReveal}>
                  Saltar intro
                  <Icon name="arrow" />
                </button>
              </div>
            )}
          </div>
        </section>

        <div className="container">
          <div className="trust-strip">
            {TRUST.map(([icon, title, detail]) => (
              <div className="trust-item" key={title}>
                <Icon name={icon} />
                <div>
                  <strong>{title}</strong>
                  <small>{detail}</small>
                </div>
              </div>
            ))}
          </div>
        </div>

        <section className="container section" id="como-funciona">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Así de sencillo</span>
              <h2>Tu paseo empieza aquí.</h2>
            </div>
            <p>
              Sin aplicaciones, sin complicaciones.
              <br />
              Nosotros preparamos todo. Tú disfrutas.
            </p>
          </div>
          <div className="steps">
            {STEPS.map(([title, detail], i) => (
              <article className="step" key={title}>
                <span className="step-number">{String(i + 1).padStart(2, '0')}</span>
                <h3>{title}</h3>
                <p>{detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="container section" id="tarifas">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Tarifas vigentes</span>
              <h2>Elige cuánto quieres volar.</h2>
            </div>
          </div>
          {loading ? (
            <p className="rate-sheet-empty">Cargando tarifas…</p>
          ) : error ? (
            <p className="rate-sheet-empty">
              No pudimos cargar las tarifas. Consúltanos por WhatsApp y te las pasamos.
            </p>
          ) : (
            <div className="prices" id="prices">
              <RateSheet rates={rates} period="special" title="Martes a jueves" />
              <RateSheet rates={rates} period="weekend" title="Viernes a domingo y festivos" />
            </div>
          )}
          <p className="small-copy muted">
            Los valores corresponden al total del plan contratado. Confirma el período aplicable con
            nuestro equipo en la estación.
          </p>
        </section>

        <section className="container section" id="experiencia">
          <div className="section-heading">
            <div>
              <span className="eyebrow">La experiencia</span>
              <h2>Más que un alquiler.</h2>
            </div>
          </div>
          <div className="trust-strip">
            <div className="trust-item">
              <Icon name="waves" />
              <div>
                <strong>El pueblo es tuyo</strong>
                <small>Brisa, mar y el mejor atardecer de Arboletes</small>
              </div>
            </div>
            <div className="trust-item">
              <Icon name="users" />
              <div>
                <strong>Planes para dos</strong>
                <small>Rueden juntos con tarifa de pareja</small>
              </div>
            </div>
            <div className="trust-item">
              <Icon name="shield" />
              <div>
                <strong>Siempre acompañado</strong>
                <small>Nuestro equipo te explica todo antes de salir</small>
              </div>
            </div>
          </div>
        </section>

        <section className="container section" id="preguntas">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Preguntas frecuentes</span>
              <h2>Resolvemos tus dudas.</h2>
            </div>
          </div>
          <div className="faq" aria-busy={loading}>
            {loading && <p role="status">Cargando preguntas frecuentes…</p>}
            {error && (
              <p>
                No pudimos cargar las preguntas. Puedes consultar a nuestro equipo en la estación.
              </p>
            )}
            {!loading && !error && faqs.length === 0 && (
              <p>¿Tienes alguna duda? Escríbenos y te ayudamos a preparar tu paseo.</p>
            )}
            {faqs.map((f) => (
              <details key={f.id}>
                <summary>{f.question}</summary>
                <p>{f.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="container section" id="ubicacion">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Dónde estamos</span>
              <h2>Te esperamos en el parque principal.</h2>
            </div>
          </div>
          <div className="contact-card">
            <div className="contact-place">
              <img
                src="/assets/contact-rokai-pro.webp"
                alt="Logo ROKAI y patineta eléctrica sobre la carretera costera al atardecer"
                width={1000}
                height={833}
                loading="lazy"
                decoding="async"
              />
            </div>
            <div className="contact-details">
              <header className="station-heading">
                <span className="station-kicker">ARBOLETES · ANTIOQUIA</span>
                <h3>
                  Nos vemos
                  <br />
                  en la estación.
                </h3>
                <p>Acércate, elige tu patineta y sal a sentir el aire.</p>
              </header>
              <dl className="station-facts">
                <div className="station-fact">
                  <dt>
                    <Icon name="pin" />
                    Punto de encuentro
                  </dt>
                  <dd>{s['location'] || 'Consulta la ubicación con nuestro equipo'}</dd>
                </div>
                <div className="station-fact">
                  <dt>
                    <Icon name="clock" />
                    Horario de atención
                  </dt>
                  <dd>{s['hours'] || 'Consulta el horario con nuestro equipo'}</dd>
                </div>
                {s['instagram'] && (
                  <div className="station-fact">
                    <dt>
                      <Icon name="instagram" />
                      Instagram
                    </dt>
                    <dd>
                      <a
                        href={`https://instagram.com/${s['instagram'].replace(/^@/, '')}`}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        @{s['instagram'].replace(/^@/, '')}
                        <Icon name="arrow" />
                      </a>
                    </dd>
                  </div>
                )}
                {s['email'] && (
                  <div className="station-fact">
                    <dt>
                      <Icon name="mail" />
                      Correo electrónico
                    </dt>
                    <dd>
                      <a href={`mailto:${s['email']}`}>{s['email']}</a>
                    </dd>
                  </div>
                )}
              </dl>
              <div className="contact-actions">
                {whatsapp && (
                  <a
                    className="button dark"
                    href={`https://wa.me/${whatsapp}?text=${encodeURIComponent('Hola ROKAI, quisiera consultar la disponibilidad de patinetas.')}`}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Hablemos por WhatsApp
                    <Icon name="arrow" />
                  </a>
                )}
                {mapsUrl && (
                  <a
                    className="button outline"
                    href={mapsUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Cómo llegar
                    <Icon name="pin" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
