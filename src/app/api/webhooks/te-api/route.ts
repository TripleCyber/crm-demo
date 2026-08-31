import { NextResponse } from 'next/server';

import { logConsoleFailure } from '@/lib/console-failures';
import { getOrganization } from '@/lib/organization';
import { settleVerification } from '@/lib/verifications';
import { isTerminalStatus } from '@/lib/verification-status';
import { storeWebhookEvent } from '@/lib/webhook-events';
import {
  DELIVERY_ID_HEADER,
  EVENT_ID_HEADER,
  SIGNATURE_HEADER,
  verifyWebhookSignature,
} from '@/lib/webhook-signature';

/**
 * `POST /api/webhooks/te-api` — **por donde el CRM se entera sin preguntar**.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  QUÉ SE PEGA EN LA CONSOLA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *     https://<CRM_ORG_DOMAIN>/api/webhooks/te-api
 *
 * Su administrador la registra en tenant-admin → Credentials → Webhook, y al
 * registrarla la consola le da **un secreto de firma**, que es el que va en
 * `CRM_WEBHOOK_SECRET`. Las dos direcciones concretas están escritas en el
 * `.env.example`, para que quien despliegue no tenga que componerlas.
 *
 * Hasta que exista esto, la organización de demostración tenía su webhook
 * apuntando a `webhook.site` — una dirección de prueba que no es de nadie.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ORDEN DE LOS PASOS, Y NINGUNO ES INTERCAMBIABLE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 1. **Leer el cuerpo CRUDO.** `request.text()`, nunca `request.json()`. te-api
 *    firma la cadena exacta que manda, así que reserializar lo que devuelva
 *    `JSON.parse` cambia espacios y orden de claves y la firma deja de cuadrar
 *    sin que nada diga por qué.
 * 2. **Comprobar la firma.** Antes de mirar el contenido, y desde luego antes de
 *    tocar nada. `src/lib/webhook-signature.ts` tiene la forma exacta y el
 *    porqué; lo que hay que saber aquí es que **una firma mala no actúa jamás**.
 * 3. **Guardar.** Lo que cuadra y lo que no: una entrega mal firmada es o alguien
 *    inventando eventos, o el secreto rotado sin actualizar aquí, y las dos hay
 *    que verlas (ver `db/007_webhook_event.sql`).
 * 4. **Actuar, sólo si la firma cuadró y sólo si el evento es nuevo.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  QUÉ SE CONTESTA, QUE NO ES UN DETALLE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * te-api considera éxito **sólo un 2xx**, no sigue redirecciones (un 3xx es un
 * fallo), reintenta con una escalera que llega a las 24 horas, y **suspende el
 * endpoint tras 20 fallos seguidos**. O sea que lo que se conteste aquí decide
 * si la integración sigue viva.
 *
 * De ahí las tres reglas:
 *
 *  · **401 a la firma mala.** Es un fallo de verdad y tiene que reintentarse: si
 *    lo que pasa es que el secreto se rotó y aquí no se actualizó, los reintentos
 *    de 24 horas son exactamente la ventana para arreglarlo sin perder el evento.
 *  · **200 a un tipo desconocido.** No es un fallo nuestro que te-api pueda
 *    arreglar reintentando: el evento se guardó y está en la pantalla. Contestar
 *    error dejaría el endpoint suspendido por no saber leer una palabra nueva.
 *  · **500 sólo si la BASE falla.** Ahí sí queremos el reintento, porque el
 *    evento no se ha guardado y se perdería.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  Y ESTO NO SUSTITUYE AL BARRIDO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `GET /v1/b2b/presentations/:id` sigue exactamente igual y sigue siendo lo que
 * sondea la pantalla de comprobación mientras el agente mira. Son dos caminos a
 * propósito: el sondeo es el que responde en tres segundos con el agente al
 * teléfono, y el webhook es el que cierra el caso del titular que contesta media
 * hora después. El que llegue primero gana, y `settleVerification` sólo escribe
 * si la fila sigue en `pending`, así que no compiten.
 *
 * Lo que este receptor **no** hace es llamar a te-api para completar el evento.
 * Todo lo que necesita viene dentro; los claims y el recibo firmado no vienen a
 * propósito —te-api minimiza el dato personal que sale por un canal saliente— y
 * quien los quiera los lee por el camino autenticado de siempre.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** El sobre común a todos los tipos. Lo que no encaje se guarda igual. */
