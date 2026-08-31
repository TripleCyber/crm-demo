import 'server-only';

import { fetchOrgDidKeys } from './te-api';
import type { OrganizationConfig } from './organizations';

/**
 * El documento DID que cada organización publica en `/.well-known/did.json`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  LAS CLAVES SALEN DE te-api. LA LISTA FIJA DE ABAJO ES EL SUELO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Hasta el 2026-08-30 este fichero **era** la lista de claves: un array escrito
 * a mano que se servía igual en los tres dominios. Funcionaba porque las tres
 * organizaciones firman hoy con el mismo emisor nuestro (ver «custodia
 * gestionada» abajo), pero dejaba la cadena partida: te-api ya sabe darle a
 * cada organización su propia clave —`te.org_key`, con su ciclo
 * `pending → active → retiring → revoked`— y este documento no se enteraba. El
 * día que una organización encendiera su emisión, te-api firmaría con una clave
 * que este `did.json` no publica, y el fallo saldría **semanas después, en el
 * teléfono de otra persona**, como «no pude verificarlo».
 *
 * Ahora las claves las pide `fetchOrgDidKeys` a te-api
 * (`GET /v1/trust/did-documents/:host`), y la lista fija se queda como lo que
 * de verdad es: **el suelo por debajo del cual este documento no baja nunca**.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  LAS TRES REGLAS DEL RESPALDO, QUE SON LO QUE MÁS IMPORTA DE AQUÍ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  1. **Nunca un documento sin claves.** Servir una lista vacía —o un 500—
 *     rompe de golpe TODAS las credenciales que ya existen, incluidas las que
 *     hay ahora mismo en el teléfono de alguien. Si te-api no contesta algo
 *     útil, se sirve la lista fija.
 *  2. **Nunca se quita una clave que ya se publicaba.** Lo que diga te-api se
 *     **une** con el suelo, no lo sustituye: retirar una clave del documento
 *     invalida todo lo firmado con ella. (Regla del proyecto: extender, nunca
 *     quitar.)
 *  3. **La caché caliente se sirve mientras te-api no conteste.** Este
 *     documento lo pide la cartera en mitad de una verificación; no puede
 *     depender de que te-api esté rápido.
 *
 * ## La unión es con el SUELO, y con nada más
 *
 * Es la parte que hay que leer despacio, porque la tentación es la contraria.
 * **No se guarda memoria de lo que te-api dijo ayer.** Si se guardara —«una vez
 * publicada, publicada para siempre»— una clave revocada se quedaría en el
 * documento para siempre, y revocar es justo la operación de emergencia: la que
 * se usa cuando una clave está en manos de otro. La revocación funciona porque
 * la clave desaparece de la respuesta de te-api y por tanto de aquí.
 *
 * El suelo es distinto: son claves **nuestras**, no de `te.org_key`, y no hay
 * ninguna operación que las revoque. Por eso se pueden sumar siempre sin
 * romper nada.
 *
 * El precio, dicho en voz alta: **mientras la caché esté caliente se puede
 * seguir publicando una clave que te-api acaba de revocar**, como mucho lo que
 * dure la caché; y si te-api está caído, hasta que vuelva. Se eligió eso antes
 * que lo otro —dejar de publicar una clave buena porque te-api tenga un mal
 * minuto— porque lo otro tumba todas las credenciales de la organización, y
 * te-api caído es mucho más probable que una clave comprometida.
 *
 * ## Por qué el suelo son las claves compartidas del emisor
 *
 * Parece mal y es lo correcto. Bajo **custodia gestionada**
 * (`docs/fases/CUSTODIA.md` §1) quien firma es NUESTRO emisor, con NUESTRA
 * clave, en nombre del partner: la credencial sale con
 * `iss = did:web:<el del partner>` y `kid = did:web:<el del partner>#<nuestra
 * clave>`. Para que la cartera pueda resolver ese `kid` tiene que encontrarlo
 * en el documento del partner, así que el documento del partner **publica las
 * nuestras**. El `did:web` dice *quién emite*, no *quién guarda la llave*.
 *
 * Ésa es la razón de que los tres documentos sean hoy el mismo con el dominio
 * cambiado, y la razón de que aquí haya una plantilla y no tres ficheros. Con
 * tres ficheros, rotar una clave son tres ediciones y olvidarse de una no rompe
 * nada visible — hasta que una cartera concreta no puede verificar una
 * credencial concreta.
 *
 * Que la **clave privada** siga siendo nuestra es otra cosa, y está anotada
 * como deuda en `CUSTODIA.md`. El documento DID es el primer paso de
 * separarlas: la identidad ya es del partner aunque la llave todavía no. Lo que
 * este fichero añade es el segundo: el día que una organización tenga clave
 * propia en `te.org_key`, su documento la publica sola.
 *
 * ## Por qué el suelo tiene TRES claves
 *
 * Una lista con varias no es un descuido: **es cómo se rota una clave**.
 * Durante la rotación todas tienen que valer, o toda credencial firmada con la
 * vieja deja de verificar de golpe.
 *
 * | `kid` | Cuál es |
 * |---|---|
 * | `jwWSd4C3…` | La que firma en producción desde la rotación del 2026-08-30 |
 * | `ThFQ5nNq…` | El emisor **desplegado** anterior (`waltid-issuer2` en Coolify); se contrasta en `https://issuer.idp.tripleenable.com/openid4vci/jwks` |
 * | `_BjP-HuMgg…` | El emisor **local de desarrollo**, para poder probar el recorrido entero contra una máquina sin tocar el despliegue |
 *
 * La última se quita el día que el recorrido de desarrollo deje de
 * necesitarla. Mientras esté, quien levante un emisor local con OTRAS claves
 * tiene que añadir la suya aquí, o la cartera rechazará sus credenciales con
 * `CREDENTIAL_ISSUER_UNRESOLVED`.
 *
 * ## Tres avisos que ahorran un ciclo de depuración
 *
 * - **Nunca la parte privada.** Un JWK con `d` publicado aquí regala la
 *   capacidad de emitir en nombre de las tres organizaciones. Sólo van `kty`,
 *   `crv`, `x`, `y`, `kid`, `alg` y `use`. Lo que llegue de te-api pasa además
 *   por `readPublicJwk`, que tira cualquier cosa que traiga `d`.
 * - **El JWK tiene que llevar `y`.** La cartera exige los dos componentes de
 *   una clave EC (`Jwk.kt`) y **descarta en silencio** la que no lo traiga; el
 *   síntoma es `NO_PUBLISHED_KEY`, que no se parece a «te falta un campo». Un
 *   punto comprimido —sólo `x`— no vale.
 * - **El `id` de cada método termina en el mismo `kid`** que lleva la cabecera
 *   del JWT: es por ahí por donde la cartera elige cuál de las claves usar. Se
 *   compone aquí a partir del `kid`, nunca se copia de te-api, así que esa
 *   trampa no se puede volver a pisar desde este lado.
 *
 * El contenido del suelo se contrastó carácter a carácter con los documentos de
 * `docs/fases/F1-ALTA-MANUAL.md` §8 y con el estático que servía Banco Demo.
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
 * Las claves públicas de nuestro emisor, que es quien firma por los tres.
 *
 * **Es el suelo, no la lista.** Ya no es lo único que se publica —eso lo decide
 * te-api— pero sí lo que se publica siempre: aunque te-api no conteste, aunque
 * la organización no tenga todavía clave propia, aunque sea el primer arranque
 * del proceso. Borrarlo deja el respaldo sin nada que servir.
 *
 * Están escritas y no leídas de ninguna parte a propósito: son material
 * público, y sacarlas de una variable de entorno pondría el respaldo del
 * documento DID —lo que hace verificable cada credencial ya emitida— a merced
 * de una consola de despliegue. Rotarlas es un cambio de código que alguien
 * revisa.
 */
