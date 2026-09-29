import 'server-only';

import { createHash } from 'node:crypto';

/**
 * La huella de un secreto: lo único de él que sale de este servidor.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ES LA MISMA FORMA QUE USA tenant-admin, Y ESO NO ES CASUALIDAD
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * En tenant-admin el secreto de una aplicación de máquina se enseña entero una
 * sola vez y después sólo queda su huella
 * (`tenant-admin/src/app/api/tenant/[...path]/route.ts`, función `fingerprint`):
 * SHA-256 en hexadecimal, recortado a 16 caracteres, más los cuatro últimos
 * caracteres del valor como pista.
 *
 * Aquí se calcula igual, byte a byte, **para que las dos huellas se puedan
 * comparar a ojo**. Ése es todo el punto: quien pega el secreto de la aplicación
 * M2M en la pantalla de ajustes de este CRM puede volver a tenant-admin, mirar
 * la huella que enseña allí y comprobar que pegó el que era — sin que ninguna de
 * las dos pantallas vuelva a enseñar el secreto.
 *
 * ⚠ **La huella del secreto de webhook NO cuadra con la de tenant-admin**, y hay
 *   que saberlo antes de intentar compararlas. te-api calcula la suya sobre el
 *   **texto cifrado** que guarda (`secretFingerprint` en
 *   `tripleenable-api/src/b2b/webhooks.ts`), no sobre el `whsec_…` en claro, así
 *   que nadie que tenga el mismo secreto puede reproducirla. La de aquí sirve
 *   para lo otro que hace falta: ver que el valor guardado **no ha cambiado**
 *   entre dos visitas, y distinguir «hay secreto» de «hay otro secreto».
 *
 * ## Por qué se recorta a 16 caracteres
 *
 * Porque es un identificador para el ojo humano, no una prueba criptográfica. 64
 * caracteres no se comparan de un vistazo y 16 sí; y de un SHA-256 truncado a 64
 * bits no se saca el original.
 *
 * ## Y por qué se enseñan los cuatro últimos caracteres
 *
 * Es la pista que ya usa tenant-admin, y resuelve el caso real: dos secretos
 * pegados con un espacio de más al final se distinguen mirando la cola. Cuatro
 * caracteres de un valor de 43 no acortan nada que valga la pena — quedan 39 por
 * adivinar — y sin ellos la única forma de saber si te equivocaste de secreto es
 * probar y ver fallar la emisión.
 */

export interface SecretFingerprint {
  /** SHA-256 del valor, hexadecimal, 16 caracteres. */
  readonly digest: string;
  /** Los cuatro últimos caracteres del valor. La pista. */
  readonly hint: string;
}

export function fingerprintOf(value: string): SecretFingerprint {
  return {
    digest: createHash('sha256').update(value).digest('hex').slice(0, 16),
    hint: value.slice(-4),
  };
}

/** La huella de un secreto que puede no estar. `undefined` = no hay secreto. */
export function fingerprintOrUndefined(value: string | undefined): SecretFingerprint | undefined {
  return value === undefined || value === '' ? undefined : fingerprintOf(value);
}
