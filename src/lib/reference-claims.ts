/**
 * Los nombres de la **referencia de sector**, y nada más.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ESTE FICHERO NO LLEVA `server-only`, Y ES SU RAZÓN DE SER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Casi todo `src/lib` es `server-only`: lee secretos, habla con Postgres o
 * compone tokens. Esto no hace nada de eso — son dos cadenas y un predicado, sin
 * una sola lectura de `process.env` — y tiene que poder leerlo **el servidor y
 * el navegador a la vez**:
 *
 *  · `organization.ts` valida contra esta lista lo que declara
 *    `CRM_REFERENCE_CLAIM`, y
 *  · `CustomerForm.tsx`, que es de cliente, decide con este mismo tipo qué
 *    campo pinta.
 *
 * Compartir el vocabulario es justo lo que hace que el formulario **no** tenga
 * que saber de qué organización es la pantalla: recibe un valor de este juego
 * cerrado, no una organización. Es el mismo sitio que ya ocupan `delivery.ts` y
 * `verification-status.ts`, por la misma razón.
 *
 * ## Eran cuatro y son dos, y no es una poda cosmética
 *
 * Hasta el 2026-08-31 estaban también `policy_number` (seguros) y
 * `medical_record_number` (clínicas), porque un mismo despliegue servía a cuatro
 * empresas de cuatro sectores. Al pasar a **una instalación por empresa** se
 * quedaron dos: Banco Demo y Larkfield Energy. Lo que se fue de aquí se fue
 * también del catálogo de atributos, del formulario, del buscador y de los
 * rótulos — no queda ningún camino que las nombre.
 *
 * **Las dos columnas siguen en la base**, y eso es deliberado: `db/005_…` está
 * aplicada y tiene filas dentro. Quitarlas sería una migración destructiva para
 * ganar dos columnas nulas que ya no lee nadie. El porqué entero, en la nota de
 * `db/005_sector_reference.sql`.
 *
 * ## Por qué son los nombres de claim y no los de los campos del formulario
 *
 * `supply_point_number` es como se llama el atributo en el catálogo del padrón
 * (`CUSTOMER_ATTRIBUTES`), en la credencial firmada y en las variables que ya
 * existen (`CRM_TYPE_<TIPO>_CLAIMS`). Quien escribe el entorno ya conoce estas
 * palabras; inventar aquí un segundo juego —`supplyPointNumber`— sería pedirle
 * que aprenda dos nombres para una cosa.
 *
 * ## Y por qué ninguno lleva almohadilla
 *
 * Porque el valor se escribe en un `.env`, y allí la almohadilla **abre un
 * comentario**: `CRM_BRAND_COLOR=#5b3ea6` guarda la cadena vacía, sin error y
 * sin síntoma (ver la nota larga de `readBrandColor` en `organization.ts`).
 * Éstos son minúsculas y guiones bajos a propósito: no hay forma de escribirlos
 * mal en un `.env`, en un `docker-compose` ni en la caja de texto de Coolify.
 */

/**
 * Las columnas del padrón con las que el titular reconoce **de qué relación se
 * le está hablando**: los últimos cuatro de su cuenta en el banco, su punto de
 * suministro en la comercializadora.
 *
 * El orden importa y es el de `CUSTOMER_ATTRIBUTES`: es el que recorre
 * `referenceOf` para elegir la referencia de una ficha.
 */
export const REFERENCE_CLAIMS = ['account_last4', 'supply_point_number'] as const;

export type ReferenceClaim = (typeof REFERENCE_CLAIMS)[number];

/**
 * Si esa cadena es una de ellas.
 *
 * Existe para que la validación del entorno pueda **rechazar** lo que no lo sea:
 * sin esto, un `CRM_REFERENCE_CLAIM=supply_point` se aceptaría como texto
 * cualquiera y el formulario acabaría sin ningún campo de referencia, que es un
 * fallo silencioso y de los caros.
 */
export function isReferenceClaim(value: string): value is ReferenceClaim {
  return (REFERENCE_CLAIMS as readonly string[]).includes(value);
}
