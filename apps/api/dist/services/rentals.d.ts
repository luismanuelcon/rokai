import { type CreateRentalRequest, type FinishRentalRequest } from '@rokai/contracts';
import type { Db } from '../db.js';
export interface Actor {
    id: number;
    name: string;
}
export declare function createRental(db: Db, actor: Actor, input: CreateRentalRequest): Promise<{
    id: number;
    idempotent: boolean;
}>;
export declare function finishRental(db: Db, actor: Actor, rentalId: number, input: FinishRentalRequest): Promise<void>;
//# sourceMappingURL=rentals.d.ts.map