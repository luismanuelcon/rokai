import type { Executor } from '../db.js';
/** Un viaje es un alquiler devuelto, independientemente del número de patinetas. */
export declare function completedTrips(exec: Executor, now?: Date): Promise<{
    date: string;
    count: number;
    firstStartedAt: string | null;
    closedAt: string | null;
}>;
//# sourceMappingURL=dashboard.d.ts.map