/**
 * Los cuatro nombres de la **referencia de sector**, y nada más.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ESTE FICHERO NO LLEVA `server-only`, Y ES SU RAZÓN DE SER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Casi todo `src/lib` es `server-only`: lee secretos, habla con Postgres o
 * compone tokens. Esto no hace nada de eso — son cuatro cadenas y un predicado,
 * sin una sola lectura de `process.env` — y tiene que poder leerlo **el
 * servidor y el navegador a la vez**:
 *
 *  · `organizations.ts` valida contra esta lista lo que declara
 *    `CRM_ORG_<SLUG>_REFERENCE_CLAIM`, y
 *  · `CustomerForm.tsx`, que es de cliente, decide con este mismo tipo qué
 *    campo pinta.
 *
 * Compartir el vocabulario es justo lo que hace que el formulario **no** tenga
 * que saber de qué organización es la pantalla: recibe un valor de este juego
 * cerrado, no una organización. Es el mismo sitio que ya ocupan `delivery.ts` y
 * `verification-status.ts`, por la misma razón.
 *
 * ## Por qué son los nombres de claim y no los de los campos del formulario
 *
 * `supply_point_number` es como se llama el atributo en el catálogo del padrón
 * (`CUSTOMER_ATTRIBUTES`), en la credencial firmada y en las variables que ya
 * existen (`CRM_TYPE_PACIENTE_CLAIMS=… medical_record_number`). Quien escribe
 * el entorno ya conoce estas cuatro palabras; inventar aquí un segundo juego
 * —`supplyPointNumber`— sería pedirle que aprenda dos nombres para una cosa.
 *
 * ## Y por qué ninguno lleva almohadilla
 *
 * Porque el valor se escribe en un `.env`, y allí la almohadilla **abre un
 * comentario**: `BRAND_COLOR=#5b3ea6` guarda la cadena vacía, sin error y sin
 * síntoma (ver la nota larga de `readBrandColor` en `organizations.ts`). Estos
 * cuatro son minúsculas y guiones bajos a propósito: no hay forma de escribirlos
 * mal en un `.env`, en un `docker-compose` ni en la caja de texto de Coolify.
 */

/**
 * Las cuatro columnas del padrón con las que el titular reconoce **de qué
 * relación se le está hablando**: los últimos cuatro de su cuenta en el banco,
 * su póliza en la aseguradora, su número de historia en la clínica, su punto de
 * suministro en la comercializadora.
 *
 * El orden importa y es el de `CUSTOMER_ATTRIBUTES`: es el que recorre
 * `referenceOf` para elegir la referencia de una ficha, y es el que decide en
 * qué orden se pintan los cuatro campos cuando una organización no declara
 * ninguno.
 */
export const REFERENCE_CLAIMS = [
  'account_last4',
  'policy_number',
  'medical_record_number',
  'supply_point_number',
] as const;

export type ReferenceClaim = (typeof REFERENCE_CLAIMS)[number];

/**
 * Si esa cadena es uno de los cuatro.
 *
 * Existe para que la validación del entorno pueda **rechazar** lo que no lo
 * sea: sin esto, un `CRM_ORG_X_REFERENCE_CLAIM=poliza` se aceptaría como texto
 * cualquiera y el formulario acabaría sin ningún campo de referencia, que es un
 * fallo silencioso y de los caros.
 */
export function isReferenceClaim(value: string): value is ReferenceClaim {
  return (REFERENCE_CLAIMS as readonly string[]).includes(value);
}
