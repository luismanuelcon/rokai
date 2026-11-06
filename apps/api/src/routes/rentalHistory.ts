import type { FastifyInstance } from 'fastify';
import { eq, sql } from 'drizzle-orm';
import { customers, rentals } from '@rokai/db';
import { RentalHistoryQuery } from '@rokai/contracts';
import ExcelJS from 'exceljs';
import type { Db } from '../db.js';
import { listRentals } from '../repositories/rentals.js';
import { badRequest } from '../lib/http-error.js';

function predicate(q: RentalHistoryQuery) {
  const date = sql`(${rentals.startedAt} at time zone 'America/Bogota')::date`;
  return sql`${rentals.endedAt} is not null
    and (${q.from ?? null}::date is null or ${date} >= ${q.from ?? null}::date)
    and (${q.to ?? null}::date is null or ${date} <= ${q.to ?? null}::date)
    and (${q.year ?? null}::integer is null or extract(year from ${date}) = ${q.year ?? null})
    and (${q.month ?? null}::integer is null or extract(month from ${date}) = ${q.month ?? null})
    and (${q.day ?? null}::integer is null or extract(day from ${date}) = ${q.day ?? null})
    and (${q.search} = '' or position(lower(${q.search}) in lower(${customers.fullName} || ' ' || ${rentals.id}::text)) > 0
      or exists(select 1 from rental_equipment re join equipment e on e.id=re.equipment_id
        where re.rental_id=${rentals.id} and position(lower(${q.search}) in lower(e.code)) > 0))`;
}
const localTime = (value: Date | null) =>
  value
    ? new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      }).format(value)
    : '';

export function registerRentalHistoryRoutes(app: FastifyInstance, db: Db) {
  const guarded = { onRequest: [app.requireAuth] };
  app.get('/api/v1/rental-history', guarded, async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const q = RentalHistoryQuery.parse(req.query),
      where = predicate(q);
    return db.transaction(
      async (tx) => {
        const [counts] = await tx
          .select({ total: sql<number>`count(*)`.mapWith(Number) })
          .from(rentals)
          .innerJoin(customers, eq(customers.id, rentals.customerId))
          .where(where);
        const total = counts?.total ?? 0;
        const page = Math.min(q.page, Math.max(1, Math.ceil(total / 25)));
        return {
          items: await listRentals(tx, { where, limit: 25, offset: (page - 1) * 25 }),
          total,
          page,
          pageSize: 25,
        };
      },
      { isolationLevel: 'repeatable read', accessMode: 'read only' },
    );
  });
  app.get(
    '/api/v1/rental-history/export',
    { ...guarded, config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const q = RentalHistoryQuery.parse(req.query);
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Historial', { views: [{ state: 'frozen', ySplit: 1 }] });
      sheet.columns = [
        ['Código', 12],
        ['Cliente', 30],
        ['Tipo documento', 16],
        ['Documento', 22],
        ['Teléfono', 22],
        ['Patinetas', 30],
        ['Cascos', 30],
        ['Inicio (Colombia)', 23],
        ['Vencimiento (Colombia)', 25],
        ['Devolución (Colombia)', 25],
        ['Minutos contratados', 20],
        ['Valor contratado COP', 22],
        ['Recargo COP', 18],
        ['Total COP', 20],
        ['Medio de pago', 18],
        ['Registró', 25],
        ['Recibió', 25],
        ['Notas', 45],
      ].map(([header, width]) => ({ header: String(header), width: Number(width) }));
      await db.transaction(
        async (tx) => {
          let offset = 0;
          while (true) {
            const rows = await listRentals(tx, { where: predicate(q), limit: 1000, offset });
            if (!rows.length) break;
            if (offset + rows.length > 1048575)
              throw badRequest(
                'El historial supera el límite de Excel. Exporta un rango de fechas menor.',
              );
            for (const r of rows) {
              // Strings are literal cell values; user text is never interpreted as a formula.
              sheet.addRow([
                String(r.id),
                r.customerName,
                r.customerDocumentType,
                r.customerDocument,
                r.customerPhone ?? '',
                r.equipment
                  .filter((e) => e.kind === 'scooter')
                  .map((e) => e.code)
                  .join(', '),
                r.equipment
                  .filter((e) => e.kind === 'helmet')
                  .map((e) => e.code)
                  .join(', '),
                localTime(r.startedAt),
                localTime(r.dueAt),
                localTime(r.endedAt),
                r.minutes,
                r.priceCents / 100,
                (r.lateFeeCents ?? 0) / 100,
                r.finalPriceCents === null ? null : r.finalPriceCents / 100,
                r.paymentMethod === 'cash'
                  ? 'Efectivo'
                  : r.paymentMethod === 'transfer'
                    ? 'Transferencia'
                    : 'Sin registrar',
                r.createdByName,
                r.endedByName ?? '',
                r.notes,
              ]);
            }
            offset += rows.length;
          }
        },
        { isolationLevel: 'repeatable read', accessMode: 'read only' },
      );
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF252825' } };
      sheet.getRow(1).height = 28;
      for (const n of [12, 13, 14]) sheet.getColumn(n).numFmt = '"$" #,##0.00';
      sheet.autoFilter = { from: 'A1', to: 'R1' };
      const bytes = await workbook.xlsx.writeBuffer();
      return reply
        .header('Cache-Control', 'no-store')
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', 'attachment; filename="rokai-historial.xlsx"')
        .send(Buffer.from(bytes));
    },
  );
}
