import { type ReservationRules } from '@rokai/contracts';
export interface Occupancy {
    start: Date;
    end: Date;
    quantity: number;
}
/**
 * Máximo de patinetas ocupadas a la vez dentro de [start, end). No basta con
 * sumar lo solapado: dos reservas seguidas que tocan el intervalo nunca coinciden.
 */
export declare function peakUsage(items: readonly Occupancy[], start: Date, end: Date): number;
export declare function newReservationCode(): string;
/** Reglas efectivas: el intervalo y el horizonte son ajustables desde `settings`. */
export declare function reservationRules(settings: Record<string, string>): ReservationRules;
//# sourceMappingURL=reservations.d.ts.map