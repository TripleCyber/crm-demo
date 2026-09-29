import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * La comprobación de la firma de un webhook de te-api.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ESTO ES LO ÚNICO QUE SEPARA UN EVENTO DE te-api DE UN `POST` CUALQUIERA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La URL del webhook es pública: la conoce quien la registró, la conoce el
 * proxy, y basta con adivinarla. Un receptor que acepte cualquier cuerpo es una
 * puerta abierta a que un tercero escriba en el diario de esta empresa eventos
 * de credenciales que nunca ocurrieron.
 *
 * Y desde el 2026-08-31 **importa mucho más que antes**, porque el cuerpo cambió
 * de forma. Cuando el evento sólo decía «la sesión X terminó», lo peor que
 * conseguía una entrega falsificada era mandarnos a leer una sesión que no había
 * cambiado. Ahora el cuerpo lleva el veredicto dentro (`data.status`), así que
 * un `POST` falsificado puede **afirmar un `verified` que no ocurrió** — y quien
 * no comprueba la firma se lo cree. Está dicho con esas palabras en la cabecera
 * de `src/b2b/webhook-signature.ts` de te-api, y es el motivo de que este
 * fichero exista antes que la pantalla que enseña los eventos.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  LA FORMA EXACTA, LEÍDA DEL CÓDIGO QUE FIRMA — NO DEDUCIDA DE UN NOMBRE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Está comprobada contra `tripleenable-api/src/b2b/webhook-signature.ts` y
 * contra la prueba que reconstruye la firma por su cuenta
 * (`test/b2b/webhook-outbox.test.ts`), que es la que fija los bytes exactos.
 *
 *     te-signature-sha-256: t=<segundos>,v1=<hex>[,v1=<hex>]
 *
 *  · **Algoritmo**: HMAC-SHA256.
 *  · **Sobre qué bytes**: el UTF-8 de `` `${t}.${cuerpo}` `` — el `t` en
 *    segundos decimales, un punto ASCII, y **el cuerpo crudo tal y como llegó**.
 *  · **Codificación**: hexadecimal en minúsculas. El `v1=` es la clave del campo
 *    de la cabecera y **no entra en el MAC**.
 *
 * ⚠ **El cuerpo tiene que ser los bytes crudos.** te-api serializa una vez y
 *   firma y manda esa misma cadena. Volver a serializar lo que devuelva
 *   `JSON.parse` cambia espacios y orden de claves, y la firma deja de cuadrar
 *   sin que nada diga por qué. Por eso la ruta lee `await request.text()` y
 *   parsea después, nunca `request.json()`.
 *
 * ⚠ **PUEDE HABER DOS `v1=`, y no es un adorno.** Durante la ventana de gracia
 *   de una rotación de secreto —24 horas por defecto— te-api firma con el nuevo
 *   y con el anterior, y manda los dos. Un receptor que sólo mire el primero
 *   funciona… hasta que el administrador rote, y entonces empieza a rechazar
 *   entregas legítimas durante un día. Vale **cualquiera** de los dos.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  EL SECRETO ES UNA CADENA OPACA. NO SE DESCODIFICA. NUNCA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Es la trampa que más caro sale y por eso va en su propio bloque. El secreto
 * tiene la forma `whsec_` + 43 caracteres base64url, y **la clave del HMAC son
 * los bytes UTF-8 de la cadena entera, con el prefijo incluido**. te-api la pasa
 * tal cual a `createHmac('sha256', secret)`; no hay ni un `Buffer.from(…,
 * 'base64url')` ni un `.slice(6)` en todo el camino, y se comprobó grepeando.
 *
 * Quitar el `whsec_` o descodificar la cola como base64 produce un MAC distinto
 * y **todas** las entregas se rechazan. Es exactamente el mismo error que ya
 * costó una tarde en este taller con la clave HMAC de Logto —te-api la leía en
 * hexadecimal y Logto en base64—, así que aquí se escribe en grande: **esto no
 * es material criptográfico codificado, es un identificador de texto.**
 *
 * `TE_B2B_WEBHOOK_SECRET_KEY`, que se ve en el entorno de te-api, **no es esto**
 * y no sirve aquí: es la clave maestra AES con la que te-api cifra en reposo los
 * secretos de cada organización, y no sale nunca de te-api.
 *
 * ## Y no se compara con `===`
 *
 * `timingSafeEqual`. Comparar dos MAC con el operador de igualdad filtra por el
 * tiempo cuántos caracteres iniciales acertó quien lo intenta, y eso convierte
 * adivinar una firma de 64 caracteres en 64 intentos cortos. Es barato hacerlo
 * bien y no hay ninguna razón para no hacerlo.
 */

/** Las tres cabeceras que manda te-api. En minúsculas, como viajan en HTTP/2. */
export const SIGNATURE_HEADER = 'te-signature-sha-256';
export const EVENT_ID_HEADER = 'te-event-id';
export const DELIVERY_ID_HEADER = 'te-delivery-id';

