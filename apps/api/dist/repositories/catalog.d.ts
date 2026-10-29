import type { Executor } from '../db.js';
export interface RateRow {
    id: number;
    period: 'special' | 'weekend';
    minutes: number;
    quantity: number;
    priceCents: number;
    active: boolean;
    validFrom: string | null;
    validUntil: string | null;
}
/** Solo tarifas activas cuya vigencia cubre la fecha civil de Bogotá. */
export declare function activeRates(exec: Executor, today?: string): Promise<RateRow[]>;
export declare function allRates(exec: Executor): Promise<RateRow[]>;
export interface EquipmentRow {
    id: number;
    code: string;
    kind: 'scooter' | 'helmet';
    status: 'available' | 'maintenance' | 'inactive';
    busy: boolean;
}
export declare function equipmentWithBusy(exec: Executor): Promise<EquipmentRow[]>;
export declare function equipmentById(exec: Executor, id: number): Promise<EquipmentRow | null>;
//# sourceMappingURL=catalog.d.ts.map