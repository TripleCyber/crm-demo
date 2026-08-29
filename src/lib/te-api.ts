import 'server-only';

import { getB2bToken, invalidateB2bToken } from './b2b-token';
import type { OrganizationConfig } from './organizations';

/**
 * El cliente de `/v1/b2b/` de te-api.
 *
 * **Es la única puerta de salida del CRM hacia TripleEnable.** No hay ningún
 * otro `fetch` a un servicio nuestro en este proyecto, y en particular no hay
 * ninguno a walt.id: la credencial la construye y la firma te-api, y la recoge
 * la cartera del titular hablando directamente con el emisor. El CRM sólo pide
 * la oferta y pinta el enlace.
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
  throw new TeApiError(`te-api ${path}: reintento agotado`, 500, 'internal_error');
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
    `te-api ${path} respondió ${response.status} (${code})`,
    response.status,
    code,
    requestId,
  );
}

/**
 * El mensaje que ve el empleado. Traduce el 404 opaco a algo accionable sin
 * inventarse un motivo que te-api no ha dado.
 */
export function describeTeApiError(error: TeApiError): string {
  const reference = error.requestId === undefined ? '' : ` (requestId ${error.requestId})`;

  if (error.status === 404) {
    return (
      'te-api ha rechazado la llamada. La puerta B2B contesta lo mismo para ocho ' +
      'motivos distintos (token, recurso, organización, padrón o scope), así que ' +
      'el motivo real está en el registro de te-api' +
      reference +
      '.'
    );
  }
  if (error.status === 403) {
    // El `403 cannot_complete` del vínculo tapa cuatro cosas a la vez y es
    // deliberado: ID token con firma mala, `aud` de otra organización, `iat`
    // fuera de la ventana de cinco minutos, o un `sub` que no tiene perfil en
    // te-api — o sea, alguien que todavía no tiene cartera de TripleEnable. Ese
    // último es el caso normal y el único accionable por el titular, así que la
    // frase lo nombra sin afirmar que sea ése.
    return (
      'te-api no ha podido completar el vínculo. El motivo más habitual es que esa cuenta ' +
      'todavía no tiene una cartera de TripleEnable dada de alta; el motivo real está en el ' +
      'registro de te-api' +
      reference +
      '.'
    );
  }
  if (error.status === 503) {
    return `El emisor de credenciales no está operativo ahora mismo${reference}.`;
  }
  if (error.status === 429) {
    return `Demasiadas peticiones para esta organización; espera un momento${reference}.`;
  }
  if (error.status === 400) {
    // El código sí distingue, y por eso se enseña: `invalid_request` es el
    // cuerpo mal formado —un `requestUri` en `http`, por ejemplo, que el
    // timbre rechaza sin excepción— y `unauthorized_client` es un canal
    // apagado en te-api, que no se arregla cambiando lo que se manda.
    return `te-api ha rechazado los datos de la llamada: ${error.code}${reference}.`;
  }
  return `te-api ha respondido ${error.status} (${error.code})${reference}.`;
}
