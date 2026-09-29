import type { MessageKey, Translator } from '@/i18n/translate';

/**
 * Los tres canales de entrega, con su nombre y para qué sirve cada uno.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  EL CANAL ES TRANSPORTE, NUNCA AUTORIDAD
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Correo, enlace y QR entregan **la misma oferta**: la misma URI, la misma
 * firma y el mismo `tx_code`. Elegir canal no cambia lo que la cartera va a
 * comprobar. Lo que cambia es a quién le llega y qué tiene que hacer el agente
 * a continuación, y eso es lo que dicen estos rótulos.
 *
 * Están aquí y no dentro del formulario porque ahora los lee también el
 * historial de la ficha: la pantalla que ofrece «QR» y la que después cuenta
 * «se le ofreció por QR» tienen que llamarlo igual, o el agente creerá que son
 * dos cosas.
 *
 * El rótulo dice **la situación**, no la tecnología. El agente no tiene que
 * saber qué es una oferta pre-autorizada de OID4VCI para acertar.
 */

export type DeliveryChannel = 'qr' | 'link' | 'email';

export interface DeliveryOption {
  readonly value: DeliveryChannel;
  /** El rótulo del selector, tal y como lo escribe el artifact. */
  readonly labelKey: MessageKey;
  /** A quién llega y qué hace falta. Es lo que de verdad decide cuál se elige. */
  readonly hintKey: MessageKey;
  /**
   * Cómo se lee el canal **dentro de una frase** del historial.
   *
   * Hace falta porque el rótulo del selector no encaja en prosa: «se le ofreció
   * por Correo» no lo escribiría nadie —se dice «por correo»—. El diario lo lee
   * un empleado meses después y tiene que sonar al idioma en el que se habla,
   * no a valor de un desplegable — y por eso es una clave aparte y no el mismo
   * rótulo reutilizado: la traducción de un rótulo no encaja en una frase.
   */
  readonly phraseKey: MessageKey;
}

/** Los tres, en el orden del artifact. */
export const DELIVERY_OPTIONS: readonly DeliveryOption[] = [
  {
    value: 'email',
    labelKey: 'delivery.emailLabel',
    hintKey: 'delivery.emailHint',
    phraseKey: 'delivery.emailPhrase',
  },
  {
    value: 'link',
    labelKey: 'delivery.linkLabel',
    hintKey: 'delivery.linkHint',
    phraseKey: 'delivery.linkPhrase',
  },
  {
    value: 'qr',
    labelKey: 'delivery.qrLabel',
    hintKey: 'delivery.qrHint',
    phraseKey: 'delivery.qrPhrase',
  },
];

/**
 * Los canales **retirados**, que ya no se ofrecen pero siguen en el historial.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  UN CANAL RETIRADO NO SE BORRA DEL PASADO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `app` —«le espera en el portal, ya autenticado»— dejó de ofrecerse cuando se
 * retiró el portal de clientes: sin portal, esa oferta no la recoge nadie. Pero
 * las filas que se crearon con él **son el registro de algo que ocurrió**, y el
 * historial de la ficha las sigue enseñando. Quitar su rótulo no borraría la
 * fila: la dejaría escrita en jerga (`app`) en la pantalla que un empleado lee
 * meses después.
 *
 * Está separado de `DELIVERY_OPTIONS` a propósito. Ésa es la lista de lo que se
 * **puede elegir hoy**, y es la que pinta el formulario; ésta es la de lo que
 * hay que **saber leer**. Juntarlas devolvería el canal al selector.
 */
const RETIRED_PHRASES: Readonly<Record<string, MessageKey>> = {
  app: 'delivery.appPhrase',
};

/**
 * El canal, tal y como se lee en una frase del historial.
 *
 * Devuelve el valor crudo cuando no lo reconoce en vez de inventarse un nombre:
 * una fila con un canal que esta versión no conoce se enseña tal cual, que es
 * información, y no como «Desconocido», que no lo es.
 */
export function deliveryPhrase(t: Translator, value: string): string {
  const option = DELIVERY_OPTIONS.find((entry) => entry.value === value);
  if (option !== undefined) return t(option.phraseKey);
  const retired = RETIRED_PHRASES[value];
  return retired === undefined ? value : t(retired);
}
