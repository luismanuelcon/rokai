import type { EquipmentKind, EquipmentStatus } from '@rokai/contracts';
export interface SelectableEquipment {
    id: number;
    kind: EquipmentKind;
    status: EquipmentStatus;
    busy: boolean;
}
/**
 * Regla de negocio pura: una patineta y un casco por persona, todo disponible.
 * Sin IO, por lo que se puede probar unitariamente.
 */
export declare function assertAssignable(selected: readonly SelectableEquipment[], requestedIds: readonly number[], quantity: number): void;
/**
 * Recargo por devolución tardía. Se cobra por minuto empezado: devolver a los
 * 61 segundos de vencido cuesta dos minutos, no uno. Regla pura y sin IO.
 * Los minutos de retraso se registran aunque el recargo configurado sea cero.
 */
export declare function lateCharge(dueAt: Date, endedAt: Date, perMinuteCents: number): {
    minutes: number;
    cents: number;
};
/** Una tarifa está vigente si está activa y la fecha civil cae dentro del rango. */
export declare function isRateCurrent(rate: {
    active: boolean;
    validFrom: string | null;
    validUntil: string | null;
}, today: string): boolean;
//# sourceMappingURL=rentals.d.ts.map