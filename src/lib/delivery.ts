import type { MessageKey, Translator } from '@/i18n/translate';

/**
 * Los cuatro canales de entrega, con su nombre y para qué sirve cada uno.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  EL CANAL ES TRANSPORTE, NUNCA AUTORIDAD
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Correo, enlace, QR y «desde nuestra app» entregan **la misma oferta**: la
 * misma URI, la misma firma y el mismo `tx_code`. Elegir canal no cambia lo que
 * la cartera va a comprobar. Lo que cambia es a quién le llega y qué tiene que
 * hacer el agente a continuación, y eso es lo que dicen estos rótulos.
 *
 * Están aquí y no dentro del formulario porque ahora los lee también el
 * historial de la ficha: la pantalla que ofrece «QR» y la que después cuenta
 * «se le ofreció por QR» tienen que llamarlo igual, o el agente creerá que son
 * dos cosas.
 *
 * El rótulo dice **la situación**, no la tecnología. El agente no tiene que
 * saber qué es una oferta pre-autorizada de OID4VCI para acertar.
 */

export type DeliveryChannel = 'qr' | 'link' | 'email' | 'app';

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
   * por Desde nuestra app» no lo escribiría nadie. El diario del banco lo lee
   * un empleado meses después y tiene que sonar al idioma en el que se habla,
   * no a valor de un desplegable — y por eso es una clave aparte y no el mismo
   * rótulo reutilizado: la traducción de un rótulo no encaja en una frase.
   */
  readonly phraseKey: MessageKey;
}

/** Los cuatro, en el orden del artifact. */
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
  {
    value: 'app',
    labelKey: 'delivery.appLabel',
    hintKey: 'delivery.appHint',
    phraseKey: 'delivery.appPhrase',
  },
];

/**
 * El canal, tal y como se lee en una frase del historial.
 *
 * Devuelve el valor crudo cuando no lo reconoce en vez de inventarse un nombre:
 * una fila con un canal que esta versión no conoce se enseña tal cual, que es
 * información, y no como «Desconocido», que no lo es.
 */
export function deliveryPhrase(t: Translator, value: string): string {
  const option = DELIVERY_OPTIONS.find((entry) => entry.value === value);
  return option === undefined ? value : t(option.phraseKey);
}
