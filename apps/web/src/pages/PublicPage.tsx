import { useEffect, useState } from 'react';
import { Footer, PublicHeader } from '../components/Chrome';
import { Icon } from '../components/Icon';
import { money } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import type { PublicData, Rate } from '../lib/types';

const DESCRIPTIONS: Record<number, string> = {
  15: 'Una dosis de brisa',
  30: 'Desconecta y disfruta',
  45: 'Un poco más de libertad',
  60: 'Sin prisa, a tu ritmo',
};

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

function PriceCards({ rates, period }: { rates: Rate[]; period: Rate['period'] }) {
  const singles = rates.filter((r) => r.period === period && r.quantity === 1);
  if (singles.length === 0) return <p>No hay tarifas vigentes para este período.</p>;

  return (
    <>
      {singles.map((rate) => {
        const pair = rates.find(
          (p) => p.period === period && p.quantity === 2 && p.minutes === rate.minutes,
        );
        const featured = rate.minutes === 30;
        return (
          <article key={rate.id} className={`price-card${featured ? ' featured' : ''}`}>
            {featured && <span className="popular">EL PLAN FAVORITO</span>}
            <div className="duration">
              {rate.minutes === 60 ? (
                <>
                  1 <small>hora</small>
                </>
              ) : (
                <>
                  {rate.minutes} <small>minutos</small>
                </>
              )}
            </div>
            <p className="price-description">
              {DESCRIPTIONS[rate.minutes] ?? 'Tiempo para disfrutar'}
            </p>
            <span className="price-label">1 patineta</span>
            <div className="price-value">
              {money(rate.priceCents)} <small>COP</small>
            </div>
            <div className="pair-price">
              <span>
                <Icon name="users" />2 patinetas
              </span>
              <strong>{pair ? money(pair.priceCents) : 'No disponible'}</strong>
            </div>
            <a className={`button${featured ? '' : ' outline'}`} href="#ubicacion">
              Visita la estación
              <Icon name="arrow" />
            </a>
          </article>
        );
      })}
    </>
  );
}

export function PublicPage() {
  const { data, loading, error } = useAsync<PublicData>('/public');
  const [period, setPeriod] = useState<Rate['period']>('special');
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

  if (loading) return <main className="loading">Preparando tu próxima aventura…</main>;
  if (error ?? !data)
    return (
      <main className="container legal">
        <h1>No pudimos cargar la estación.</h1>
        <p>{error}</p>
      </main>
    );

  const s = data.settings;
  const whatsapp = s['whatsapp']?.replace(/\D/g, '') ?? '';
  // Solo https: evita abrir esquemas arbitrarios si el ajuste se corrompe.
  const mapsUrl = s['mapsUrl']?.startsWith('https://') ? s['mapsUrl'] : '';

  return (
    <>
      <PublicHeader />
      <main id="main">
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
              src="/assets/hero-rokai-atardecer.jpg"
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
            <div className="period-toggle" role="group" aria-label="Período de tarifas">
              <button
                data-period="special"
                aria-pressed={period === 'special'}
                onClick={() => {
                  setPeriod('special');
                }}
              >
                Martes a jueves
              </button>
              <button
                data-period="weekend"
                aria-pressed={period === 'weekend'}
                onClick={() => {
                  setPeriod('weekend');
                }}
              >
                Viernes a domingo y festivos
              </button>
            </div>
          </div>
          <div className="prices" id="prices">
            <PriceCards rates={data.rates} period={period} />
          </div>
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
          <div className="faq">
            {data.faqs.map((f) => (
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
                src="/assets/contact-rokai-pro.jpg"
                alt="Logo ROKAI y patineta eléctrica sobre la carretera costera al atardecer"
                width={1200}
                height={1000}
                loading="lazy"
                decoding="async"
              />
              <div className="contact-place-copy">
                <span className="contact-kicker">ARBOLETES · ANTIOQUIA</span>
                <h3>El paseo empieza aquí.</h3>
                <p>{s['location']}</p>
              </div>
            </div>
            <div className="contact-details">
              <div className="summary-row">
                <span>
                  <Icon name="pin" />
                  Ubicación
                </span>
                <strong>{s['location']}</strong>
              </div>
              <div className="summary-row">
                <span>
                  <Icon name="clock" />
                  Horario
                </span>
                <strong>{s['hours']}</strong>
              </div>
              <div className="summary-row">
                <span>
                  <Icon name="instagram" />
                  Instagram
                </span>
                <strong>
                  <a
                    href={`https://instagram.com/${s['instagram'] ?? ''}`}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    @{s['instagram']}
                  </a>
                </strong>
              </div>
              <div className="summary-row">
                <span>
                  <Icon name="mail" />
                  Correo
                </span>
                <strong>
                  <a href={`mailto:${s['email'] ?? ''}`}>{s['email']}</a>
                </strong>
              </div>
              <div className="contact-actions">
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
                {whatsapp && (
                  <a
                    className="button dark"
                    href={`https://wa.me/${whatsapp}?text=${encodeURIComponent('Hola ROKAI, quisiera consultar la disponibilidad de patinetas.')}`}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Escríbenos por WhatsApp
                    <Icon name="arrow" />
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
