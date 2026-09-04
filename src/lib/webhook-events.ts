import 'server-only';

import { query } from './db';
import type { SignatureFailure } from './webhook-signature';

/**
 * El diario de webhooks del CRM: lo que te-api ha mandado y qué se hizo con ello.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  EL CONTRATO DEL EVENTO ES DE te-api, Y ESTÁ ESCRITO ALLÍ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La forma la fija `tripleenable-api/src/b2b/webhook-events.ts`, que es el
 * fichero que hay que abrir cuando algo no cuadre. Lo que llega hoy:
 *
 *     {
 *       "id":             "<uuidv7>",              // = cabecera te-event-id
 *       "type":           "presentation.settled",
 *       "apiVersion":     "2026-08-31",
 *       "createdAt":      "2026-08-31T10:15:30.000Z",
 *       "organizationId": "ww51qgtvpc9h",
 *       "data": {
 *         "presentationId": "<uuidv7>",
 *         "status":         "verified" | "rejected" | "failed" | "expired" | null,
 *         "credentialType": "cliente",
 *         "requestedAt":    "…", "expiresAt": "…", "settledAt": "…"
 *       }
 *     }
 *
 * Y dos tipos, hoy: `presentation.settled` —que cubre **todos** los finales, con
 * el desenlace en `data.status`— y `webhook.test`, cuyo `data.presentationId` es
 * `null` siempre.
 *
 * ## Lo que el evento NO lleva, y por qué eso no es un hueco
 *
 * Ni los claims que enseñó el titular, ni el recibo firmado, ni su clave. Es
 * deliberado en te-api: minimizar el dato personal que sale por un canal
 * saliente. Existe `GET /v1/b2b/presentations/:id`, que sí los sirve, pero
 * **este CRM ya no la llama**: el sondeo se retiró entero y con él la única
 * llamada que este servidor hacía para preguntar si algo había terminado.
 *
 * Consecuencia, dicha sin adornos: **el recibo pinta el veredicto pero no los
 * atributos que enseñó el titular**, porque nadie se los cuenta. No se disimula
 * y no se suple preguntando — el sitio donde se arregla es el evento, en te-api.
 *
 * Lo que sí cambia, y es el punto entero de que esto exista: **con el veredicto
 * dentro, el receptor cierra el caso sin volver a llamar**. Un titular que
 * contesta media hora después, con el agente ya en otra llamada, deja huella en
 * el diario de este banco sin que nadie tenga la pestaña abierta.
 *
 * ## Cómo se despacha
 *
 * Por `type`, con una rama por tipo conocido y **una salida para lo que no se
 * conozca**: se guarda y no se actúa. Un tipo nuevo no puede ser un `500` en el
 * receptor — te-api reintentaría ocho veces algo que nunca va a entrar, y el
 * administrador vería su endpoint suspendido por no saber leer una palabra.
 *
 * ## Idempotencia
 *
 * La entrega es **al menos una vez**: un reintento llega con el mismo `id`. La
 * clave primaria de la tabla es ese id y el `insert` lleva `on conflict do
 * nothing`, así que la repetición no escribe dos filas ni vuelve a actuar. Se
 * deduplica por `event_id` y **no** por `te-delivery-id`, que cambia en cada
 * intento — deduplicar por él dejaría entrar el mismo evento ocho veces.
 */

/** Un evento tal y como se guarda y se enseña. */
export interface WebhookEventRecord {
  readonly eventId: string;
  readonly orgId: string;
  readonly type: string;
  readonly apiVersion: string | null;
  /** Cuándo lo registró te-api. `null` si el cuerpo no lo traía. */
  readonly occurredAt: string | null;
  /** Cuándo llegó a este servidor. Lo sella esta base. */
  readonly receivedAt: string;
  readonly presentationId: string | null;
  /** El cliente al que afecta, cruzado aquí contra `verification`. */
  readonly externalId: string | null;
  readonly status: string | null;
  readonly signatureOk: boolean;
  readonly signatureError: string | null;
  readonly deliveryId: string | null;
  /** El cuerpo entero, tal y como llegó. */
  readonly payload: unknown;
}

interface WebhookEventRow extends Record<string, unknown> {
  event_id: string;
  org_id: string;
  type: string;
  api_version: string | null;
  occurred_at: Date | null;
  received_at: Date;
  presentation_id: string | null;
  external_id: string | null;
  status: string | null;
  signature_ok: boolean;
  signature_error: string | null;
  delivery_id: string | null;
  payload: unknown;
}

function toRecord(row: WebhookEventRow): WebhookEventRecord {
  return {
    eventId: row.event_id,
    orgId: row.org_id,
    type: row.type,
    apiVersion: row.api_version,
    occurredAt: row.occurred_at === null ? null : row.occurred_at.toISOString(),
    receivedAt: row.received_at.toISOString(),
    presentationId: row.presentation_id,
    externalId: row.external_id,
    status: row.status,
    signatureOk: row.signature_ok,
    signatureError: row.signature_error,
    deliveryId: row.delivery_id,
    payload: row.payload,
  };
}

export interface StoreWebhookEventInput {
  readonly eventId: string;
  readonly orgId: string;
  readonly type: string;
  readonly apiVersion: string | null;
  readonly occurredAt: string | null;
  readonly presentationId: string | null;
  readonly status: string | null;
  readonly signatureOk: boolean;
  readonly signatureError: SignatureFailure | null;
  readonly deliveryId: string | null;
  readonly payload: unknown;
}

