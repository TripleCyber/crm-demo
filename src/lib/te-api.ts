import 'server-only';

import type { MessageKey, Translator } from '@/i18n/translate';

import { getB2bToken, invalidateB2bToken } from './b2b-token';
import type { PublicJwk } from './did-document';
import type { OrganizationConfig } from './organizations';

/**
 * El cliente de te-api.
 *
 * **Es la única puerta de salida del CRM hacia TripleEnable.** No hay ningún
 * otro `fetch` a un servicio nuestro en este proyecto, y en particular no hay
 * ninguno a walt.id: la credencial la construye y la firma te-api, y la recoge
 * la cartera del titular hablando directamente con el emisor. El CRM sólo pide
 * la oferta y pinta el enlace.
 *
 * ## Dos clases de llamada, y la diferencia importa
 *
 * Casi todo va por `/v1/b2b/` con el token M2M de la organización, y de eso se
 * encarga `callB2b`. La excepción es **una**, `fetchOrgDidKeys`, que pide
 * `GET /v1/trust/did-documents/:host`: una ruta **pública y sin token**, porque
 * lo que devuelve es el documento DID que la cartera de cualquier titular
 * consulta antes de guardar una credencial (ver `src/routes/trust-did.ts` de
 * te-api). Pedirle un token sería pedírselo a la web abierta.
 *
 * Que no lleve token no es sólo una comodidad: es lo que hace que el
 * `did.json` —que sostiene la verificación de TODO lo ya emitido— no dependa
 * de que Logto esté en pie.
 *
 * ## El 404 de te-api no significa «no existe»
 *
 * La puerta B2B devuelve **el mismo `404 not_found`** para todo: token ausente,
 * firma mala, `aud` de otro recurso, token caducado, sin `organization_id`,
 * organización que no está en el padrón, partner suspendido y scope que falta.
 * Es deliberado —el conjunto de organizaciones socias es justo lo que un
 * competidor querría enumerar— y significa que desde aquí **no se puede saber
 * cuál de las ocho cosas ha pasado**.
 *
 * Lo que sí se puede hacer, y es lo que hace `TeApiError`, es guardar el
 * `requestId` del cuerpo: con él, quien opera te-api encuentra el motivo real
 * en `te.request_event` en un minuto. Por eso el `requestId` se enseña en la
 * interfaz cuando la emisión falla; sin él, un 404 aquí es un callejón sin
 * salida.
 */

/** El «¿quién soy?» del partner: `GET /v1/b2b/organization`. */
export interface B2bOrganization {
  readonly organizationId: string;
  readonly legalName: string;
  /** El DID con el que te-api emite en su nombre. Es el `iss` de sus credenciales. */
  readonly did: string;
  readonly credentialTypes: ReadonlyArray<{ type: string; maxValidityDays: number }>;
  /** Los scopes que trae el token de ESTA llamada. Es lo que le falta a quien depura. */
  readonly scopes: readonly string[];
}

/** Lo que devuelve `POST /v1/b2b/credentials`. */
export interface CredentialOffer {
  readonly offerId: string;
  /** El `openid-credential-offer://…`. Se pinta como QR y como enlace. */
  readonly offerUri: string;
  readonly expiresAt: string;
  /** El PIN, sólo si se pidió. Se enseña en pantalla; nunca se manda al titular. */
  readonly pin: string | null;
}

/** Lo que devuelve `POST /v1/b2b/presentations`. */
export interface PresentationRequestResult {
  readonly presentationId: string;
  /**
   * Dónde va la cartera a por el objeto de solicitud. Apunta al verificador de
   * **TripleEnable**, no a uno de Banco Demo — y es a propósito: la
   * verificación se hace en su infraestructura, no en la nuestra. De aquí sale
   * también el `requestUri` de `POST /v1/b2b/wakeups`.
   */
  readonly requestUri: string;
  /** El `openid4vp://authorize?…`. Se pinta como QR y como enlace. */
  readonly authorizationRequestUrl: string;
  readonly expiresAt: string;
}

