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

/**
 * `4:12` — lo que le queda a un plazo, para una cuenta atrás.
 *
 * Está aquí y no dentro de la pantalla de seguimiento porque ahora lo pintan
 * dos sitios de esa misma pantalla —el reloj grande del titular y la línea de
 * tiempo— y dos relojes de la misma espera que redondearan distinto se leen
 * como dos plazos distintos.
 *
 * Nunca baja de `0:00`: un plazo vencido se dice con otras palabras, no con un
 * número negativo.
 */
export function formatCountdown(expiresAt: string, now: number): string {
  const remaining = new Date(expiresAt).getTime() - now;
  if (Number.isNaN(remaining) || remaining <= 0) return '0:00';
  const totalSeconds = Math.floor(remaining / 1000);
  return `${String(Math.floor(totalSeconds / 60))}:${(totalSeconds % 60)
    .toString()
    .padStart(2, '0')}`;
}

/**
 * `hace 4 s` — cuánto hace de algo que acaba de pasar.
 *
 * Se usa para decir cuándo fue la última vez que esta consola preguntó, que es
 * lo que distingue una pantalla que espera de una colgada. Por debajo de dos
 * segundos se dice «ahora mismo»: «hace 0 s» es un número que se lee como una
 * avería, y además dejaría de ser verdad antes de que a nadie le diera tiempo
 * a leerlo.
 */
export function formatSince(at: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 2) return 'ahora mismo';
  if (seconds < 60) return `hace ${seconds} s`;
  return `hace ${Math.floor(seconds / 60)} min`;
}
