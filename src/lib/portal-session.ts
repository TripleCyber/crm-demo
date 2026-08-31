import 'server-only';

import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';

import type { MessageKey, MessageValues } from '@/i18n/translate';

import type { AuthorizationRequest } from './portal-oidc';
import { loadTenantSettings } from './tenant-settings';

/**
 * Las dos cookies del portal del cliente, y **lo que deliberadamente no
 * guardan**.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  EL ID TOKEN NO SE GUARDA EN NINGUNA DE LAS DOS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * El vínculo se pide **en el callback**, con el ID token todavía en la mano y
 * sin que llegue a tocar disco ni cookie. Hay dos razones y las dos mandan:
 *
 *  1. **te-api sólo acepta ID tokens recientes.** `src/b2b/portal-id-token.ts`
 *     impone una ventana de cinco minutos sobre el `iat`, y a propósito: un ID
 *     token viejo que sigue vinculando es un ID token filtrado que sigue
 *     vinculando. Guardarlo para usarlo «cuando el titular pulse el botón»
 *     produciría un fallo intermitente que parece de red.
 *  2. **Un ID token guardado es un ID token que se puede robar.** Es la prueba
 *     entera del vínculo: quien lo tenga puede atar a esa persona a un cliente
 *     de esta organización. No hay ninguna razón para que sobreviva al segundo
 *     en que se usa.
 *
 * Lo que sí sobrevive es **el resultado**: qué cliente se vinculó y con qué
 * `linkId`. Eso no es canjeable por nada.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POR QUÉ UN JWT FIRMADO Y NO UNA COOKIE DE SESIÓN EN MEMORIA
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Porque `next dev` recarga el módulo en cada cambio y una tabla en memoria se
 * vacía a mitad del login, que es el momento en el que menos se entiende. Un
 * JWT firmado con `CRM_PORTAL_COOKIE_SECRET` sobrevive a la recarga y no
 * necesita almacén. El contenido no es secreto —el titular puede leer su propio
 * `sub`—; lo que hace falta es que **no lo pueda inventar**, y eso lo da la
 * firma.
 */

const AUTH_COOKIE = 'bd_portal_auth';
const SESSION_COOKIE = 'bd_portal_session';

/**
 * Diez minutos para completar un login. Cubre de sobra leer un OTP del correo
 * y no deja una petición de autorización viva toda la tarde.
 */
const AUTH_TTL_SECONDS = 600;

/** Ocho horas de sesión del portal. Es una pantalla de consulta, no un banco. */
const SESSION_TTL_SECONDS = 8 * 3600;

/**
 * La clave con la que se firma la cookie.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  YA NO LA ESCRIBE NADIE: SE GENERA AL SEMBRAR LA CONFIGURACIÓN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Salía de `CRM_PORTAL_COOKIE_SECRET`, y era una de las variables que había que
 * inventar a mano para levantar una instalación. Pedirle a quien despliega que
 * teclee 32 caracteres aleatorios es pedirle que ponga `changeme`, y una sesión
 * de portal firmada con `changeme` la escribe cualquiera.
 *
 * Ahora vive en la fila de configuración y **se genera con `randomBytes(32)` la
 * primera vez** (`./tenant-settings.ts`). La variable sigue valiendo como
 * semilla, así que un despliegue que ya la tenía conserva la suya y sus sesiones
 * abiertas siguen valiendo.
 *
 * Sigue lanzando cuando no hay: sin clave no se puede firmar, y firmar con una
 * cadena vacía es no firmar. Lo que ya no puede pasar es que falte por descuido.
 */
async function secret(): Promise<Uint8Array> {
  const raw = (await loadTenantSettings()).portalCookieSecret;
  if (raw === undefined || raw.length < 32) {
    throw new Error(
      'the portal cookie signing key is missing (32 characters or more): without it the portal ' +
        'session cannot be signed, and an unsigned session can be written by anybody',
    );
  }
  return new TextEncoder().encode(raw);
}