/** Lo que devuelve `GET /v1/b2b/presentations/:id`. */
export interface PresentationStatus {
  readonly presentationId: string;
  /**
   * `rejected` es la persona diciendo que no desde su cartera; `failed` es la
   * credencial no valiendo. Son dos cosas distintas para quien está al teléfono
   * con el cliente: una se repite, la otra no.
   */
  readonly status: 'pending' | 'verified' | 'rejected' | 'failed' | 'expired';
  /** Sólo los atributos que se pidieron, y sólo cuando `status` es `verified`. */
  readonly claims: Record<string, unknown> | null;
  /**
   * La llave con la que firmó el titular, del `cnf` de la credencial
   * presentada. NO es un `did:key:`: nuestro emisor pone una JWK cruda, y
   * te-api no se inventa la conversión. `thumbprint` es la huella RFC 7638 —44
   * caracteres, estable— y es lo que se enseña; `jwk` es lo que hace falta para
   * comprobar la firma sin nosotros.
   */
  readonly holderKey: { readonly thumbprint: string; readonly jwk: Record<string, unknown> } | null;
  /**
   * El vínculo de esta persona **con esta organización**.
   *
   * NO es su perfil en TripleEnable, y la diferencia importa: el perfil es el
   * mismo en todas las organizaciones, así que dos partners que guardaran sus
   * recibos podrían cruzarlos y descubrir que el cliente 4471 de uno y el 8823
   * del otro son la misma persona. El vínculo contesta la misma pregunta y no
   * sirve para cruzarlos.
   */
  readonly holderLinkId: string | null;
  /**
   * La prueba, entera o nada. Suelta, la firma no demuestra nada: hace falta la
   * presentación que se firmó, el resumen que se hasheó, y a quién y con qué
   * número se dirigía. Por eso viaja como un objeto y no como cuatro campos.
   */
  readonly proof: {
    /** La SD-JWT presentada, con sus divulgaciones y el KB-JWT al final. */
    readonly presentation: string;
    /** El KB-JWT: lo que ata esa presentación a esa llave. */
    readonly keyBinding: string;
    /** El resumen de la presentación, tal como lo firmó el titular. */
    readonly sdHash: string;
    /** A quién iba dirigida. Sin esto, la firma se podría reusar en otro sitio. */
    readonly audience: string;
    /** El número de un solo uso. Sin esto, se podría reusar más tarde. */
    readonly nonce: string;
    /** Cuándo firmó **el titular**. No es cuándo se enteró este banco. */
    readonly signedAt: string;
  } | null;
}

export interface RequestPresentationInput {
  /** El `type_key` del padrón del partner. El mismo que al emitir. */
  readonly type: string;
  /** El `sub` que se le exigirá a la credencial presentada. */
  readonly subjectReference: string;
  /** Los atributos que se piden. Al menos uno. */
  readonly claims: readonly string[];
}

/**
 * Quién dice el CRM que pulsó el botón. **Atribución, no autenticación.**
 *
 * te-api no lo verifica y no decide nada con él: no elige destinatario, no entra
 * en ningún límite y no abre ninguna puerta (`src/b2b/wakeups.ts`). Sirve para
 * que en el móvil del titular ponga «Pedro Ramírez, agente 4471» en vez de un
 * aviso anónimo, y para que el diario de te-api pueda contestar «quién pidió
 * esto» el día que alguien pregunte. Un banco que mienta aquí se está mintiendo
 * a sus propios clientes, igual que hoy por teléfono.
 */
export interface WakeupActor {
  readonly id: string;
  readonly displayName: string;
}

