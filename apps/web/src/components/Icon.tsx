const PATHS: Record<string, string> = {
  mail: 'M3 5h18v14H3z M3 5l9 8 9-8',
  instagram:
    'M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M17 7h.01',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  clock: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M12 6v6l4 2',
  shield: 'M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7L12 3 M8 12l3 3 5-6',
  scooter:
    'M6 17h10L12 3h-3 M5 17a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M23 17a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M16 17l4-3',
  users:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M17 4a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-4',
  lock: 'M5 10h14v11H5z M8 10V6a4 4 0 0 1 8 0v4',
  waves: 'M2 6q3-4 7 0t7 0 6 0 M2 12q3-4 7 0t7 0 6 0 M2 18q3-4 7 0t7 0 6 0',
  helmet: 'M3 14v-3a9 9 0 0 1 18 0v3H3 M4 14v5h4l4-5 M16 14v6h4v-6',
  check: 'm5 12 4 4L19 6',
  menu: 'M3 6h18 M3 12h18 M3 18h18',
  close: 'm6 6 12 12 M18 6 6 18',
  plus: 'M12 5v14 M5 12h14',
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  history: 'M3 11a9 9 0 1 1 3 8 M3 4v7h7 M12 7v5l4 2',
  settings:
    'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2',
  logout: 'M10 3H3v18h7 M9 12h13 M17 7l5 5-5 5',
  chart: 'M4 20V10 M12 20V4 M20 20v-7',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  leaf: 'M20 3C5 1 1 10 6 17s17 2 14-14Z M6 19 16 9',
  bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.7 21a2 2 0 0 1-3.4 0',
  chevron: 'm6 9 6 6 6-6',
  pen: 'M4 20h4L19 9a2.83 2.83 0 0 0-4-4L4 16v4 M14 6l4 4',
};

export function Icon({ name }: { name: string }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={PATHS[name] ?? PATHS['check']} />
    </svg>
  );
}
