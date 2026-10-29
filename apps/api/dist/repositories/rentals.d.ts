import type { Executor } from '../db.js';
export interface RentalRow {
    id: number;
    customerName: string;
    customerDocumentType: 'CC' | 'CE' | 'TI' | 'PA' | 'PEP' | 'PPT';
    customerDocument: string;
    customerPhone: string | null;
    minutes: number;
    priceCents: number;
    finalPriceCents: number | null;
    startedAt: Date;
    dueAt: Date;
    endedAt: Date | null;
    createdByName: string;
    endedByName: string | null;
    notes: string;
    equipment: {
        code: string;
        kind: 'scooter' | 'helmet';
    }[];
}
/**
 * Una sola consulta con json_agg: el MVP hacía una consulta de equipos por alquiler.
 */
export declare function listRentals(exec: Executor, filter?: {
    onlyActive?: boolean;
    limit?: number;
}): Promise<RentalRow[]>;
export declare function findRental(exec: Executor, id: number): Promise<{
    id: number;
    customerId: number;
    rateId: number;
    minutes: number;
    priceCents: number;
    finalPriceCents: number | null;
    startedAt: Date;
    dueAt: Date;
    endedAt: Date | null;
    createdBy: number;
    endedBy: number | null;
    notes: string;
    signature: string;
    termsVersion: string;
    requestId: string;
} | null>;
export declare function findByRequestId(exec: Executor, requestId: string): Promise<{
    id: number;
    createdBy: number;
} | null>;
/**
 * Bloquea las filas de equipo seleccionadas durante la transacción.
 * Sustituye al `BEGIN IMMEDIATE` global del MVP por un bloqueo por fila.
 */
export declare function lockEquipmentForUpdate(exec: Executor, ids: readonly number[]): Promise<{
    busy: boolean;
    id: number;
    kind: "scooter" | "helmet";
    status: "available" | "maintenance" | "inactive";
}[]>;
export declare function upsertCustomer(exec: Executor, input: {
    fullName: string;
    documentType: 'CC' | 'CE' | 'TI' | 'PA' | 'PEP' | 'PPT';
    document: string;
    phone: string | null;
}): Promise<number>;
//# sourceMappingURL=rentals.d.ts.map