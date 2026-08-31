import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

import {
  getLogtoConfig,
  type OrganizationConfig,
  type PortalAppConfig,
} from './organizations';

/**
 * El login OIDC del **portal de clientes** — el paso del que nace el vínculo.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  POR QUÉ ESTE LOGIN EXISTE, QUE NO ES «PARA QUE EL PORTAL TENGA USUARIOS»
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `POST /v1/b2b/links` de te-api no acepta que el banco **declare** a quién
 * vincula: exige que lo **demuestre**, presentando el ID token que recibió al
 * autenticar a esa persona. Sin este login no hay ID token, y sin ID token no
 * hay vínculo — la ruta contesta `cannot_complete` y no llega a mirar el
 * cuerpo. Todo lo de este fichero existe para producir ese ID token.
 *
 * Y por eso el `aud` importa tanto: te-api compara el `aud` del ID token con
 * `te.partner_org.portal_client_id`, que es el `client_id` de **esta**
 * aplicación. Un ID token emitido para el portal de otro banco no vincula aquí.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * FLUJO DE CÓDIGO, CON SECRETO Y CON PKCE
 * ─────────────────────────────────────────────────────────────────────────
 *
 * La aplicación es *traditional web* en Logto: el canje del código ocurre en
 * **este** servidor con `client_secret_basic`, y el secreto no sale de aquí. Se
 * añade PKCE encima aunque un cliente confidencial no lo necesite en teoría:
 * cuesta tres líneas y cierra el robo del código en el salto del navegador, que
 * es donde el código viaja por una URL y acaba en historiales y registros.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POR QUÉ SE VERIFICA LA FIRMA AQUÍ TAMBIÉN
 * ─────────────────────────────────────────────────────────────────────────
 *
 * OIDC Core §3.1.3.7 permite saltársela cuando el token llega por el canal
 * directo con el *token endpoint*, que es este caso. Se verifica igual porque
 * de este ID token sale **qué cliente del banco se va a vincular**: el portal
 * cruza su `email` contra su propio padrón. Leer claims sin comprobar la firma
 * para tomar esa decisión es exactamente la clase de atajo que funciona hasta
 * que alguien mete un token por otro camino. Y el `nonce` no se puede
 * comprobar sin leer el cuerpo de todas formas.
 */

/** Lo que el portal necesita saber de quien acaba de entrar. */
export interface PortalIdentity {
  /** `sub` = el `logto_user_id`. Es lo que te-api resuelve a un perfil. */
  readonly logtoUserId: string;
  /** Verificado por Logto. Es la clave con la que el banco busca en su padrón. */
  readonly email: string | null;
  readonly name: string | null;
  /** El ID token **en crudo**: es lo que viaja a `POST /v1/b2b/links`. */
  readonly idToken: string;
}

/** El material efímero de una petición de autorización. Vive en una cookie. */
export interface AuthorizationRequest {
  readonly state: string;
  readonly nonce: string;
  readonly codeVerifier: string;
}

const ALGORITHMS = ['ES384', 'ES256', 'RS256', 'PS256', 'EdDSA'] as const;

/** `https://auth.idp.tripleenable.com/oidc` — el `iss` que firma Logto. */
function issuer(): string {
  return `${getLogtoConfig().endpoint}/oidc`;
}

/**
 * El juego de claves, cacheado por proceso.
 *
 * Sin caché, cada login descarga el JWKS de Logto. Con `next dev` eso no se
 * nota; con varias personas entrando a la vez, el portal se vuelve un
 * amplificador contra el propio Logto.
 */
let jwksCache: ReturnType<typeof createRemoteJWKSet> | undefined;

function getJwks(): ReturnType<typeof createRemoteJWKSet> {
  jwksCache ??= createRemoteJWKSet(new URL(`${issuer()}/jwks`), {
    cooldownDuration: 30_000,
    cacheMaxAge: 600_000,
    timeoutDuration: 3_000,
  });
  return jwksCache;
}

