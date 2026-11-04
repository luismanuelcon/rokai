import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { api, ApiError } from '../../lib/api';
import { centsToInput, copCents, formatCopInput } from '../../lib/copInput';
import { money } from '../../lib/format';
import '../../styles/business-expenses.css';

const CATEGORIES: Record<string, string> = {
  salary: 'Salarios',
  advertising: 'Publicidad',
  parts: 'Repuestos',
  maintenance: 'Mantenimiento',
  transport: 'Transporte',
  services: 'Servicios',
  other: 'Otros',
  closing: 'Gastos del cierre',
};
const PAYMENT: Record<string, string> = { cash: 'Efectivo', transfer: 'Transferencia' };
type ExpenseRow = {
  id: string;
  expenseId: number | null;
  closingId: number | null;
  source: 'additional' | 'closing';
  date: string;
  category: string;
  description: string;
  amountCents: number;
  paymentMethod: 'cash' | 'transfer' | null;
  beneficiary: string;
  receiptUrl: string;
  version: number;
  status: 'active' | 'voided';
  voidReason: string | null;
};
type ExpenseReport = {
  items: ExpenseRow[];
  total: number;
  page: number;
  pageSize: number;
  summary: {
    cashCents: number;
    transferCents: number;
    closingExpensesCents: number;
    additionalExpensesCents: number;
    netCents: number;
  };
  categories: { category: string; amountCents: number }[];
  monthly: { month: string; incomeCents: number; expensesCents: number }[];
};
const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
const dateLabel = (date: string) =>
  new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: 'America/Bogota' }).format(
    new Date(`${date}T12:00:00-05:00`),
  );
const monthLabel = (month: string) =>
  new Intl.DateTimeFormat('es-CO', {
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Bogota',
  }).format(new Date(`${month}-01T12:00:00-05:00`));
const safeReceipt = (url: string) => {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
};

