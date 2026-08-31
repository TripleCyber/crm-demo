import type { MessageKey, Translator } from '@/i18n/translate';

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
 * El tono y las claves de cada desenlace.
 *
 * ⚠ **El tono se queda escrito aquí, en código, y no en el catálogo.** Es una
 *   propiedad de seguridad —el rojo es sólo del fraude— y un catálogo es un
 *   fichero que se edita para traducir: quien traduce cambia palabras, no
 *   decide de qué color se pinta un aviso de suplantación. Lo que sí es
 *   traducible son las palabras, y ahí la regla es que `rejected` y `expired`
 *   no se pueden acercar: con uno se corta la llamada y con el otro se
 *   reintenta.
 */
interface VerdictShape {
  readonly tone: VerificationTone;
  readonly labelKey: MessageKey;
  readonly detailKey: MessageKey;
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
 *
 * El traductor entra por parámetro y no se resuelve aquí: este módulo lo
 * importan también los componentes de navegador, que reciben el idioma por
 * contexto, y no puede tocar cookies.
 */
export function describeVerification(
  t: Translator,
  status: VerificationStatus,
  expiresAt: string,
  now: number = Date.now(),
): VerificationVerdict {
  const shape = shapeOf(status, expiresAt, now);
  return { tone: shape.tone, label: t(shape.labelKey), detail: t(shape.detailKey) };
}

/**
 * El tono a secas, sin traducir nada.
 *
 * Para quien sólo necesita el color —la clase CSS de un hito de la línea de
 * tiempo, el aspecto del escenario— y ya tiene el texto por otro lado.
 */
export function verificationTone(
  status: VerificationStatus,
  expiresAt: string,
  now: number = Date.now(),
): VerificationTone {
  return shapeOf(status, expiresAt, now).tone;
}

function shapeOf(
  status: VerificationStatus,
  expiresAt: string,
  now: number,
): VerdictShape {
  if (status === 'pending') {
    const deadline = new Date(expiresAt).getTime();
    if (!Number.isNaN(deadline) && deadline <= now) {
      return {
        tone: 'caution',
        labelKey: 'verdict.noAnswerLabel',
        detailKey: 'verdict.noAnswerDetail',
      };
    }
    return {
      tone: 'waiting',
      labelKey: 'verdict.pendingLabel',
      detailKey: 'verdict.pendingDetail',
    };
  }

  return VERDICTS[status];
}

const VERDICTS: Record<Exclude<VerificationStatus, 'pending'>, VerdictShape> = {
  verified: {
    tone: 'ok',
    labelKey: 'verdict.verifiedLabel',
    detailKey: 'verdict.verifiedDetail',
  },
  // El único rojo. Ver la cabecera.
  rejected: {
    tone: 'alarm',
    labelKey: 'verdict.rejectedLabel',
    detailKey: 'verdict.rejectedDetail',
  },
  failed: {
    tone: 'caution',
    labelKey: 'verdict.failedLabel',
    detailKey: 'verdict.failedDetail',
  },
  expired: {
    tone: 'caution',
    labelKey: 'verdict.expiredLabel',
    detailKey: 'verdict.expiredDetail',
  },
};
