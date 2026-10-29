import { sql } from 'drizzle-orm';
import {
  bigserial,
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/* ------------------------------------------------------------------ enums */

export const userRole = pgEnum('user_role', ['admin', 'worker', 'operator']);
export const equipmentKind = pgEnum('equipment_kind', ['scooter', 'helmet']);
export const equipmentStatus = pgEnum('equipment_status', ['available', 'maintenance', 'inactive']);
export const ratePeriod = pgEnum('rate_period', ['special', 'weekend']);
export const documentType = pgEnum('document_type', ['CC', 'CE', 'TI', 'PA', 'PEP', 'PPT']);
export const consentKind = pgEnum('consent_kind', ['operational', 'marketing']);
export const notifChannel = pgEnum('notif_channel', [
  'whatsapp',
  'telegram',
  'sms',
  'email',
  'console',
]);
export const notifCategory = pgEnum('notif_category', ['utility', 'internal', 'marketing']);
export const notifStatus = pgEnum('notif_status', [
  'pending',
  'sending',
  'sent',
  'delivered',
  'failed',
  'dead',
]);

const now = sql`now()`;

/* ------------------------------------------------------------- identidad */

export const users = pgTable(
  'users',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    name: text().notNull(),
    email: text().notNull(),
    passwordHash: text().notNull(),
    role: userRole().notNull(),
    active: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().default(now),
  },
  (t) => [uniqueIndex('users_email_key').on(sql`lower(${t.email})`)],
);

export const sessions = pgTable(
  'sessions',
  {
    /** SHA-256 del valor enviado en la cookie: el token plano nunca se almacena. */
    tokenHash: text().primaryKey(),
    userId: bigint({ mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    csrfToken: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().default(now),
  },
  (t) => [
    index('sessions_expires_at_idx').on(t.expiresAt),
    index('sessions_user_id_idx').on(t.userId),
  ],
);

export const loginAttempts = pgTable('login_attempts', {
  key: text().primaryKey(),
  count: integer().notNull().default(1),
  resetAt: timestamp({ withTimezone: true }).notNull(),
});

/* -------------------------------------------------------------- clientes */

export const customers = pgTable(
  'customers',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    fullName: text().notNull(),
    documentType: documentType().notNull().default('CC'),
    document: text().notNull(),
    /**
     * E.164. Nulo mientras el negocio no defina el teléfono como obligatorio.
     * Nombre explícito: la conversión automática produciría `phone_e_164`.
     */
    phoneE164: text('phone_e164'),
    createdAt: timestamp({ withTimezone: true }).notNull().default(now),
    updatedAt: timestamp({ withTimezone: true }).notNull().default(now),
  },
  (t) => [
    // Un mismo número puede existir en dos tipos distintos de documento.
    uniqueIndex('customers_document_key').on(t.documentType, t.document),
    index('customers_phone_idx').on(t.phoneE164),
    check(
      'customers_phone_e164_chk',
      sql`${t.phoneE164} IS NULL OR ${t.phoneE164} ~ '^\\+[1-9][0-9]{7,14}$'`,
    ),
  ],
);

export const consents = pgTable(
  'consents',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    customerId: bigint({ mode: 'number' })
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    kind: consentKind().notNull(),
    granted: boolean().notNull(),
    channel: text().notNull().default(''),
    policyVersion: text().notNull().default(''),
    grantedAt: timestamp({ withTimezone: true }).notNull().default(now),
    revokedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index('consents_customer_kind_idx').on(t.customerId, t.kind)],
);

/* -------------------------------------------------------------- catálogo */

export const rates = pgTable(
  'rates',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    period: ratePeriod().notNull(),
    minutes: integer().notNull(),
    quantity: smallint().notNull(),
    priceCents: integer().notNull(),
    active: boolean().notNull().default(true),
    validFrom: date(),
    validUntil: date(),
    createdAt: timestamp({ withTimezone: true }).notNull().default(now),
  },
  (t) => [
    index('rates_lookup_idx').on(t.period, t.minutes, t.quantity),
    check('rates_minutes_chk', sql`${t.minutes} BETWEEN 1 AND 480`),
    check('rates_quantity_chk', sql`${t.quantity} BETWEEN 1 AND 2`),
    check('rates_price_chk', sql`${t.priceCents} >= 0`),
    check(
      'rates_date_range_chk',
      sql`${t.validFrom} IS NULL OR ${t.validUntil} IS NULL OR ${t.validFrom} <= ${t.validUntil}`,
    ),
  ],
);

export const equipment = pgTable(
  'equipment',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    code: text().notNull(),
    kind: equipmentKind().notNull(),
    status: equipmentStatus().notNull().default('available'),
    createdAt: timestamp({ withTimezone: true }).notNull().default(now),
  },
  (t) => [uniqueIndex('equipment_code_key').on(t.code)],
);

/* ------------------------------------------------------------- alquileres */

