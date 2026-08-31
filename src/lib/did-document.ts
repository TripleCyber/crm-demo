import 'server-only';

import { fetchOrgDidKeys } from './te-api';
import type { OrganizationConfig } from './organizations';

/**
 * El documento DID que cada organización publica en `/.well-known/did.json`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  LAS CLAVES SALEN DE te-api, Y DE NINGÚN OTRO SITIO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Hasta hoy este fichero llevaba dentro un array de claves escrito a mano —«el
 * suelo»— que se unía a lo que dijera te-api y que se servía tal cual cuando
 * te-api no contestaba. Eran las claves compartidas de nuestro emisor, y el
 * argumento para tenerlas era la custodia gestionada: si firma nuestro emisor
 * en nombre del partner, el `kid` es nuestro y el documento del partner tiene
 * que publicarlo.
 *
 * **Se fue, por decisión del dueño y con su razón.** Son claves de un entorno
 * de pruebas, y escribir código para que un despliegue de desarrollo sobreviva
 * a sus propios cambios de versión es sostener un problema que no existe: si
 * una credencial de prueba deja de verificar, se borra y se emite otra. Lo que
 * quedaba a cambio era una lista de claves incrustada en el código, que es
 * exactamente lo que este trabajo venía a quitar.
 *
 * Así que la regla es una sola y no tiene excepciones: **el documento publica
 * lo que te-api diga, y si te-api no tiene claves para esa organización, no hay
 * documento** — 404, no una lista vacía. Un documento vacío la cartera lo
 * tomaría por bueno y diría «esta organización no publica claves», que suena a
 * error suyo; un 404 dice lo que pasa.
 *
 * La consecuencia, dicha en voz alta: **una organización que no haya encendido
 * su emisión no tiene documento DID.** Es lo correcto — todavía no tiene
 * identidad de emisor — y es lo que hace que encenderla desde la consola sea el
 * único camino.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  LO QUE SÍ SE QUEDA: LA CACHÉ, QUE NO ES UN RESPALDO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Este documento lo pide la cartera **en mitad de una verificación**, así que
 * no puede depender de que te-api esté rápido. Se cachea lo que te-api dijo, y
 * mientras no conteste se sirve eso mismo con su fecha real (`x-te-did-age` no
 * miente) y una ventana de reintento corta.
 *
 * Eso es una caché de material real, no un suelo de claves inventadas: nunca
 * publica una clave que te-api no haya dado. El precio, dicho: mientras la
 * caché esté caliente se puede seguir publicando una clave recién revocada,
 * como mucho lo que dure la caché. Se aceptó eso antes que consultar te-api en
 * cada verificación.
 *
 * **No se guarda memoria de lo que te-api dijo ayer.** Si se guardara —«una vez
 * publicada, publicada para siempre»— una clave revocada se quedaría en el
 * documento para siempre, y revocar es la operación de emergencia. La
 * revocación funciona porque la clave desaparece de la respuesta de te-api y
 * por tanto de aquí.
 *
 * ## Tres avisos que ahorran un ciclo de depuración
 *
 * - **Nunca la parte privada.** Un JWK con `d` publicado aquí regala la
 *   capacidad de emitir en nombre de la organización. Sólo van `kty`, `crv`,
 *   `x`, `y`, `kid`, `alg` y `use`. Lo que llegue de te-api pasa por
 *   `readPublicJwk`, que tira cualquier cosa que traiga `d`.
 * - **El JWK tiene que llevar `y`.** La cartera exige los dos componentes de
 *   una clave EC (`Jwk.kt`) y **descarta en silencio** la que no lo traiga; el
 *   síntoma es `NO_PUBLISHED_KEY`, que no se parece a «te falta un campo».
 * - **El `id` de cada método termina en el mismo `kid`** que lleva la cabecera
 *   del JWT: es por ahí por donde la cartera elige la clave. Se compone aquí a
 *   partir del `kid`, nunca se copia de te-api.
 */

/** Un JWK público de firma, tal y como se publica. Nunca lleva `d`. */
export interface PublicJwk {
  readonly kty: 'EC';
  readonly crv: 'P-256';
  readonly x: string;
  readonly y: string;
  readonly kid: string;
  readonly alg: 'ES256';
  readonly use: 'sig';
}

/**
 * De dónde salieron las claves del documento que se acaba de servir.
 *
 * Sale en una cabecera de la respuesta (`x-te-did-source`) porque sin ella
 * depurar esto es adivinar: los tres casos producen un 200 con un documento de
 * aspecto correcto, y lo único que los distingue es **qué claves lleva** — que
 * es justo lo que no se puede comparar de memoria.
 */
export type DidDocumentSource =
  /** Se le preguntó a te-api en esta misma petición y contestó. */
  | 'te-api'
  /** Material de te-api servido de la caché — fresca, o caliente porque te-api no contesta. */
  | 'te-api-cache';