const PUBLISHED_KEYS: readonly PublicJwk[] = [
  {
    // La que firma en producción desde la rotación del 2026-08-30. Es la
    // primera cuya parte privada NO vive en un fichero de una máquina: entra
    // por `TE_ISSUER_KEY_D`, así que se puede rotar sin entrar en el servidor.
    kty: 'EC',
    crv: 'P-256',
    x: 'sEITr5UPRGgOT59WfYQlPUVMH93gAYfOHZkLD0zaay0',
    y: 'GX_vnr3xQnDwImDVuhRWPsEAuSVh3ibGslSL8Ev9X1o',
    kid: 'jwWSd4C3QPpKhQ76Ab3-bDwfJ3jSX8r5da3N_de8Q-U',
    alg: 'ES256',
    use: 'sig',
  },
  {
    // LA ANTERIOR, Y SE QUEDA. Todo lo firmado antes de la rotación lleva este
    // `kid` en su cabecera, y una cartera que no lo encuentre aquí no puede
    // verificar esas credenciales. Retirarla las invalidaría a todas de golpe:
    // sale cuando caduque la última, no antes.
    kty: 'EC',
    crv: 'P-256',
    x: 'ssRLxTmTBJZOVnf3jh3auwkm0zdx-T_pfSdCrDaJxXg',
    y: 'PD3NYSiQuHxuoUhOB3gepbRr9VJ0KIo_XtA0sJRv4eU',
    kid: 'ThFQ5nNqT72Ak8kl7BMjZ_NkpzgYt5wK95TyNSJqZGg',
    alg: 'ES256',
    use: 'sig',
  },
  {
    kty: 'EC',
    crv: 'P-256',
    x: 'mkrc7lSpFaXK-3RUYwGhBJ4rDheZkatgU_QqW3EK4fA',
    y: 'mU1vMjjIkPegviqv771OQRIZ68UvLF6r7hQEbwfofbY',
    kid: '_BjP-HuMggbMxvtbMYrMNqoTfAbMr8ubLZauzwTXzzY',
    alg: 'ES256',
    use: 'sig',
  },
];

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
  | 'te-api-cache'
  /** Sólo el suelo: te-api no ha dado nunca una respuesta útil para esta organización. */
  | 'fallback';

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
  /** `fallback` = sólo el suelo. `te-api` = te-api dijo algo y está ahí dentro. */
  readonly source: 'te-api' | 'fallback';
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
 * **No lanza nunca.** Un fallo aquí es un `did.json` que no sale, y eso vale lo
 * mismo que no tener credencial: todo lo que pueda ir mal termina en el suelo.
 */
