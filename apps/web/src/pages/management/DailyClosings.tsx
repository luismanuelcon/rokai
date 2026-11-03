import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Modal } from '../../components/Modal';
import { api, ApiError } from '../../lib/api';
import { money } from '../../lib/format';

type Closing = {
  id: number;
  date: string;
  opensAt: string;
  closesAt: string;
  closesNextDay: boolean;
  cashCents: number;
  transferCents: number;
  expenses: { description: string; amountCents: number }[];
  notes: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};
type ExpenseInput = { key: number; description: string; amount: string };
const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
const dateLabel = (date: string) =>
  new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeZone: 'America/Bogota' }).format(
    new Date(`${date}T12:00:00-05:00`),
  );
// Conversión decimal exacta: nunca redondea silenciosamente un importe ingresado.
function cents(value: string) {
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value.trim())) return null;
  const [whole = '0', fraction = ''] = value.trim().replace(',', '.').split('.');
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(result) && result <= 1_000_000_000 ? result : null;
}

export function DailyClosings() {
  const [rows, setRows] = useState<Closing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState('');
  const [opened, setOpened] = useState(false);
  const [editing, setEditing] = useState<Closing | null>(null);
  const [date, setDate] = useState(today);
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [closesNextDay, setClosesNextDay] = useState(false);
  const [cash, setCash] = useState('0');
  const [transfer, setTransfer] = useState('0');
  const [expenses, setExpenses] = useState<ExpenseInput[]>([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  const income = (cents(cash) ?? 0) + (cents(transfer) ?? 0);
  const expenseTotal = expenses.reduce((sum, item) => sum + (cents(item.amount) ?? 0), 0);

  async function load() {
    setLoading(true);
    setLoadError('');
    try {
      setRows(await api<Closing[]>('/admin/day-closings'));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'No pudimos cargar los cierres.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  function open(row?: Closing) {
    setEditing(row ?? null);
    setDate(row?.date ?? today());
    setOpensAt(row?.opensAt ?? '');
    setClosesAt(row?.closesAt ?? '');
    setClosesNextDay(row?.closesNextDay ?? false);
    setCash(String((row?.cashCents ?? 0) / 100));
    setTransfer(String((row?.transferCents ?? 0) / 100));
    setExpenses(
      row?.expenses.map((item, key) => ({
        key,
        description: item.description,
        amount: String(item.amountCents / 100),
      })) ?? [],
    );
    setNotes(row?.notes ?? '');
    setError('');
    setConflict(false);
    setOpened(true);
  }
  function updateExpense(key: number, patch: Partial<ExpenseInput>) {
    setExpenses((items) => items.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError('');
    const cashCents = cents(cash);
    const transferCents = cents(transfer);
    if (cashCents === null || transferCents === null) {
      setError(
        'Ingresa efectivo y transferencias en pesos, sin separadores de miles y con máximo dos decimales y hasta 10.000.000 COP por importe.',
      );
      return;
    }
    if ((!closesNextDay && closesAt <= opensAt) || (closesNextDay && closesAt > opensAt)) {
      setError(
        'La jornada debe durar entre un minuto y 24 horas. Revisa las horas y marca si cierra al día siguiente.',
      );
      return;
    }
    if (expenses.some((item) => !item.description.trim() || (cents(item.amount) ?? 0) <= 0)) {
      setError('Cada gasto necesita una descripción y un valor mayor que cero.');
      return;
    }
    setBusy(true);
    try {
      const saved = await api<Closing>(
        editing ? `/admin/day-closings/${editing.date}` : '/admin/day-closings',
        {
          method: editing ? 'PUT' : 'POST',
          json: {
            date,
            opensAt,
            closesAt,
            closesNextDay,
            cashCents,
            transferCents,
            expenses: expenses.map((item) => ({
              description: item.description.trim(),
              amountCents: cents(item.amount),
            })),
            notes: notes.trim(),
            ...(editing ? { version: editing.version } : {}),
          },
        },
      );
      setRows((items) => [saved, ...items.filter((item) => item.date !== saved.date)]);
      setOpened(false);
      setMessage(editing ? 'Cierre actualizado.' : 'Cierre guardado.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el cierre.');
      if (e instanceof ApiError && e.status === 409) {
        setConflict(true);
        void load();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel daily-closings" aria-labelledby="daily-closings-title">
      <div className="toolbar">
        <div>
          <h2 id="daily-closings-title">Cierre de día</h2>
          <p className="small-copy muted">
            Registra lo recibido y los gastos del día. Estos valores son declarados manualmente.
          </p>
        </div>
        <button className="button" disabled={busy} onClick={() => open()}>
          Registrar cierre
        </button>
      </div>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {loading && <p role="status">Cargando cierres…</p>}
      {loadError && (
        <div role="alert" className="form-error">
          {loadError}{' '}
          <button className="button small outline" onClick={() => void load()}>
            Reintentar
          </button>
        </div>
      )}
      {!loading && !loadError && rows.length === 0 && (
        <div className="empty">
          <h3>Aún no hay cierres registrados</h3>
          <p>Puedes registrar cualquier fecha y editarla cuando sea necesario.</p>
        </div>
      )}
      <div className="closing-history">
        {[...rows]
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((row) => {
            const total = row.cashCents + row.transferCents;
            const costs = row.expenses.reduce((sum, item) => sum + item.amountCents, 0);
            return (
              <article className="closing-record" key={row.date}>
                <header>
                  <div>
                    <h3>{dateLabel(row.date)}</h3>
                    <p>
                      {row.opensAt}–{row.closesAt}
                      {row.closesNextDay ? ' · cierre al día siguiente' : ''}
                    </p>
                  </div>
                  <button
                    className="button small outline"
                    disabled={busy}
                    aria-label={`Editar cierre del ${dateLabel(row.date)}`}
                    onClick={() => open(row)}
                  >
                    Editar
                  </button>
                </header>
                <dl className="closing-totals">
                  <div>
                    <dt>Ingresos</dt>
                    <dd>{money(total)}</dd>
                  </div>
                  <div>
                    <dt>Gastos</dt>
                    <dd>{money(costs)}</dd>
                  </div>
                  <div>
                    <dt>Neto</dt>
                    <dd>{money(total - costs)}</dd>
                  </div>
                </dl>
              </article>
            );
          })}
      </div>
      {opened && (
        <Modal
          title={editing ? 'Editar cierre de día' : 'Registrar cierre de día'}
          onClose={() => {
            setOpened(false);
          }}
        >
          <form className="closing-form" onSubmit={(event) => void submit(event)} aria-busy={busy}>
            <p className="small-copy muted">
              Valores en pesos colombianos (COP), sin separadores de miles. El neto es ingresos
              menos gastos; no representa saldo de caja.
            </p>
            {error && (
              <div className="form-error" role="alert" ref={errorRef} tabIndex={-1}>
                {error}
                {conflict && (
                  <p>
                    Los cierres se actualizaron en la lista. Cierra este formulario y abre el
                    registro vigente antes de volver a editar; tus cambios no se han sobrescrito.
                  </p>
                )}
              </div>
            )}
            <fieldset disabled={busy}>
              <legend className="sr-only">Datos del cierre</legend>
              <div className="field">
                <label htmlFor="closing-date">Fecha del día</label>
                <input
                  id="closing-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  readOnly={Boolean(editing)}
                />
              </div>
              <div className="closing-fields">
                <div className="field">
                  <label htmlFor="closing-open">Hora de apertura</label>
                  <input
                    id="closing-open"
                    type="time"
                    value={opensAt}
                    onChange={(e) => setOpensAt(e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="closing-close">Hora de cierre</label>
                  <input
                    id="closing-close"
                    type="time"
                    value={closesAt}
                    onChange={(e) => setClosesAt(e.target.value)}
                    required
                  />
                </div>
              </div>
              <label className="closing-next-day">
                <input
                  type="checkbox"
                  checked={closesNextDay}
                  onChange={(e) => setClosesNextDay(e.target.checked)}
                />
                Cierra al día siguiente
              </label>
              <div className="closing-fields">
                <div className="field">
                  <label htmlFor="closing-cash">Efectivo recibido (COP)</label>
                  <input
                    id="closing-cash"
                    inputMode="decimal"
                    value={cash}
                    onChange={(e) => setCash(e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="closing-transfer">Transferencias recibidas (COP)</label>
                  <input
                    id="closing-transfer"
                    inputMode="decimal"
                    value={transfer}
                    onChange={(e) => setTransfer(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="closing-expenses-heading">
                <h3>Gastos</h3>
                <button
                  type="button"
                  className="button small outline"
                  disabled={expenses.length >= 40}
                  onClick={() =>
                    setExpenses((items) => [
                      ...items,
                      {
                        key: Math.max(-1, ...items.map((item) => item.key)) + 1,
                        description: '',
                        amount: '',
                      },
                    ])
                  }
                >
                  Agregar gasto
                </button>
              </div>
              {expenses.length === 0 && (
                <p className="small-copy muted">Sin gastos registrados para este día.</p>
              )}
              {expenses.map((item, index) => (
                <div className="closing-expense" key={item.key}>
                  <div className="field">
                    <label htmlFor={`expense-description-${item.key}`}>Gasto {index + 1}</label>
                    <input
                      id={`expense-description-${item.key}`}
                      value={item.description}
                      maxLength={160}
                      onChange={(e) => updateExpense(item.key, { description: e.target.value })}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`expense-amount-${item.key}`}>Valor (COP)</label>
                    <input
                      id={`expense-amount-${item.key}`}
                      inputMode="decimal"
                      value={item.amount}
                      onChange={(e) => updateExpense(item.key, { amount: e.target.value })}
                      required
                    />
                  </div>
                  <button
                    type="button"
                    className="button small outline"
                    aria-label={`Quitar gasto ${index + 1}`}
                    onClick={() =>
                      setExpenses((items) => items.filter((expense) => expense.key !== item.key))
                    }
                  >
                    Quitar
                  </button>
                </div>
              ))}
              <div className="field">
                <label htmlFor="closing-notes">Notas (opcional)</label>
                <textarea
                  id="closing-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={2000}
                  rows={3}
                />
              </div>
            </fieldset>
            <dl className="closing-totals closing-preview" aria-live="polite">
              <div>
                <dt>Ingresos</dt>
                <dd>{money(income)}</dd>
              </div>
              <div>
                <dt>Gastos</dt>
                <dd>{money(expenseTotal)}</dd>
              </div>
              <div>
                <dt>Neto</dt>
                <dd>{money(income - expenseTotal)}</dd>
              </div>
            </dl>
            <div className="modal-actions">
              <button
                type="button"
                className="button outline"
                disabled={busy}
                onClick={() => setOpened(false)}
              >
                Cancelar
              </button>
              <button className="button" disabled={busy || conflict}>
                {busy ? 'Guardando…' : 'Guardar cierre'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