export interface ResolvedDidDocument {
  readonly document: Record<string, unknown>;
  readonly source: DidDocumentSource;
  /** Cuántas claves lleva. Es lo primero que se mira cuando algo no verifica. */
  readonly keyCount: number;
  /** Antigüedad del material, en segundos. `0` = recién pedido a te-api. */
  readonly ageSeconds: number;
}

/**
 * Cuánto vale una respuesta de te-api antes de volver a preguntar.
 *
 * Un minuto. Corto porque una rotación tarda en verse lo que dure esto, y
 * porque te-api ya impone su propio retardo de publicación
 * (`TE_ORG_KEY_PUBLISH_GRACE_SECONDS`, 300 s hoy) antes de dejar que una clave
 * nueva firme: mientras esta caché sea bastante más corta que aquel retardo, la
 * clave nueva está publicada aquí mucho antes de que llegue a firmar nada, que
 * es la regla de oro de la rotación.
 */
const FRESH_TE_API_MS = 60_000;

/**
 * Y cuánto se espera antes de volver a preguntar cuando te-api NO contesta algo
 * útil — esté caído, tarde, o simplemente todavía no tenga clave para esta
 * organización, que es el estado de hoy.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  SIN ESTO, te-api CAÍDO SON DOS SEGUNDOS EN CADA `did.json`
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Es el motivo entero de que esta constante exista, y se escribe porque la
 * primera versión no la tenía. Sin ventana de reintento, un te-api que no
 * responde hace que **cada** petición espere el corte de `DID_KEYS_TIMEOUT_MS`
 * antes de servir la caché caliente. O sea: el respaldo funcionaría —saldrían
 * las claves correctas— y aun así la verificación de cada titular se llevaría
 * dos segundos de más, en la única ruta donde hay una persona esperando al otro
 * lado con el teléfono en la mano.
 *
 * Medio minuto: bastante para que un te-api caído cueste dos segundos cada
 * treinta y no dos por petición, y poco para notar pronto el día que
 * `te.org_key` deje de estar vacía.
 */
const RETRY_AFTER_NO_ANSWER_MS = 30_000;

interface CacheEntry {
  /** Ya unidas con el suelo: lo que se guarda es lo que se sirve. */
  readonly keys: readonly PublicJwk[];
  /** Siempre material de te-api: `te-api` recién pedido, o de la caché. */
  readonly source: 'te-api';
  /**
   * Cuándo se obtuvo **el material**. No se toca cuando te-api falla: es lo que
   * envejece en `x-te-did-age`, y una caché caliente que dijera «edad 0» porque
   * se acaba de reintentar sería justo la mentira que hay que evitar.
   */
  readonly storedAtMs: number;
  /** Cuándo toca volver a preguntar a te-api. Ver la constante de arriba. */
  readonly nextAskAtMs: number;
}

/**
 * Una entrada por organización. Vive en el proceso, como el token M2M.
 *
 * No es estado compartido entre despliegues: en Next el módulo se evalúa en
 * cada trabajador, así que lo peor que puede pasar es que dos trabajadores
 * pregunten a te-api por separado.
 */
const documentCache = new Map<string, CacheEntry>();

/**
 * Peticiones en vuelo, por organización.
 *
 * Sin esto, el instante en que caduca la caché convierte cada cartera que esté
 * verificando en ese momento en una llamada a te-api. `did.json` es la ruta más
 * pública que tiene este servidor: es el único sitio donde la estampida es un
 * escenario real y no una precaución.
 */
const inFlight = new Map<string, Promise<readonly PublicJwk[] | null>>();

/**
 * **El documento DID de una organización, con su respaldo.** Es lo que sirve la
 * ruta.
 *
 * El dominio entra por parámetro y sale de `CRM_ORG_<SLUG>_DOMAIN`, nunca de la
 * cabecera `Host`: la ruta busca primero qué organización vive en ese host y
 * después compone con lo que esa organización tiene declarado. Si se compusiera
 * con el `Host`, cualquiera que apuntase un DNS a esta máquina se fabricaría un
 * `did:web` en su dominio respaldado por nuestras claves. Ese mismo dominio es
 * el que se le pide a te-api y el que se exige de vuelta en el `id`.
 *
 * **No lanza nunca**, pero **sí puede devolver `null`**: cuando te-api no tiene
 * claves para esta organización y no hay caché. Quien llama lo traduce en un
 * 404, que es la respuesta honesta a «este dominio todavía no publica ninguna
 * identidad de emisor».
 */