export async function resolveDidDocument(
  organization: OrganizationConfig,
  domain: string,
): Promise<ResolvedDidDocument> {
  const did = didWebOf(domain);
  const cached = documentCache.get(organization.orgId);

  if (cached !== undefined && Date.now() < cached.nextAskAtMs) {
    return serve(cached, did, false);
  }

  const fromApi = await askTeApi(organization, did, domain);
  const now = Date.now();

  if (fromApi !== null) {
    // La unión, y en este orden: primero lo de te-api —cuya primera clave es la
    // activa, y la cartera prueba `keys.first()` cuando el `kid` no le casa con
    // ninguna (`VerificationKeys.kt`)— y después el suelo que no esté ya.
    const entry: CacheEntry = {
      keys: unionKeys(fromApi, PUBLISHED_KEYS),
      source: 'te-api',
      storedAtMs: now,
      nextAskAtMs: now + FRESH_TE_API_MS,
    };
    documentCache.set(organization.orgId, entry);
    return serve(entry, did, true);
  }

  // te-api no dijo nada útil. La caché caliente es mejor que el suelo: lleva el
  // suelo dentro **y además** lo que te-api dijo la última vez, y la regla 2 es
  // que de aquí no se quita nada. Se conserva su material y su fecha —sólo se
  // aplaza el siguiente intento— para que `x-te-did-age` siga diciendo la
  // verdad sobre lo vieja que es.
  if (cached !== undefined) {
    const kept: CacheEntry = { ...cached, nextAskAtMs: now + RETRY_AFTER_NO_ANSWER_MS };
    documentCache.set(organization.orgId, kept);
    return serve(kept, did, false);
  }

  // Ni te-api ni caché: primer arranque, o te-api no ha contestado nunca para
  // esta organización. El suelo, que es exactamente lo que se publicaba antes
  // de que esto existiera.
  const floor: CacheEntry = {
    keys: PUBLISHED_KEYS,
    source: 'fallback',
    storedAtMs: now,
    nextAskAtMs: now + RETRY_AFTER_NO_ANSWER_MS,
  };
  documentCache.set(organization.orgId, floor);
  return serve(floor, did, false);
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
  const source: DidDocumentSource =
    entry.source === 'fallback' ? 'fallback' : justFetched ? 'te-api' : 'te-api-cache';
  return {
    document: buildDidDocument(did, entry.keys),
    source,
    keyCount: entry.keys.length,
    ageSeconds: Math.floor((Date.now() - entry.storedAtMs) / 1000),
  };
}

/**
 * `primary` primero, y detrás lo de `floor` que no estuviera ya. Sin repetidos.
 *
 * Se compara por `kid` porque es lo que la cartera usa para elegir, y porque es
 * la huella RFC 7638 del material: dos claves con el mismo `kid` son la misma
 * clave. Gana la copia de `primary`, que es la que viene del padrón.
 */
function unionKeys(
  primary: readonly PublicJwk[],
  floor: readonly PublicJwk[],
): readonly PublicJwk[] {
  const seen = new Set(primary.map((key) => key.kid));
  return [...primary, ...floor.filter((key) => !seen.has(key.kid))];
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
