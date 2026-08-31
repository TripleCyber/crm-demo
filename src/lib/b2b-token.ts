import 'server-only';

import { getLogtoConfig, type OrganizationConfig } from './organization';

/**
 * El token M2M de organización — lo único que autentica al CRM contra te-api.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  LA REGLA DE F4 §0, QUE ES LA QUE GOBIERNA ESTE FICHERO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * > El login con TripleEnable **no puede ser requisito** para que el backend
 * > del CRM hable con te-api.
 *
 * Aquí no entra ninguna sesión de empleado, ni ninguna cookie, ni ningún token
 * de usuario. La firma de `getB2bToken` recibe una `OrganizationConfig` y nada
 * más, a propósito: si algún día una llamada a te-api necesitara el token del
 * empleado, el compilador no tendría por dónde dárselo. La prueba de auditoría
 * («borra las cookies y la llamada servidor-a-servidor funciona igual») pasa
 * porque no hay nada que borrar.
 *
 * Quién pulsó el botón es *atribución*: viaja en el cuerpo cuando haga falta y
 * no autoriza nada.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POR QUÉ EL `organization_id` VA EN LA PETICIÓN DEL TOKEN
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Es la extensión de Logto al grant `client_credentials`. Pedir un token para
 * una organización de la que la aplicación no es miembro no devuelve un token
 * con otro claim: devuelve `access_denied`, «app has not associated with the
 * organization». Por eso te-api saca la organización del token y no del cuerpo,
 * y por eso este CRM no puede emitir en nombre de otro banco ni queriendo.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POR QUÉ SE CACHEA
 * ─────────────────────────────────────────────────────────────────────────
 *
 * El token dura una hora. Pedir uno por emisión convierte cada botón en dos
 * viajes de red, uno de ellos a Logto, que es el que no hace falta. Se renueva
 * antes de caducar (`REFRESH_MARGIN_MS`) para que ninguna emisión salga con un
 * token que caduca en vuelo.
 */

interface CachedToken {
  readonly token: string;
  /** Momento a partir del cual se pide uno nuevo. Ya lleva el margen restado. */
  readonly refreshAtMs: number;
}

/**
 * Un minuto de margen. Cubre el desfase de reloj entre este servidor y Logto y
 * el viaje de la petición a te-api: un token que caduca mientras va por el
 * cable sale como el mismo 404 opaco de la puerta B2B, y diagnosticarlo cuesta
 * una tarde.
 */
const REFRESH_MARGIN_MS = 60_000;

/** Cache por organización. La clave es el `orgId`, nunca el `client_id`. */
const tokenCache = new Map<string, CachedToken>();

/**
 * Peticiones en vuelo, también por organización.
 *
 * Sin esto, dos emisiones simultáneas tras un reinicio piden dos tokens a la
 * vez y uno de los dos sobra. No es un problema de corrección —Logto emite los
 * que le pidas— pero sí de ruido en el registro de auditoría de Logto, que es
 * donde se mira cuando algo va mal.
 */
const inFlight = new Map<string, Promise<string>>();

export class B2bTokenError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'B2bTokenError';
  }
}

export async function getB2bToken(organization: OrganizationConfig): Promise<string> {
  const cached = tokenCache.get(organization.orgId);
  if (cached !== undefined && Date.now() < cached.refreshAtMs) {
    return cached.token;
  }

  const pending = inFlight.get(organization.orgId);
  if (pending !== undefined) return pending;

  const request = requestToken(organization).finally(() => {
    inFlight.delete(organization.orgId);
  });
  inFlight.set(organization.orgId, request);
  return request;
}

/** Tira el token cacheado. Se llama cuando te-api responde 401. */
export function invalidateB2bToken(orgId: string): void {
  tokenCache.delete(orgId);
}

async function requestToken(organization: OrganizationConfig): Promise<string> {
  const logto = getLogtoConfig();

  // `client_secret_basic`: las credenciales van en la cabecera y no en el
  // cuerpo, que es lo que evita que aparezcan en un volcado del cuerpo si
  // alguien depura la petición.
  const authorization = Buffer.from(
    `${encodeURIComponent(organization.m2mClientId)}:${encodeURIComponent(organization.m2mSecret)}`,
  ).toString('base64');

  const response = await fetch(`${logto.endpoint}/oidc/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${authorization}`,
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      // El recurso B2B, distinto del recurso de la cartera. Sin él Logto
      // devuelve un token OPACO, que te-api no puede verificar y que sale como
      // el 404 de la puerta.
      resource: logto.b2bResource,
      organization_id: organization.orgId,
      scope: logto.b2bScope,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    // El cuerpo de Logto va al LOG y no al mensaje del error.
    //
    // No es celo de más: `error_description` incluye el `client_id` que se
    // intentó usar, y el mensaje de un `B2bTokenError` acaba pintado en la
    // ficha del cliente, que es una pantalla de mostrador. El detalle lo
    // necesita quien opera, no el agente que tiene delante a un titular. Se
    // recorta además porque un error largo llena el log sin añadir nada.
    const body = await response.text();
    console.error('[crm] Logto rechazó el token M2M', {
      orgId: organization.orgId,
      status: response.status,
      body: body.slice(0, 300),
    });
    throw new B2bTokenError(
      `Logto rejected the M2M token for ${organization.orgId} (${response.status}); ` +
        'the reason is in the server log.',
      response.status,
    );
  }

  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    token_type?: string;
  };

  if (typeof payload.access_token !== 'string' || payload.access_token === '') {
    throw new B2bTokenError(
      `Logto returned a response with no access_token for ${organization.orgId}`,
    );
  }

  // Si Logto no dijera cuánto dura, se asume una hora, que es lo que dura hoy.
  // Nunca «para siempre»: un token cacheado sin caducidad sobrevive a la
  // rotación del secreto y el fallo aparece al reiniciar, días después.
  const expiresInSeconds = typeof payload.expires_in === 'number' ? payload.expires_in : 3600;
  const lifetimeMs = expiresInSeconds * 1000;
  const refreshAtMs =
    Date.now() + (lifetimeMs > REFRESH_MARGIN_MS ? lifetimeMs - REFRESH_MARGIN_MS : lifetimeMs / 2);

  tokenCache.set(organization.orgId, { token: payload.access_token, refreshAtMs });
  return payload.access_token;
}
