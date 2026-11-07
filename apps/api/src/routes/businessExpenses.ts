import type { FastifyInstance } from 'fastify';
import { eq, sql } from 'drizzle-orm';
import { businessExpenses } from '@rokai/db';
import {
  BusinessExpenseQuery,
  CreateBusinessExpense,
  UpdateBusinessExpense,
  VoidBusinessExpense,
} from '@rokai/contracts';
import type { Db } from '../db.js';
import { badRequest, conflict, notFound } from '../lib/http-error.js';
import { recordAudit } from '../lib/audit.js';

export function registerBusinessExpenseRoutes(app: FastifyInstance, db: Db) {
  const admin = { onRequest: [app.requireAdmin] };
  const path = '/api/v1/admin/business-expenses';
  const parseId = (params: unknown) => {
    const id = Number((params as { id: string }).id);
    if (!Number.isSafeInteger(id) || id <= 0) throw badRequest('Gasto no válido.');
    return id;
  };
  app.get(path, admin, async (req) => {
    const q = BusinessExpenseQuery.parse(req.query);
    // One source for legacy closing expenses: never copy them into the additional ledger.
    const ledger = sql`with ledger as (
      select 'additional:' || id as id, id as "expenseId", null::bigint as "closingId", 'additional' as source,
        date::text, category, description, amount_cents as "amountCents", payment_method::text as "paymentMethod",
        beneficiary, receipt_url as "receiptUrl", version,
        case when voided_at is null then 'active' else 'voided' end as status, void_reason as "voidReason"
      from business_expenses
      union all
      select 'closing:' || d.id || ':' || (e.ordinality - 1), null::bigint, d.id, 'closing', d.date::text,
        'closing', e.item->>'description', (e.item->>'amountCents')::integer, coalesce(e.item->>'paymentMethod', 'cash'), '', '', d.version, 'active', null::text
      from day_closings d cross join lateral jsonb_array_elements(d.expenses) with ordinality as e(item, ordinality)
    )`;
    const dates = sql`(${q.from ?? null}::date is null or date::date >= ${q.from ?? null}::date) and (${q.to ?? null}::date is null or date::date <= ${q.to ?? null}::date)`;
    const filters = sql`${dates} and (${q.category ?? null}::text is null or category = ${q.category ?? null}) and (${q.paymentMethod ?? null}::text is null or "paymentMethod" = ${q.paymentMethod ?? null}) and (${q.status} = 'all' or status = ${q.status})`;
    return db.transaction(
      async (tx) => {
        const count = await tx.execute(
          sql`${ledger} select count(*)::integer as total from ledger where ${filters}`,
        );
        const total = Number(count.rows[0]?.total ?? 0);
        const page = Math.min(q.page, Math.max(1, Math.ceil(total / 25)));
        const rows = await tx.execute(
          sql`${ledger} select * from ledger where ${filters} order by date desc, "expenseId" desc nulls last, "closingId" desc nulls last, id desc limit 25 offset ${(page - 1) * 25}`,
        );
        const income = await tx.execute(
          sql`select coalesce(sum(cash_cents),0) as cash, coalesce(sum(transfer_cents),0) as transfer from day_closings where ${dates}`,
        );
        const expenseTotals = await tx.execute(
          sql`${ledger} select source, coalesce(sum("amountCents"),0) as amount from ledger where ${dates} and status = 'active' group by source`,
        );
        const byPayment = await tx.execute(
          sql`${ledger} select "paymentMethod", coalesce(sum("amountCents"),0) as amount from ledger where ${dates} and status = 'active' group by "paymentMethod"`,
        );
        const categories = await tx.execute(
          sql`${ledger} select category, sum("amountCents") as "amountCents" from ledger where ${dates} and status = 'active' group by category order by sum("amountCents") desc`,
        );
        const monthly = await tx.execute(sql`${ledger}, movements as (
        select left(date::text,7) as month, cash_cents::bigint + transfer_cents as income, 0::bigint as expense from day_closings where ${dates}
        union all select left(date,7), 0::bigint, "amountCents"::bigint from ledger where ${dates} and status='active'
      ) select month, sum(income) as "incomeCents", sum(expense) as "expensesCents" from movements group by month order by month`);
        const cashCents = Number(income.rows[0]?.cash ?? 0);
        const transferCents = Number(income.rows[0]?.transfer ?? 0);
        const closingExpensesCents = Number(
          expenseTotals.rows.find((r) => r.source === 'closing')?.amount ?? 0,
        );
        const additionalExpensesCents = Number(
          expenseTotals.rows.find((r) => r.source === 'additional')?.amount ?? 0,
        );
        return {
          items: rows.rows.map((r) => ({
            ...r,
            expenseId: r.expenseId === null ? null : Number(r.expenseId),
            closingId: r.closingId === null ? null : Number(r.closingId),
          })),
          total,
          page,
          pageSize: 25,
          summary: {
            cashCents,
            transferCents,
            closingExpensesCents,
            additionalExpensesCents,
            cashBalanceCents:
              cashCents -
              Number(byPayment.rows.find((r) => r.paymentMethod === 'cash')?.amount ?? 0),
            transferBalanceCents:
              transferCents -
              Number(byPayment.rows.find((r) => r.paymentMethod === 'transfer')?.amount ?? 0),
            netCents: cashCents + transferCents - closingExpensesCents - additionalExpensesCents,
          },
          categories: categories.rows.map((r) => ({ ...r, amountCents: Number(r.amountCents) })),
          monthly: monthly.rows.map((r) => ({
            ...r,
            incomeCents: Number(r.incomeCents),
            expensesCents: Number(r.expensesCents),
          })),
        };
      },
      { isolationLevel: 'repeatable read', accessMode: 'read only' },
    );
  });
  app.post(path, admin, async (req, reply) => {
    const body = CreateBusinessExpense.parse(req.body);
    const userId = req.session!.user.id;
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${body.requestId}, 0))`);
      const [existing] = await tx
        .select()
        .from(businessExpenses)
        .where(eq(businessExpenses.requestId, body.requestId));
      if (existing) {
        if (existing.createdBy !== userId) throw conflict('Identificador ya utilizado.');
        return { row: existing, created: false };
      }
      const [row] = await tx
        .insert(businessExpenses)
        .values({ ...body, createdBy: userId, updatedBy: userId })
        .returning();
      await recordAudit(tx, {
        userId,
        action: 'business_expense.create',
        entity: 'business_expense',
        entityId: row!.id,
        after: row,
      });
      return { row, created: true };
    });
    return reply.code(result.created ? 201 : 200).send(result.row);
  });
  app.put(`${path}/:id`, admin, async (req) => {
    const id = parseId(req.params);
    const { version, ...body } = UpdateBusinessExpense.parse(req.body);
    return db.transaction(async (tx) => {
      const [before] = await tx
        .select()
        .from(businessExpenses)
        .where(eq(businessExpenses.id, id))
        .for('update');
      if (!before) throw notFound('Gasto no encontrado.');
      if (before.voidedAt) throw conflict('Un gasto anulado no se puede editar.');
      if (before.version !== version)
        throw conflict('El gasto cambió. Actualiza el listado y vuelve a abrirlo.');
      const [updated] = await tx
        .update(businessExpenses)
        .set({
          ...body,
          version: version + 1,
          updatedBy: req.session!.user.id,
          updatedAt: new Date(),
        })
        .where(eq(businessExpenses.id, id))
        .returning();
      await recordAudit(tx, {
        userId: req.session!.user.id,
        action: 'business_expense.update',
        entity: 'business_expense',
        entityId: id,
        before,
        after: updated,
      });
      return updated;
    });
  });
  app.post(`${path}/:id/void`, admin, async (req) => {
    const id = parseId(req.params);
    const { version, reason } = VoidBusinessExpense.parse(req.body);
    return db.transaction(async (tx) => {
      const [before] = await tx
        .select()
        .from(businessExpenses)
        .where(eq(businessExpenses.id, id))
        .for('update');
      if (!before) throw notFound('Gasto no encontrado.');
      if (before.voidedAt || before.version !== version)
        throw conflict('El gasto cambió o ya fue anulado. Actualiza el listado.');
      const [updated] = await tx
        .update(businessExpenses)
        .set({
          voidedAt: new Date(),
          voidReason: reason,
          version: version + 1,
          updatedBy: req.session!.user.id,
          updatedAt: new Date(),
        })
        .where(eq(businessExpenses.id, id))
        .returning();
      await recordAudit(tx, {
        userId: req.session!.user.id,
        action: 'business_expense.void',
        entity: 'business_expense',
        entityId: id,
        before,
        after: { ...updated, reason },
      });
      return updated;
    });
  });
}
