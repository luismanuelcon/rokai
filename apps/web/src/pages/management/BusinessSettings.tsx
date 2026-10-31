import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Icon } from '../../components/Icon';
import { api } from '../../lib/api';
import { datetime } from '../../lib/format';
import type { AuditEntry } from '../../lib/types';

/** Campos cortos del negocio. El orden es el del formulario. */
const FIELDS: { key: string; label: string; hint?: string; type?: string }[] = [
  { key: 'location', label: 'Ubicación' },
  {
    key: 'mapsUrl',
    label: 'Enlace del mapa',
    hint: 'Se usa en el botón "Cómo llegar". Debe empezar por https://',
    type: 'url',
  },
  { key: 'hours', label: 'Horario de atención' },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    hint: 'Formato internacional, por ejemplo +573001234567',
    type: 'tel',
  },
  { key: 'instagram', label: 'Usuario de Instagram', hint: 'Sin @ ni enlace' },
  { key: 'email', label: 'Correo de contacto', type: 'email' },
];

const LEGAL_FIELDS: { key: string; label: string }[] = [
  { key: 'terms', label: 'Términos y condiciones' },
  { key: 'privacy', label: 'Privacidad y tratamiento de datos' },
  { key: 'cookies', label: 'Política de cookies' },
];

/** El ajuste viaja en centavos; el formulario trabaja en pesos. */
const toPesos = (cents: string) => String(Math.round((Number(cents) || 0) / 100));
const toCents = (pesos: string) => String(Math.max(0, Math.round(Number(pesos) || 0)) * 100);

export function BusinessSettings({
  settings,
  audit,
  onReload,
  notify,
}: {
  settings: Record<string, string>;
  audit: AuditEntry[];
  onReload: () => Promise<void>;
  notify: (m: string) => void;
}) {
  const [draft, setDraft] = useState(settings);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const dirty = useMemo(
    () =>
      Object.keys({ ...settings, ...draft }).some((k) => (settings[k] ?? '') !== (draft[k] ?? '')),
    [settings, draft],
  );

  const lastChange = audit.find((a) => a.action === 'editar_configuracion');

  // Aviso del navegador al cerrar o recargar con cambios sin guardar.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
    };
  }, [dirty]);

  function set(key: string, value: string) {
    setDraft((s) => ({ ...s, [key]: value }));
  }

  function cancel() {
    if (dirty && !window.confirm('Se perderán los cambios sin guardar. ¿Continuar?')) return;
    setDraft(settings);
    setError('');
    setEditing(false);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !dirty) return;
    setBusy(true);
    setError('');
    try {
      await api('/admin/settings', { method: 'PUT', json: draft });
      await onReload();
      setEditing(false);
      notify('Configuración del negocio actualizada.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel" onSubmit={(e) => void save(e)}>
      <div className="toolbar">
        <div>
          <h2>Configuración del negocio</h2>
          <p className="small-copy muted">
            {lastChange
              ? `Última modificación: ${datetime(lastChange.createdAt)} · ${lastChange.name ?? 'usuario eliminado'}`
              : 'Sin modificaciones registradas.'}
          </p>
        </div>
        {!editing && (
          <button
            type="button"
            className="button small"
            onClick={() => {
              setEditing(true);
            }}
          >
            <Icon name="pen" />
            Editar
          </button>
        )}
      </div>

      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}

      {dirty && editing && <p className="notice">Tienes cambios sin guardar.</p>}

      <div className="form-grid">
        {FIELDS.map(({ key, label, hint, type }) => (
          <div className="field" key={key}>
            <label htmlFor={`s-${key}`}>{label}</label>
            <input
              id={`s-${key}`}
              type={type ?? 'text'}
              readOnly={!editing}
              aria-readonly={!editing}
              value={draft[key] ?? ''}
              onChange={(e) => {
                set(key, e.target.value);
              }}
            />
            {hint && <small>{hint}</small>}
          </div>
        ))}
        <div className="field">
          <label htmlFor="s-lateFee">Recargo por minuto de retraso</label>
          <input
            id="s-lateFee"
            type="number"
            inputMode="numeric"
            min={0}
            step={50}
            readOnly={!editing}
            aria-readonly={!editing}
            aria-describedby="s-lateFee-hint"
            value={toPesos(draft['lateFeePerMinuteCents'] ?? '0')}
            onChange={(e) => {
              set('lateFeePerMinuteCents', toCents(e.target.value));
            }}
          />
          <small id="s-lateFee-hint">
            En pesos, por cada minuto empezado después de la hora de devolución. Escribe 0 para no
            cobrar recargo.
          </small>
        </div>
      </div>

      <h2>Documentos legales</h2>
      {LEGAL_FIELDS.map(({ key, label }) => (
        <div className="field" key={key}>
          <label htmlFor={`s-${key}`}>{label}</label>
          <textarea
            id={`s-${key}`}
            rows={6}
            maxLength={10000}
            readOnly={!editing}
            aria-readonly={!editing}
            value={draft[key] ?? ''}
            onChange={(e) => {
              set(key, e.target.value);
            }}
          />
        </div>
      ))}

      {editing && (
        <div className="modal-actions">
          <button type="button" className="button outline" onClick={cancel}>
            Cancelar
          </button>
          <button type="submit" className="button dark" disabled={busy || !dirty}>
            {busy ? 'Guardando…' : 'Guardar cambios'}
            <Icon name="check" />
          </button>
        </div>
      )}
    </form>
  );
}
