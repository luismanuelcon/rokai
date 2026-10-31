/**
 * Familia de iconos de ROKAI. Una sola rejilla y un solo trazo:
 *
 *   · lienzo 24×24, dibujo dentro de 2..22 (nada toca ni rebasa el borde)
 *   · solo contorno; el grosor, los extremos redondeados y el tamaño los fija
 *     `svg.icon` en rokai.css, para que no se puedan desviar desde una página
 *
 * Icono nuevo = una entrada aquí. Ningún SVG suelto en una pantalla.
 */
const PATHS: Record<string, string> = {
  mail: 'M3 6h18v12H3z M3 7l9 6 9-6',
  instagram:
    'M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M17 7h.01',
  arrow: 'M4 12h15m-5-5 5 5-5 5',
  pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  clock: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M12 6v6l4 2',
  shield: 'M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7L12 3 M8 12l3 3 5-6',
  /* Patineta: cubierta, mástil, manillar y dos ruedas. La versión anterior
     colocaba la rueda trasera en x=-1 y el navegador la recortaba. */
  scooter:
    'M8 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0 M21 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0 M8 18h7 M15 18 18.5 5 M16.5 5h4.5',
  users:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M17 4a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-4',
  lock: 'M5 10h14v11H5z M8 10V6a4 4 0 0 1 8 0v4',
  waves: 'M2 7q3-4 7 0t7 0 6 0 M2 12q3-4 7 0t7 0 6 0 M2 17q3-4 7 0t7 0 6 0',
  /* Casco: casquete, borde y visera. */
  helmet: 'M3 14a9 9 0 0 1 18 0 M2 14h20 M8 14a4 4 0 0 1 8 0',
  check: 'm5 12 4 4L19 6',
  menu: 'M3 6h18 M3 12h18 M3 18h18',
  close: 'm6 6 12 12 M18 6 6 18',
  plus: 'M12 5v14 M5 12h14',
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  history: 'M3 11a9 9 0 1 1 3 8 M3 4v7h7 M12 7v5l4 2',
  settings:
    'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2',
  logout: 'M10 3H3v18h7 M9 12h12 M16 7l5 5-5 5',
  /* Barras con línea base: sin ella flotaban sin apoyo. */
  chart: 'M3 21h18 M6 21V11 M12 21V4 M18 21v-7',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  leaf: 'M20 3C5 1 1 10 6 17s17 2 14-14Z M6 19 16 9',
  bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.7 21a2 2 0 0 1-3.4 0',
  chevron: 'm6 9 6 6 6-6',
  pen: 'M4 20h4L19 9a2.83 2.83 0 0 0-4-4L4 16v4 M14 6l4 4',
  cash: 'M3 6h18v12H3z M14.5 12a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0 M6 9.5v.01 M18 14.5v.01',
  transfer: 'M4 8h15 M16 5l3 3-3 3 M20 16H5 M8 13l-3 3 3 3',
  trash: 'M4 7h16 M10 11v6 M14 11v6 M6 7l1 13h10l1-13 M9 7V4h6v3',
};

/**
 * `label` da nombre accesible al icono. Sin él queda oculto a los lectores de
 * pantalla, que es lo correcto cuando va acompañado de texto visible.
 */
export function Icon({ name, label }: { name: string; label?: string }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d={PATHS[name] ?? PATHS['check']} />
    </svg>
  );
}