interface WebhookEnvelope {
  readonly id?: unknown;
  readonly type?: unknown;
  readonly apiVersion?: unknown;
  readonly createdAt?: unknown;
  readonly organizationId?: unknown;
  readonly data?: unknown;
}

export async function POST(request: Request): Promise<NextResponse> {
  let organization;
  try {
    organization = getOrganization();
  } catch (error) {
    // Sin configuración no se sabe ni de quién es este CRM ni con qué secreto
    // comprobar. 500 para que te-api reintente: es un fallo de este lado y se
    // arregla poniendo las variables.
    logConsoleFailure(error, 'el receptor de webhooks no pudo leer su configuración');
    return NextResponse.json({ error: 'not_configured' }, { status: 500 });
  }

  // ── Paso 1: el cuerpo crudo ─────────────────────────────────────────────
  const rawBody = await request.text();

  // ── Paso 2: la firma, antes de mirar el contenido ───────────────────────
  const check = verifyWebhookSignature(
    organization.webhookSecret,
    request.headers.get(SIGNATURE_HEADER),
    rawBody,
  );

  // El sobre se lee aunque la firma esté mal — para poder guardar de qué decía
  // ser—, pero **nada de lo que salga de aquí autoriza ninguna acción** mientras
  // `check.ok` sea falso. Un cuerpo ilegible da un sobre vacío y se guarda igual.
  const envelope = parseEnvelope(rawBody);
  const headerEventId = request.headers.get(EVENT_ID_HEADER);

  // El id del evento sale del CUERPO cuando la firma cuadra —está dentro del
  // MAC, así que nadie lo ha tocado— y de la cabecera sólo como respaldo para
  // poder archivar un rechazo. Un `POST` sin ninguno de los dos se archiva con
  // un id sintético: sin clave no hay fila, y sin fila no hay síntoma.
  const eventId =
    asString(envelope.id) ?? nonEmpty(headerEventId) ?? `unsigned-${crypto.randomUUID()}`;

  const data = isRecord(envelope.data) ? envelope.data : {};
  const presentationId = asString(data['presentationId']) ?? null;

  let stored: boolean;
  try {
    stored = await storeWebhookEvent({
      eventId,
      // De QUIÉN es esta fila la decide **nuestra** configuración, no el cuerpo.
      // Guardar aquí el `organizationId` que viniera dentro dejaría que un `POST`
      // falsificado escribiera filas que la pantalla de esta empresa no enseña —
      // o peor, que enseñara la de otra. Lo que venía en el cuerpo se compara
      // más abajo y se registra si discrepa.
      orgId: organization.orgId,
      type: asString(envelope.type) ?? 'unknown',
      apiVersion: asString(envelope.apiVersion) ?? null,
      occurredAt: asString(envelope.createdAt) ?? null,
      presentationId,
      status: asString(data['status']) ?? null,
      signatureOk: check.ok,
      signatureError: check.ok ? null : check.reason,
      deliveryId: nonEmpty(request.headers.get(DELIVERY_ID_HEADER)) ?? null,
      payload: envelope,
    });
  } catch (error) {
    // La base es lo único que justifica un 500: el evento no se ha guardado y sin
    // el reintento se perdería.
    logConsoleFailure(error, 'no se pudo archivar un webhook de te-api');
    return NextResponse.json({ error: 'storage_failed' }, { status: 500 });
  }

  if (!check.ok) {
    console.warn('[crm] webhook rechazado', { reason: check.reason, eventId });
    // 401 y no 200: queremos el reintento. Si lo que pasa es que el secreto se
    // rotó en la consola y aquí no se actualizó, la escalera de 24 horas es la
    // ventana para arreglarlo sin perder el evento.
    return NextResponse.json({ error: check.reason }, { status: 401 });
  }

  // La firma cuadra, así que el cuerpo es de te-api. Que además diga ser de OTRA
  // organización no debería poder pasar —el secreto es por organización— y por
  // eso se registra en vez de pasarse por alto: significa que este webhook está
  // registrado en la consola de otra empresa. No se actúa.
  const claimedOrg = asString(envelope.organizationId);
  if (claimedOrg !== undefined && claimedOrg !== organization.orgId) {
    console.error('[crm] un webhook firmado dice ser de otra organización', {
      expected: organization.orgId,
      claimed: claimedOrg,
      eventId,
    });
    return NextResponse.json({ status: 'ignored', reason: 'organization_mismatch' });
  }

  // Un reintento de algo ya archivado: se contesta 200 y no se vuelve a actuar.
  // La entrega es «al menos una vez» y ésta es la mitad que lo hace inofensivo.
  if (!stored) {
    return NextResponse.json({ status: 'duplicate' });
  }

  // ── Paso 4: actuar, despachando por tipo ────────────────────────────────
  try {
    return await dispatch(organization.orgId, asString(envelope.type), presentationId, data);
  } catch (error) {
    // El evento YA está archivado, así que no se pierde nada devolviendo 200: se
    // ve en la pantalla y el barrido lo cierra. Un 500 aquí haría que te-api
    // reintentara ocho veces algo que sólo puede volver a fallar, y a las veinte
    // suspendería el endpoint.
    logConsoleFailure(error, 'un webhook archivado no se pudo aplicar');
    return NextResponse.json({ status: 'stored', applied: false });
  }
}