export async function resolveDidDocument(
  organization: OrganizationConfig,
  domain: string,
): Promise<ResolvedDidDocument | null> {
  const did = didWebOf(domain);
  const cached = documentCache.get(organization.orgId);

  if (cached !== undefined && Date.now() < cached.nextAskAtMs) {
    return serve(cached, did, false);
  }

  const fromApi = await askTeApi(organization, did, domain);
  const now = Date.now();

  if (fromApi !== null) {
    // El orden de te-api se respeta: su primera clave es la activa, y la
    // cartera prueba `keys.first()` cuando el `kid` no le casa con ninguna
    // (`VerificationKeys.kt`).
    const entry: CacheEntry = {
      keys: fromApi,
      source: 'te-api',
      storedAtMs: now,
      nextAskAtMs: now + FRESH_TE_API_MS,
    };
    documentCache.set(organization.orgId, entry);
    return serve(entry, did, true);
  }

  // te-api no dijo nada útil. Se sirve la caché caliente si la hay: es material
  // que te-api dio de verdad, no una lista inventada. Se conserva su fecha
  // —sólo se aplaza el siguiente intento— para que `x-te-did-age` siga diciendo
  // la verdad sobre lo vieja que es.
  if (cached !== undefined) {
    const kept: CacheEntry = { ...cached, nextAskAtMs: now + RETRY_AFTER_NO_ANSWER_MS };
    documentCache.set(organization.orgId, kept);
    return serve(kept, did, false);
  }

  // Ni te-api ni caché. **No hay documento**, y eso es una respuesta: esta
  // organización todavía no tiene identidad de emisor. Devolver una lista vacía
  // sería peor —la cartera la tomaría por buena— y devolver claves de relleno
  // es justo lo que este fichero dejó de hacer.
  return null;
}

/** Una llamada a te-api por organización, aunque pregunten diez a la vez. */
async function askTeApi(
  organization: OrganizationConfig,
  did: string,
  domain: string,
): Promise<readonly PublicJwk[] | null> {
  const pending = inFlight.get(organization.orgId);
  if (pending !== undefined) return pending;

  const request = fetchOrgDidKeys(organization, did, domain)
    .catch((error: unknown) => {
      // `fetchOrgDidKeys` ya devuelve `null` en vez de lanzar para todo lo
      // previsto. Esto es el cinturón: un fallo inesperado ahí NO puede dejar
      // sin documento a un dominio entero.
      console.error('[crm] fallo inesperado pidiendo el documento DID', {
        orgId: organization.orgId,
        reason: error instanceof Error ? error.message : 'desconocido',
      });
      return null;
    })
    .finally(() => {
      inFlight.delete(organization.orgId);
    });

  inFlight.set(organization.orgId, request);
  return request;
}

function serve(entry: CacheEntry, did: string, justFetched: boolean): ResolvedDidDocument {
  // Sólo quedan dos orígenes, y los dos son material de te-api: lo que acaba de
  // contestar, o lo que contestó la última vez. Ya no hay un tercero.
  const source: DidDocumentSource = justFetched ? 'te-api' : 'te-api-cache';
  return {
    document: buildDidDocument(did, entry.keys),
    source,
    keyCount: entry.keys.length,
    ageSeconds: Math.floor((Date.now() - entry.storedAtMs) / 1000),
  };
}


/**
 * El documento DID de un dominio con las claves dadas, **en el orden dado**.
 *
 * Es el mismo montaje que hace te-api (`src/trust/did-document.ts`), y tiene
 * que seguir siéndolo: su ruta devuelve el documento entero justamente para que
 * nadie lo componga dos veces, y aquí se compone igualmente porque la unión con
 * el suelo obliga. Cualquier campo que te-api añada a su documento hay que
 * añadirlo aquí el mismo día, o el `did.json` de estos tres dominios se queda
 * atrás.
 *
 * Se exporta para poder montarlo sin pasar por la red, que es como se prueba.
 */
export function buildDidDocument(
  did: string,
  keys: readonly PublicJwk[],
): Record<string, unknown> {
  const methodIds = keys.map((key) => `${did}#${key.kid}`);

  return {
    '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/suites/jws-2020/v1'],
    id: did,
    verificationMethod: keys.map((key, index) => ({
      id: methodIds[index],
      type: 'JsonWebKey2020',
      controller: did,
      // Campo a campo y no un `spread`: así el `d` de una clave privada no
      // puede colarse aunque alguien pase el objeto equivocado.
      publicKeyJwk: {
        kty: key.kty,
        crv: key.crv,
        x: key.x,
        y: key.y,
        kid: key.kid,
        alg: key.alg,
        use: key.use,
      },
    })),
    // Las tres listas nombran las mismas claves, y las tres hacen falta:
    // `assertionMethod` es con lo que se firma una credencial y
    // `authentication` con lo que el sujeto demuestra control del DID. Un
    // documento con una sola de las dos verifica en unas carteras y no en
    // otras, que es el peor de los fallos posibles aquí.
    assertionMethod: methodIds,
    authentication: methodIds,
  };
}

/** El `did:web` de un dominio. Una sola función para no escribirlo dos veces. */
export function didWebOf(domain: string): string {
  return `did:web:${domain}`;
}
