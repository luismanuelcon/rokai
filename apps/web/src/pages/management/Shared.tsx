import type { ReactNode } from 'react';

export function PageHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string | undefined;
  action?: ReactNode;
}) {
  return (
    <div className="workspace-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Metrics({
  items,
}: {
  items: { label: string; value: string | number; icon?: string }[];
}) {
  return (
    <div className="metrics">
      {items.map((m) => (
        <div className="metric" key={m.label}>
          <div>
            <p>{m.label}</p>
            <strong>{m.value}</strong>
          </div>
        </div>
      ))}
    </div>
  );
}
