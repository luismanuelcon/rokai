import { reservations } from '@rokai/db';
import { type CreateReservationRequest, type PublicReservation, type ReservationAvailability, type ReservationOptions } from '@rokai/contracts';
import type { Db, Executor } from '../db.js';
import { type Occupancy } from '../domain/reservations.js';
type ReservationRow = typeof reservations.$inferSelect;
/** Cada persona sale con patineta y casco: la flota útil es el menor de los dos. */
export declare function fleetCapacity(exec: Executor): Promise<number>;
/** Reservas que bloquean cupo y alquileres en curso que tocan el intervalo. */
export declare function occupancy(exec: Executor, from: Date, to: Date): Promise<Occupancy[]>;
export declare function reservationOptions(db: Db, now?: Date): Promise<ReservationOptions>;
export declare function reservationAvailability(db: Db, date: string, quantity: number, now?: Date): Promise<ReservationAvailability>;
export declare function toPublicReservation(row: ReservationRow, contact: string): PublicReservation;
export declare function createReservation(db: Db, input: CreateReservationRequest, now?: Date): Promise<{
    reservation: PublicReservation;
    created: boolean;
}>;
/** Vincula la reserva al alquiler que la inicia. Debe llamarse dentro de la transacción del alquiler. */
export declare function lockReservationForRental(exec: Executor, reservationId: number): Promise<{
    id: number;
    code: string;
    requestId: string;
    customerName: string;
    phoneE164: string;
    serviceDate: string;
    startsAt: Date;
    endsAt: Date;
    quantity: number;
    rateId: number | null;
    ratePeriod: "special" | "weekend";
    durationMinutes: number;
    priceCents: number;
    planLabel: string;
    status: "pending" | "confirmed" | "cancelled" | "in_rental" | "completed" | "no_show";
    statusReason: string | null;
    statusChangedAt: Date | null;
    statusChangedBy: number | null;
    rentalId: number | null;
    createdAt: Date;
}>;
export declare function rateById(exec: Executor, id: number): Promise<{
    id: number;
    period: "special" | "weekend";
    minutes: number;
    quantity: number;
    priceCents: number;
    active: boolean;
    validFrom: string | null;
    validUntil: string | null;
    createdAt: Date;
} | null>;
export declare function completeReservationsForRental(exec: Executor, rentalIds: number[], at: Date): Promise<void>;
export {};
//# sourceMappingURL=reservations.d.ts.map