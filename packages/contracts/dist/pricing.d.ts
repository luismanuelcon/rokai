/** Las tarifas siguen siendo individuales y de pareja; el grupo es una sola operación. */
export declare function planBreakdown(quantity: number): string;
interface GroupRate {
    id: number;
    period: string;
    minutes: number;
    quantity: number;
    priceCents: number;
}
/** Recibe únicamente tarifas vigentes para la fecha. Nunca inventa tarifas faltantes. */
export declare function quoteGroupRate<T extends GroupRate>(rates: readonly T[], baseRateId: number, quantity: number): T | null;
export {};
//# sourceMappingURL=pricing.d.ts.map