export interface WakeupInput {
  /** El id del cliente en la organización. El mismo que en la presentación. */
  readonly subjectReference: string;
  /**
   * `identity` = «demuéstrame que eres tú»; `transaction` = aprobar una
   * operación con importe y destinatario.
   *
   * Los dos se declaran porque los dos son el contrato de la ruta, no porque
   * este CRM mande los dos: hoy sólo manda `identity`. `transaction` es F4c
   * nivel 2 y le falta la pantalla que lo use, no el camino hasta te-api.
   */
  readonly kind: 'identity' | 'transaction';
  /**
   * Dónde va la cartera a por la solicitud firmada. Es el `requestUri` que
   * acaba de devolver `POST /v1/b2b/presentations`, tal cual.
   *
   * **te-api exige `https` y no hace excepción para desarrollo.** Con una base
   * de verificador local en `http://…` la llamada sale con `400 invalid_request`
   * antes de tocar nada, que es el comportamiento correcto: la cartera va a ir a
   * esa URL a por una solicitud firmada.
   */
  readonly requestUri: string;
  readonly actor: WakeupActor;
}

/** Lo que devuelve `POST /v1/b2b/wakeups`. */
export interface WakeupResult {
  readonly wakeupId: string;
  readonly expiresAt: string;
}

export interface IssueCredentialInput {
  /** El `type_key` del padrón del partner, tal y como lo nombra él. */
  readonly type: string;
  /** El `sub` de la credencial: el id del titular en la organización. */
  readonly subjectReference: string;
  readonly claims: Record<string, unknown>;
  readonly validityDays?: number;
  readonly withPin?: boolean;
}

/** Un error de te-api, con lo único que te-api cuenta: el código y el `requestId`. */
export class TeApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** El código público (`not_found`, `invalid_request`, `unavailable`, …). */
    readonly code: string,
    /** El identificador de la petición. Es la llave para leer el motivo real. */
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'TeApiError';
  }
}

/** `GET /v1/b2b/organization` — comprueba la integración sin emitir nada a nadie. */
export async function fetchB2bOrganization(
  organization: OrganizationConfig,
): Promise<B2bOrganization> {
  return callB2b<B2bOrganization>(organization, organization.issuerUrl, '/v1/b2b/organization', {
    method: 'GET',
  });
}

/**
 * El padrón de la organización, cacheado un minuto.
 *
 * ## Por qué hay caché, y por qué es corta
 *
 * Desde que el `type` que llega del navegador se comprueba contra el padrón,
 * **cada comprobación de identidad haría dos llamadas a te-api en vez de una**:
 * el padrón y la presentación. Las dos pasan por el mismo cubo de tasa por
 * organización (`TE_B2B_RATE_PER_ORG`), que la pantalla de al lado ya se está
 * gastando sondeando cada tres segundos. Duplicar el coste de arrancar una
 * comprobación para releer una lista que cambia cuando alguien ejecuta
 * `seed:partner` sería pagar por nada.
 *
 * Un minuto y no una hora porque es el tiempo que se tarda en volver a probar
 * después de sembrar un tipo nuevo: más largo y quien acaba de añadirlo cree
 * que no ha funcionado.
 *
 * **`/diagnostics` y `GET /api/organization` NO usan esto** y llaman a
 * `fetchB2bOrganization` a pelo, a propósito: son las pantallas que se miran
 * para saber si la costura funciona *ahora*, y una respuesta cacheada diría que
 * sí cuando el secreto acaba de caducar.
 */
const ORGANIZATION_CACHE_MS = 60_000;

const organizationCache = new Map<string, { value: B2bOrganization; expiresAt: number }>();

export async function fetchB2bOrganizationCached(
  organization: OrganizationConfig,
): Promise<B2bOrganization> {
  const cached = organizationCache.get(organization.orgId);
  if (cached !== undefined && cached.expiresAt > Date.now()) return cached.value;

  const value = await fetchB2bOrganization(organization);
  organizationCache.set(organization.orgId, {
    value,
    expiresAt: Date.now() + ORGANIZATION_CACHE_MS,
  });
  return value;
}

/** Lo que devuelve `POST /v1/b2b/links`. */
export interface CustomerLink {
  readonly linkId: string;
  /** `true` si este vínculo sustituyó a otro que apuntaba a otro perfil. */
  readonly replaced: boolean;
}

