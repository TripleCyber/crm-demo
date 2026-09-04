import 'server-only';

import { query } from './db';
import type { VerificationStatus } from './verification-status';

/**
 * El diario de comprobaciones del banco — lectura y escritura de `verification`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  AQUÍ NO SE INVENTA NADA: SE ANOTA LO QUE ESTA CONSOLA HIZO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Cada fila nace cuando el agente lanza una comprobación y se cierra cuando
 * te-api dice cómo acabó. Ni un campo se compone: lo que se pidió lo eligió el
 * agente, las horas las sella este servidor y el desenlace se copia tal cual del
 * evento `presentation.settled` que te-api entrega al webhook — este servidor no
 * pregunta por él. La razón larga está en `db/003_verification.sql`.
 *
 * Toda consulta lleva el `org_id` en el `where`, sin excepción, por lo mismo
 * que en `./customers.ts`: no existe una función que encuentre una comprobación
 * sin decir de qué organización es.
 */

/**
 * El recibo firmado de una presentación, tal y como lo mandó te-api.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ES UNA UNIDAD, Y POR ESO VIVE EN UNA SOLA COLUMNA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Las seis piezas se guardan juntas en `verification.proof` porque juntas son
 * lo que permite que un tercero **vuelva a verificar la firma sin preguntarnos
 * nada**: el `keyBinding` es lo que se comprueba, el `nonce` y el `audience`
 * son contra qué se comprueba, el `sdHash` ata la firma a esa presentación
 * concreta, y `presentation` es la cadena entera por si hace falta rehacerlo
 * todo desde el principio.
 *
 * Todos los campos son `string | null` y ninguno se compone aquí. Lo que no
 * venga en el evento se queda a `null`: un recibo con un `nonce` inventado no
 * es un recibo peor, es un recibo falso.
 */
export interface PresentationProof {
  /** La cadena completa: `<SD-JWT>~<disclosure>~…~<KB-JWT>`. */
  readonly presentation: string | null;
  /** El KB-JWT suelto. Es lo que ata la presentación a la llave del titular. */
  readonly keyBinding: string | null;
  /** El `sd_hash` que firmó el titular: ata su firma a **esta** presentación. */
  readonly sdHash: string | null;
  /** El `aud` del KB-JWT: el verificador para el que se firmó, y ningún otro. */
  readonly audience: string | null;
  /** El `nonce` de la petición. Es lo que impide reutilizar una firma vieja. */
  readonly nonce: string | null;
  /**
   * Cuándo firmó **el titular**, según el reloj de su teléfono.
   *
   * No es `settledAt`, que es cuándo se enteró esta consola: entre las dos hay
   * lo que tarde el evento en llegar. Las dos se guardan y las dos se pintan,
   * con rótulos distintos, porque la diferencia es exactamente el dato que un
   * banco necesita para reconstruir una llamada.
   */
  readonly signedAt: string | null;
}

export interface VerificationRecord {
  readonly presentationId: string;
  readonly externalId: string;
  readonly typeKey: string;
  readonly requestedClaims: readonly string[];
  readonly channel: 'qr' | 'phone';
  readonly issuerDid: string;
  readonly authorizationRequestUrl: string;
  /**
   * El enlace de mostrador que devolvió te-api al crear la petición
   * (`tripleenable://requests/…`). Es lo que se dibuja como QR, y se guarda
   * —en vez de rehacerse— porque lo construye te-api y no nos toca a nosotros
   * fabricarlo. Nulo en la rama del teléfono y si el canal QR está apagado.
   */
  readonly counterLink: string | null;
  readonly requestUri: string;
  readonly expiresAt: string;
  readonly agentId: string;
  readonly agentName: string;
  readonly requestedAt: string;
  readonly wakeupId: string | null;
  readonly wakeupAt: string | null;
  readonly settledAt: string | null;
  readonly status: VerificationStatus;
  readonly disclosedClaims: Record<string, unknown> | null;

  // ── Lo que trae la confirmación del titular ──────────────────────────────
  //
  // Los cuatro llegan por el evento `presentation.settled` y **sólo cuando el
  // desenlace es `verified`**: una comprobación rechazada, caducada o fallida
  // no tiene recibo. Pueden faltar además si el cuerpo se degradó por tamaño o
  // si el evento viene de una versión anterior, así que todos son anulables y
  // la pantalla no pinta la fila que no tiene dato. Ver `db/010_holder_proof.sql`.

