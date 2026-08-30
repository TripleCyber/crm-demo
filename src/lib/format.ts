/**
 * Cómo se escriben las fechas y las horas en toda la consola.
 *
 * Está en un módulo aparte porque ahora las pintan cuatro pantallas, y una
 * fecha escrita de dos maneras distintas en dos columnas de la misma tabla es
 * lo que hace que una herramienta parezca hecha a trozos. No es de servidor: lo
 * importan también los componentes de navegador.
 */

/**
 * `2024-03-12` → `12 mar 2024`, **sin restar un día por el camino**.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  `new Date('2024-03-12')` NO ES EL 12 DE MARZO AQUÍ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Una cadena `YYYY-MM-DD` a secas la interpreta JavaScript como medianoche
 * **UTC**, y al pintarla en una zona al oeste de Greenwich sale el día
 * anterior. Se vio en pantalla: la ficha de un cliente de alta el 12 de marzo
 * ponía «11 mar 2024».
 *
 * Es exactamente el mismo fallo que `src/lib/customers.ts` evita formateando
 * `customer_since` en Postgres —ahí está su nota larga— y que se volvió a
 * colar por la puerta de al lado en cuanto alguien construyó un `Date` con esa
 * cadena. La `T00:00:00` sin zona obliga a interpretarla en **hora local**,
 * que es lo que significa una fecha de alta comercial: un día del calendario,
 * sin hora y sin huso.
 */
export function formatCalendarDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Un instante con hora, para el diario: `29 ago, 21:54`.
 *
 * Aquí **sí** hay huso: lo que se guarda es un `timestamptz`, un momento
 * concreto en el tiempo, y se pinta en la zona de quien mira la pantalla —que
 * es quien tiene que cruzarlo con lo que recuerda de esa llamada.
 */
export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-ES', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** `14:32:07` en la zona de quien mira la pantalla, que es quien la lee. */
export function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('es-ES', { hour12: false });
}
