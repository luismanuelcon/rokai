/** Las tarifas siguen siendo individuales y de pareja; el grupo es una sola operación. */
export function planBreakdown(quantity) {
    return ([
        '1 plan individual',
        '1 plan de pareja',
        '1 plan de pareja + 1 individual',
        '2 planes de pareja',
    ][quantity - 1] ?? '');
}
/** Recibe únicamente tarifas vigentes para la fecha. Nunca inventa tarifas faltantes. */
export function quoteGroupRate(rates, baseRateId, quantity) {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 4)
        return null;
    const base = rates.find((r) => r.id === baseRateId);
    if (!base || base.quantity !== (quantity === 1 ? 1 : 2))
        return null;
    const individual = quantity === 1
        ? base
        : rates.find((r) => r.quantity === 1 && r.period === base.period && r.minutes === base.minutes);
    if (quantity % 2 && !individual)
        return null;
    const priceCents = Math.floor(quantity / 2) * base.priceCents + (quantity % 2) * (individual?.priceCents ?? 0);
    return { ...base, quantity, priceCents };
}
//# sourceMappingURL=pricing.js.map