/**
 * Cuánto se acepta de desfase entre el `t` firmado y el reloj de aquí.
 *
 * ⚠ **Este número lo elegimos nosotros. te-api no impone ninguno.** Lo
 * comprobé: no hay constante de tolerancia en su código, sólo un comentario que
 * recomienda cinco minutos. O sea que esto es política del receptor y no
 * contrato, y bajarlo demasiado empieza a rechazar entregas legítimas de un
 * te-api con el reloj algo corrido.
 *
 * Cinco minutos, que es lo recomendado. Sirve para que un `POST` grabado hoy no
 * se pueda reproducir mañana: el `t` está **dentro** del MAC, así que no se
 * puede reescribir sin invalidar la firma, y por tanto una entrega antigua sólo
 * se puede repetir tal cual.
 *
 * Contra la repetición *dentro* de la ventana está la otra mitad, que es la que
 * de verdad cierra el caso: `te-event-id` es único por evento y la tabla lo
 * tiene como clave, así que un reenvío no puede escribir dos filas. Ver
 * `webhook-events.ts`.
 */
export const TIMESTAMP_TOLERANCE_SECONDS = 300;

/**
 * Por qué no se aceptó una entrega.
 *
 * Son códigos y no frases porque **se guardan en la base** y se enseñan en la
 * pantalla de eventos: una frase guardada queda escrita en el idioma que
 * estuviera activo el día que llegó, y esa pantalla se ve en dos.
 */
export type SignatureFailure =
  /** No se ha registrado ningún secreto: `CRM_WEBHOOK_SECRET` no está. */
  | 'not_configured'
  /** No venía la cabecera de firma. */
  | 'missing_header'
  /** La cabecera no tiene la forma `t=…,v1=…`. */
  | 'malformed_header'
  /** El `t` está fuera de la ventana. Ver la constante de arriba. */
  | 'stale_timestamp'
  /** Ninguna de las firmas cuadra. Es el caso que importa. */
  | 'bad_signature';

export type SignatureCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: SignatureFailure };

/**
 * Comprueba la firma de una entrega.
 *
 * `rawBody` tienen que ser **los bytes exactos** que llegaron, sin reserializar.
 * `nowSeconds` entra por parámetro para poder probar la ventana sin tocar el
 * reloj del proceso.
 */
export function verifyWebhookSignature(
  secret: string | undefined,
  header: string | null,
  rawBody: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): SignatureCheck {
  // Sin secreto no se puede comprobar nada, y **no comprobar no es una opción**:
  // aceptar sería exactamente la puerta abierta que este fichero existe para
  // cerrar. Se rechaza todo y Diagnóstico dice qué variable falta.
  if (secret === undefined || secret === '') return { ok: false, reason: 'not_configured' };
  if (header === null || header.trim() === '') return { ok: false, reason: 'missing_header' };

  const parsed = parseSignatureHeader(header);
  if (parsed === null) return { ok: false, reason: 'malformed_header' };

  // La ventana se comprueba **antes** que el MAC. No por rendimiento: un
  // `t` viejo se rechaza aunque su firma sea perfecta, porque una firma
  // perfecta es justamente lo que tiene una entrega legítima grabada y
  // reproducida.
  if (Math.abs(nowSeconds - parsed.timestamp) > TIMESTAMP_TOLERANCE_SECONDS) {
    return { ok: false, reason: 'stale_timestamp' };
  }

  const expected = createHmac('sha256', secret)
    .update(`${String(parsed.timestamp)}.${rawBody}`, 'utf8')
    .digest('hex');

  // Cualquiera de las firmas vale: durante una rotación vienen dos.
  const matches = parsed.signatures.some((candidate) => hexEquals(candidate, expected));
  return matches ? { ok: true } : { ok: false, reason: 'bad_signature' };
}

interface ParsedSignature {
  readonly timestamp: number;
  readonly signatures: readonly string[];
}

/**
 * `t=1756640000,v1=abc…,v1=def…` desmontado.
 *
 * Se aceptan espacios alrededor de las comas y de los `=` porque un proxy por en
 * medio puede reescribirlos, y se ignoran los campos que no se conozcan: es lo
 * que permite que te-api añada un `v2=` el día que cambie de algoritmo sin
 * romper a este receptor, que seguiría comprobando su `v1`.
 */
function parseSignatureHeader(header: string): ParsedSignature | null {
  let timestamp: number | undefined;
  const signatures: string[] = [];

  for (const part of header.split(',')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key === 't') {
      // Sólo dígitos: `Number('12e3')` vale 12000 y `Number(' 1 ')` vale 1, y
      // ninguna de las dos cosas es un sello de tiempo que te-api haya escrito.
      if (!/^\d{1,15}$/.test(value)) return null;
      timestamp = Number(value);
    } else if (key === 'v1') {
      if (/^[0-9a-f]{64}$/i.test(value)) signatures.push(value.toLowerCase());
    }
  }

  if (timestamp === undefined || signatures.length === 0) return null;
  return { timestamp, signatures };
}

/** Compara dos MAC en hexadecimal sin filtrar por el tiempo cuántos coinciden. */
function hexEquals(a: string, b: string): boolean {
  // `timingSafeEqual` lanza si los largos difieren, y ese lanzamiento ya es en
  // sí una filtración del largo. Aquí no importa —los dos son 64 caracteres por
  // construcción, uno por el `test` de arriba y otro por `digest('hex')`— pero
  // se comprueba igual para no depender de esa coincidencia.
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}
