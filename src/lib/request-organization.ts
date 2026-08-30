import 'server-only';

import { headers } from 'next/headers';

import {
  findOrganizationByHost,
  getActiveOrganization,
  type OrganizationConfig,
} from './organizations';

/**
 * De qué organización es esta petición.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  UN DESPLIEGUE, TRES DOMINIOS, Y EL DOMINIO ES QUIEN ELIGE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Los tres dominios —`bank.demo-te.com`, `seguros.demo-te.com`,
 * `clinica.demo-te.com`— están declarados en Coolify contra **esta misma
 * aplicación**. Así que la pregunta «¿de quién es esta pantalla?» sólo la puede
 * contestar la petición, y la contesta con lo único que la distingue: su
 * `Host`.
 *
 * Es además la misma respuesta que da `/.well-known/did.json`, y tiene que
 * serlo: el dominio en el que se emite una credencial y el `did:web` con el que
 * se firma son la misma organización o el `iss` no significa nada.
 *
 * ## El respaldo, y por qué no es un respaldo cualquiera
 *
 * Un host que no encaja con ninguna organización cae en `CRM_ACTIVE_ORG_ID`.
 * Eso **no** es «la primera que haya»: es una variable que alguien escribió a
 * propósito, y en producción no se pone. Sin ella y con varias organizaciones
 * declaradas, `getActiveOrganization()` falla y la pantalla dice que esa
 * dirección no corresponde a ninguna organización — que es la verdad, y es
 * mejor que enseñar el padrón del banco a quien llegó por otro sitio.
 *
 * En desarrollo sí se pone, porque `localhost:3000` no es el dominio de nadie.
 *
 * ## Esto no autoriza nada, igual que `session.ts`
 *
 * Elegir organización por `Host` decide **qué se enseña**, no **quién puede
 * verlo**: los tres dominios son públicos y cualquiera puede visitar los tres.
 * Lo único que autoriza una llamada a te-api sigue siendo el token M2M de esa
 * organización (`./b2b-token.ts`), que se pide con su secreto y que Logto se
 * niega a emitir para una organización de la que la aplicación no es miembro.
 * El login de empleado sigue siendo la casilla pendiente de F4a.
 */
export async function getRequestOrganization(): Promise<OrganizationConfig> {
  const organization = findOrganizationByHost(await getRequestHost());
  return organization ?? getActiveOrganization();
}

/**
 * El host de la petición, tal y como llegó.
 *
 * `x-forwarded-host` primero porque delante hay un proxy (Traefik, en Coolify)
 * y es la cabecera que lleva el dominio que tecleó la persona. Se cae a `host`
 * para el `next dev` de local, donde no hay proxy ninguno.
 *
 * **Que las escriba quien llama no es un problema aquí**, y conviene decir por
 * qué en vez de dejarlo a la fe: lo único que se hace con este valor es
 * buscarlo en una lista cerrada de dominios declarados. Falsificarlo lleva como
 * mucho a la consola de otra organización — la misma a la que se llega
 * tecleando su dominio, que es público. Nunca compone un documento DID, nunca
 * compone una URL a la que se llame, y nunca entra en una consulta.
 */
async function getRequestHost(): Promise<string | undefined> {
  const requestHeaders = await headers();
  return requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host') ?? undefined;
}