export interface LinkCustomerInput {
  /** El `external_id` del cliente en el padrón del banco. El mismo que el `sub`. */
  readonly subjectReference: string;
  /**
   * El ID token que Logto emitió al autenticar al titular **en este portal**.
   *
   * Es la prueba entera: te-api comprueba su firma contra el JWKS de Logto y
   * que su `aud` es el `portal_client_id` de esta organización. Sin él la ruta
   * responde `cannot_complete` sin mirar nada más — un banco no declara a quién
   * vincula, lo demuestra.
   *
   * **Y tiene que ser reciente.** te-api sólo acepta ID tokens de menos de
   * cinco minutos, así que esto se llama en el callback del login y no cuando
   * al titular le apetezca pulsar un botón.
   */
  readonly idToken: string;
  /** Su tipo de credencial, si el banco ya lo sabe. Opcional a propósito. */
  readonly type?: string;
}

/**
 * `POST /v1/b2b/links` — ata el cliente del banco al perfil de TripleEnable.
 *
 * Es lo que hace que `POST /v1/b2b/wakeups` pueda hacer sonar el teléfono de
 * esta persona: sin vínculo activo, el despertador resuelve como señuelo y
 * nadie se entera de nada, que es el comportamiento correcto.
 */
export async function linkCustomer(
  organization: OrganizationConfig,
  input: LinkCustomerInput,
): Promise<CustomerLink> {
  return callB2b<CustomerLink>(organization, organization.issuerUrl, '/v1/b2b/links', {
    method: 'POST',
    body: {
      subjectReference: input.subjectReference,
      idToken: input.idToken,
      ...(input.type === undefined ? {} : { type: input.type }),
    },
  });
}

/** `POST /v1/b2b/credentials` — crea la oferta OID4VCI pre-autorizada. */
export async function issueCredential(
  organization: OrganizationConfig,
  input: IssueCredentialInput,
): Promise<CredentialOffer> {
  return callB2b<CredentialOffer>(organization, organization.issuerUrl, '/v1/b2b/credentials', {
    method: 'POST',
    body: {
      type: input.type,
      subjectReference: input.subjectReference,
      claims: input.claims,
      ...(input.validityDays === undefined ? {} : { validityDays: input.validityDays }),
      withPin: input.withPin ?? false,
    },
  });
}

/**
 * `POST /v1/b2b/presentations` — pide que el titular enseñe su credencial.
 *
 * te-api abre la sesión en **su** verificador y devuelve el enlace. El CRM no
 * habla con walt.id ni tiene verificador propio, y eso no es una simplificación
 * de la maqueta: un banco que verificase en su casa podría dar por buena
 * cualquier cosa —incluida una credencial revocada— y nadie se enteraría.
 */
export async function requestPresentation(
  organization: OrganizationConfig,
  input: RequestPresentationInput,
): Promise<PresentationRequestResult> {
  // `verifierUrl` y no `issuerUrl`: son la misma base en el despliegue de hoy,
  // pero el contrato de F4a las declara por separado justo para que un día se
  // puedan separar. Usar la de emitir aquí dejaría el campo muerto y la
  // separación sin efecto el día que hiciera falta.
  return callB2b<PresentationRequestResult>(
    organization,
    organization.verifierUrl,
    '/v1/b2b/presentations',
    {
      method: 'POST',
      body: {
        type: input.type,
        subjectReference: input.subjectReference,
        claims: [...input.claims],
      },
    },
  );
}

/**
 * `POST /v1/b2b/wakeups` — **el timbre**. Hace sonar el teléfono del titular.
 *
 * Es lo que convierte la verificación en algo que sirve **por teléfono**: sin
 * esto sólo hay un QR en la pantalla del agente, y quien está al otro lado de
 * una llamada no ve esa pantalla.
 *
 * ## La respuesta no dice si esa persona tiene cartera
 *
 * `{ wakeupId, expiresAt }` es **idéntico exista el cliente o no**, con la misma
 * forma y la misma latencia. te-api resuelve a quién despertar *después* de
 * contestar, y si no resuelve a nadie la fila nace señuelo y caduca sola. Es
 * deliberado: si la respuesta cambiara, este CRM sería un oráculo para averiguar
 * quién tiene cartera de TripleEnable probando identificadores. Por eso aquí no
 * hay nada que interpretar, y la pantalla no puede decir «este cliente no tiene
 * la app» — el 200 no lo dice.
 */