  /**
   * La huella RFC 7638 de la llave con la que firmó el titular.
   *
   * Se llama `holderKey` y no `holderKeyThumbprint` a propósito: es el nombre
   * que espera `HolderProof` en `components/VerificationTracker.tsx`, y así la
   * página del seguimiento pasa la fila entera sin traducir campo a campo. La
   * columna sí se llama `holder_key_thumbprint`, que es lo que hay que buscar
   * en un `select` a mano.
   */
  readonly holderKey: string | null;
  /** La llave en sí. Es el material con el que se re-verifica la firma. */
  readonly holderKeyJwk: Record<string, unknown> | null;
  /** El vínculo de esa persona con **esta** organización, no su id global. */
  readonly holderLinkId: string | null;
  /** El recibo firmado entero. Ver `PresentationProof`. */
  readonly proof: PresentationProof | null;
}

/** Una comprobación con el nombre del cliente al lado, para los listados. */
export interface VerificationListEntry extends VerificationRecord {
  readonly customerName: string | null;
}

interface VerificationRow extends Record<string, unknown> {
  presentation_id: string;
  external_id: string;
  type_key: string;
  requested_claims: string[];
  channel: 'qr' | 'phone';
  issuer_did: string;
  authorization_request_url: string;
  counter_link: string | null;
  request_uri: string;
  expires_at: Date;
  agent_id: string;
  agent_name: string;
  requested_at: Date;
  wakeup_id: string | null;
  wakeup_at: Date | null;
  settled_at: Date | null;
  status: VerificationStatus;
  disclosed_claims: Record<string, unknown> | null;
  holder_key_thumbprint: string | null;
  holder_key_jwk: Record<string, unknown> | null;
  holder_link_id: string | null;
  // `unknown` y no `PresentationProof`: es una columna `jsonb`, o sea que lo que
  // devuelve el driver es lo que hubiera dentro, y una fila escrita por una
  // versión anterior —o a mano— no tiene por qué tener la forma de hoy.
  // `readPresentationProof` es quien decide qué de eso es utilizable.
  proof: unknown;
}

/**
 * Normaliza el recibo firmado, venga de donde venga.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  UN SOLO LECTOR PARA LOS DOS BORDES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Lo usan dos sitios y a propósito: el receptor de webhooks, para validar lo
 * que llega en el evento antes de escribirlo, y `toRecord`, para normalizar lo
 * que devuelve la columna `jsonb` al leerla. Los dos son bordes —JSON ajeno en
 * un caso, contenido histórico de una columna sin esquema en el otro— y tener
 * dos validaciones distintas para la misma forma es cómo acaban divergiendo.
 *
 * Se queda con **los campos que reconoce y descarta el resto**, en vez de
 * rechazar el objeto entero por un campo raro: un evento que traiga una pieza
 * nueva tiene que poder guardarse con las que ya se entienden. Lo que sí se
 * descarta entero es lo que no sea un objeto, porque de ahí no se puede sacar
 * nada. Un objeto del que no se reconozca ni un campo devuelve `null` y no un
 * recibo con seis huecos: la fila vacía y la fila ausente significan lo mismo
 * y sólo una de las dos hace que la pantalla pinte rótulos sin valor.
 */
export function readPresentationProof(value: unknown): PresentationProof | null {
  if (!isRecord(value)) return null;

  const proof: PresentationProof = {
    presentation: asString(value['presentation']),
    keyBinding: asString(value['keyBinding']),
    sdHash: asString(value['sdHash']),
    audience: asString(value['audience']),
    nonce: asString(value['nonce']),
    signedAt: asString(value['signedAt']),
  };

  return Object.values(proof).some((field) => field !== null) ? proof : null;
}

