import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import {
  formatReservationDate,
  formatReservationTime,
  fromMinutes,
  reservationWhatsappMessage,
  toMinutes,
  type PublicReservation,
  type ReservationAvailability,
  type ReservationOptions,
} from '@rokai/contracts';
import { Footer, PublicHeader } from '../components/Chrome';
import { CountrySelect } from '../components/CountrySelect';
import { Icon } from '../components/Icon';
import { ApiError, api } from '../lib/api';
import { money } from '../lib/format';
import { DEFAULT_DIAL, digitsOnly, phoneHint, toE164 } from '../lib/phone';
import { useAsync } from '../lib/useAsync';

function durationLabel(minutes: number) {
  return minutes === 60 ? '1 hora' : `${String(minutes)} min`;
}

function Confirmation({
  reservation,
  onAnother,
}: {
  reservation: PublicReservation;
  onAnother: () => void;
}) {
  const [copied, setCopied] = useState('');
  const [stage, setStage] = useState<'send' | 'check' | 'sent'>('send');
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [stage]);

  // Sin abrir WhatsApp la reserva no llega a ROKAI: se advierte antes de salir.
  useEffect(() => {
    if (stage !== 'send') return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
    };
  }, [stage]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(reservationWhatsappMessage(reservation));
      setCopied('Resumen copiado. Pégalo en el chat con ROKAI si WhatsApp no se abre.');
    } catch {
      setCopied('No pudimos copiar. Escribe a ROKAI con tu código de reserva.');
    }
  }

  const whatsappButton = (label: string, outline = false) => (
    <a
      className={`button${outline ? ' outline' : ''} reserve-whatsapp`}
      href={reservation.whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        setStage('check');
      }}
    >
      <Icon name="whatsapp" />
      {label}
    </a>
  );

  if (stage === 'sent') {
    return (
      <section className="reserve-done" aria-labelledby="reserve-done-title">
        <span className="reserve-done-icon" aria-hidden="true">
          <Icon name="check" />
        </span>
        <h1 id="reserve-done-title" ref={heading} tabIndex={-1}>
          ¡Listo! Ya tenemos tu solicitud.
        </h1>
        <p className="reserve-done-lead">
          Nuestro equipo revisa tu mensaje y te confirma por WhatsApp. Tu código es{' '}
          <strong>{reservation.code}</strong>.
        </p>
        <p className="reserve-note">
          <Icon name="clock" />
          <span>
            ¿No te respondemos pronto? Abre WhatsApp de nuevo y verifica que el mensaje se haya
            enviado. El pago se hace en la estación.
          </span>
        </p>
        <div className="reserve-done-actions">
          {whatsappButton('Abrir WhatsApp de nuevo', true)}
        </div>
        <div className="reserve-done-links">
          <button type="button" className="button small subtle" onClick={onAnother}>
            Hacer otra reserva
          </button>
          <Link className="button small subtle" to="/">
            Volver al inicio
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="reserve-done" aria-labelledby="reserve-done-title">
      <ol className="reserve-progress" aria-label="Pasos de la reserva">
        <li className="is-done">
          <Icon name="check" />
          Horario apartado
        </li>
        <li className="is-current" aria-current="step">
          <Icon name="whatsapp" />
          Enviar por WhatsApp
        </li>
      </ol>
      <h1 id="reserve-done-title" ref={heading} tabIndex={-1}>
        {stage === 'send' ? 'Último paso: envía tu reserva.' : '¿Pulsaste Enviar en WhatsApp?'}
      </h1>
      <p className="reserve-done-lead">
        {stage === 'send'
          ? 'Apartamos tu horario, pero la reserva solo se confirma cuando nuestro equipo recibe tu mensaje de WhatsApp.'
          : 'Si el mensaje quedó escrito sin enviar, ROKAI no recibe tu reserva. Vuelve a WhatsApp y pulsa Enviar.'}
      </p>

      {stage === 'send' ? (
        <div className="reserve-done-actions">
          {whatsappButton('Enviar por WhatsApp para confirmar')}
        </div>
      ) : (
        <div className="reserve-done-actions">
          <button
            type="button"
            className="button"
            onClick={() => {
              setStage('sent');
            }}
          >
            <Icon name="check" />
            Sí, ya lo envié
          </button>
          {whatsappButton('Abrir WhatsApp de nuevo', true)}
        </div>
      )}

      <div className="reserve-code">
        <span>Código de reserva · pendiente de WhatsApp</span>
        <strong>{reservation.code}</strong>
      </div>

      <dl className="reserve-summary-list">
        <div>
          <dt>Fecha</dt>
          <dd>{formatReservationDate(reservation.date)}</dd>
        </div>
        <div>
          <dt>Horario</dt>
          <dd>
            {formatReservationTime(reservation.date, reservation.startTime)} –{' '}
            {formatReservationTime(reservation.date, reservation.endTime)}
          </dd>
        </div>
        <div>
          <dt>Plan</dt>
          <dd>{reservation.planLabel}</dd>
        </div>
        <div>
          <dt>Tarifa</dt>
          <dd>{reservation.periodLabel}</dd>
        </div>
        <div className="is-total">
          <dt>Valor total</dt>
          <dd>{money(reservation.priceCents)}</dd>
        </div>
      </dl>

      <button type="button" className="button small subtle" onClick={() => void copy()}>
        <Icon name="copy" />
        ¿No se abre WhatsApp? Copiar resumen
      </button>
      <p className="reserve-copied" role="status">
        {copied}
      </p>
      <p className="reserve-note">
        <Icon name="shield" />
        <span>
          WhatsApp se abre con el mensaje listo para ROKAI: solo pulsa <strong>Enviar</strong>. Si
          no lo envías, el horario apartado puede liberarse. El pago se hace en la estación.
        </span>
      </p>
    </section>
  );
}