/**
 * La URL pública del portal **de esta organización**. De ella sale el
 * `redirect_uri`.
 *
 * Es por organización y no global desde que un despliegue sirve tres dominios:
 * cada organización tiene su propia aplicación en Logto con su propio
 * `redirect_uri` declarado, y una URL global mandaría al titular de Seguros
 * Aurora a `bank.demo-te.com` — donde su cookie no existe y donde el vínculo se
 * pediría contra el padrón del banco.
 *
 * `CRM_PORTAL_BASE_URL` sigue siendo el respaldo, y sigue siendo lo que se usa
 * en local: ahí las tres viven en `http://localhost:3000` y no hay nada que
 * separar.
 */
export function getPortalBaseUrl(organization: OrganizationConfig): string {
  const raw = organization.portalBaseUrl ?? process.env.CRM_PORTAL_BASE_URL?.trim();
  if (raw === undefined || raw === '') {
    throw new Error(
      'the portal does not know its own address: CRM_ORG_<SLUG>_PORTAL_BASE_URL is missing ' +
        '(or CRM_PORTAL_BASE_URL for all of them)',
    );
  }
  return raw.replace(/\/+$/, '');
}

/**
 * El `redirect_uri`, en una sola función.
 *
 * Se compone aquí y no en cada sitio porque tiene que ser **el mismo texto** en
 * la petición de autorización y en el canje del código: Logto los compara
 * carácter a carácter, y además tiene que estar declarado igual en la consola.
 * Tres copias de una cadena que tiene que coincidir tres veces es una errata
 * esperando a ocurrir, y el error que produce (`invalid_grant`) no la nombra.
 */
export function getRedirectUri(organization: OrganizationConfig): string {
  return `${getPortalBaseUrl(organization)}/portal/callback`;
}

function base64url(input: Buffer): string {
  return input.toString('base64url');
}

/** Material nuevo para un login. Nada de esto se reutiliza entre intentos. */
export function newAuthorizationRequest(): AuthorizationRequest {
  return {
    state: base64url(randomBytes(24)),
    nonce: base64url(randomBytes(24)),
    codeVerifier: base64url(randomBytes(32)),
  };
}

/**
 * A dónde se manda el navegador para que la persona se autentique.
 *
 * Lleva la organización además de su aplicación de portal porque el
 * `redirect_uri` es **suyo**: cada una tiene su dominio y su aplicación en
 * Logto, y el que se manda aquí tiene que ser el mismo que el declarado allí y
 * el mismo que se manda al canjear el código.
 */
export function buildAuthorizationUrl(
  organization: OrganizationConfig,
  portal: PortalAppConfig,
  request: AuthorizationRequest,
): string {
  const challenge = base64url(createHash('sha256').update(request.codeVerifier).digest());
  const url = new URL(`${issuer()}/auth`);
  url.searchParams.set('client_id', portal.clientId);
  url.searchParams.set('redirect_uri', getRedirectUri(organization));
  url.searchParams.set('response_type', 'code');
  // `email` porque es con lo que el banco encuentra la ficha del titular en SU
  // padrón; `profile` sólo para poder saludarle por su nombre. Ni un scope más:
  // lo que se pide en un consentimiento queda pedido para siempre.
  url.searchParams.set('scope', 'openid profile email');
  url.searchParams.set('state', request.state);
  url.searchParams.set('nonce', request.nonce);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

/** El portal cierra la sesión también en Logto, no sólo su propia cookie. */
export function buildEndSessionUrl(
  organization: OrganizationConfig,
  idTokenHint?: string,
): string {
  const url = new URL(`${issuer()}/session/end`);
  url.searchParams.set('post_logout_redirect_uri', `${getPortalBaseUrl(organization)}/portal`);
  if (idTokenHint !== undefined) url.searchParams.set('id_token_hint', idTokenHint);
  return url.toString();
}

/** Logto contestó al canje con algo que no es un ID token utilizable. */
export class PortalLoginError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PortalLoginError';
  }
}

