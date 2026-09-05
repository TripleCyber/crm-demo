import { NextResponse } from 'next/server';

import { logConsoleFailure } from '@/lib/console-failures';
import { getOrganization } from '@/lib/organization';
import {
  readAnsweredRequest,
  REQUEST_ANSWERED_EVENT,
  statusOfOutcome,
  type AnsweredRequest,
} from '@/lib/request-answered';
import {
  readPresentationProof,
  settleAnsweredRequest,
  settleVerification,
  type VerificationSettlement,
} from '@/lib/verifications';
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
 *  Y AHORA ESTO ES EL ÚNICO CAMINO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Aquí decía que el sondeo de la pantalla y este receptor eran dos caminos a
 * propósito, y que ganaba el que llegara primero. **El sondeo se retiró.** Este
 * receptor es lo único que escribe un desenlace en el diario de este banco; la
 * pantalla de la ceremonia lee la fila que él deja.
 *
 * Se pudo retirar porque te-api liquida —y por tanto avisa— en los dos casos que
 * importan: la petición que responde y la que caduca sin respuesta. No hace
 * falta que nadie tenga una pestaña abierta para que el caso se cierre, que era
 * justo lo que el sondeo compraba y lo único que compraba.
 *
 * Lo que este receptor **no** hace, y ahora es una regla y no una preferencia,
 * es llamar a te-api para completar el evento. Todo lo que se usa viene dentro.
 * Si al recibo le falta un campo, el sitio donde se arregla es el evento —en
 * te-api—, nunca una llamada de vuelta desde aquí. Ver `lib/te-api.ts`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  Y AHORA EL EVENTO LO TRAE TODO, INCLUIDO EL DATO PERSONAL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Aquí decía que los claims y el recibo firmado **no** venían, porque te-api
 * minimizaba el dato personal que sale por un canal saliente. Esa política está
 * revocada y ahora es la contraria: `presentation.settled` lleva **todo lo que
 * trae la confirmación del titular** —`claims`, `holderKey`, `holderLinkId` y
 * `proof`—, para que quien lo recibe no tenga que volver a llamar a la API para
 * nada.
 *
 * El porqué, que no es una comodidad sino un argumento sobre a quién pertenece
 * el dato, en tres piezas:
 *
 *  1. **El destino no es de un tercero: lo puso la propia organización.** Esta
 *     dirección la dio de alta y la verificó su administrador en tenant-admin.
 *     Mandarle el dato aquí no es sacarlo de la organización — es entregárselo
 *     en el buzón que ella misma señaló.
 *  2. **El cuerpo va firmado.** Nadie puede inyectar un recibo ni leerlo por el
 *     camino sin romper la firma, y este receptor la comprueba antes de mirar
 *     nada (paso 2). Un canal firmado punto a punto no es «un canal saliente»
 *     en el sentido que preocupaba.
 *  3. **Esta organización ya tiene derecho a esos datos.** Es quien pidió la
 *     verificación, y el titular consintió enseñárselos al aprobarla en su
 *     cartera. Obligarla a pedirlos otra vez por una segunda ruta no protegía
 *     al titular de nada: protegía de una llamada que la propia organización
 *     estaba autorizada a hacer.
 *
 * Lo que **no** cambia es la otra mitad de la regla: el receptor no vuelve a
 * llamar a te-api. Los cuatro campos se leen del cuerpo o no se leen.
 *
 * Y se leen **con desconfianza**: son `unknown` de un JSON, así que se valida la
 * forma de cada uno (ver `readSettlement`). Los cuatro son opcionales aunque el
 * desenlace sea `verified` —te-api tiene un tope de tamaño de cuerpo y los
 * recorta antes que el sobre, y un evento de una versión anterior no los lleva—,
 * así que faltar es un caso normal y no un error que haya que registrar.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  Y AHORA HAY UN TERCER TIPO: LA RESPUESTA A UNA PETICIÓN DEL MARCO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `request.answered`. Cierra el hueco que el dueño encontró enseñando esto —«el
 * CRM sigue sin reaccionar a las autorizaciones»—: hasta ahora una petición del
 * marco firmada con la identidad de la cartera se aprobaba o se rechazaba sin
 * producir **nada** que esta consola pudiera ver.
 *
 * Lo importante de cómo entra es que **no entra de ninguna manera especial**.
 * Mismo sobre, misma firma, misma comprobación, misma tabla, misma clave de
 * idempotencia. La comprobación de firma, la protección contra reproducción y la
 * deduplicación por `event_id` le aplican por estar en este camino, no por una
 * rama que las repita para él — que es como acaban divergiendo.
 *
 * Y **una sola rama para las catorce plantillas**. El cuerpo es el mismo para
 * todas, así que un `if` por ceremonia aquí no compraría nada y sería el sitio
 * donde la decimoquinta se cae en silencio. La diferencia entre plantillas es
 * cómo se lee en pantalla, y ahí sí está tipada: `lib/request-answered.ts`
 * obliga a nombrarlas todas o no compila.
 *
 * Lo que lleva dentro y qué se hace con ello, en ese mismo fichero y en la rama
 * de abajo. Dos apuntes que sí son de aquí:
 *
 *  · **Un campo de `data` que este receptor no conozca no se pierde ni tumba
 *    nada.** El sobre entero se archiva tal cual, así que aparece solo en el
 *    detalle técnico de la pantalla. Un lector estricto ataría los dos
 *    despliegues para siempre, y es justo lo que este proyecto no quiere.
 *  · **El desenlace se guarda en la columna `status`** aunque el evento lo llame
 *    `outcome`. Es la misma pregunta —cómo acabó— y la columna es genérica; ver
 *    el comentario del `insert`.
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
    organization = await getOrganization();
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

  // La respuesta a una petición del marco se lee **antes de archivar**, y no por
  // adelantar trabajo: de ella salen dos de las columnas que se promocionan (el
  // desenlace y el cliente al que afecta), y esas se escriben en el mismo
  // `insert`. Ver los dos comentarios de abajo.
  //
  // Se lee para **cualquier** plantilla: aquí no hay ni una rama por ceremonia y
  // no puede haberla. El sobre y el `data` son los mismos para las catorce, así
  // que un caso especial por plantilla sería exactamente el sitio donde la
  // decimoquinta se cae sin que nadie lo note.
  const answered = asString(envelope.type) === REQUEST_ANSWERED_EVENT
    ? readAnsweredRequest(data)
    : null;

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
      // Los dos identificadores de la petición, para que la fila del evento se
      // pueda cruzar con el diario de comprobaciones cuando no hay presentación
      // que nombrar —que es la mayoría del catálogo—. No se guardan en columna:
      // sólo resuelven el cliente en el `insert`. Ver `storeWebhookEvent`.
      requestId: answered?.requestId ?? null,
      askerReference: answered?.reference ?? null,
      // **El desenlace, se llame como se llame en su tipo.** La columna es
      // genérica a propósito («el veredicto, cuando el evento lo lleva») y en
      // `presentation.settled` se llama `status`; en `request.answered` se llama
      // `outcome` y es la misma cosa. Guardarlo aquí es lo que hace que la
      // pantalla de eventos y el diario de la ceremonia lo pinten sin saber de
      // qué tipo es la fila.
      status: asString(data['status']) ?? answered?.outcome ?? null,
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
    return await dispatch(organization.orgId, asString(envelope.type), presentationId, data, answered);
  } catch (error) {
    // El evento YA está archivado, así que se ve en la pantalla de eventos y no
    // se pierde el rastro. Un 500 aquí haría que te-api reintentara ocho veces
    // algo que sólo puede volver a fallar, y a las veinte suspendería el
    // endpoint — o sea que el precio de insistir es quedarse sin el canal.
    //
    // Lo que sí se pierde es el cierre de ESA fila: retirado el sondeo, no queda
    // nadie detrás que la reconcilie, y se quedará en `pending` con el plazo
    // vencido (que el listado pinta «sin respuesta»). Por eso esto se registra
    // como fallo de consola y no se traga en silencio.
    logConsoleFailure(error, 'un webhook archivado no se pudo aplicar');
    return NextResponse.json({ status: 'stored', applied: false });
  }
}