export const rentals = pgTable(
  'rentals',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    customerId: bigint({ mode: 'number' })
      .notNull()
      .references(() => customers.id),
    rateId: bigint({ mode: 'number' })
      .notNull()
      .references(() => rates.id),
    /** Snapshot: cambiar una tarifa no reescribe la historia. */
    minutes: integer().notNull(),
    priceCents: integer().notNull(),
    finalPriceCents: integer(),
    startedAt: timestamp({ withTimezone: true }).notNull().default(now),
    /** Persistido para que el programador de vencimientos use un índice. */
    dueAt: timestamp({ withTimezone: true }).notNull(),
    endedAt: timestamp({ withTimezone: true }),
    createdBy: bigint({ mode: 'number' })
      .notNull()
      .references(() => users.id),
    endedBy: bigint({ mode: 'number' }).references(() => users.id),
    notes: text().notNull().default(''),
    /** Firma manuscrita del cliente (PNG en data URL): prueba de la entrega. */
    signature: text().notNull().default(''),
    /** Versión del texto legal aceptado al firmar. */
    termsVersion: text().notNull().default(''),
    /** Idempotencia garantizada por la base de datos, no por la aplicación. */
    requestId: text().notNull(),
  },
  (t) => [
    uniqueIndex('rentals_request_id_key').on(t.requestId),
    index('rentals_active_idx')
      .on(t.endedAt)
      .where(sql`${t.endedAt} IS NULL`),
    index('rentals_due_at_idx')
      .on(t.dueAt)
      .where(sql`${t.endedAt} IS NULL`),
    index('rentals_customer_idx').on(t.customerId),
    index('rentals_started_at_idx').on(t.startedAt.desc()),
    check('rentals_price_chk', sql`${t.priceCents} >= 0`),
    check(
      'rentals_final_price_chk',
      sql`${t.finalPriceCents} IS NULL OR ${t.finalPriceCents} >= 0`,
    ),
    check('rentals_ended_chk', sql`${t.endedAt} IS NULL OR ${t.endedAt} >= ${t.startedAt}`),
  ],
);

export const rentalEquipment = pgTable(
  'rental_equipment',
  {
    rentalId: bigint({ mode: 'number' })
      .notNull()
      .references(() => rentals.id, { onDelete: 'cascade' }),
    equipmentId: bigint({ mode: 'number' })
      .notNull()
      .references(() => equipment.id),
  },
  (t) => [
    primaryKey({ columns: [t.rentalId, t.equipmentId] }),
    index('rental_equipment_equipment_idx').on(t.equipmentId),
  ],
);

export const rentalDrafts = pgTable('rental_drafts', {
  userId: bigint({ mode: 'number' })
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  content: jsonb().notNull(),
  updatedAt: timestamp({ withTimezone: true }).notNull().default(now),
});

/* ----------------------------------------------------------- mensajería */

export const messageTemplates = pgTable('message_templates', {
  key: text().primaryKey(),
  version: text().notNull().default('1'),
  locale: text().notNull().default('es-CO'),
  channel: notifChannel().notNull(),
  category: notifCategory().notNull(),
  body: text().notNull(),
  active: boolean().notNull().default(true),
  updatedAt: timestamp({ withTimezone: true }).notNull().default(now),
});

export const notifications = pgTable(
  'notifications',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    /** Un evento de negocio produce como máximo un mensaje. */
    idempotencyKey: text().notNull(),
    channel: notifChannel().notNull(),
    category: notifCategory().notNull(),
    templateKey: text()
      .notNull()
      .references(() => messageTemplates.key),
    rentalId: bigint({ mode: 'number' }).references(() => rentals.id, { onDelete: 'cascade' }),
    customerId: bigint({ mode: 'number' }).references(() => customers.id, { onDelete: 'cascade' }),
    recipient: text().notNull(),
    payload: jsonb().notNull().default({}),
    status: notifStatus().notNull().default('pending'),
    attempts: smallint().notNull().default(0),
    scheduledFor: timestamp({ withTimezone: true }).notNull().default(now),
    nextAttemptAt: timestamp({ withTimezone: true }).notNull().default(now),
    sentAt: timestamp({ withTimezone: true }),
    providerMessageId: text(),
    lastError: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().default(now),
  },
  (t) => [
    uniqueIndex('notifications_idempotency_key').on(t.idempotencyKey),
    index('notifications_dispatch_idx')
      .on(t.nextAttemptAt)
      .where(sql`${t.status} = 'pending'`),
    index('notifications_rental_template_idx').on(t.rentalId, t.templateKey),
    index('notifications_provider_msg_idx').on(t.providerMessageId),
  ],
);

/* -------------------------------------------------------- contenido web */

export const faqs = pgTable(
  'faqs',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    question: text().notNull(),
    answer: text().notNull(),
    position: integer().notNull().default(0),
    active: boolean().notNull().default(true),
  },
  (t) => [index('faqs_order_idx').on(t.position, t.id)],
);

export const settings = pgTable('settings', {
  key: text().primaryKey(),
  value: text().notNull(),
  updatedAt: timestamp({ withTimezone: true }).notNull().default(now),
});

/* ---------------------------------------------------------- trazabilidad */

export const auditLog = pgTable(
  'audit_log',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    userId: bigint({ mode: 'number' }).references(() => users.id),
    action: text().notNull(),
    entity: text().notNull(),
    entityId: text().notNull().default(''),
    /** Qué cambió exactamente: el MVP solo guardaba el nombre de la acción. */
    before: jsonb(),
    after: jsonb(),
    createdAt: timestamp({ withTimezone: true }).notNull().default(now),
  },
  (t) => [
    index('audit_log_created_at_idx').on(t.createdAt.desc()),
    index('audit_log_user_idx').on(t.userId),
    index('audit_log_entity_idx').on(t.entity, t.entityId),
  ],
);