/**
 * Canjea el código y devuelve la identidad probada.
 *
 * El `code_verifier` y el `nonce` vienen de la cookie que puso `/portal/login`,
 * no de la URL de vuelta: comprobar el `nonce` contra un valor que llega en la
 * misma respuesta que se está comprobando no comprueba nada.
 */
export async function exchangeCode(
  organization: OrganizationConfig,
  portal: PortalAppConfig,
  code: string,
  request: AuthorizationRequest,
): Promise<PortalIdentity> {
  // `client_secret_basic`: el secreto va en la cabecera y no en el cuerpo, para
  // que no aparezca en un volcado si alguien depura la petición.
  const authorization = Buffer.from(
    `${encodeURIComponent(portal.clientId)}:${encodeURIComponent(portal.clientSecret)}`,
  ).toString('base64');

  const response = await fetch(`${issuer()}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${authorization}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: getRedirectUri(organization),
      code_verifier: request.codeVerifier,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    // El cuerpo de Logto va al log y no a la pantalla: `error_description`
    // nombra el `client_id` que se intentó usar, y la pantalla del portal la
    // está mirando un titular.
    const body = await response.text();
    console.error('[portal] Logto rechazó el canje del código', {
      status: response.status,
      body: body.slice(0, 300),
    });
    throw new PortalLoginError(
      `Logto rejected the code exchange (${response.status}); the reason is in the log.`,
    );
  }

  const payload = (await response.json()) as {
    id_token?: unknown;
    access_token?: unknown;
  };

  if (typeof payload.id_token !== 'string' || payload.id_token === '') {
    throw new PortalLoginError('Logto returned no ID token: check the `openid` scope');
  }

  let claims: JWTPayload;
  try {
    const result = await jwtVerify(payload.id_token, getJwks(), {
      issuer: issuer(),
      audience: portal.clientId,
      algorithms: [...ALGORITHMS],
      clockTolerance: 30,
    });
    claims = result.payload;
  } catch (error) {
    throw new PortalLoginError(
      `el ID token de Logto no verifica: ${error instanceof Error ? error.message : 'desconocido'}`,
    );
  }

  // El `nonce` ata este ID token a **esta** petición de autorización. Sin él,
  // un ID token robado de otra sesión se podría inyectar en el callback.
  if (claims['nonce'] !== request.nonce) {
    throw new PortalLoginError('the ID token `nonce` is not the one for this request');
  }

  const sub = claims['sub'];
  if (typeof sub !== 'string' || sub === '') {
    throw new PortalLoginError('el ID token no trae `sub`');
  }

  let email = typeof claims['email'] === 'string' ? claims['email'] : null;
  const name = typeof claims['name'] === 'string' ? claims['name'] : null;

  // Logto no siempre mete los claims de perfil en el ID token —depende de la
  // configuración del inquilino—, así que si falta el correo se pide a
  // `userinfo` con el access token. Sin correo el portal no sabría qué ficha de
  // su padrón es la de esta persona, y prefiero un salto de red más a una
  // pantalla que dice «no te encuentro» por una razón de configuración.
  if (email === null && typeof payload.access_token === 'string') {
    email = await fetchEmailFromUserinfo(payload.access_token);
  }

  return { logtoUserId: sub, email, name, idToken: payload.id_token };
}

async function fetchEmailFromUserinfo(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch(`${issuer()}/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { email?: unknown };
    return typeof body.email === 'string' ? body.email : null;
  } catch (error) {
    // Que falle `userinfo` no puede tumbar un login que ya está probado: el ID
    // token verificó, la persona entró. Lo único que se pierde es el atajo para
    // encontrar su ficha, y eso la pantalla lo sabe decir.
    console.error('[portal] userinfo no respondió', error);
    return null;
  }
}