export async function sendWakeup(
  organization: OrganizationConfig,
  input: WakeupInput,
): Promise<WakeupResult> {
  // La misma base que abrió la sesión. El timbre no es emitir ni verificar —es
  // el canal push del núcleo de te-api—, así que ninguna de las dos bases es
  // obviamente la suya; se elige ésta porque el `requestUri` que se manda salió
  // de ella y las dos llamadas son la misma ceremonia. El día que el emisor y el
  // verificador se separen de verdad, el núcleo necesita su propia variable en
  // `organizations.ts`, y entonces se cambia también aquí.
  return callB2b<WakeupResult>(organization, organization.verifierUrl, '/v1/b2b/wakeups', {
    method: 'POST',
    body: {
      subjectReference: input.subjectReference,
      kind: input.kind,
      requestUri: input.requestUri,
      actor: { id: input.actor.id, displayName: input.actor.displayName },
    },
  });
}

/**
 * `GET /v1/b2b/presentations/:id` — «¿ya ha contestado?».
 *
 * Se sondea porque no hay webhook, y no por falta de soporte en walt.id: el
 * destino lo elegiría quien pide, y el verificador de TripleEnable acabaría
 * haciendo peticiones salientes a donde le dijeran.
 */
export async function fetchPresentationStatus(
  organization: OrganizationConfig,
  presentationId: string,
): Promise<PresentationStatus> {
  return callB2b<PresentationStatus>(
    organization,
    organization.verifierUrl,
    `/v1/b2b/presentations/${encodeURIComponent(presentationId)}`,
    { method: 'GET' },
  );
}

/**
 * Cuánto se espera a te-api por el documento DID. **Dos segundos y se corta.**
 *
 * No es el mismo problema que emitir. Una emisión la está mirando un empleado y
 * puede esperar; este documento lo pide **la cartera en mitad de una
 * verificación**, así que la respuesta lenta y la respuesta ausente valen lo
 * mismo para quien espera. Se corta pronto y se sirve lo que haya —la caché
 * caliente, o el suelo—, que es lo que `@/lib/did-document.ts` hace con el
 * `null` de aquí.
 */
const DID_KEYS_TIMEOUT_MS = 2_000;

/**
 * `GET /v1/trust/did-documents/:host` — **las claves publicables de una
 * organización, según te-api.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ESTA RUTA ES EL CONTRATO, Y NO ES `GET /v1/b2b/keys`
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Las dos leen `te.org_key` y las dos existen, pero contestan preguntas
 * distintas y sólo una es la de aquí:
 *
 *  · `/v1/b2b/keys` es **la consola**: usa `listAllKeys`, o sea que devuelve
 *    también **las revocadas**, más el historial, más las cuentas atrás. Quien
 *    la usara para componer un `did.json` tendría que filtrar `revoked` y
 *    reordenar por estado **aquí**, duplicando `listPublishableKeys` — y el día
 *    que las dos copias discrepen, lo que se publica es una clave revocada. La
 *    revocación es la operación de emergencia; no puede depender de que este
 *    repositorio recuerde filtrar.
 *  · `/v1/trust/did-documents/:host` está escrita para esto, lo dice en su
 *    cabecera —«quien sirva el documento pide esto»— y ya viene filtrada
 *    (nada revocado), ordenada (la activa primera) y montada.
 *
 * Y además es **pública**: el `did.json` sigue saliendo aunque Logto no dé
 * tokens.
 *
 * ## Qué se comprueba antes de creerse la respuesta
 *
 *  1. **Que el `id` es el DID que se pidió.** Es la línea que impide que un
 *     te-api mal configurado —o algo puesto en medio— haga que este dominio
 *     publique las claves de otra organización.
 *  2. **Que ningún JWK trae `d`.** te-api ya no la deja salir, pero este
 *     módulo es el último salto antes de la web abierta y la consecuencia de
 *     que se cuele es regalar la capacidad de emitir.
 *  3. **Que cada JWK está completo** (`x` **y** `y`). La cartera descarta en
 *     silencio la clave EC a la que le falte un componente (`Jwk.kt`), y el
 *     síntoma —`NO_PUBLISHED_KEY`— no se parece a «te falta un campo». Lo que
 *     no encaja se descarta **gritando en el log**, nunca callando.
 *
 * Devuelve `null` cuando no hay respuesta útil, y ahí caben cosas muy
 * distintas —te-api caído, tarda, 404 porque la organización todavía no tiene
 * clave propia, 404 porque está suspendida—. **A propósito no se distinguen**:
 * el 404 de te-api es el mismo cuerpo para todas, y quien llama tiene que hacer
 * lo mismo en todos los casos (servir el suelo) o se queda sin documento.
 */