export function BusinessExpenses({ revision = 0 }: { revision?: number }) {
  const [history, setHistory] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [category, setCategory] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [status, setStatus] = useState('active');
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [data, setData] = useState<ExpenseReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState<ExpenseRow | null | undefined>(undefined);
  const [voiding, setVoiding] = useState<ExpenseRow | null>(null);
  const invalidRange = Boolean(from && to && from > to);
  useEffect(() => {
    if (invalidRange) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    const query = new URLSearchParams({ page: String(page), status });
    if (from) query.set('from', from);
    if (to) query.set('to', to);
    if (category) query.set('category', category);
    if (paymentMethod) query.set('paymentMethod', paymentMethod);
    void api<ExpenseReport>(`/admin/business-expenses?${query}`, { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        const lastPage = Math.max(1, Math.ceil(result.total / result.pageSize));
        if (page > lastPage) {
          setPage(lastPage);
          return;
        }
        setData(result);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setLoadError(error instanceof Error ? error.message : 'No pudimos cargar los gastos.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [from, to, category, paymentMethod, status, page, reload, revision, invalidRange]);
  function saved(text: string) {
    setEditing(undefined);
    setVoiding(null);
    setMessage(text);
    setReload((value) => value + 1);
  }
  const ready = data && !loading && !loadError && !invalidRange;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const summary = data?.summary;
  const chartMax = Math.max(
    1,
    ...(data?.monthly.flatMap((row) => [row.incomeCents, row.expensesCents]) ?? []),
  );
  const categoryMax = Math.max(1, ...(data?.categories.map((row) => row.amountCents) ?? []));
  return (
    <section
      className="panel business-expenses"
      aria-labelledby="business-expenses-title"
      aria-busy={loading}
    >
      <div className="toolbar">
        <div>
          <h2 id="business-expenses-title">
            {history ? 'Historial de gastos' : 'Gastos del negocio'}
          </h2>
        </div>
        <button
          type="button"
          className="button"
          onClick={() => {
            setMessage('');
            setEditing(null);
          }}
        >
          <Icon name="plus" />
          Registrar gasto
        </button>
      </div>

      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {history && (
        <div className="expense-period">
          <div className="field">
            <label htmlFor="expense-from">Desde</label>
            <input
              id="expense-from"
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="expense-to">Hasta</label>
            <input
              id="expense-to"
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <button
            type="button"
            className="button small outline"
            disabled={!from && !to && !category && !paymentMethod && status === 'active'}
            onClick={() => {
              setFrom('');
              setTo('');
              setCategory('');
              setPaymentMethod('');
              setStatus('active');
              setPage(1);
            }}
          >
            Limpiar filtros
          </button>
        </div>
      )}
      {invalidRange && (
        <p role="alert" className="form-error">
          La fecha inicial debe ser anterior o igual a la fecha final.
        </p>
      )}
      {loading && (
        <p role="status" className="expense-loading">
          Actualizando gastos y balance…
        </p>
      )}
      {loadError && (
        <div role="alert" className="form-error">
          {loadError}
          <button
            type="button"
            className="button small outline"
            onClick={() => setReload((value) => value + 1)}
          >
            Reintentar
          </button>
        </div>
      )}
      {ready && summary && (
        <>
          <div className="expense-balance" aria-label="Balance del período">
            <div>
              <span>Efectivo de cierres</span>
              <strong>{money(summary.cashCents)}</strong>
            </div>
            <div>
              <span>Transferencias de cierres</span>
              <strong>{money(summary.transferCents)}</strong>
            </div>
            <div>
              <span>Gastos en cierres</span>
              <strong>{money(summary.closingExpensesCents)}</strong>
            </div>
            <div>
              <span>Gastos adicionales</span>
              <strong>{money(summary.additionalExpensesCents)}</strong>
            </div>
            <div className={`expense-net${summary.netCents < 0 ? ' is-negative' : ''}`}>
              <span>{history ? 'Saldo del período' : 'Saldo acumulado'}</span>
              <strong>{money(summary.netCents)}</strong>
            </div>
          </div>
        </>
      )}
      {history && (
        <div className="expense-table-filters">
          <div className="field">
            <label htmlFor="expense-category-filter">Categoría</label>
            <select
              id="expense-category-filter"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todas las categorías</option>
              {Object.entries(CATEGORIES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="expense-payment-filter">Medio de pago</label>
            <select
              id="expense-payment-filter"
              value={paymentMethod}
              onChange={(e) => {
                setPaymentMethod(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos los medios</option>
              <option value="cash">Efectivo</option>
              <option value="transfer">Transferencia</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="expense-status-filter">Estado</label>
            <select
              id="expense-status-filter"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="active">Vigentes</option>
              <option value="voided">Anulados</option>
              <option value="all">Todos</option>
            </select>
          </div>
        </div>
      )}
      <div className="report-history-access">
        <button
          type="button"
          className="button small outline report-history-toggle"
          aria-expanded={history}
          onClick={() => {
            setHistory(!history);
            setFrom('');
            setTo('');
            setCategory('');
            setPaymentMethod('');
            setStatus('active');
            setPage(1);
          }}
        >
          <Icon name={history ? 'arrow' : 'eye'} />
          {history ? 'Volver a los últimos 5 gastos' : 'Ver historial de gastos'}
        </button>
      </div>
      {ready && (
        <>
          <div className="expense-list-heading">
            <h3>{history ? 'Movimientos' : 'Últimos 5 gastos'}</h3>
            <span className="small-copy muted">
              {data.total} {data.total === 1 ? 'registro' : 'registros'}
            </span>
          </div>
          {data.items.length === 0 ? (
            <div className="empty">
              <h3>No hay gastos para estos filtros</h3>
            </div>
          ) : (
            <>
              <div
                className="table-wrap expense-table-wrap"
                tabIndex={0}
                role="region"
                aria-label="Historial de gastos, desplazamiento horizontal"
              >
                <table className="expense-table">
                  <thead>
                    <tr>
                      <th>Fecha / origen</th>
                      <th>Concepto / categoría</th>
                      <th>Valor</th>
                      <th>Medio / beneficiario</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(history ? data.items : data.items.slice(0, 5)).map((row) => (
                      <tr
                        key={row.id}
                        className={row.status === 'voided' ? 'expense-row-voided' : undefined}
                      >
                        <td>
                          <strong>{dateLabel(row.date)}</strong>
                          <small className="expense-source">
                            {row.source === 'closing' ? 'Gasto del cierre' : 'Gasto adicional'}
                          </small>
                        </td>
                        <td className="expense-description">
                          <strong>{row.description}</strong>
                          <small>{CATEGORIES[row.category] ?? row.category}</small>
                          {row.voidReason && (
                            <small className="expense-void-reason">
                              Anulación: {row.voidReason}
                            </small>
                          )}
                        </td>
                        <td className="expense-amount">{money(row.amountCents)}</td>
                        <td>
                          {row.paymentMethod ? PAYMENT[row.paymentMethod] : 'Sin detalle'}
                          <small>{row.beneficiary || '—'}</small>
                        </td>
                        <td>
                          <span
                            className={`expense-status${row.status === 'voided' ? ' is-voided' : ''}`}
                          >
                            {row.status === 'voided' ? 'Anulado' : 'Vigente'}
                          </span>
                        </td>
                        <td>
                          <div className="expense-row-actions">
                            {row.source === 'additional' && row.status === 'active' && (
                              <>
                                <button
                                  type="button"
                                  className="button small outline"
                                  aria-label={`Editar gasto: ${row.description}`}
                                  onClick={() => setEditing(row)}
                                >
                                  <Icon name="pen" />
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  className="button small subtle"
                                  aria-label={`Anular gasto: ${row.description}`}
                                  onClick={() => setVoiding(row)}
                                >
                                  Anular
                                </button>
                              </>
                            )}
                            {row.source === 'closing' && (
                              <a href="#daily-closings-title" className="expense-closing-link">
                                Ver cierres <Icon name="arrow" />
                              </a>
                            )}
                            {row.receiptUrl && safeReceipt(row.receiptUrl) && (
                              <a
                                className="expense-closing-link"
                                href={row.receiptUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Comprobante <Icon name="arrow" />
                              </a>
                            )}
                            {row.source === 'additional' &&
                              row.status === 'voided' &&
                              !row.receiptUrl && (
                                <span className="muted">Conservado en historial</span>
                              )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {history && (
            <>
              <nav className="expense-pagination" aria-label="Páginas de gastos">
                <span className="small-copy">
                  Página {page} de {totalPages}
                </span>
                <div>
                  <button
                    type="button"
                    className="button small outline"
                    disabled={page <= 1}
                    onClick={() => setPage((value) => value - 1)}
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    className="button small outline"
                    disabled={page >= totalPages}
                    onClick={() => setPage((value) => value + 1)}
                  >
                    Siguiente
                  </button>
                </div>
              </nav>
              <div className="expense-charts">
                <section className="expense-chart" aria-labelledby="expense-category-chart">
                  <h3 id="expense-category-chart">Gastos por categoría</h3>

                  {data.categories.length === 0 ? (
                    <p className="muted">Sin gastos para graficar.</p>
                  ) : (
                    <ul className="expense-bars">
                      {data.categories.map((row) => (
                        <li key={row.category}>
                          <div>
                            <span>{CATEGORIES[row.category] ?? row.category}</span>
                            <strong>{money(row.amountCents)}</strong>
                          </div>
                          <span className="expense-bar-track" aria-hidden="true">
                            <span style={{ width: `${(row.amountCents / categoryMax) * 100}%` }} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <section className="expense-chart" aria-labelledby="expense-month-chart">
                  <h3 id="expense-month-chart">Ingresos y gastos por mes</h3>
                  <div className="expense-chart-legend">
                    <span>
                      <i className="is-income" />
                      Ingresos
                    </span>
                    <span>
                      <i className="is-expense" />
                      Gastos
                    </span>
                  </div>
                  {data.monthly.length === 0 ? (
                    <p className="muted">Sin movimientos para graficar.</p>
                  ) : (
                    <ul className="expense-bars expense-month-bars">
                      {data.monthly.map((row) => (
                        <li key={row.month}>
                          <strong>{monthLabel(row.month)}</strong>
                          <div className="expense-month-value">
                            <span>Ingresos</span>
                            <strong>{money(row.incomeCents)}</strong>
                          </div>
                          <span className="expense-bar-track" aria-hidden="true">
                            <span style={{ width: `${(row.incomeCents / chartMax) * 100}%` }} />
                          </span>
                          <div className="expense-month-value">
                            <span>Gastos</span>
                            <strong>{money(row.expensesCents)}</strong>
                          </div>
                          <span className="expense-bar-track is-expense" aria-hidden="true">
                            <span style={{ width: `${(row.expensesCents / chartMax) * 100}%` }} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            </>
          )}
        </>
      )}
      {editing !== undefined && (
        <ExpenseForm
          row={editing}
          onClose={() => setEditing(undefined)}
          onSaved={saved}
          onConflict={() => setReload((value) => value + 1)}
        />
      )}
      {voiding && (
        <VoidExpense
          row={voiding}
          onClose={() => setVoiding(null)}
          onSaved={saved}
          onConflict={() => setReload((value) => value + 1)}
        />
      )}
    </section>
  );
}

function ExpenseForm({
  row,
  onClose,
  onSaved,
  onConflict,
}: {
  row: ExpenseRow | null;
  onClose: () => void;
  onSaved: (message: string) => void;
  onConflict: () => void;
}) {
  const [date, setDate] = useState(row?.date ?? today());
  const [category, setCategory] = useState(row?.category ?? 'other');
  const [description, setDescription] = useState(row?.description ?? '');
  const [amount, setAmount] = useState(row ? centsToInput(row.amountCents) : '');
  const [paymentMethod, setPaymentMethod] = useState(row?.paymentMethod ?? 'cash');
  const [beneficiary, setBeneficiary] = useState(row?.beneficiary ?? '');
  const [receiptUrl, setReceiptUrl] = useState(row?.receiptUrl ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(crypto.randomUUID());
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || conflict) return;
    const amountCents = copCents(amount);
    if (amountCents === null || amountCents <= 0 || amountCents % 100 !== 0) {
      setError('Escribe un valor en pesos enteros, mayor a cero y hasta $10.000.000 COP.');
      return;
    }
    if (receiptUrl.trim() && !safeReceipt(receiptUrl.trim())) {
      setError('El comprobante debe ser un enlace que empiece por https://.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api(row ? `/admin/business-expenses/${row.expenseId}` : '/admin/business-expenses', {
        method: row ? 'PUT' : 'POST',
        json: {
          date,
          category,
          description: description.trim(),
          amountCents,
          paymentMethod,
          beneficiary: beneficiary.trim(),
          receiptUrl: receiptUrl.trim(),
          ...(row ? { version: row.version } : { requestId: requestId.current }),
        },
      });
      onSaved(row ? 'Gasto actualizado.' : 'Gasto registrado.');
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'No se pudo guardar. Tus datos siguen aquí para reintentar.',
      );
      if (e instanceof ApiError && e.status === 409) {
        setConflict(true);
        onConflict();
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={row ? 'Editar gasto' : 'Registrar gasto'}
      dismissible={!busy}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form onSubmit={(event) => void submit(event)}>
        <p className="small-copy muted expense-form-help">
          Registra solo pagos que no estén incluidos en un cierre de día.
        </p>
        {error && (
          <div ref={errorRef} role="alert" tabIndex={-1} className="form-error">
            {error}
            {conflict && (
              <p>
                Cierra este formulario y vuelve a abrir el registro actualizado antes de editar.
              </p>
            )}
          </div>
        )}
        <fieldset disabled={busy || conflict} className="expense-form-fields">
          <div className="form-grid">
            <div className="field">
              <label htmlFor="expense-date">Fecha del pago</label>
              <input
                id="expense-date"
                type="date"
                required
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="expense-category">Categoría</label>
              <select
                id="expense-category"
                required
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {Object.entries(CATEGORIES)
                  .filter(([value]) => value !== 'closing')
                  .map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="expense-description">Concepto</label>
            <input
              id="expense-description"
              required
              minLength={3}
              maxLength={160}
              value={description}
              placeholder="Ej.: publicidad de noviembre"
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="expense-amount">Valor (COP)</label>
              <input
                id="expense-amount"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                required
                value={amount}
                aria-describedby="expense-amount-hint"
                placeholder="234.000"
                onChange={(event) => setAmount(formatCopInput(event.target.value))}
              />
              <small id="expense-amount-hint">Máximo $10.000.000 COP.</small>
            </div>
            <div className="field">
              <label htmlFor="expense-payment">Medio de pago</label>
              <select
                id="expense-payment"
                required
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as 'cash' | 'transfer')}
              >
                <option value="cash">Efectivo</option>
                <option value="transfer">Transferencia</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="expense-beneficiary">
              Beneficiario <span className="muted">(opcional)</span>
            </label>
            <input
              id="expense-beneficiary"
              maxLength={160}
              value={beneficiary}
              onChange={(event) => setBeneficiary(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="expense-receipt">
              Enlace del comprobante <span className="muted">(opcional)</span>
            </label>
            <input
              id="expense-receipt"
              type="url"
              maxLength={1000}
              value={receiptUrl}
              placeholder="https://…"
              aria-describedby="expense-receipt-hint"
              onChange={(event) => setReceiptUrl(event.target.value)}
            />
            <small id="expense-receipt-hint">Enlace HTTPS a la factura o recibo.</small>
          </div>
        </fieldset>
        <div className="modal-actions">
          <button type="button" className="button outline" disabled={busy} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="button dark" disabled={busy || conflict}>
            <Icon name="check" />
            {busy ? 'Guardando…' : row ? 'Guardar cambios' : 'Registrar gasto'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function VoidExpense({
  row,
  onClose,
  onSaved,
  onConflict,
}: {
  row: ExpenseRow;
  onClose: () => void;
  onSaved: (message: string) => void;
  onConflict: () => void;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || conflict) return;
    if (reason.trim().length < 10) {
      setError('Explica el motivo con al menos 10 caracteres.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api(`/admin/business-expenses/${row.expenseId}/void`, {
        method: 'POST',
        json: { version: row.version, reason: reason.trim() },
      });
      onSaved('Gasto anulado.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo anular el gasto.');
      if (e instanceof ApiError && e.status === 409) {
        setConflict(true);
        onConflict();
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Anular gasto"
      dismissible={!busy}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form onSubmit={(event) => void submit(event)}>
        <div className="notice">
          <strong>
            {row.description} · {money(row.amountCents)}
          </strong>
          <p>{dateLabel(row.date)}</p>
        </div>
        <p className="small-copy expense-form-help">
          El gasto dejará de descontarse del balance. Se conservarán el registro, el motivo y el
          responsable de la anulación.
        </p>
        {error && (
          <div role="alert" tabIndex={-1} ref={errorRef} className="form-error">
            {error}
            {conflict && <p>Cierra este formulario y consulta la versión actualizada.</p>}
          </div>
        )}
        <div className="field">
          <label htmlFor="expense-void-reason">Justificación</label>
          <textarea
            id="expense-void-reason"
            required
            minLength={10}
            maxLength={1000}
            rows={4}
            disabled={busy || conflict}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            aria-describedby="expense-void-hint"
          />
          <small id="expense-void-hint">
            Entre 10 y 1000 caracteres. Esta acción no se puede deshacer.
          </small>
        </div>
        <div className="modal-actions">
          <button type="button" className="button outline" disabled={busy} onClick={onClose}>
            Conservar gasto
          </button>
          <button
            type="submit"
            className="button danger"
            disabled={busy || conflict || reason.trim().length < 10}
          >
            {busy ? 'Anulando…' : 'Confirmar anulación'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