export function ReservationPage() {
  const options = useAsync<ReservationOptions>('/public/reservations/options');
  const [date, setDate] = useState('');
  const [quantity, setQuantity] = useState<1 | 2>(1);
  const [rateId, setRateId] = useState<number | null>(null);
  const [startTime, setStartTime] = useState('');
  const [name, setName] = useState('');
  const [iso, setIso] = useState('CO');
  const [dial, setDial] = useState(DEFAULT_DIAL);
  const [national, setNational] = useState('');
  const [availability, setAvailability] = useState<ReservationAvailability | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<PublicReservation | null>(null);
  const requestId = useRef(crypto.randomUUID());
  const errorRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const [summaryVisible, setSummaryVisible] = useState(true);

  // La barra fija solo acompaña mientras el resumen completo no está en pantalla.
  useEffect(() => {
    const target = summaryRef.current;
    if (!target || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      setSummaryVisible(entry?.isIntersecting ?? true);
    });
    observer.observe(target);
    return () => {
      observer.disconnect();
    };
  }, [done, options.error]);

  const today = options.data?.today ?? '';
  const rules = options.data?.rules;
  useEffect(() => {
    if (today && !date) setDate(today);
  }, [today, date]);

  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    setLoadingSlots(true);
    setSlotsError('');
    api<ReservationAvailability>(
      `/public/reservations/availability?date=${date}&quantity=${String(quantity)}`,
    )
      .then((result) => {
        if (!cancelled) setAvailability(result);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setAvailability(null);
        setSlotsError(e instanceof Error ? e.message : 'No pudimos consultar los horarios.');
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date, quantity, refresh]);

  const plans = useMemo(() => availability?.plans ?? [], [availability]);
  const plan = plans.find((p) => p.rateId === rateId) ?? null;

  // Al cambiar fecha o cantidad cambian los planes: conservar la duración elegida si existe.
  useEffect(() => {
    if (plans.length === 0) return;
    if (plans.some((p) => p.rateId === rateId)) return;
    setRateId(plans[0]?.rateId ?? null);
  }, [plans, rateId]);

  useEffect(() => {
    if (!plan) return;
    if (!plan.slots.some((s) => s.start === startTime && s.available)) setStartTime('');
  }, [plan, startTime]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const phone = toE164(dial, national);
  const hint = phoneHint(dial, national);
  const endTime = plan && startTime ? fromMinutes(toMinutes(startTime) + plan.minutes) : '';
  const freeSlots = plan?.slots.filter((s) => s.available).length ?? 0;
  const missing = !plan
    ? 'Elige una fecha con planes disponibles.'
    : !startTime
      ? 'Elige la hora de inicio.'
      : name.trim().length < 2
        ? 'Escribe tu nombre.'
        : !phone
          ? 'Escribe tu número de WhatsApp.'
          : hint;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (missing || !plan) {
      setError(missing ?? 'Revisa los datos de la reserva.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await api<PublicReservation>('/public/reservations', {
        method: 'POST',
        json: {
          requestId: requestId.current,
          customerName: name.trim(),
          phone,
          date,
          startTime,
          quantity,
          rateId: plan.rateId,
        },
      });
      setDone(result);
      window.scrollTo({ top: 0 });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        // El cupo cambió mientras el cliente decidía: nueva solicitud y horarios frescos.
        requestId.current = crypto.randomUUID();
        setStartTime('');
        setRefresh((n) => n + 1);
      }
      setError(
        e instanceof ApiError && e.status === 429
          ? 'Recibimos muchas solicitudes desde tu conexión. Espera unos minutos e inténtalo de nuevo.'
          : e instanceof Error
            ? e.message
            : 'No pudimos registrar la reserva.',
      );
    } finally {
      setBusy(false);
    }
  }

  function another() {
    requestId.current = crypto.randomUUID();
    setDone(null);
    setStartTime('');
    setRefresh((n) => n + 1);
  }

  return (
    <>
      <PublicHeader />
      <main id="main" className="public-page reserve-page">
        <div className="container">
          {done ? (
            <Confirmation reservation={done} onAnother={another} />
          ) : (
            <>
              <header className="reserve-head">
                <span className="eyebrow">Reservas</span>
                <h1>Reserva tu paseo.</h1>
                <p>
                  Elige fecha, hora y plan. Sin crear cuenta ni pagar en línea: pagas en la
                  estación.
                </p>
              </header>

              {options.error ? (
                <div className="form-error" role="alert">
                  No pudimos cargar las reservas. Intenta de nuevo en un momento.
                </div>
              ) : (
                <form className="reserve-layout" onSubmit={(e) => void submit(e)} noValidate>
                  <div className="reserve-steps">
                    <section className="reserve-step" aria-labelledby="step-date">
                      <h2 id="step-date">
                        <span className="step-badge">01</span>¿Qué día?
                      </h2>
                      <div className="field">
                        <label htmlFor="reserve-date">Fecha</label>
                        <input
                          id="reserve-date"
                          type="date"
                          required
                          min={today || undefined}
                          max={options.data?.maxDate}
                          value={date}
                          onChange={(e) => {
                            setDate(e.target.value);
                          }}
                        />
                        <small>
                          {[
                            availability?.periodLabel
                              ? `Tarifa ${availability.periodLabel.toLowerCase()}`
                              : null,
                            rules && today
                              ? `reservas de ${formatReservationTime(today, rules.openTime)} a ${formatReservationTime(today, rules.closeTime)}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </small>
                      </div>
                    </section>

                    <fieldset className="reserve-step">
                      <legend>
                        <span className="step-badge">02</span>¿Cuántas patinetas?
                      </legend>
                      <div className="reserve-plans reserve-quantity">
                        {([1, 2] as const).map((n) => (
                          <label className="reserve-plan" key={n}>
                            <input
                              type="radio"
                              name="quantity"
                              checked={quantity === n}
                              onChange={() => {
                                setQuantity(n);
                              }}
                            />
                            <span>
                              <Icon name={n === 1 ? 'scooter' : 'users'} />
                              <strong>{n === 1 ? '1 patineta' : '2 patinetas'}</strong>
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    <fieldset className="reserve-step" aria-busy={loadingSlots}>
                      <legend>
                        <span className="step-badge">03</span>Plan
                      </legend>
                      {slotsError && (
                        <p className="form-error" role="alert">
                          {slotsError}
                        </p>
                      )}
                      {availability?.closedReason ? (
                        <p className="reserve-empty">{availability.closedReason}</p>
                      ) : plans.length === 0 ? (
                        <p className="reserve-empty" role="status">
                          {loadingSlots
                            ? 'Buscando planes…'
                            : 'Elige una fecha para ver los planes.'}
                        </p>
                      ) : (
                        <div className="reserve-plans">
                          {plans.map((p) => (
                            <label className="reserve-plan" key={p.rateId}>
                              <input
                                type="radio"
                                name="plan"
                                checked={p.rateId === rateId}
                                onChange={() => {
                                  setRateId(p.rateId);
                                }}
                              />
                              <span>
                                <strong>{durationLabel(p.minutes)}</strong>
                                <em>{money(p.priceCents)}</em>
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </fieldset>

                    <fieldset className="reserve-step" aria-busy={loadingSlots}>
                      <legend>
                        <span className="step-badge">04</span>Hora de inicio
                      </legend>
                      {!plan ? (
                        <p className="reserve-empty">Elige primero un plan.</p>
                      ) : plan.slots.length === 0 ? (
                        <p className="reserve-empty">
                          Ya no quedan horarios para este plan en esa fecha. Prueba otro día o un
                          plan más corto.
                        </p>
                      ) : (
                        <>
                          <div className="reserve-slots">
                            {plan.slots.map((s) => (
                              <label
                                className={`reserve-slot${s.available ? '' : ' is-full'}`}
                                key={s.start}
                              >
                                <input
                                  type="radio"
                                  name="start"
                                  disabled={!s.available}
                                  checked={startTime === s.start}
                                  onChange={() => {
                                    setStartTime(s.start);
                                  }}
                                />
                                <span>
                                  <span className="slot-time">
                                    {formatReservationTime(date, s.start)}
                                  </span>
                                  {!s.available && <small>Sin cupo</small>}
                                </span>
                              </label>
                            ))}
                          </div>
                          {freeSlots === 0 && (
                            <p className="reserve-empty" role="status">
                              No quedan patinetas libres para este plan. Prueba otra fecha
                              {quantity === 2 ? ' o reserva una sola' : ''}.
                            </p>
                          )}
                        </>
                      )}
                    </fieldset>

                    <section className="reserve-step" aria-labelledby="step-contact">
                      <h2 id="step-contact">
                        <span className="step-badge">05</span>Tus datos
                      </h2>
                      <div className="field">
                        <label htmlFor="reserve-name">Nombre</label>
                        <input
                          id="reserve-name"
                          required
                          maxLength={120}
                          autoComplete="name"
                          value={name}
                          onChange={(e) => {
                            setName(e.target.value);
                          }}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="reserve-phone">WhatsApp</label>
                        <div className="phone-input">
                          <CountrySelect
                            iso={iso}
                            onChange={(nextDial, nextIso) => {
                              setIso(nextIso);
                              setDial(nextDial);
                            }}
                          />
                          <input
                            id="reserve-phone"
                            type="tel"
                            inputMode="numeric"
                            required
                            maxLength={15}
                            placeholder="3001112233"
                            autoComplete="tel-national"
                            value={national}
                            onChange={(e) => {
                              setNational(digitsOnly(e.target.value));
                            }}
                          />
                        </div>
                        <small>{hint ?? 'Te contactaremos por este número si algo cambia.'}</small>
                      </div>
                    </section>
                  </div>

                  <aside
                    className="reserve-summary"
                    aria-labelledby="reserve-summary-title"
                    ref={summaryRef}
                  >
                    <h2 id="reserve-summary-title">Tu reserva</h2>
                    <dl className="reserve-summary-list">
                      <div>
                        <dt>Fecha</dt>
                        <dd>{date ? formatReservationDate(date) : '—'}</dd>
                      </div>
                      <div>
                        <dt>Inicio</dt>
                        <dd>{startTime ? formatReservationTime(date, startTime) : 'Por elegir'}</dd>
                      </div>
                      <div>
                        <dt>Fin estimado</dt>
                        <dd>{endTime ? formatReservationTime(date, endTime) : '—'}</dd>
                      </div>
                      <div>
                        <dt>Patinetas</dt>
                        <dd>{quantity}</dd>
                      </div>
                      <div>
                        <dt>Duración</dt>
                        <dd>{plan ? `${String(plan.minutes)} minutos` : '—'}</dd>
                      </div>
                      <div>
                        <dt>Tarifa</dt>
                        <dd>{availability?.periodLabel ?? '—'}</dd>
                      </div>
                    </dl>
                    <div className="reserve-total">
                      <span>Valor total</span>
                      <strong>{plan ? money(plan.priceCents) : '—'}</strong>
                    </div>
                    {error && (
                      <div className="form-error" role="alert" tabIndex={-1} ref={errorRef}>
                        {error}
                      </div>
                    )}
                    <button className="button reserve-submit" type="submit" disabled={busy}>
                      {busy ? 'Guardando reserva…' : 'Confirmar reserva'}
                      {!busy && <Icon name="check" />}
                    </button>
                    <p className="reserve-hint">
                      {missing ?? 'Pagas en la estación. Confirmar no realiza ningún cobro.'}
                    </p>
                  </aside>

                  {!summaryVisible && (
                    <div className="reserve-mobilebar">
                      <div>
                        <span>
                          {plan
                            ? `${durationLabel(plan.minutes)} · ${String(quantity)} patineta${quantity > 1 ? 's' : ''}`
                            : 'Valor total'}
                        </span>
                        <strong>{plan ? money(plan.priceCents) : '—'}</strong>
                      </div>
                      {missing ? (
                        <button
                          type="button"
                          className="button"
                          onClick={() => {
                            summaryRef.current?.scrollIntoView({ block: 'start' });
                          }}
                        >
                          Ver resumen
                        </button>
                      ) : (
                        <button className="button" type="submit" disabled={busy}>
                          {busy ? 'Guardando…' : 'Confirmar'}
                        </button>
                      )}
                    </div>
                  )}
                </form>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