export async function fetchOrgDidKeys(
  organization: OrganizationConfig,
  expectedDid: string,
  host: string,
): Promise<readonly PublicJwk[] | null> {
  // `issuerUrl` y no `verifierUrl`: este documento contesta «quién firmó», que
  // es la mitad de emitir. Hoy son la misma base; el día que se separen, la
  // identidad del emisor vive con el emisor.
  const url = `${organization.issuerUrl}/v1/trust/did-documents/${encodeURIComponent(host)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      // La caché la lleva `@/lib/did-document.ts`, que es quien sabe qué se
      // puede servir viejo y qué no. Dos cachés encima serían dos ventanas de
      // rotación sumadas, y la de aquí no se puede inspeccionar desde fuera.
      cache: 'no-store',
      signal: AbortSignal.timeout(DID_KEYS_TIMEOUT_MS),
    });
  } catch (error) {
    // Caído, DNS, TLS o el corte de los dos segundos. Es una línea de log y no
    // un error que suba: el documento se sirve igual, con el suelo.
    console.warn('[crm] te-api no contestó por el documento DID', {
      orgId: organization.orgId,
      host,
      reason: error instanceof Error ? error.message : 'desconocido',
    });
    return null;
  }

  if (!response.ok) {
    console.warn('[crm] te-api rechazó el documento DID', {
      orgId: organization.orgId,
      host,
      status: response.status,
    });
    return null;
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    console.error('[crm] te-api devolvió un documento DID ilegible', {
      orgId: organization.orgId,
      host,
    });
    return null;
  }

  return readDidDocumentKeys(payload, expectedDid, organization.orgId);
}

/** Las claves de un documento DID de te-api, o `null` si no es de fiar. */
function readDidDocumentKeys(
  payload: unknown,
  expectedDid: string,
  orgId: string,
): readonly PublicJwk[] | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const document = payload as Record<string, unknown>;

  // ── La comprobación 1: el documento tiene que ser el que se pidió ────────
  //
  // Sin esto, cualquier cosa que conteste en esa URL puede hacer que este
  // dominio publique un documento que dice ser de otro DID. La cartera lo
  // rechazaría —el `id` no es el que resolvió— pero para entonces ya habríamos
  // dejado de publicar las claves buenas.
  if (document['id'] !== expectedDid) {
    console.error('[crm] te-api devolvió un documento DID de otro DID', {
      orgId,
      expected: expectedDid,
      received: typeof document['id'] === 'string' ? document['id'] : '(sin id)',
    });
    return null;
  }

  const methods = document['verificationMethod'];
  if (!Array.isArray(methods)) return null;

  const keys: PublicJwk[] = [];
  for (const method of methods) {
    if (typeof method !== 'object' || method === null) continue;
    const jwk = readPublicJwk((method as Record<string, unknown>)['publicKeyJwk']);
    if (jwk === null) {
      // Gritar y seguir. Descartar una clave en silencio es exactamente la
      // trampa que este proyecto ya pisó una vez, y el síntoma sale semanas
      // después en el teléfono de otra persona.
      console.error('[crm] se descartó una clave del documento DID de te-api', {
        orgId,
        did: expectedDid,
      });
      continue;
    }
    keys.push(jwk);
  }

  // Cero claves útiles es lo mismo que no haber preguntado. Nunca se devuelve
  // una lista vacía: quien llama la uniría con el suelo y no se enteraría de
  // que te-api no dijo nada.
  return keys.length === 0 ? null : keys;
}

/** Un JWK público completo, o `null`. Ver las comprobaciones 2 y 3 de arriba. */
function readPublicJwk(value: unknown): PublicJwk | null {
  if (typeof value !== 'object' || value === null) return null;
  const jwk = value as Record<string, unknown>;

  // La comprobación 2. Va la primera y no se negocia: una clave con parte
  // privada no se «arregla» quitándosela, se tira y se grita.
  if ('d' in jwk) return null;

  // La comprobación 3. `x` e `y` los dos, o la cartera la descarta callando.
  const { x, y, kid } = jwk;
  if (typeof x !== 'string' || x === '') return null;
  if (typeof y !== 'string' || y === '') return null;
  if (typeof kid !== 'string' || kid === '') return null;

  // Las cuatro constantes son las que te-api genera hoy (`generateSigningKey`)
  // y las únicas que la cartera sabe verificar. Se exigen en vez de copiarse
  // para que una clave de otra curva no salga publicada como si fuera P-256:
  // saldría en el log de arriba, que es donde se quiere que salga.
  if (jwk['kty'] !== 'EC' || jwk['crv'] !== 'P-256') return null;
  if (jwk['alg'] !== 'ES256' || jwk['use'] !== 'sig') return null;

  return { kty: 'EC', crv: 'P-256', x, y, kid, alg: 'ES256', use: 'sig' };
}

async function callB2b<T>(
  organization: OrganizationConfig,
  baseUrl: string,
  path: string,
  init: { method: string; body?: unknown },
): Promise<T> {
  // Se intenta dos veces como mucho, y sólo en el caso concreto de un 401 con
  // el token cacheado: es lo que pasa cuando alguien rota el secreto o
  // reinicia Logto mientras este proceso lleva un token en memoria. Un 404 NO
  // se reintenta: sería un bucle contra la puerta cerrada.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const token = await getB2bToken(organization);
    const response = await fetch(`${baseUrl}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: 'no-store',
    });

    if (response.ok) {
      return (await response.json()) as T;
    }

    if (response.status === 401 && attempt === 0) {
      invalidateB2bToken(organization.orgId);
      continue;
    }

    throw await toTeApiError(response, path);
  }

  // Inalcanzable: el bucle sale por `return` o por `throw`. Está para que el
  // tipo de retorno no dependa de que TypeScript entienda el bucle.
  throw new TeApiError(`te-api ${path}: retries exhausted`, 500, 'internal_error');
}

