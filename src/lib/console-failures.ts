import 'server-only';

import type { Translator } from '@/i18n/translate';

import { OrganizationConfigError } from './organizations';

/**
 * Lo que se le dice a un agente cuando una pantalla no ha podido cargar.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  EL MENSAJE DE UN ERROR NO ES LENGUAJE DE UNA CONSOLA DE ATENCIÓN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Las tres pantallas de atención enseñaban `error.message` tal cual, y el
 * comentario que lo justificaba decía que «nombra la variable o la tabla que
 * falta y no lleva ningún secreto». Lo segundo es verdad y lo primero es el
 * problema: `falta la variable de entorno CRM_ORG_SEGUROS_M2M_SECRET` y
 * `relation "customer" does not exist` son las dos frases correctas para quien
 * despliega y las dos inútiles para quien tiene un cliente al teléfono. No
 * puede hacer nada con ninguna, y las dos le dicen que la herramienta que está
 * usando delante del cliente está rota.
 *
 * Así que aquí se traduce a lo que sí puede hacer —esperar, o avisar a quien
 * lleva la integración— y **el detalle entero se conserva**: va al registro del
 * servidor y a Diagnóstico, que es la pantalla de quien puede arreglarlo. No se
 * pierde nada; cambia quién lo lee.
 *
 * Se distinguen dos casos porque son dos personas distintas las que tienen que
 * enterarse, y es la misma razón por la que `describeTeApiError` distingue el
 * 403 del vínculo del 403 de la presentación.
 */
export function describeConsoleFailure(t: Translator, error: unknown, context: string): string {
  logConsoleFailure(error, context);

  return t(error instanceof OrganizationConfigError ? 'errors.misconfigured' : 'errors.generic');
}

/**
 * Sólo el registro, sin frase.
 *
 * Para las pantallas que ya llevan su propio prefijo —«No se ha podido
 * consultar TripleEnable: …»— y donde la frase genérica de arriba quedaría
 * pegada detrás diciendo lo mismo dos veces. El detalle tiene que ir al log
 * igual, y ésa es la mitad que no se puede saltar.
 */
export function logConsoleFailure(error: unknown, context: string): void {
  // El detalle completo, con su contexto, al registro del servidor. Es lo que
  // busca quien depura, y no cuesta nada dejarlo escrito.
  console.error(`[crm] ${context}`, error);
}
