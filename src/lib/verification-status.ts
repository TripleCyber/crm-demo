/**
 * El vocabulario de los cinco desenlaces, **en un solo sitio**.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  EL ROJO ES SÓLO DEL FRAUDE, Y ESA REGLA NO PUEDE VIVIR EN TRES PANTALLAS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * El resultado de una comprobación se pinta ahora en tres sitios —la columna
 * del listado, la ficha del cliente y la pantalla de seguimiento— y los tres
 * tienen que decir lo mismo con el mismo color. Repartir la equivalencia
 * «`rejected` es rojo, `failed` es ámbar» por tres componentes es garantizar
 * que dentro de dos cambios uno de los tres pinte un fraude del color de un
 * reintento, y esa distinción es una propiedad de seguridad: quien está al
 * teléfono corta la llamada con uno y vuelve a intentarlo con el otro.
 *
 * Este fichero **no es de servidor**: lo importan también los componentes de
 * navegador, que es medio motivo de que exista. No toca la base ni te-api.
 */

/** Los cinco valores de `GET /v1/b2b/presentations/:id`, y ninguno más. */
export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'failed' | 'expired';

/**
 * El color, por lo que significa y no por cómo se ve.
 *
 * - `alarm` — rojo. **Sólo `rejected`**: el titular dice que no ha sido él.
 * - `caution` — ámbar. Ha ido mal sin ser fraude: se reintenta.
 * - `ok` — verde. Comprobada.
 * - `waiting` — azul, latiendo. No es un final: es la espera.
 */
export type VerificationTone = 'ok' | 'alarm' | 'caution' | 'waiting';

export interface VerificationVerdict {
  readonly tone: VerificationTone;
  /** Dos o tres palabras, para una celda de tabla o una insignia. */
  readonly label: string;
  /** Una frase, para debajo del rótulo cuando hay sitio. */
  readonly detail: string;
}

/**
 * Cómo se lee una comprobación, con su plazo tenido en cuenta.
 *
 * `expiresAt` importa porque una fila que se quedó en `pending` —nadie tenía la
 * pantalla abierta cuando venció el plazo, así que nadie preguntó y nadie la
 * marcó— **no está en curso**: su plazo se agotó, y enseñarla como «en curso»
 * en el listado de mañana sería decir que hay una ceremonia viva que no existe.
 * Se pinta como lo que es, sin respuesta y en ámbar, y no se afirma que te-api
 * la haya dado por caducada: eso lo dirá él cuando alguien abra la pantalla de
 * seguimiento, que vuelve a preguntar al cargar y reconcilia la fila.
 */
export function describeVerification(
  status: VerificationStatus,
  expiresAt: string,
  now: number = Date.now(),
): VerificationVerdict {
  if (status === 'pending') {
    const deadline = new Date(expiresAt).getTime();
    if (!Number.isNaN(deadline) && deadline <= now) {
      return {
        tone: 'caution',
        label: 'Sin respuesta',
        detail: 'El plazo se agotó y nadie llegó a contestar.',
      };
    }
    return { tone: 'waiting', label: 'En curso', detail: 'Esperando a que el titular conteste.' };
  }

  return VERDICTS[status];
}

const VERDICTS: Record<Exclude<VerificationStatus, 'pending'>, VerificationVerdict> = {
  verified: {
    tone: 'ok',
    label: 'Verificada',
    detail: 'Presentó su credencial y la comprobación salió bien.',
  },
  // El único rojo. Ver la cabecera.
  rejected: {
    tone: 'alarm',
    label: 'Rechazada por el titular',
    detail: 'Dijo desde su cartera que no ha sido él. Es un aviso de fraude.',
  },
  failed: {
    tone: 'caution',
    label: 'Credencial no válida',
    detail: 'No es un «no soy yo»: la credencial no valió. Se puede reintentar.',
  },
  expired: {
    tone: 'caution',
    label: 'Sin respuesta',
    detail: 'Nadie contestó dentro del plazo.',
  },
};
