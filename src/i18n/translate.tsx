import { Fragment, type ReactNode } from 'react';

import { DEFAULT_LOCALE, type Locale } from './config';
import { en, type Messages } from './messages/en';
import { es } from './messages/es';

/**
 * **El traductor.** Cuarenta líneas de mecanismo y ninguna dependencia nueva.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  POR QUÉ NO HAY AQUÍ UNA LIBRERÍA DE i18n
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Las de Next —`next-intl` y compañía— resuelven el idioma **por la ruta**
 * (`/en/customers`) o con un `middleware` que la reescribe. Este producto no
 * puede pagar eso: sus direcciones son públicas y estables —el enlace de una
 * verificación se pega en un chat, y `/.well-known/did.json` tiene que
 * responder en la raíz o la cartera no resuelve el `did:web`—. Meter un
 * segmento delante las cambia todas, y eso es cambiar comportamiento para ganar
 * un desplegable.
 *
 * Lo que hacía falta cabía aquí: dos idiomas, respaldo al inglés, y cambio en
 * caliente sin reconstruir. Traer una dependencia para eso habría sido traer
 * también su modelo de enrutado.
 *
 * ## Las tres propiedades que sostiene este fichero
 *
 * 1. **Una clave que no existe no compila.** `MessageKey` sale del catálogo
 *    inglés, así que `t('customers.titulo')` es un error de tipo y no una
 *    sorpresa en pantalla.
 * 2. **Una clave sin traducir cae al inglés.** No revienta, y sobre todo **no
 *    pinta el nombre de la clave**: si ni siquiera el inglés la tuviera —cosa
 *    que el tipo impide— saldría vacío, que es feo pero no es un mensaje de
 *    error dirigido a un cliente.
 * 3. **Cambiar de idioma no reconstruye nada.** Los dos catálogos están en el
 *    paquete; lo único que cambia en caliente es qué `locale` se lee.
 */

/**
 * Las claves como camino con puntos: `'customers.title'`.
 *
 * Se deriva del catálogo inglés, que es el original. Un idioma que declare una
 * clave que allí no existe **no compila** (ver `PartialMessages`), que es cómo
 * se evita la traducción huérfana de una pantalla que ya no está.
 */
type MessagePaths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${MessagePaths<T[K]>}`;
}[keyof T & string];

export type MessageKey = MessagePaths<Messages>;

/**
 * Un catálogo traducido: la misma forma, con todo opcional.
 *
 * Opcional **por rama**, no sólo por hoja: un idioma puede traducir una sección
 * entera y dejar otra sin empezar, y las que falten salen en inglés.
 */
export type PartialMessages<T = Messages> = {
  [K in keyof T]?: T[K] extends string ? string : PartialMessages<T[K]>;
};

/** Los huecos `{nombre}` de un mensaje. */
export type MessageValues = Readonly<Record<string, string | number>>;

const CATALOGUES: Record<Locale, PartialMessages> = { en, es };

/**
 * Baja por el camino de puntos. `undefined` si se acaba antes o si lo que hay
 * al final no es una cadena —una rama entera no se puede pintar—.
 */
function lookup(catalogue: PartialMessages, key: string): string | undefined {
  let current: unknown = catalogue;
  for (const segment of key.split('.')) {
    if (typeof current !== 'object' || current === null) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === 'string' ? current : undefined;
}

/**
 * Rellena los huecos.
 *
 * Un hueco sin valor **se deja tal cual** en vez de quedarse vacío: `{name}` en
 * pantalla es un fallo que se ve y se corrige, y un hueco borrado produce una
 * frase que parece correcta y le falta el dato.
 */
function interpolate(template: string, values: MessageValues | undefined): string {
  if (values === undefined) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in values ? String(values[name]) : whole,
  );
}

/**
 * Las cuatro marcas de `t.rich()`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  NO ES HTML, Y NO PUEDE SERLO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Lo que sale de aquí son elementos de React construidos a mano; el texto del
 * catálogo **nunca** se inyecta como HTML. Un catálogo es un fichero que se
 * edita para traducir, y un `dangerouslySetInnerHTML` alimentado desde ahí es
 * una inyección esperando a que alguien pegue algo raro.
 *
 * Cuatro y no más porque cuatro es lo que hace falta: negrita, cursiva,
 * monoespaciada y **un** enlace por frase (su `href` lo pone quien llama, en
 * `values.href`, porque una dirección no se traduce).
 */
const RICH_PATTERN = /<(b|i|code|a)>([\s\S]*?)<\/\1>/g;

function renderRich(text: string, values: MessageValues | undefined): ReactNode {
  const parts: ReactNode[] = [];
  let cursor = 0;

  for (const match of text.matchAll(RICH_PATTERN)) {
    const [whole, tag, inner = ''] = match;
    const at = match.index;
    if (at > cursor) parts.push(text.slice(cursor, at));

    const key = `${tag}-${at}`;
    if (tag === 'b') parts.push(<strong key={key}>{inner}</strong>);
    else if (tag === 'i') parts.push(<em key={key}>{inner}</em>);
    else if (tag === 'code') parts.push(<span key={key} className="mono">{inner}</span>);
    else {
      // Sin `href` el enlace no se pinta como enlace: se queda el texto. Un
      // `<a>` sin destino es un elemento que se puede enfocar y no hace nada.
      const href = values?.href;
      parts.push(
        typeof href === 'string' ? (
          <a key={key} href={href}>
            {inner}
          </a>
        ) : (
          <Fragment key={key}>{inner}</Fragment>
        ),
      );
    }

    cursor = at + whole.length;
  }

  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

export interface Translator {
  /** El mensaje ya interpolado. */
  (key: MessageKey, values?: MessageValues): string;
  /** El idioma activo. Lo necesitan las fechas (`lib/format.ts`). */
  readonly locale: Locale;
  /** El mensaje con sus marcas convertidas en elementos. Ver `renderRich`. */
  readonly rich: (key: MessageKey, values?: MessageValues) => ReactNode;
  /**
   * Una clave **compuesta en tiempo de ejecución**, que por definición no puede
   * estar en el tipo.
   *
   * Existe por un solo caso y no debería tener más: los rótulos de los tipos de
   * credencial se buscan por el `type_key` que declara el padrón de te-api
   * (`credentialTypes.<type_key>`), y ese valor lo elige el partner. Devuelve
   * `undefined` cuando no está, para que quien llama pueda caer a su propio
   * respaldo — ver `resolveCredentialType`.
   */
  readonly optional: (key: string, values?: MessageValues) => string | undefined;
}

/**
 * Un traductor para un idioma. Es barato: no lee ficheros, no toca red y no
 * guarda estado. Se puede crear una vez por petición sin pensarlo.
 */
export function createTranslator(locale: Locale): Translator {
  const primary = CATALOGUES[locale];
  const fallback = CATALOGUES[DEFAULT_LOCALE];

  const resolve = (key: string): string | undefined =>
    lookup(primary, key) ?? lookup(fallback, key);

  const translate = ((key: MessageKey, values?: MessageValues): string =>
    interpolate(resolve(key) ?? '', values)) as {
    (key: MessageKey, values?: MessageValues): string;
    locale: Locale;
    rich: Translator['rich'];
    optional: Translator['optional'];
  };

  translate.locale = locale;
  translate.rich = (key, values) => renderRich(interpolate(resolve(key) ?? '', values), values);
  translate.optional = (key, values) => {
    const raw = resolve(key);
    return raw === undefined ? undefined : interpolate(raw, values);
  };

  return translate;
}
