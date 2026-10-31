import { sql } from 'drizzle-orm';
import { createDatabase, createPool } from './index.js';
import { equipment, faqs, messageTemplates, rates, settings, } from './schema.js';
/** Precios de la tabla oficial de ROKAI, en centavos de COP. */
const PRICE_TABLE = {
    special: {
        single: [500_000, 900_000, 1_300_000, 1_800_000],
        pair: [900_000, 1_600_000, 2_400_000, 3_200_000],
    },
    weekend: {
        single: [700_000, 1_200_000, 1_700_000, 2_200_000],
        pair: [1_200_000, 2_200_000, 3_100_000, 4_000_000],
    },
};
const DURATIONS = [15, 30, 45, 60];
const FAQS = [
    [
        '¿Qué necesito para alquilar?',
        'Acércate a la estación con tu documento de identidad. Nuestro equipo realiza el registro y te explica las condiciones antes de salir.',
    ],
    [
        '¿El casco está incluido?',
        'Sí. Te entregamos la patineta y el casco, junto con una breve inducción de seguridad.',
    ],
    [
        '¿Puedo reservar desde la página?',
        'Por ahora el alquiler es presencial. Consulta las tarifas y visítanos en el parque principal de Arboletes.',
    ],
    [
        '¿Pueden conducir menores de edad?',
        'Consulta las condiciones y la edad permitida con el equipo en la estación antes de contratar el servicio.',
    ],
    [
        '¿Qué métodos de pago reciben?',
        'Consulta los medios de pago disponibles con nuestro equipo en la estación.',
    ],
];
const SETTINGS = {
    location: 'Parque principal de Arboletes, Antioquia',
    mapsUrl: 'https://maps.app.goo.gl/LEpwibszPgpBVpjT7',
    hours: '8:00 a. m. a 10:00 p. m.',
    whatsapp: '+573106817317',
    instagram: 'roaki_patinetas',
    email: 'rokai.pat@gmail.com',
    /** Recargo por minuto de retraso, en centavos. 0 desactiva el cobro. */
    lateFeePerMinuteCents: '0',
    terms: 'Las condiciones definitivas del servicio están pendientes de aprobación por ROKAI. Antes de contratar, consulta con el personal las reglas de uso, edad permitida, devolución, daños y tiempo adicional.',
    privacy: 'El documento definitivo de privacidad está pendiente de aprobación por ROKAI. Esta versión registra datos de clientes para gestionar alquileres y restringe su acceso al personal autorizado. El responsable, canal de atención y plazo de conservación deben ser definidos antes de usar datos reales.',
    cookies: 'Utilizamos una cookie de sesión necesaria para proteger el acceso del personal. Guardamos tus preferencias de cookies en este navegador. Esta versión no incorpora analítica, publicidad ni rastreadores de terceros.',
};
/** Ninguna plantilla es de categoría `marketing`: las campañas son fase 2. */
const TEMPLATES = [
    {
        key: 'rental.started',
        channel: 'whatsapp',
        category: 'utility',
        body: 'Hola {{nombre}}, tu paseo ROKAI comenzó. Equipos: {{equipos}}. Devolución prevista: {{hora_devolucion}}. ¡Siente el aire!',
    },
    {
        key: 'rental.due_soon',
        channel: 'whatsapp',
        category: 'utility',
        body: 'Hola {{nombre}}, a tu alquiler ROKAI le quedan {{minutos_restantes}} minutos. Te esperamos en la estación del Malecón.',
    },
    {
        key: 'rental.overdue',
        channel: 'whatsapp',
        category: 'utility',
        body: 'Hola {{nombre}}, tu tiempo de alquiler ROKAI terminó. Por favor regresa a la estación para la devolución.',
    },
    {
        key: 'rental.finished',
        channel: 'whatsapp',
        category: 'utility',
        body: 'Gracias por rodar con ROKAI, {{nombre}}. Alquiler #{{alquiler}} finalizado. Valor: {{valor}}. ¡Vuelve pronto!',
    },
    {
        key: 'equipment.overdue_alert',
        channel: 'telegram',
        category: 'internal',
        body: 'ALERTA: alquiler #{{alquiler}} de {{nombre}} lleva {{minutos_vencido}} minutos vencido. Equipos: {{equipos}}.',
    },
    {
        key: 'equipment.incident',
        channel: 'telegram',
        category: 'internal',
        body: 'NOVEDAD en alquiler #{{alquiler}}: {{novedad}}',
    },
];
export async function seed(db) {
    await db.transaction(async (tx) => {
        const existing = await tx.select({ id: rates.id }).from(rates).limit(1);
        if (existing.length === 0) {
            const rows = DURATIONS.flatMap((minutes, i) => ['special', 'weekend'].flatMap((period) => [
                { period, minutes, quantity: 1, priceCents: PRICE_TABLE[period].single[i] },
                { period, minutes, quantity: 2, priceCents: PRICE_TABLE[period].pair[i] },
            ]));
            await tx.insert(rates).values(rows);
        }
        const haveEquipment = await tx.select({ id: equipment.id }).from(equipment).limit(1);
        if (haveEquipment.length === 0) {
            const units = [1, 2, 3, 4].flatMap((n) => {
                const suffix = String(n).padStart(2, '0');
                return [
                    { code: `ROKAI-${suffix}`, kind: 'scooter' },
                    { code: `CASCO-${suffix}`, kind: 'helmet' },
                ];
            });
            await tx.insert(equipment).values(units);
        }
        const haveFaqs = await tx.select({ id: faqs.id }).from(faqs).limit(1);
        if (haveFaqs.length === 0) {
            await tx
                .insert(faqs)
                .values(FAQS.map(([question, answer], position) => ({ question, answer, position })));
        }
        // Los ajustes editados por el administrador no se sobrescriben.
        await tx
            .insert(settings)
            .values(Object.entries(SETTINGS).map(([key, value]) => ({ key, value })))
            .onConflictDoNothing();
        await tx
            .insert(messageTemplates)
            .values(TEMPLATES.map((t) => ({ ...t })))
            .onConflictDoUpdate({
            target: messageTemplates.key,
            set: {
                body: sql `excluded.body`,
                channel: sql `excluded.channel`,
                category: sql `excluded.category`,
                updatedAt: sql `now()`,
            },
        });
    });
}
const isDirectRun = process.argv[1]?.endsWith('seed.js') ?? false;
if (isDirectRun) {
    const url = process.env.DATABASE_URL;
    if (!url) {
        console.error('DATABASE_URL no está definida.');
        process.exit(1);
    }
    const pool = createPool(url);
    try {
        await seed(createDatabase(pool));
        console.log('Semillas aplicadas.');
    }
    finally {
        await pool.end();
    }
}
//# sourceMappingURL=seed.js.map