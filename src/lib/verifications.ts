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
 * agente, las horas las sella este servidor y el desenlace se copia tal cual de
 * `GET /v1/b2b/presentations/:id`. La razón larga está en `db/003_verification.sql`.
 *
 * Toda consulta lleva el `org_id` en el `where`, sin excepción, por lo mismo
 * que en `./customers.ts`: no existe una función que encuentre una comprobación
 * sin decir de qué organización es.
 */

export interface VerificationRecord {
  readonly presentationId: string;
  readonly externalId: string;
  readonly typeKey: string;
  readonly requestedClaims: readonly string[];
  readonly channel: 'qr' | 'phone';
  readonly issuerDid: string;
  readonly authorizationRequestUrl: string;
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
  v.request_uri,
  v.expires_at,
  v.agent_id,
  v.agent_name,
  v.requested_at,
  v.wakeup_id,
  v.wakeup_at,
  v.settled_at,
  v.status,
  v.disclosed_claims
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
        issuer_did, authorization_request_url, request_uri, expires_at,
        agent_id, agent_name, actor, requested_at, wakeup_id, wakeup_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
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
 * Cierra la fila con el desenlace que ha dado te-api.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  EL ESTADO LO TRAE te-api, NUNCA EL NAVEGADOR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Quien llama a esto es la ruta que acaba de consultar
 * `GET /v1/b2b/presentations/:id` con el token de la organización. El navegador
 * sólo dispara la consulta; el valor sale de te-api. Si el estado viniera del
 * cuerpo de una petición, cualquiera con la consola de red abierta cerraría en
 * verde la comprobación de otro, y el diario del banco pasaría a ser un campo
 * de texto editable.
 *
 * El `where` exige que siga en `pending`: el primer desenlace es el bueno y los
 * sondeos que llegan después no lo reescriben, así que `settled_at` guarda la
 * hora en la que el banco se enteró **la primera vez**. Es idempotente a
 * propósito — la pantalla sondea cada tres segundos y puede haber dos pestañas
 * abiertas.
 */
export async function settleVerification(
  orgId: string,
  presentationId: string,
  status: Exclude<VerificationStatus, 'pending'>,
  disclosedClaims: Record<string, unknown> | null,
): Promise<void> {
  await query(
    `update verification
        set status = $3,
            -- coalesce y no una asignación a secas, POR EL WEBHOOK.
            --
            -- Este diario se cierra ahora por dos caminos: el sondeo de la
            -- pantalla, que trae los claims que enseñó el titular, y el evento
            -- de te-api, que trae el veredicto y a propósito NO trae los claims
            -- (minimiza el dato personal que sale por un canal saliente). Con
            -- una asignación normal, el que llegara segundo con null borraría lo
            -- que hubiera escrito el primero.
            --
            -- Hoy no puede pasar -- el where exige pending y el primero en
            -- llegar cierra la fila -- pero eso hace que los claims dependan de
            -- QUIEN llegue antes, y eso si es una carrera de verdad: el webhook
            -- gana siempre que el agente no tenga la pestaña abierta. Preservar
            -- lo que ya hubiera es lo correcto en los dos ordenes.
            disclosed_claims = coalesce($4, disclosed_claims),
            settled_at = now()
      where org_id = $1 and presentation_id = $2 and status = 'pending'`,
    [orgId, presentationId, status, disclosedClaims === null ? null : JSON.stringify(disclosedClaims)],
  );
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