/**
 * Guarda un evento. Devuelve `false` si ya estaba — o sea, si es un reintento.
 *
 * El `external_id` se resuelve **en el propio `insert`**, con una subconsulta
 * contra `verification`. Se hace así y no en dos viajes porque las dos escrituras
 * tienen que ver la misma base: entre un `select` y un `insert` separados cabe
 * que la comprobación se cierre por el otro camino, y entonces la fila del
 * evento se quedaría sin cliente por una carrera que nadie va a reproducir.
 *
 * `null` si no cruza, que es lo normal en `webhook.test` y en una presentación
 * que no abrió esta consola. No es un error: te-api no conoce el padrón de esta
 * empresa y no tiene por qué mandar el `external_id`.
 */
export async function storeWebhookEvent(input: StoreWebhookEventInput): Promise<boolean> {
  const rows = await query<{ event_id: string }>(
    `insert into webhook_event
       (event_id, org_id, type, api_version, occurred_at, presentation_id, external_id,
        status, signature_ok, signature_error, delivery_id, payload)
     values ($1, $2, $3, $4, $5, $6,
             (select v.external_id from verification v
               where v.org_id = $2 and v.presentation_id = $6),
             $7, $8, $9, $10, $11::jsonb)
     on conflict (event_id) do nothing
     returning event_id`,
    [
      input.eventId,
      input.orgId,
      input.type,
      input.apiVersion,
      input.occurredAt,
      input.presentationId,
      input.status,
      input.signatureOk,
      input.signatureError,
      input.deliveryId,
      JSON.stringify(input.payload),
    ],
  );
  return rows.length > 0;
}

/**
 * Los últimos eventos de esta organización, lo más reciente primero.
 *
 * Con `org_id` en el `where` como todo lo demás de este proyecto: dos
 * instalaciones pueden acabar apuntando a la misma base, y entonces esto es lo
 * único que impide que la pantalla de una enseñe los eventos de la otra.
 */
export async function listWebhookEvents(
  orgId: string,
  limit = 100,
): Promise<WebhookEventRecord[]> {
  const rows = await query<WebhookEventRow>(
    `select event_id, org_id, type, api_version, occurred_at, received_at,
            presentation_id, external_id, status, signature_ok, signature_error,
            delivery_id, payload
       from webhook_event
      where org_id = $1
      order by received_at desc
      limit $2`,
    [orgId, limit],
  );
  return rows.map(toRecord);
}

/**
 * **Lo que ha entrado desde un instante concreto.** La otra mitad del catálogo
 * de verificaciones: qué contestó te-api a la petición que se acaba de mandar.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  SE FILTRA POR HORA Y NO POR `request_id`, Y NO PORQUE SEA MÁS CÓMODO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Porque **no hay `request_id` en ningún evento**. te-api manda hoy dos tipos y
 * ninguno habla de peticiones del marco: `presentation.settled`, que se
 * identifica por `presentationId`, y `webhook.test`. Una petición que firma con
 * la identidad de la cartera —la mayoría del catálogo— se aprueba, se rechaza o
 * caduca **sin que salga ningún webhook**, y eso es un hueco del contrato de
 * te-api, no de esta consulta.
 *
 * Así que lo que esta función puede contestar con verdad es «qué ha llegado
 * desde que pulsaste», y la pantalla dice exactamente eso. Lo que sí se puede
 * emparejar de verdad es la mitad de credencial: allí hay `presentationId`, es
 * el mismo que devolvió `POST /v1/b2b/presentations` y el que esta consola anotó
 * en `verification` — y quien empareja es la pantalla, comparando esa columna.
 *
 * El día que te-api mande un evento de petición, esta función no cambia: la
 * pantalla deja de tener que disculparse.
 *
 * `since` va como texto ISO y lo convierte Postgres, igual que `occurred_at` en
 * el `insert`. El tope está para que una pestaña abierta desde ayer no se traiga
 * el diario entero.
 */
export async function listWebhookEventsSince(
  orgId: string,
  since: string,
  limit = 25,
): Promise<WebhookEventRecord[]> {
  const rows = await query<WebhookEventRow>(
    `select event_id, org_id, type, api_version, occurred_at, received_at,
            presentation_id, external_id, status, signature_ok, signature_error,
            delivery_id, payload
       from webhook_event
      where org_id = $1 and received_at >= $2::timestamptz
      order by received_at desc
      limit $3`,
    [orgId, since, limit],
  );
  return rows.map(toRecord);
}

/** Cuántos han llegado y cuántos venían mal firmados. Para Diagnóstico. */
export interface WebhookEventTally {
  readonly total: number;
  readonly rejected: number;
  readonly lastReceivedAt: string | null;
}

export async function countWebhookEvents(orgId: string): Promise<WebhookEventTally> {
  const rows = await query<{ total: string; rejected: string; last_received_at: Date | null }>(
    `select count(*)::text as total,
            count(*) filter (where not signature_ok)::text as rejected,
            max(received_at) as last_received_at
       from webhook_event
      where org_id = $1`,
    [orgId],
  );
  const row = rows[0];
  return {
    total: Number(row?.total ?? '0'),
    rejected: Number(row?.rejected ?? '0'),
    lastReceivedAt: row?.last_received_at?.toISOString() ?? null,
  };
}
