import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { Rental } from '../../lib/types';
import { datetime, money } from '../../lib/format';
import { Icon } from '../../components/Icon';
import { PageHeading } from './Shared';
import { PAYMENT_LABEL, RentalDialog } from './RentalTable';
import '../../styles/rental-history.css';

type Results = { items: Rental[]; total: number; page: number; pageSize: number };
export function RentalHistory({
  lateFeePerMinuteCents,
  isAdmin,
  onNew,
  onReload,
  notify,
}: {
  lateFeePerMinuteCents: number;
  isAdmin: boolean;
  onNew: () => void;
  onReload: () => Promise<void>;
  notify: (text: string) => void;
}) {
  const [filters, setFilters] = useState({
    from: '',
    to: '',
    year: '',
    month: '',
    day: '',
    search: '',
  });
  const [page, setPage] = useState(1),
    [revision, setRevision] = useState(0);
  const [data, setData] = useState<Results | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const [exporting, setExporting] = useState(false),
    [selected, setSelected] = useState<Rental | null>(null);
  const invalid = Boolean(
    (filters.from && filters.to && filters.from > filters.to) ||
    (filters.year && (!/^\d{4}$/.test(filters.year) || Number(filters.year) < 1900)) ||
    (filters.day && (Number(filters.day) < 1 || Number(filters.day) > 31)),
  );
  const query = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
  query.set('page', String(page));
  const queryString = query.toString();
  useEffect(() => {
    if (invalid) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const timer = setTimeout(() => {
      void api<Results>(`/rental-history?${queryString}`, { signal: controller.signal })
        .then((result) => {
          if (!controller.signal.aborted) setData(result);
        })
        .catch((e: unknown) => {
          if (!controller.signal.aborted)
            setError(e instanceof Error ? e.message : 'No se pudo cargar el historial.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [queryString, revision, invalid]);
  const change = (key: keyof typeof filters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };
  async function download(all: boolean) {
    if (exporting) return;
    setExporting(true);
    setError('');
    try {
      const response = await fetch(`/api/v1/rental-history/export${all ? '' : `?${queryString}`}`, {
        credentials: 'same-origin',
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? 'No se pudo exportar. Intenta de nuevo.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = all ? 'rokai-historial-completo.xlsx' : 'rokai-historial-filtrado.xlsx';
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      notify('Excel descargado.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo exportar.');
    } finally {
      setExporting(false);
    }
  }
  const refresh = () => {
    setSelected(null);
    setRevision((r) => r + 1);
    void onReload();
  };
  return (
    <>
      <PageHeading
        title="Historial de alquileres"
        action={
          <button className="button" onClick={onNew}>
            <Icon name="plus" />
            Nuevo alquiler
          </button>
        }
      />
      <section className="panel rental-history" aria-label="Historial de alquileres">
        <div className="toolbar">
          <h2>Alquileres finalizados</h2>
          <div className="history-export-actions">
            <button
              className="button small outline"
              disabled={exporting}
              onClick={() => void download(true)}
            >
              {exporting ? 'Exportando…' : 'Exportar todo a Excel'}
            </button>
            <button
              className="button small dark"
              disabled={exporting || loading || invalid || !data?.total}
              onClick={() => void download(false)}
            >
              Exportar filtrados
            </button>
          </div>
        </div>
        <div className="history-filters">
          <label>
            Buscar
            <input
              type="search"
              value={filters.search}
              maxLength={160}
              placeholder="Cliente o código"
              onChange={(e) => change('search', e.target.value)}
            />
          </label>
          <label>
            Desde
            <input
              type="date"
              value={filters.from}
              onChange={(e) => change('from', e.target.value)}
            />
          </label>
          <label>
            Hasta
            <input type="date" value={filters.to} onChange={(e) => change('to', e.target.value)} />
          </label>
          <label>
            Año
            <input
              type="number"
              min={1900}
              max={9999}
              placeholder="Todos"
              value={filters.year}
              onChange={(e) => change('year', e.target.value)}
            />
          </label>
          <label>
            Mes
            <select value={filters.month} onChange={(e) => change('month', e.target.value)}>
              <option value="">Todos</option>
              {[
                'Enero',
                'Febrero',
                'Marzo',
                'Abril',
                'Mayo',
                'Junio',
                'Julio',
                'Agosto',
                'Septiembre',
                'Octubre',
                'Noviembre',
                'Diciembre',
              ].map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label>
            Día
            <input
              type="number"
              min={1}
              max={31}
              placeholder="Todos"
              value={filters.day}
              onChange={(e) => change('day', e.target.value)}
            />
          </label>
          <button
            className="button small outline"
            onClick={() => {
              setFilters({ from: '', to: '', year: '', month: '', day: '', search: '' });
              setPage(1);
            }}
          >
            Limpiar
          </button>
        </div>
        <div className="history-caption">
          <span>Fecha de inicio · Colombia</span>
          <span>{!loading && !invalid && data ? `${data.total} registros` : ''}</span>
        </div>
        {invalid && (
          <p className="form-error" role="alert">
            Revisa las fechas, el año y el día.
          </p>
        )}
        {error && (
          <div className="form-error" role="alert">
            {error}{' '}
            <button className="button small outline" onClick={() => setRevision((r) => r + 1)}>
              Reintentar
            </button>
          </div>
        )}
        {loading && !invalid && <p role="status">Cargando historial…</p>}
        {!loading && !invalid && !error && data && (
          <>
            <div
              className="table-wrap history-table"
              tabIndex={0}
              role="region"
              aria-label="Tabla de alquileres"
            >
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Cliente</th>
                    <th>Patinetas</th>
                    <th>Inicio</th>
                    <th>Devolución</th>
                    <th>Minutos</th>
                    <th>Total COP</th>
                    <th>Pago</th>
                    <th>Registró</th>
                    <th>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((r) => (
                    <tr key={r.id}>
                      <td>#{String(r.id).padStart(4, '0')}</td>
                      <td>{r.customerName}</td>
                      <td>
                        {r.equipment
                          .filter((e) => e.kind === 'scooter')
                          .map((e) => e.code)
                          .join(', ')}
                      </td>
                      <td>{datetime(r.startedAt)}</td>
                      <td>{r.endedAt ? datetime(r.endedAt) : '—'}</td>
                      <td>{r.minutes}</td>
                      <td className="history-money">
                        {r.finalPriceCents === null ? '—' : money(r.finalPriceCents)}
                      </td>
                      <td>{r.paymentMethod ? PAYMENT_LABEL[r.paymentMethod] : 'Sin registrar'}</td>
                      <td>{r.createdByName}</td>
                      <td>
                        <button
                          className="iconbutton"
                          aria-label={`Ver detalle del alquiler ${r.id}`}
                          onClick={() => setSelected(r)}
                        >
                          <Icon name="eye" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.items.length && <p className="empty">Sin resultados.</p>}
            <nav className="history-pagination" aria-label="Páginas del historial">
              <span>
                Página {data.page} de {Math.max(1, Math.ceil(data.total / data.pageSize))}
              </span>
              <div>
                <button
                  className="button small outline"
                  disabled={data.page === 1}
                  onClick={() => setPage(data.page - 1)}
                >
                  Anterior
                </button>
                <button
                  className="button small outline"
                  disabled={data.page * data.pageSize >= data.total}
                  onClick={() => setPage(data.page + 1)}
                >
                  Siguiente
                </button>
              </div>
            </nav>
          </>
        )}
      </section>
      {selected && (
        <RentalDialog
          rental={selected}
          lateFeePerMinuteCents={lateFeePerMinuteCents}
          isAdmin={isAdmin}
          onClose={() => setSelected(null)}
          onFinished={refresh}
          onDeleted={() => {
            refresh();
            notify('Registro eliminado.');
          }}
        />
      )}
    </>
  );
}
