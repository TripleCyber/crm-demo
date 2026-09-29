/**
 * **Las cabeceras de una llamada a la puerta B2B, en un solo sitio.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ESTE FICHERO EXISTE PARA QUE UNA PANTALLA NO PUEDA MENTIR SOBRE LO QUE SALE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * El catálogo de verificaciones enseña **la petición HTTP exacta** que este CRM
 * le va a mandar a te-api, cabeceras incluidas. Escribirlas allí a mano habría
 * sido escribirlas dos veces —una para mandarlas y otra para pintarlas— y dos
 * copias de lo mismo se separan: el día que `callB2b` añadiera una cabecera, la
 * pantalla seguiría enseñando las de ayer y nadie se enteraría, porque una
 * pantalla que documenta no falla cuando se queda vieja.
 *
 * Así que las compone esta función, y la usan las dos: `callB2b` para mandarlas
 * y el compositor para pintarlas, con el mismo objeto y el mismo orden.
 *
 * ## El portador nunca se pinta
 *
 * La versión que se enseña se compone con `REDACTED_BEARER` en vez del token, y
 * **no es una máscara aplicada al final**: el token de verdad no llega a
 * componerse. Un token de organización de Logto abre la puerta B2B entera de
 * esta empresa, y esta pantalla es la que alguien va a proyectar en una
 * demostración y a capturar para un correo.
 *
 * Este módulo es puro a propósito —ni `server-only` ni acceso a configuración—
 * porque el compositor lo llama **en el navegador** para pintar el bloque antes
 * de mandar nada. Lo único que sabe es cómo se llaman dos cabeceras.
 */

/**
 * Lo que se pinta en el sitio del token. No es un ejemplo de token: es una
 * palabra que **no se puede confundir** con uno, para que nadie copie el bloque
 * de la pantalla y lo pegue esperando que funcione.
 */
export const REDACTED_BEARER = '<organisation token — never printed>';

/**
 * Las cabeceras de una llamada B2B, en el orden en que se leen.
 *
 * `Content-Type` sólo cuando hay cuerpo, exactamente como en `callB2b`: una
 * llamada `GET` no lo lleva y enseñarlo diría que sí.
 */
export function b2bHeaders(bearer: string, withBody: boolean): Record<string, string> {
  return {
    Authorization: `Bearer ${bearer}`,
    ...(withBody ? { 'Content-Type': 'application/json' } : {}),
  };
}
