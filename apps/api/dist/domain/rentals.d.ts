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
/** Una tarifa está vigente si está activa y la fecha civil cae dentro del rango. */
export declare function isRateCurrent(rate: {
    active: boolean;
    validFrom: string | null;
    validUntil: string | null;
}, today: string): boolean;
//# sourceMappingURL=rentals.d.ts.map