async function toTeApiError(response: Response, path: string): Promise<TeApiError> {
  // El cuerpo de te-api es siempre `{ error, requestId }` y nada más: ni
  // `message`, ni `details`, ni el array de issues de Zod. Se lee con cuidado
  // porque un 502 de un proxy por delante no es JSON.
  let code = 'unknown';
  let requestId: string | undefined;
  try {
    const body = (await response.json()) as { error?: unknown; requestId?: unknown };
    if (typeof body.error === 'string') code = body.error;
    if (typeof body.requestId === 'string') requestId = body.requestId;
  } catch {
    // Sin cuerpo legible se queda el código de estado, que ya es algo.
  }

  return new TeApiError(
    `te-api ${path} answered ${response.status} (${code})`,
    response.status,
    code,
    requestId,
  );
}

/**
 * Qué se estaba haciendo cuando te-api contestó mal.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  EL MISMO 403 SIGNIFICA DOS COSAS DISTINTAS SEGÚN LA RUTA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * te-api usa `cannot_complete` (403) en dos sitios que no se parecen en nada:
 *
 * - **`POST /v1/b2b/links`** — el ID token no vale, o la persona todavía no
 *   tiene perfil de TripleEnable. Lo arregla el titular.
 * - **`POST /v1/b2b/presentations`** — el tipo de credencial no tiene `vct` en
 *   el padrón (`src/routes/b2b.ts`, justo después de resolver el tipo). Ese
 *   tipo **se puede emitir pero no se puede pedir de vuelta**, y no lo arregla
 *   ni el titular ni el agente: hay que volver a sembrarlo con su `vct`.
 *
 * Sin este parámetro, a un agente que intenta comprobar una identidad se le
 * decía que el cliente no tiene cartera cuando lo que pasa es que falta una
 * columna en el padrón. Son dos personas distintas las que tienen que
 * enterarse, así que son dos frases distintas.
 */
