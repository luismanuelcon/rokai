import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { DocumentType } from '@rokai/contracts';
import { CountrySelect } from '../../components/CountrySelect';
import { Icon } from '../../components/Icon';
import { SignaturePad } from '../../components/SignaturePad';
import { api } from '../../lib/api';
import { DEFAULT_DOCUMENT_TYPE, DOCUMENT_TYPES } from '../../lib/documents';
import { money } from '../../lib/format';
import { DEFAULT_DIAL, digitsOnly, phoneHint, splitE164, toE164 } from '../../lib/phone';
import type { Dashboard, Equipment } from '../../lib/types';
import { PageHeading } from './Shared';

interface DraftState {
  requestId: string;
  fullName: string;
  documentType: DocumentType;
  document: string;
  phone: string;
  notes: string;
  rateId: number | null;
  equipmentIds: number[];
}

const EMPTY: DraftState = {
  requestId: crypto.randomUUID(),
  fullName: '',
  documentType: DEFAULT_DOCUMENT_TYPE,
  document: '',
  phone: '',
  notes: '',
  rateId: null,
  equipmentIds: [],
};

export function NewRental({ dash, onDone }: { dash: Dashboard; onDone: () => Promise<void> }) {
  const [draft, setDraft] = useState<DraftState>(EMPTY);
  // La firma y la aceptación se quedan en esta pantalla: son un acto presencial
  // del cliente, no un dato de trabajo que deba sobrevivir en un borrador.
  const [signature, setSignature] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  // El teléfono se edita en dos partes y se guarda siempre como E.164.
  const [dial, setDial] = useState(DEFAULT_DIAL);
  const [iso, setIso] = useState('CO');
  const [national, setNational] = useState('');
  const [status, setStatus] = useState(
    'El borrador se guarda en el servidor, solo para tu usuario.',
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loaded = useRef(false);

  // El borrador vive en el servidor: nunca se guardan datos del cliente en el navegador.
  useEffect(() => {
    void api<Partial<DraftState>>('/draft').then((saved) => {
      setDraft((d) => ({ ...d, ...saved, requestId: saved.requestId ?? d.requestId }));
      if (saved.phone) {
        const parts = splitE164(saved.phone);
        setDial(parts.dial);
        setNational(parts.national);
        // Un borrador antiguo puede traer el número sin indicativo.
        setDraft((d) => ({ ...d, phone: toE164(parts.dial, parts.national) }));
      }
      loaded.current = true;
    });
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    setStatus('Guardando borrador…');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void api('/draft', { method: 'PUT', json: draft })
        .then(() => {
          setStatus('Borrador guardado de forma privada.');
        })
        .catch(() => {
          setStatus('Sin guardar. Conserva esta página abierta y reintenta cuando haya conexión.');
        });
    }, 600);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [draft]);

  const rate = dash.rates.find((r) => r.id === draft.rateId);
  const hint = phoneHint(dial, national);
  const needed = rate ? rate.quantity * 2 : 0;
  const equipmentReady = needed > 0 && draft.equipmentIds.length === needed;
  const identityReady = draft.fullName.trim() !== '' && draft.document.trim() !== '';
  const closingReady = termsAccepted && signature !== '';
  const canSubmit = identityReady && equipmentReady && closingReady;
  // Cuando solo falta el cierre, el paso 04 se resalta: el resto ya está hecho
  // y el operario necesita saber dónde mirar.
  const closingPending = identityReady && equipmentReady && !closingReady;
  const blockingReason = !rate
    ? 'Selecciona una tarifa vigente.'
    : !equipmentReady
      ? `Asigna ${String(rate.quantity)} patineta(s) y ${String(rate.quantity)} casco(s).`
      : !identityReady
        ? 'Completa el nombre y el documento del cliente.'
        : !termsAccepted
          ? 'El cliente debe aceptar los términos y condiciones.'
          : 'Falta la firma del cliente.';
  const available = (kind: Equipment['kind']) =>
    dash.equipment.filter((e) => e.kind === kind && !e.busy && e.status === 'available');

  function setPhone(nextDial: string, nextNational: string) {
    setDial(nextDial);
    setNational(nextNational);
    setDraft((d) => ({ ...d, phone: toE164(nextDial, nextNational) }));
  }

  function toggle(id: number) {
    setDraft((d) => ({
      ...d,
      equipmentIds: d.equipmentIds.includes(id)
        ? d.equipmentIds.filter((x) => x !== id)
        : [...d.equipmentIds, id],
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/rentals', {
        method: 'POST',
        json: {
          requestId: draft.requestId,
          customer: {
            fullName: draft.fullName,
            documentType: draft.documentType,
            document: draft.document,
            // Se deriva de los campos visibles para que no pueda desincronizarse.
            phone: toE164(dial, national) || null,
          },
          rateId: draft.rateId,
          equipmentIds: draft.equipmentIds,
          notes: draft.notes,
          signature,
          termsAccepted,
        },
      });
      setDraft({ ...EMPTY, requestId: crypto.randomUUID() });
      setDial(DEFAULT_DIAL);
      setNational('');
      setSignature('');
      setTermsAccepted(false);
      await onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar el alquiler.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeading
        title="Un nuevo paseo."
        subtitle="Completa el registro y entrega los equipos al cliente."
      />
      <form onSubmit={(e) => void submit(e)}>
        <div className="rental-layout">
          <div>
            <div className="panel step-panel">
              <h2 className="step-title">
                <span className="step-badge">01</span>Datos del cliente
              </h2>
              {error && (
                <div className="form-error" role="alert">
                  {error}
                </div>
              )}
              <div className="client-grid">
                <div className="field field-wide">
                  <label htmlFor="fullName">Nombre completo</label>
                  <input
                    id="fullName"
                    required
                    maxLength={120}
                    autoComplete="off"
                    value={draft.fullName}
                    onChange={(e) => {
                      setDraft((d) => ({ ...d, fullName: e.target.value }));
                    }}
                  />
                </div>

                <div className="field">
                  <label htmlFor="documentType">Tipo de documento</label>
                  <select
                    id="documentType"
                    value={draft.documentType}
                    onChange={(e) => {
                      setDraft((d) => ({ ...d, documentType: e.target.value as DocumentType }));
                    }}
                  >
                    {DOCUMENT_TYPES.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="document">Número de documento</label>
                  <input
                    id="document"
                    required
                    maxLength={40}
                    autoComplete="off"
                    value={draft.document}
                    onChange={(e) => {
                      setDraft((d) => ({ ...d, document: e.target.value }));
                    }}
                  />
                </div>

                <div className="field field-wide">
                  <label htmlFor="phone">Teléfono (opcional)</label>
                  <div className="phone-input">
                    <CountrySelect
                      iso={iso}
                      onChange={(nextDial, nextIso) => {
                        setIso(nextIso);
                        setPhone(nextDial, national);
                      }}
                    />
                    <input
                      id="phone"
                      type="tel"
                      inputMode="numeric"
                      maxLength={15}
                      placeholder="3001112233"
                      autoComplete="off"
                      value={national}
                      onChange={(e) => {
                        setPhone(dial, digitsOnly(e.target.value));
                      }}
                    />
                  </div>
                  <small>
                    {hint ??
                      'Solo el número, sin indicativo. Sin teléfono no se envían notificaciones.'}
                  </small>
                </div>
              </div>
            </div>

            <div className="panel step-panel">
              <h2 className="step-title">
                <span className="step-badge">02</span>Plan y equipos
              </h2>
              <div className="field">
                <label htmlFor="rateId">Tarifa vigente</label>
                <select
                  id="rateId"
                  required
                  value={draft.rateId ?? ''}
                  onChange={(e) => {
                    setDraft((d) => ({
                      ...d,
                      rateId: e.target.value === '' ? null : Number(e.target.value),
                      equipmentIds: [],
                    }));
                  }}
                >
                  <option value="">Selecciona un plan</option>
                  {dash.rates.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.period === 'special' ? 'Mar–Jue' : 'Vie–Dom / festivos'} · {r.minutes} min
                      · {r.quantity} patineta{r.quantity > 1 ? 's' : ''} · {money(r.priceCents)}
                    </option>
                  ))}
                </select>
                <small>
                  Confirma en la estación el período aplicable. Las tarifas no se pueden modificar
                  en el registro.
                </small>
              </div>

              <span className="field-label">Patinetas disponibles</span>
              <div className="equipment-grid">
                {available('scooter').map((e) => (
                  <label className="equipment-check" key={e.id}>
                    <input
                      type="checkbox"
                      checked={draft.equipmentIds.includes(e.id)}
                      onChange={() => {
                        toggle(e.id);
                      }}
                    />
                    <Icon name="scooter" />
                    {e.code}
                  </label>
                ))}
              </div>

              <span className="field-label">Cascos disponibles</span>
              <div className="equipment-grid">
                {available('helmet').map((e) => (
                  <label className="equipment-check" key={e.id}>
                    <input
                      type="checkbox"
                      checked={draft.equipmentIds.includes(e.id)}
                      onChange={() => {
                        toggle(e.id);
                      }}
                    />
                    <Icon name="helmet" />
                    {e.code}
                  </label>
                ))}
              </div>
            </div>

            <div className="panel step-panel">
              <h2 className="step-title">
                <span className="step-badge">03</span>Antes de salir
              </h2>
              <div className="field">
                <label htmlFor="notes">Novedades del servicio o equipo (opcional)</label>
                <textarea
                  id="notes"
                  maxLength={2000}
                  placeholder="Deja una observación para el equipo…"
                  value={draft.notes}
                  onChange={(e) => {
                    setDraft((d) => ({ ...d, notes: e.target.value }));
                  }}
                />
              </div>
              <div className="draft-status" role="status">
                {status}
              </div>
            </div>

            <div
              className={`panel step-panel closing-panel${closingPending ? ' needs-attention' : ''}${
                closingReady ? ' is-complete' : ''
              }`}
            >
              <h2 className="step-title">
                <span className="step-badge">04</span>Aceptación y firma
              </h2>
              <p className="closing-intro">
                Lee las condiciones con el cliente y pide que firme en pantalla. Sin estos dos pasos
                no se puede entregar el equipo.
              </p>

              <label className="consent-check">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => {
                    setTermsAccepted(e.target.checked);
                  }}
                />
                <span className="consent-box" aria-hidden="true">
                  <Icon name="check" />
                </span>
                <span className="consent-copy">
                  El cliente declara haber leído y aceptado los{' '}
                  <a href="/terminos" target="_blank" rel="noreferrer">
                    términos y condiciones
                  </a>{' '}
                  y la{' '}
                  <a href="/privacidad" target="_blank" rel="noreferrer">
                    política de tratamiento de datos
                  </a>
                  , y asume la responsabilidad del equipo durante el alquiler.
                </span>
              </label>

              <span className="field-label">Firma del cliente</span>
              <SignaturePad value={signature} onChange={setSignature} />
            </div>
          </div>

          <aside className="panel summary">
            <h2>Resumen</h2>
            <div className="summary-row">
              <span>Duración</span>
              <strong>{rate ? `${rate.minutes} minutos` : 'Por seleccionar'}</strong>
            </div>
            <div className="summary-row">
              <span>Patinetas + cascos</span>
              <strong>{rate ? `${rate.quantity} de cada uno` : '—'}</strong>
            </div>
            <div className="summary-row">
              <span>Equipos</span>
              <strong className={equipmentReady ? 'is-ready' : undefined}>
                {draft.equipmentIds.length}
                {needed > 0 && ` / ${String(needed)}`}
              </strong>
            </div>
            <div className="summary-row">
              <span>Aceptación y firma</span>
              <strong className={closingReady ? 'is-ready' : undefined}>
                {closingReady ? 'Completo' : termsAccepted ? 'Falta firmar' : 'Pendiente'}
              </strong>
            </div>

            {needed > 0 && (
              <div
                className={`summary-progress${equipmentReady ? ' is-ready' : ''}`}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={needed}
                aria-valuenow={Math.min(draft.equipmentIds.length, needed)}
                aria-label="Equipos asignados"
              >
                <span
                  style={{
                    width: `${String(Math.min(draft.equipmentIds.length / needed, 1) * 100)}%`,
                  }}
                />
              </div>
            )}

            <div className={`summary-price${rate ? ' has-value' : ''}`} key={rate?.id ?? 'empty'}>
              {rate ? money(rate.priceCents) : '—'}
            </div>
            <p>Total contratado · COP</p>
            <button className="button dark" type="submit" disabled={busy || !canSubmit}>
              {busy ? 'Registrando…' : 'Confirmar alquiler'} <Icon name="check" />
            </button>
            {!canSubmit && !busy && <p className="summary-hint">{blockingReason}</p>}
          </aside>
        </div>
      </form>
    </>
  );
}