/**
 * Qué hace el CRM con cada tipo de evento.
 *
 * Una rama por tipo conocido y **una salida para lo que no se conozca**, que
 * contesta 200: un tipo nuevo tiene que poder llegar, archivarse y verse en la
 * pantalla sin que este receptor lo trate como un fallo. La lista de hoy son
 * tres (`presentation.settled`, `request.answered` y `webhook.test`), y te-api
 * versiona el cuerpo (`apiVersion`) justo porque cuenta con que siga creciendo.
 *
 * ⚠ **Una rama por TIPO, nunca por plantilla.** `request.answered` llega igual
 *   para las catorce ceremonias del catálogo y se trata igual para las catorce:
 *   el sobre es el mismo, la firma es la misma y `data` tiene la misma forma. Un
 *   `if` por plantilla aquí sería el sitio exacto donde la decimoquinta se cae
 *   sin síntoma. Lo que sí distingue una plantilla de otra es cómo se **lee** en
 *   pantalla, y eso vive en `lib/request-answered.ts`, donde el compilador
 *   obliga a nombrarlas todas.
 */
async function dispatch(
  orgId: string,
  type: string | undefined,
  presentationId: string | null,
  data: Record<string, unknown>,
  answered: AnsweredRequest | null,
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
      // Y ahora el evento trae todo lo que trae la confirmación del titular, así
      // que lo que se escribe aquí es el recibo entero y no sólo el veredicto.
      // El porqué de que pueda venir por este canal está en la cabecera.
      //
      // Lo que no venga se escribe `null`, y `settleVerification` lo trata con
      // `coalesce`: un `null` no borra lo que hubiera. Faltar es un caso normal
      // —cuerpo degradado por tamaño, versión anterior del evento, desenlace que
      // no es `verified`— y por eso no se registra como fallo.
      await settleVerification(orgId, presentationId, {
        status,
        ...readSettlement(data),
      });
      return NextResponse.json({ status: 'applied' });
    }

    case REQUEST_ANSWERED_EVENT: {
      // El cuerpo lo leyó el llamante —de ahí salieron dos columnas— así que
      // aquí sólo se comprueba si era legible. `null` significa que faltaba el
      // `requestId` o que el desenlace no era una de las tres palabras, y
      // ninguna de las dos se puede suplir: sin identificador no hay petición a
      // la que atar esto, y un desenlace inventado es lo único que este receptor
      // no puede hacer nunca. Se registra y se deja archivado, que es lo que
      // convierte un hueco del contrato en algo que se ve en la pantalla.
      if (answered === null) {
        console.error('[crm] request.answered ilegible', { data });
        return NextResponse.json({ status: 'stored', applied: false });
      }

      // El diario se cierra con lo que trae el evento y sin volver a llamar,
      // igual que arriba. Lo que este evento **no** trae —claims, llave, recibo
      // firmado— no se va a buscar: si la ceremonia llevaba presentación, eso
      // llega por `presentation.settled` y ahora puede rellenarlo aunque esta
      // rama haya cerrado la fila antes. Ver `settleVerification`.
      const closed = await settleAnsweredRequest(
        orgId,
        {
          // El expediente primero: es el único de los tres que esta consola
          // emitió ella misma. El porqué, en `settleAnsweredRequest`.
          reference: answered.reference,
          requestId: answered.requestId,
          presentationId: answered.presentationId,
        },
        statusOfOutcome(answered.outcome),
      );

      // `false` **no es un fallo** y por eso no se registra como tal: una
      // ceremonia que firma con la identidad de la cartera no abre sesión de
      // verificador y esta consola no le anota fila ninguna, porque no habría
      // nada que sondear en ella. La respuesta se ve igual —está archivada, y la
      // pantalla de la ceremonia la empareja por `requestId`—; lo que no hay es
      // fila que cerrar.
      return NextResponse.json(closed ? { status: 'applied' } : { status: 'stored', applied: false });
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

/**
 * Lee del evento las cuatro piezas de la confirmación del titular.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  LA FIRMA DICE QUIÉN LO MANDÓ, NO QUÉ FORMA TIENE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Que el MAC cuadre demuestra que el cuerpo lo escribió te-api y que nadie lo
 * tocó por el camino. **No demuestra que `holderKey` sea un objeto ni que
 * `claims` no sea un array**: eso depende de qué versión de te-api esté
 * desplegada al otro lado, y esta consola se despliega por su cuenta. Un
 * `data.claims` que llegue como cadena y se meta en una columna `jsonb` no
 * revienta aquí — revienta al pintar el recibo, tres pantallas más allá y sin
 * nada que lo relacione con este `POST`.
 *
 * Por eso cada campo pasa por su lector, y **lo que no encaje se descarta en
 * silencio**. En silencio a propósito: los cuatro son opcionales por contrato
 * —no vienen si el desenlace no es `verified`, ni si te-api recortó el cuerpo
 * por tamaño, ni si el evento es de una versión anterior—, así que no distinguir
 * «no venía» de «vino torcido» con un registro de error es correcto. Lo que no
 * se puede es escribir basura en el diario y que el recibo la enseñe como
 * prueba.
 *
 * `status` no sale de aquí: ya lo validó el llamante contra la lista cerrada de
 * desenlaces, que es una comprobación distinta y con otra consecuencia.
 */
function readSettlement(data: Record<string, unknown>): Omit<VerificationSettlement, 'status'> {
  // `holderKey` es `{thumbprint, jwk}` y se parte en dos columnas: la huella es
  // lo que se compara, la llave es con lo que se vuelve a verificar. Se leen por
  // separado porque una puede venir sin la otra y ninguna necesita a la otra
  // para valer.
  const holderKey = isRecord(data['holderKey']) ? data['holderKey'] : {};

  return {
    // Los claims son el objeto del titular, no nuestro esquema: se guarda tal
    // cual, sin recortar ni convertir. Quien filtra por lo que se pidió es
    // te-api —lo hace en `toPresentationResult`, antes de componer el evento—
    // así que repetir aquí ese filtro sería una segunda copia de una regla que
    // ya se aplicó, y el día que las dos discrepen el recibo enseñaría menos de
    // lo que el titular enseñó de verdad.
    disclosedClaims: isRecord(data['claims']) ? data['claims'] : null,
    holderKey: asString(holderKey['thumbprint']) ?? null,
    holderKeyJwk: isRecord(holderKey['jwk']) ? holderKey['jwk'] : null,
    holderLinkId: asString(data['holderLinkId']) ?? null,
    // El recibo firmado lo valida `lib/verifications.ts`, que es también quien
    // lo normaliza al leerlo de la columna. Una sola validación para los dos
    // bordes: ver `readPresentationProof`.
    proof: readPresentationProof(data['proof']),
  };
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