export type TeApiOperation = 'link' | 'presentation' | 'issue';

/**
 * Qué falló, **como clave y datos**, sin traducir todavía.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  UN FALLO NO PUEDE VIAJAR YA ESCRITO EN UN IDIOMA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * El del vínculo del portal se guarda en la cookie de sesión del titular y se
 * pinta en la siguiente petición, o en la de mañana. Si se guardara la frase
 * hecha, quedaría escrita en el idioma que estaba activo cuando falló: cambiar
 * a inglés dejaría la pantalla entera en inglés y ese aviso —el único que
 * importa— en castellano. Se guarda qué pasó, y se escribe al pintarlo.
 */
export interface TeApiFailure {
  readonly key: MessageKey;
  /** El `requestId`, el código y el estado, cuando hacen falta en la frase. */
  readonly values: Readonly<Record<string, string | number>>;
}

/**
 * El fallo que ve el empleado. Traduce el 404 opaco a algo accionable sin
 * inventarse un motivo que te-api no ha dado.
 */
export function describeTeApiFailure(
  error: TeApiError,
  operation?: TeApiOperation,
): TeApiFailure {
  const values: Record<string, string | number> =
    error.requestId === undefined ? {} : { requestId: error.requestId };

  if (error.status === 404) return { key: 'errors.teApiNotFound', values };
  if (error.status === 403 && operation === 'presentation') {
    return { key: 'errors.teApiNoVct', values };
  }
  if (error.status === 403) {
    // El `403 cannot_complete` del vínculo tapa cuatro cosas a la vez y es
    // deliberado: ID token con firma mala, `aud` de otra organización, `iat`
    // fuera de la ventana de cinco minutos, o un `sub` que no tiene perfil en
    // te-api — o sea, alguien que todavía no tiene cartera de TripleEnable. Ese
    // último es el caso normal y el único accionable por el titular, así que la
    // frase lo nombra sin afirmar que sea ése.
    return { key: 'errors.teApiLink', values };
  }
  if (error.status === 503) return { key: 'errors.teApiUnavailable', values };
  if (error.status === 429) return { key: 'errors.teApiRateLimited', values };
  if (error.status === 400) {
    // El código sí distingue, y por eso se enseña: `invalid_request` es el
    // cuerpo mal formado —un `requestUri` en `http`, por ejemplo, que el
    // timbre rechaza sin excepción— y `unauthorized_client` es un canal
    // apagado en te-api, que no se arregla cambiando lo que se manda.
    return { key: 'errors.teApiBadRequest', values: { ...values, code: error.code } };
  }
  return {
    key: 'errors.teApiOther',
    values: { ...values, status: error.status, code: error.code },
  };
}

/**
 * El fallo ya escrito.
 *
 * La referencia —` (requestId …)`— se compone aquí y no en cada mensaje: va al
 * final de las siete frases, y repetir su paréntesis siete veces por idioma es
 * repetir siete veces la ocasión de escribirlo distinto. Cuando no hay
 * `requestId` se queda vacía, y la frase termina en su punto.
 */
export function translateTeApiFailure(t: Translator, failure: TeApiFailure): string {
  const requestId = failure.values['requestId'];
  return t(failure.key, {
    ...failure.values,
    reference: requestId === undefined ? '' : t('errors.teApiReference', { requestId }),
  });
}

/** Los dos pasos de arriba, para quien pinta el fallo en el acto. */
export function describeTeApiError(
  t: Translator,
  error: TeApiError,
  operation?: TeApiOperation,
): string {
  return translateTeApiFailure(t, describeTeApiFailure(error, operation));
}
