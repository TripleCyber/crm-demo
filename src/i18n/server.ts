import 'server-only';

import { cookies, headers } from 'next/headers';

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isLocale,
  negotiateLocale,
  type Locale,
} from './config';
import { createTranslator, type Translator } from './translate';

/**
 * El idioma de **esta petición**, y el traductor que sale de él.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  TRES FUENTES, EN ESTE ORDEN, Y NINGUNA ES EL DOMINIO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 1. **La cookie**, que es una elección explícita de quien mira la pantalla.
 *    Manda sobre todo lo demás: alguien que pulsa «Español» en un navegador en
 *    inglés está diciendo justamente eso.
 * 2. **`Accept-Language`**, para la primera visita. Es lo que el navegador
 *    declara, no una suposición nuestra.
 * 3. **Inglés**, que es el idioma del catálogo.
 *
 * Ni el dominio ni el entorno entran: aquéllos dicen de quién es esta consola
 * (`lib/organization.ts`), y esto en qué idioma la lee quien la tiene delante.
 * Son dos preguntas distintas y tienen dos respuestas distintas.
 *
 * Es `server-only` porque lee cookies y cabeceras. Los componentes de navegador
 * reciben el idioma por contexto (`./client.tsx`) y no vuelven a resolverlo:
 * dos resoluciones del mismo idioma podrían discrepar, y entonces el servidor
 * pintaría una frase y el navegador la sustituiría por otra al hidratar.
 */
export async function getLocale(): Promise<Locale> {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;

  return negotiateLocale((await headers()).get('accept-language')) ?? DEFAULT_LOCALE;
}

export async function getTranslator(): Promise<Translator> {
  return createTranslator(await getLocale());
}
