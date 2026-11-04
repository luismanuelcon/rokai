export declare const newTrackingToken: () => string;
export declare const validTrackingToken: (token: string) => boolean;
export declare const trackingPath: (token: string) => string;
export declare function trackingClock(dueAt: Date, endedAt: Date | null, now: Date): {
    status: "active" | "closed" | "expired";
    remainingSeconds: number;
};
export declare function redactTrackingUrl(url: string): string;
//# sourceMappingURL=tracking.d.ts.map