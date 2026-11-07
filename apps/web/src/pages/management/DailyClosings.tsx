import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { api, ApiError } from '../../lib/api';
import { copCents as cents, formatCopInput, centsToInput } from '../../lib/copInput';
import { money } from '../../lib/format';

type Closing = {
  id: number;
  date: string;
  opensAt: string;
  closesAt: string;
  closesNextDay: boolean;
  cashCents: number;
  transferCents: number;
  expenses: { description: string; amountCents: number; paymentMethod?: 'cash' | 'transfer' }[];
  notes: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};
type ExpenseInput = {
  key: number;
  description: string;
  amount: string;
  paymentMethod: 'cash' | 'transfer';
};
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
export function DailyClosings({ onChanged }: { onChanged?: () => void }) {
  const [rows, setRows] = useState<Closing[]>([]);
  const [history, setHistory] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const invalidRange = Boolean(fromDate && toDate && fromDate > toDate);
  const filtered = rows
    .filter(
      (row) =>
        !invalidRange && (!fromDate || row.date >= fromDate) && (!toDate || row.date <= toDate),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const totalPages = Math.max(1, Math.ceil(filtered.length / 25));
  const currentPage = Math.min(page, totalPages);
  const pageRows = history
    ? filtered.slice((currentPage - 1) * 25, currentPage * 25)
    : filtered.slice(0, 5);
  const totals = filtered.reduce(
    (sum, row) => ({
      cash: sum.cash + row.cashCents,
      transfer: sum.transfer + row.transferCents,
      expenses: sum.expenses + row.expenses.reduce((cost, item) => cost + item.amountCents, 0),
    }),
    { cash: 0, transfer: 0, expenses: 0 },
  );
  const totalIncome = totals.cash + totals.transfer;
  const months = new Map<string, { income: number; expenses: number }>();
  filtered.forEach((row) => {
    const month = row.date.slice(0, 7);
    const entry = months.get(month) ?? { income: 0, expenses: 0 };
    entry.income += row.cashCents + row.transferCents;
    entry.expenses += row.expenses.reduce((cost, item) => cost + item.amountCents, 0);
    months.set(month, entry);
  });
  const monthly = [...months.entries()].sort(([a], [b]) => a.localeCompare(b));
  const chartMax = Math.max(1, ...monthly.flatMap(([, item]) => [item.income, item.expenses]));

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
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewInfo, setPreviewInfo] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [previewRetry, setPreviewRetry] = useState(0);
  useEffect(() => {
    if (!opened || editing || !date) return;
    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError('');
    setPreviewInfo('');
    void api<{ cashCents: number; transferCents: number; count: number; unclassified: number }>(
      `/admin/day-closings/preview/${date}`,
    )
      .then((data) => {
        if (cancelled) return;
        setCash(centsToInput(data.cashCents));
        setTransfer(centsToInput(data.transferCents));
        setPreviewInfo(
          `${data.count} alquileres finalizados en esta fecha (hora de Colombia).${data.unclassified ? ` ${data.unclassified} sin método de pago o valor final: revisa el historial.` : ''} Puedes ajustar los valores antes de guardar.`,
        );
      })
      .catch(() => {
        if (!cancelled)
          setPreviewError(
            'No pudimos consultar el historial. Reintenta para precargar los ingresos.',
          );
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [opened, editing, date, previewRetry]);
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
    setPreviewInfo('');
    setPreviewError('');
    setPreviewLoading(false);
    setEditing(row ?? null);
    setDate(row?.date ?? today());
    setOpensAt(row?.opensAt ?? '');
    setClosesAt(row?.closesAt ?? '');
    setClosesNextDay(row?.closesNextDay ?? false);
    setCash(centsToInput(row?.cashCents ?? 0));
    setTransfer(centsToInput(row?.transferCents ?? 0));
    setExpenses(
      row?.expenses.map((item, key) => ({
        key,
        description: item.description,
        amount: centsToInput(item.amountCents),
        paymentMethod: item.paymentMethod ?? 'cash',
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
    if (busy || (!editing && (previewLoading || previewError))) return;
    setError('');
    const cashCents = cents(cash);
    const transferCents = cents(transfer);
    if (cashCents === null || transferCents === null) {
      setError(
        'Ingresa efectivo y transferencias en pesos, con puntos de miles y coma para máximo dos decimales y hasta 10.000.000 COP por importe.',
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
              paymentMethod: item.paymentMethod,
            })),
            notes: notes.trim(),
            ...(editing ? { version: editing.version } : {}),
          },
        },
      );
      setRows((items) => [saved, ...items.filter((item) => item.date !== saved.date)]);
      setOpened(false);
      setMessage(editing ? 'Cierre actualizado.' : 'Cierre guardado.');
      onChanged?.();
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
          <h2 id="daily-closings-title">{history ? 'Historial de cierres' : 'Cierre de día'}</h2>
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
        </div>
      )}
      {history && (
        <div className="closing-filters">
          <div className="field">
            <label htmlFor="closing-from">Desde</label>
            <input
              id="closing-from"
              type="date"
              value={fromDate}
              onChange={(event) => {
                setFromDate(event.target.value);
                setPage(1);
              }}
              aria-invalid={invalidRange}
              aria-describedby={invalidRange ? 'closing-range-error' : undefined}
            />
          </div>
          <div className="field">
            <label htmlFor="closing-to">Hasta</label>
            <input
              id="closing-to"
              type="date"
              value={toDate}
              onChange={(event) => {
                setToDate(event.target.value);
                setPage(1);
              }}
              aria-invalid={invalidRange}
              aria-describedby={invalidRange ? 'closing-range-error' : undefined}
            />
          </div>
          <button
            className="button outline"
            onClick={() => {
              setFromDate('');
              setToDate('');
              setPage(1);
            }}
            disabled={!fromDate && !toDate}
          >
            Limpiar filtros
          </button>
        </div>
      )}
      {invalidRange && (
        <p className="form-error" role="alert" id="closing-range-error">
          La fecha inicial debe ser anterior o igual a la fecha final.
        </p>
      )}
      <div className="report-history-access">
        <button
          type="button"
          className="button small outline report-history-toggle"
          aria-expanded={history}
          onClick={() => {
            setHistory(!history);
            setFromDate('');
            setToDate('');
            setPage(1);
          }}
        >
          <Icon name={history ? 'arrow' : 'eye'} />
          {history ? 'Volver a los últimos 5 cierres' : 'Ver historial de cierres'}
        </button>
      </div>
      {!loading && !loadError && !invalidRange && (
        <>
          <p className="small-copy muted" role="status">
            {history
              ? `${filtered.length} cierres`
              : `Últimos ${Math.min(5, filtered.length)} de ${filtered.length} cierres`}
          </p>
          {filtered.length > 0 ? (
            <>
              <div
                className="table-wrap closing-report-table"
                role="region"
                aria-label="Histórico de cierres"
                tabIndex={0}
              >
                <table>
                  <caption className="sr-only">
                    Cierres de día, importes en pesos colombianos
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Fecha</th>
                      <th scope="col">Horario</th>
                      <th scope="col">Efectivo</th>
                      <th scope="col">Transferencias</th>
                      <th scope="col">Ingresos</th>
                      <th scope="col">Gastos</th>
                      <th scope="col">Neto</th>
                      <th scope="col">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row) => {
                      const income = row.cashCents + row.transferCents;
                      const costs = row.expenses.reduce((sum, item) => sum + item.amountCents, 0);
                      return (
                        <tr key={row.date}>
                          <th scope="row">{dateLabel(row.date)}</th>
                          <td>
                            {row.opensAt}–{row.closesAt}
                            {row.closesNextDay && (
                              <small className="closing-next-day-label">Día siguiente</small>
                            )}
                          </td>
                          <td>{money(row.cashCents)}</td>
                          <td>{money(row.transferCents)}</td>
                          <td>{money(income)}</td>
                          <td>{money(costs)}</td>
                          <td>
                            <strong>{money(income - costs)}</strong>
                          </td>
                          <td>
                            <button
                              className="button small outline"
                              disabled={busy}
                              aria-label={`Editar cierre del ${dateLabel(row.date)}`}
                              onClick={() => open(row)}
                            >
                              Editar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {history && (
                <nav className="closing-pagination" aria-label="Páginas del histórico">
                  <p role="status">
                    {(currentPage - 1) * 25 + 1}–{Math.min(currentPage * 25, filtered.length)} de{' '}
                    {filtered.length} · Página {currentPage} de {totalPages}
                  </p>
                  <div>
                    <button
                      className="button small outline"
                      disabled={currentPage === 1}
                      onClick={() => setPage(currentPage - 1)}
                    >
                      Anterior
                    </button>
                    <button
                      className="button small outline"
                      disabled={currentPage === totalPages}
                      onClick={() => setPage(currentPage + 1)}
                    >
                      Siguiente
                    </button>
                  </div>
                </nav>
              )}
              <dl className="closing-report-totals">
                <div>
                  <dt>Efectivo</dt>
                  <dd>{money(totals.cash)}</dd>
                </div>
                <div>
                  <dt>Transferencias</dt>
                  <dd>{money(totals.transfer)}</dd>
                </div>
                <div>
                  <dt>Ingresos totales</dt>
                  <dd>{money(totalIncome)}</dd>
                </div>
                <div>
                  <dt>Gastos</dt>
                  <dd>{money(totals.expenses)}</dd>
                </div>
                <div>
                  <dt>Neto</dt>
                  <dd>{money(totalIncome - totals.expenses)}</dd>
                </div>
              </dl>
              {history && (
                <div className="closing-charts">
                  <figure className="closing-chart">
                    <figcaption>
                      <h3>Ingresos y gastos por mes</h3>
                    </figcaption>
                    <div
                      className="closing-chart-months"
                      tabIndex={0}
                      aria-label="Comparación mensual de ingresos y gastos"
                    >
                      {monthly.map(([month, values]) => (
                        <div className="closing-chart-month" key={month}>
                          <strong>
                            {new Intl.DateTimeFormat('es-CO', {
                              month: 'short',
                              year: 'numeric',
                              timeZone: 'America/Bogota',
                            }).format(new Date(`${month}-01T12:00:00-05:00`))}
                          </strong>
                          <div className="closing-chart-bar-row">
                            <span>Ingresos</span>
                            <span className="closing-chart-bar" aria-hidden="true">
                              <i style={{ width: `${(values.income / chartMax) * 100}%` }} />
                            </span>
                            <b>{money(values.income)}</b>
                          </div>
                          <div className="closing-chart-bar-row expenses">
                            <span>Gastos</span>
                            <span className="closing-chart-bar" aria-hidden="true">
                              <i style={{ width: `${(values.expenses / chartMax) * 100}%` }} />
                            </span>
                            <b>{money(values.expenses)}</b>
                          </div>
                        </div>
                      ))}
                    </div>
                  </figure>
                  <figure className="closing-chart">
                    <figcaption>
                      <h3>Medios de pago</h3>
                    </figcaption>
                    {totalIncome > 0 ? (
                      <>
                        <div className="closing-payment-bar" aria-hidden="true">
                          <span style={{ width: `${(totals.cash / totalIncome) * 100}%` }} />
                          <span style={{ width: `${(totals.transfer / totalIncome) * 100}%` }} />
                        </div>
                        <dl className="closing-payment-values">
                          <div>
                            <dt>Efectivo · {((totals.cash / totalIncome) * 100).toFixed(1)}%</dt>
                            <dd>{money(totals.cash)}</dd>
                          </div>
                          <div>
                            <dt>
                              Transferencias · {((totals.transfer / totalIncome) * 100).toFixed(1)}%
                            </dt>
                            <dd>{money(totals.transfer)}</dd>
                          </div>
                        </dl>
                      </>
                    ) : (
                      <p className="small-copy muted">
                        No hay ingresos declarados en este período.
                      </p>
                    )}
                  </figure>
                </div>
              )}
            </>
          ) : (
            rows.length > 0 && (
              <div className="empty">
                <h3>No hay cierres en estas fechas</h3>
              </div>
            )
          )}
        </>
      )}
      {opened && (
        <Modal
          title={editing ? 'Editar cierre de día' : 'Registrar cierre de día'}
          onClose={() => {
            setOpened(false);
          }}
        >
          <form className="closing-form" onSubmit={(event) => void submit(event)} aria-busy={busy}>
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
            {!editing && (
              <div aria-live="polite">
                {previewLoading && <p>Cargando ingresos del historial…</p>}
                {previewInfo && <p className="small-copy">{previewInfo}</p>}
                {previewError && (
                  <div className="form-error" role="alert">
                    {previewError}{' '}
                    <button
                      type="button"
                      className="button small outline"
                      onClick={() => setPreviewRetry((v) => v + 1)}
                    >
                      Reintentar
                    </button>
                  </div>
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
                    disabled={previewLoading}
                    onChange={(e) => setCash(formatCopInput(e.target.value))}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="closing-transfer">Transferencias recibidas (COP)</label>
                  <input
                    id="closing-transfer"
                    inputMode="decimal"
                    value={transfer}
                    disabled={previewLoading}
                    onChange={(e) => setTransfer(formatCopInput(e.target.value))}
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
                        paymentMethod: 'cash',
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
                      onChange={(e) =>
                        updateExpense(item.key, { amount: formatCopInput(e.target.value) })
                      }
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`expense-payment-${item.key}`}>Medio de pago</label>
                    <select
                      id={`expense-payment-${item.key}`}
                      value={item.paymentMethod}
                      onChange={(e) =>
                        updateExpense(item.key, {
                          paymentMethod: e.target.value as 'cash' | 'transfer',
                        })
                      }
                    >
                      <option value="cash">Efectivo</option>
                      <option value="transfer">Transferencia</option>
                    </select>
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
              <button
                className="button"
                disabled={busy || conflict || (!editing && (previewLoading || !!previewError))}
              >
                {busy ? 'Guardando…' : 'Guardar cierre'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
