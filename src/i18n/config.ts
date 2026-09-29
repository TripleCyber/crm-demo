/**
 * Los idiomas de la consola, y **cómo se elige uno**.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  EL IDIOMA NO CUELGA NI DEL DOMINIO NI DEL ENTORNO, Y ESO ES DELIBERADO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **El dominio es la identidad de la organización** (`src/lib/organization.ts`):
 * de `CRM_ORG_DOMAIN` sale el `did:web` que se publica. Colgar de ahí también el
 * idioma obligaría a un dominio por idioma.
 *
 * Y tampoco es una variable de entorno, que sería lo fácil ahora que hay una
 * instalación por empresa: eso ataría el idioma de un empleado a la entidad para
 * la que trabaja, y en un mostrador se sientan personas distintas. Lo que de
 * verdad varía es **quién mira la pantalla**, no de quién es.
 *
 * Tampoco va en la ruta (`/en/customers`). Meter un segmento de idioma delante
 * cambiaría **todas** las direcciones del producto: los enlaces que un agente
 * pega en un chat para pasar una verificación a un compañero, y
 * `/.well-known/did.json`, que tiene que responder en la raíz del dominio o la
 * cartera no resuelve el DID.
 *
 * Así que el idioma va en **una cookie**, la elige quien mira la pantalla, y se
 * cambia en caliente: no hay que reconstruir la imagen ni tocar el entorno.
 * Sin cookie se negocia con la cabecera `Accept-Language` del navegador, y si
 * tampoco dice nada se queda el inglés.
 */

/** Los idiomas que existen. El primero es el de por defecto. */
export const LOCALES = ['en', 'es'] as const;

export type Locale = (typeof LOCALES)[number];

/**
 * **Inglés.** Es el idioma en el que está escrito el catálogo de mensajes, así
 * que es también el respaldo de cualquier clave que a otro idioma le falte:
 * una traducción incompleta enseña inglés, nunca el nombre de la clave.
 */
export const DEFAULT_LOCALE: Locale = 'en';

/**
 * La cookie que guarda la elección.
 *
 * Nombre propio y no `NEXT_LOCALE`: aquél lo mira el enrutado por idioma de
 * Next, que este proyecto no usa, y compartir el nombre invitaría a que un día
 * alguien encienda aquello y las dos cosas se peleen por la misma cookie.
 */
export const LOCALE_COOKIE = 'crm_locale';

/** Un año. La elección de idioma no caduca sola: no es una sesión. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * La etiqueta BCP 47 con la que se formatean fechas y horas.
 *
 * Es distinta del código del idioma porque las fechas no dependen sólo de la
 * lengua: `en-GB` escribe `12 Mar 2024` y `en-US` escribe `Mar 12, 2024`. Este
 * producto es europeo y sus tres organizaciones son españolas, así que el
 * inglés que se enseña es el británico — el día antes que el mes, como el resto
 * de la pantalla.
 */
export const LOCALE_TAGS: Record<Locale, string> = {
  en: 'en-GB',
  es: 'es-ES',
};

/**
 * Cómo se llama cada idioma **en ese idioma**.
 *
 * «Español» y no «Spanish»: quien busca su idioma en un selector lo busca
 * escrito como lo escribiría él, que es justo el caso de quien no entiende el
 * que está viendo.
 */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * El idioma que pide el navegador, si es uno de los nuestros.
 *
 * Se lee `Accept-Language` a mano en vez de traer una librería de negociación:
 * con dos idiomas, la lista ordenada por `q` se resuelve recorriéndola y
 * quedándose con el primero que reconocemos. Se compara sólo la parte de la
 * lengua (`es-419` → `es`) porque las variantes regionales de un mismo idioma
 * comparten catálogo.
 */
export function negotiateLocale(acceptLanguage: string | null): Locale | undefined {
  if (acceptLanguage === null) return undefined;

  const ranked = acceptLanguage
    .split(',')
    .map((entry) => {
      const [tag = '', ...parameters] = entry.trim().split(';');
      const quality = parameters
        .map((parameter) => /^\s*q=([0-9.]+)\s*$/.exec(parameter))
        .find((match) => match !== null)?.[1];
      return { language: tag.trim().toLowerCase().split('-')[0] ?? '', quality: Number(quality ?? '1') };
    })
    // `q=0` significa «este idioma no, explícitamente». Se descarta en vez de
    // ordenarlo el último, o un `es;q=0` acabaría eligiendo español.
    .filter((entry) => entry.language !== '' && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality);

  return ranked.map((entry) => entry.language).find(isLocale);
}
