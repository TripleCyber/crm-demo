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
  readonly label: string;
  /** A quién llega y qué hace falta. Es lo que de verdad decide cuál se elige. */
  readonly hint: string;
  /**
   * Cómo se lee el canal **dentro de una frase** del historial.
   *
   * Hace falta porque el rótulo del selector no encaja en prosa: «se le ofreció
   * por Desde nuestra app» no lo escribiría nadie. El diario del banco lo lee
   * un empleado meses después y tiene que sonar a español, no a valor de un
   * desplegable.
   */
  readonly phrase: string;
}

/** Los cuatro, en el orden del artifact. */
export const DELIVERY_OPTIONS: readonly DeliveryOption[] = [
  {
    value: 'email',
    label: 'Correo',
    hint: 'Al correo de la ficha, desde tu propio buzón',
    phrase: 'por correo',
  },
  {
    value: 'link',
    label: 'Enlace',
    hint: 'Lo copias y lo pegas donde haga falta',
    phrase: 'por enlace',
  },
  {
    value: 'qr',
    label: 'QR',
    hint: 'El cliente está delante y lo escanea de esta pantalla',
    phrase: 'por QR',
  },
  {
    value: 'app',
    label: 'Desde nuestra app',
    hint: 'Le espera en el portal, ya autenticado',
    phrase: 'en su área de cliente',
  },
];

/**
 * El canal, tal y como se lee en una frase del historial.
 *
 * Devuelve el valor crudo cuando no lo reconoce en vez de inventarse un nombre:
 * una fila con un canal que esta versión no conoce se enseña tal cual, que es
 * información, y no como «Desconocido», que no lo es.
 */
export function deliveryPhrase(value: string): string {
  return DELIVERY_OPTIONS.find((option) => option.value === value)?.phrase ?? value;
}