/**
 * Qué hace el CRM con cada tipo de evento.
 *
 * Una rama por tipo conocido y **una salida para lo que no se conozca**, que
 * contesta 200: un tipo nuevo tiene que poder llegar, archivarse y verse en la
 * pantalla sin que este receptor lo trate como un fallo. La lista de hoy son dos
 * (`presentation.settled` y `webhook.test`), y te-api versiona el cuerpo
 * (`apiVersion`) justo porque cuenta con que crezca.
 */
async function dispatch(
  orgId: string,
  type: string | undefined,
  presentationId: string | null,
  data: Record<string, unknown>,
): Promise<NextResponse> {
  switch (type) {
    case 'presentation.settled': {
      if (presentationId === null) {
        // El contrato dice que lo lleva siempre. Que falte es un hueco del
        // contrato y se dice en el registro; lo que no se hace es ir a
        // preguntárselo a te-api, que es justo lo que este evento existe para
        // ahorrar.
        console.error('[crm] presentation.settled sin presentationId', { data });
        return NextResponse.json({ status: 'stored', applied: false });
      }

      const status = asString(data['status']);

      // `null` es un valor legítimo aquí y significa **«te-api no pudo
      // determinarlo al liquidar»** — su verificador guarda las sesiones en
      // memoria y las borra al caducar, así que el veredicto es perecedero. Es
      // una invitación explícita a leer la ruta de consulta, no un desenlace: no
      // se convierte en `failed` para no dejar el campo vacío, porque decir que
      // una verificación falló cuando lo que falló es una lectura nuestra es
      // mentir en el sitio donde más caro sale.
      if (status === undefined || !isTerminalStatus(status)) {
        return NextResponse.json({ status: 'stored', applied: false });
      }

      // El diario se cierra **con lo que trae el evento**, sin volver a llamar.
      // Los claims no vienen —te-api minimiza el dato personal que sale por un
      // canal saliente— y por eso van a `null`: la consulta los preserva si el
      // sondeo llegó antes (`coalesce` en `settleVerification`).
      await settleVerification(orgId, presentationId, status, null);
      return NextResponse.json({ status: 'applied' });
    }

    case 'webhook.test':
      // La prueba de integración del administrador. Se archiva y se ve en la
      // pantalla, que es exactamente para lo que sirve: comprobar que la
      // dirección y el secreto son los buenos. Su `presentationId` es `null`
      // siempre y a propósito.
      return NextResponse.json({ status: 'ok' });

    default:
      console.warn('[crm] tipo de webhook desconocido, archivado sin aplicar', { type });
      return NextResponse.json({ status: 'stored', applied: false });
  }
}

function parseEnvelope(rawBody: string): WebhookEnvelope {
  try {
    const parsed: unknown = JSON.parse(rawBody);
    return isRecord(parsed) ? (parsed as WebhookEnvelope) : {};
  } catch {
    // Un cuerpo que no es JSON sólo puede venir de algo que no es te-api, y ya
    // se habrá rechazado por la firma. Se archiva con el sobre vacío para que la
    // pantalla lo enseñe.
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function nonEmpty(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? undefined : trimmed;
}
