import { useState, type FormEvent } from 'react';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { api } from '../../lib/api';
import type { Faq } from '../../lib/types';

const EMPTY = { question: '', answer: '', position: 0, active: true };

export function FaqManager({
  faqs,
  onReload,
  notify,
}: {
  faqs: Faq[];
  onReload: () => Promise<void>;
  notify: (m: string) => void;
}) {
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<Faq | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function open(faq?: Faq) {
    setError('');
    setEditingId(faq?.id ?? null);
    setForm(
      faq
        ? { question: faq.question, answer: faq.answer, position: faq.position, active: faq.active }
        : { ...EMPTY, position: faqs.length },
    );
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || busy) return;
    setBusy(true);
    setError('');
    try {
      await api(editingId ? `/admin/faqs/${editingId}` : '/admin/faqs', {
        method: editingId ? 'PATCH' : 'POST',
        json: form,
      });
      setForm(null);
      setEditingId(null);
      notify(editingId ? 'Pregunta actualizada.' : 'Pregunta creada.');
      await onReload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la pregunta.');
    } finally {
      setBusy(false);
    }
  }

  async function toggle(faq: Faq) {
    try {
      await api(`/admin/faqs/${faq.id}`, {
        method: 'PATCH',
        json: {
          question: faq.question,
          answer: faq.answer,
          position: faq.position,
          active: !faq.active,
        },
      });
      notify(faq.active ? 'Pregunta oculta.' : 'Pregunta publicada.');
      await onReload();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'No se pudo actualizar.');
    }
  }

  async function remove() {
    if (!deleting || busy) return;
    setBusy(true);
    setError('');
    try {
      await api(`/admin/faqs/${deleting.id}`, { method: 'DELETE' });
      setDeleting(null);
      notify('Pregunta eliminada.');
      await onReload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <div className="toolbar">
        <div>
          <h2>Preguntas públicas</h2>
          <p className="small-copy muted">
            Se muestran en la portada, ordenadas de menor a mayor número de orden.
          </p>
        </div>
        <button
          className="button small"
          onClick={() => {
            open();
          }}
        >
          Nueva pregunta <Icon name="plus" />
        </button>
      </div>

      {faqs.length === 0 ? (
        <div className="empty">
          <Icon name="bell" />
          <h3>Todavía no hay preguntas.</h3>
          <p>Añade las dudas que más repiten los visitantes.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Pregunta</th>
                <th scope="col">Orden</th>
                <th scope="col">Estado</th>
                <th scope="col">Acción</th>
              </tr>
            </thead>
            <tbody>
              {faqs.map((faq) => (
                <tr key={faq.id}>
                  <td>
                    <strong>{faq.question}</strong>
                    <small>{faq.answer}</small>
                  </td>
                  <td>{faq.position}</td>
                  <td>
                    <span className={`status ${faq.active ? 'ok' : ''}`}>
                      {faq.active ? 'Publicada' : 'Oculta'}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="button small outline"
                        onClick={() => {
                          open(faq);
                        }}
                      >
                        Editar
                      </button>
                      <button className="button small outline" onClick={() => void toggle(faq)}>
                        {faq.active ? 'Ocultar' : 'Publicar'}
                      </button>
                      <button
                        className="button small subtle"
                        onClick={() => {
                          setError('');
                          setDeleting(faq);
                        }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <Modal
          title={editingId ? 'Editar pregunta' : 'Nueva pregunta'}
          onClose={() => {
            setForm(null);
            setEditingId(null);
          }}
        >
          <form onSubmit={(e) => void save(e)}>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <div className="field">
              <label htmlFor="faq-question">Pregunta</label>
              <input
                id="faq-question"
                required
                maxLength={200}
                value={form.question}
                onChange={(e) => {
                  setForm({ ...form, question: e.target.value });
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="faq-answer">Respuesta</label>
              <textarea
                id="faq-answer"
                required
                rows={5}
                maxLength={2000}
                value={form.answer}
                onChange={(e) => {
                  setForm({ ...form, answer: e.target.value });
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="faq-position">Orden</label>
              <input
                id="faq-position"
                type="number"
                inputMode="numeric"
                min={0}
                max={999}
                required
                value={form.position}
                onChange={(e) => {
                  setForm({ ...form, position: Number(e.target.value) });
                }}
              />
              <small>Las preguntas se ordenan de menor a mayor.</small>
            </div>
            <label className="consent-check">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => {
                  setForm({ ...form, active: e.target.checked });
                }}
              />
              <span>Publicar en la portada</span>
            </label>
            <div className="modal-actions">
              <button
                type="button"
                className="button outline"
                onClick={() => {
                  setForm(null);
                  setEditingId(null);
                }}
              >
                Cancelar
              </button>
              <button type="submit" className="button dark" disabled={busy}>
                {busy ? 'Guardando…' : 'Guardar'} <Icon name="check" />
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleting && (
        <Modal
          title="Eliminar pregunta"
          onClose={() => {
            setDeleting(null);
          }}
        >
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <p className="small-copy">
            ¿Eliminar <strong>{deleting.question}</strong>? Dejará de verse en la portada de
            inmediato. Si solo quieres retirarla temporalmente, usa «Ocultar».
          </p>
          <div className="modal-actions">
            <button
              type="button"
              className="button outline"
              onClick={() => {
                setDeleting(null);
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="button danger"
              disabled={busy}
              onClick={() => void remove()}
            >
              {busy ? 'Eliminando…' : 'Eliminar pregunta'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
