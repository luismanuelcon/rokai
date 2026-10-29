import { useEffect, useState } from 'react';

/** Re-renderiza en intervalos fijos para mantener los contadores vivos. */
export function useTicker(intervalMs = 1000, enabled = true): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      setTick((t) => t + 1);
    }, intervalMs);
    return () => {
      clearInterval(id);
    };
  }, [intervalMs, enabled]);

  return tick;
}

export interface Countdown {
  overdue: boolean;
  label: string;
  /** Proporción de tiempo consumido, acotada a 0..1. */
  progress: number;
}

export function countdown(startedAt: string, dueAt: string): Countdown {
  const start = new Date(startedAt).getTime();
  const due = new Date(dueAt).getTime();
  const now = Date.now();
  const remaining = due - now;
  const overdue = remaining < 0;
  const total = Math.max(due - start, 1);

  const seconds = Math.floor(Math.abs(remaining) / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');

  const clock =
    hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${pad(minutes)}:${pad(rest)}`;

  return {
    overdue,
    label: overdue ? `+${clock}` : clock,
    progress: Math.min(Math.max((now - start) / total, 0), 1),
  };
}