/** Un objeto JSON, que no es lo mismo que «no nulo»: un array tampoco vale. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Una cadena con contenido, o `null`. La cadena vacía no es un dato. */
function asString(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

/**
 * Las columnas que lee la aplicación, con el prefijo de la tabla ya puesto.
 *
 * Lleva alias (`v.`) porque una de las consultas hace `join` con `customer` y
 * las dos tablas tienen `org_id` y `external_id`: sin prefijo, Postgres
 * rechazaría la consulta por ambigua. Las que no hacen `join` declaran el mismo
 * alias y así la lista es una sola.
 */
const SELECT_COLUMNS = `
  v.presentation_id,
  v.external_id,
  v.type_key,
  v.requested_claims,
  v.channel,
  v.issuer_did,
  v.authorization_request_url,
  v.counter_link,
  v.request_uri,
  v.expires_at,
  v.agent_id,
  v.agent_name,
  v.requested_at,
  v.wakeup_id,
  v.wakeup_at,
  v.settled_at,
  v.status,
  v.disclosed_claims,
  v.holder_key_thumbprint,
  v.holder_key_jwk,
  v.holder_link_id,
  v.proof
`;

function toRecord(row: VerificationRow): VerificationRecord {
  return {
    presentationId: row.presentation_id,
    externalId: row.external_id,
    typeKey: row.type_key,
    requestedClaims: row.requested_claims,
    channel: row.channel,
    issuerDid: row.issuer_did,
    authorizationRequestUrl: row.authorization_request_url,
    counterLink: row.counter_link,
    requestUri: row.request_uri,
    expiresAt: row.expires_at.toISOString(),
    agentId: row.agent_id,
    agentName: row.agent_name,
    requestedAt: row.requested_at.toISOString(),
    wakeupId: row.wakeup_id,
    wakeupAt: row.wakeup_at === null ? null : row.wakeup_at.toISOString(),
    settledAt: row.settled_at === null ? null : row.settled_at.toISOString(),
    status: row.status,
    disclosedClaims: row.disclosed_claims,
    holderKey: row.holder_key_thumbprint,
    holderKeyJwk: row.holder_key_jwk,
    holderLinkId: row.holder_link_id,
    proof: readPresentationProof(row.proof),
  };
}

export interface RecordVerificationInput {
  readonly orgId: string;
  readonly externalId: string;
  readonly presentationId: string;
  readonly typeKey: string;
  readonly requestedClaims: readonly string[];
  readonly channel: 'qr' | 'phone';
  readonly issuerDid: string;
  readonly authorizationRequestUrl: string;
  readonly counterLink: string | null;
  readonly requestUri: string;
  readonly expiresAt: string;
  readonly agentId: string;
  readonly agentName: string;
  readonly actor: string;
  readonly requestedAt: string;
  readonly wakeupId: string | undefined;
  readonly wakeupAt: string | undefined;
}

/**
 * Anota la comprobación recién lanzada.
 *
 * Se llama **después** de que te-api haya abierto la sesión y —en el canal de
 * teléfono— después de que el timbre haya salido, para que la fila no exista
 * si la ceremonia no llegó a empezar. Una fila «pendiente» de algo que nunca se
 * pidió es peor que ninguna: el agente la vería en el historial del cliente y
 * creería que le avisó.
 */
export async function recordVerification(input: RecordVerificationInput): Promise<void> {
  await query(
    `insert into verification
       (org_id, external_id, presentation_id, type_key, requested_claims, channel,
        issuer_did, authorization_request_url, counter_link, request_uri, expires_at,
        agent_id, agent_name, actor, requested_at, wakeup_id, wakeup_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
     on conflict (org_id, presentation_id) do nothing`,
    [
      input.orgId,
      input.externalId,
      input.presentationId,
      input.typeKey,
      [...input.requestedClaims],
      input.channel,
      input.issuerDid,
      input.authorizationRequestUrl,
      input.counterLink,
      input.requestUri,
      input.expiresAt,
      input.agentId,
      input.agentName,
      input.actor,
      input.requestedAt,
      input.wakeupId ?? null,
      input.wakeupAt ?? null,
    ],
  );
}

/**
 * Todo lo que trae la confirmación del titular, ya validado por quien lo recibe.
 *
 * Es un objeto y no cinco parámetros sueltos porque cinco posicionales del
 * mismo tipo —cuatro de ellos anulables— es la firma que acaba invocada con dos
 * argumentos intercambiados sin que nada lo note. Aquí, además, todos menos
 * `status` pueden ser `null` a la vez, que es el caso normal en cuatro de los
 * cinco desenlaces.
 */
export interface VerificationSettlement {
  readonly status: Exclude<VerificationStatus, 'pending'>;
  /** Lo que el titular decidió enseñar. `null` salvo en `verified`. */
  readonly disclosedClaims: Record<string, unknown> | null;
  /** La huella RFC 7638 de la llave que firmó. */
  readonly holderKey: string | null;
  /** La llave en sí, para poder re-verificar la firma sin preguntar. */
  readonly holderKeyJwk: Record<string, unknown> | null;
  /** El vínculo del titular con esta organización. */
  readonly holderLinkId: string | null;
  /** El recibo firmado entero. */
  readonly proof: PresentationProof | null;
}

/**
 * Cierra la fila con el desenlace que ha dado te-api.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  UN SOLO LLAMANTE: EL RECEPTOR DE WEBHOOKS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Y eso es nuevo. Antes eran dos —el receptor de webhooks y la ruta que sondeaba
 * `GET /v1/b2b/presentations/:id` cada tres segundos—; el sondeo se retiró
 * entero, así que el único camino por el que un desenlace entra en este diario
 * es un `POST` de te-api **con la firma comprobada** (`api/webhooks/te-api`).
 *
 * Sigue sin poder venir del navegador, que era la propiedad importante: si el
 * estado saliera del cuerpo de una petición del agente, cualquiera con la
 * consola de red abierta cerraría en verde la comprobación de otro y el diario
 * del banco pasaría a ser un campo de texto editable. Ahora hay una razón más
 * para que no ocurra — no queda ninguna ruta que escriba aquí desde una acción
 * del navegador.
 *
 * El `where` exige que siga en `pending`: el primer desenlace es el bueno y las
 * reentregas que lleguen después no lo reescriben, así que `settled_at` guarda
 * la hora en la que el banco se enteró **la primera vez**. Es idempotente a
 * propósito — la entrega de te-api es «al menos una vez».
 */
export async function settleVerification(
  orgId: string,
  presentationId: string,
  settlement: VerificationSettlement,
): Promise<void> {
  await query(
    `update verification
        set status = $3,
            -- coalesce y no una asignacion a secas, en las cinco.
            --
            -- El dia que se anuncio aqui ya llego: el evento trae los claims y
            -- trae el recibo firmado, asi que estas columnas se llenan de
            -- verdad y no son un hueco decorativo. Y con dato dentro, la
            -- diferencia entre coalesce y asignacion deja de ser teorica.
            --
            -- La regla es la misma para las cinco: **el que llegue con null no
            -- borra lo que ya hay**. te-api entrega «al menos una vez», y una
            -- reentrega puede venir degradada por tamano —te-api tiene un tope
            -- de cuerpo y recorta estos campos antes que el sobre— o de una
            -- version del evento que todavia no los llevaba. Si esa reentrega
            -- se colase, un recibo completo pasaria a estar vacio sin que nada
            -- lo dijera. El where de abajo ya protege el caso normal, porque
            -- exige que la fila siga pendiente; esto protege el que no pasa
            -- por ahi.
            disclosed_claims       = coalesce($4, disclosed_claims),
            holder_key_thumbprint  = coalesce($5, holder_key_thumbprint),
            holder_key_jwk         = coalesce($6, holder_key_jwk),
            holder_link_id         = coalesce($7, holder_link_id),
            proof                  = coalesce($8, proof),
            settled_at = now()
      where org_id = $1 and presentation_id = $2 and status = 'pending'`,
    [
      orgId,
      presentationId,
      settlement.status,
      toJsonParam(settlement.disclosedClaims),
      settlement.holderKey,
      toJsonParam(settlement.holderKeyJwk),
      settlement.holderLinkId,
      toJsonParam(settlement.proof),
    ],
  );
}

/**
 * Serializa un objeto para una columna `jsonb`, o pasa el `null` tal cual.
 *
 * El driver manda `undefined` y los objetos de formas distintas segun el tipo
 * inferido del parametro; serializar aqui hace que los tres `jsonb` de la
 * consulta viajen igual, y que un `null` siga siendo un `null` de SQL —que es
 * lo que el `coalesce` de arriba necesita para no borrar nada—.
 */
function toJsonParam(value: object | null): string | null {
  return value === null ? null : JSON.stringify(value);
}

export async function findVerification(
  orgId: string,
  presentationId: string,
): Promise<VerificationRecord | null> {
  const rows = await query<VerificationRow>(
    `select ${SELECT_COLUMNS} from verification v
      where v.org_id = $1 and v.presentation_id = $2`,
    [orgId, presentationId],
  );
  const row = rows[0];
  return row === undefined ? null : toRecord(row);
}

/** El historial de un cliente, de la más reciente a la más vieja. */
export async function listVerificationsForCustomer(
  orgId: string,
  externalId: string,
  limit = 20,
): Promise<VerificationRecord[]> {
  const rows = await query<VerificationRow>(
    `select ${SELECT_COLUMNS} from verification v
      where v.org_id = $1 and v.external_id = $2
      order by v.requested_at desc
      limit $3`,
    [orgId, externalId, limit],
  );
  return rows.map(toRecord);
}

/**
 * Las comprobaciones recientes de toda la organización.
 *
 * El nombre del cliente se trae con un `left join` y no con una segunda
 * consulta: es una sola pantalla y una sola lista, y N+1 consultas para pintar
 * cincuenta filas es la clase de detalle que no se nota en la maqueta y sí en
 * el primer despliegue. `left` porque una ficha puede haberse corregido después
 * y la comprobación no se borra por eso — entonces la columna sale vacía y la
 * pantalla enseña el identificador, que sigue siendo verdad.
 */
export async function listRecentVerifications(
  orgId: string,
  limit = 50,
): Promise<VerificationListEntry[]> {
  const rows = await query<VerificationRow & { customer_name: string | null }>(
    `select ${SELECT_COLUMNS},
            nullif(trim(concat(c.given_name, ' ', c.family_name)), '') as customer_name
       from verification v
       left join customer c
         on c.org_id = v.org_id and c.external_id = v.external_id
      where v.org_id = $1
      order by v.requested_at desc
      limit $2`,
    [orgId, limit],
  );
  return rows.map((row) => ({ ...toRecord(row), customerName: row.customer_name }));
}