/**
 * El resultado del vínculo, tal y como lo enseña la pantalla del portal.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  EL FALLO SE GUARDA COMO CLAVE, NO COMO FRASE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Esto vive dentro de la cookie de sesión y se pinta en la petición siguiente,
 * o en la de mañana. Una frase ya escrita se quedaría en el idioma que hubiera
 * activo en el instante del fallo: el titular cambia a inglés, la pantalla
 * entera cambia, y el único aviso que importa sigue en castellano. Se guarda
 * qué pasó —`messageKey` y sus valores— y se escribe al pintarlo.
 */
export interface LinkOutcome {
  readonly ok: boolean;
  /** El `linkId` que devolvió te-api. Sólo cuando `ok`. */
  readonly linkId?: string;
  /** `true` si este vínculo sustituyó a otro que había. */
  readonly replaced?: boolean;
  /** Qué falló, como clave del catálogo. Sólo cuando `!ok`. */
  readonly messageKey?: MessageKey;
  /** Los huecos de esa clave, si los lleva. */
  readonly messageValues?: MessageValues;
  /** El `requestId` de te-api, si lo dio. Es la llave para leer el motivo real. */
  readonly requestId?: string;
}

/** Lo que el portal recuerda de quien ha entrado. Sin ID token. Ver arriba. */
export interface PortalSession {
  readonly logtoUserId: string;
  readonly email: string | null;
  readonly displayName: string | null;
  /** El `external_id` de su ficha en el padrón del banco. `null` si no se halló. */
  readonly customerExternalId: string | null;
  readonly outcome: LinkOutcome;
  /** Cuándo se hizo el login que produjo el vínculo. ISO-8601 UTC. */
  readonly linkedAt: string;
}

async function sign(payload: Record<string, unknown>, ttlSeconds: number): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(await secret());
}

async function read<T>(token: string | undefined): Promise<T | null> {
  if (token === undefined || token === '') return null;
  try {
    const { payload } = await jwtVerify(token, await secret(), { algorithms: ['HS256'] });
    return payload as T;
  } catch {
    // Caducada, manipulada o firmada con otro secreto: las tres son «no hay
    // sesión». Distinguirlas en pantalla no le sirve de nada a un titular.
    return null;
  }
}

/**
 * `sameSite: 'lax'` y no `'strict'`: la vuelta de Logto es una navegación de
 * primer nivel desde otro sitio, y con `strict` el navegador no manda la cookie
 * — el callback no encontraría su propia petición y el login fallaría siempre.
 *
 * `secure` sólo fuera de desarrollo: en local el portal vive en `http://` y una
 * cookie `secure` sobre `http` sencillamente no se guarda.
 */
function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/portal',
    maxAge,
  };
}

export async function saveAuthorizationRequest(request: AuthorizationRequest): Promise<void> {
  const jar = await cookies();
  jar.set(AUTH_COOKIE, await sign({ ...request }, AUTH_TTL_SECONDS), cookieOptions(AUTH_TTL_SECONDS));
}

/**
 * Lee la petición de autorización y **la borra**.
 *
 * De un solo uso: un `state` que sigue valiendo después de canjearlo es un
 * `state` que se puede reproducir.
 */
export async function takeAuthorizationRequest(): Promise<AuthorizationRequest | null> {
  const jar = await cookies();
  const parsed = await read<AuthorizationRequest>(jar.get(AUTH_COOKIE)?.value);
  jar.delete({ name: AUTH_COOKIE, path: '/portal' });
  if (parsed === null) return null;
  if (
    typeof parsed.state !== 'string' ||
    typeof parsed.nonce !== 'string' ||
    typeof parsed.codeVerifier !== 'string'
  ) {
    return null;
  }
  return { state: parsed.state, nonce: parsed.nonce, codeVerifier: parsed.codeVerifier };
}

export async function saveSession(session: PortalSession): Promise<void> {
  const jar = await cookies();
  jar.set(
    SESSION_COOKIE,
    await sign({ ...session }, SESSION_TTL_SECONDS),
    cookieOptions(SESSION_TTL_SECONDS),
  );
}

export async function getSession(): Promise<PortalSession | null> {
  const jar = await cookies();
  const parsed = await read<PortalSession>(jar.get(SESSION_COOKIE)?.value);
  if (parsed === null || typeof parsed.logtoUserId !== 'string') return null;
  return parsed;
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete({ name: SESSION_COOKIE, path: '/portal' });
  jar.delete({ name: AUTH_COOKIE, path: '/portal' });
}
