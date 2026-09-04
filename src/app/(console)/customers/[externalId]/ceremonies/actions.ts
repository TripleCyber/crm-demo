'use server';

import { getTranslator } from '@/i18n/server';
import { findCeremonyCase } from '@/lib/ceremony-catalogue';
import type { CeremonyHttpRequest } from '@/lib/ceremony-request';
import { checkCeremonyDraft, type CeremonyDraftField } from '@/lib/ceremony-templates';
import { logConsoleFailure } from '@/lib/console-failures';
import { findCustomer } from '@/lib/customers';
import { getEmployeeSession } from '@/lib/session';
import {
  describeTeApiError,
  fetchB2bOrganizationCached,
  requestCeremony,
  requestPresentation,
  TeApiError,
} from '@/lib/te-api';
import type { VerificationStatus } from '@/lib/verification-status';
import { findVerification, recordVerification } from '@/lib/verifications';
import { listWebhookEventsSince, type WebhookEventRecord } from '@/lib/webhook-events';

/**
 * **Mandar un caso del catálogo, ya compuesto.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ACCIÓN DE SERVIDOR, Y POR ESO NO HAY RUTA NUEVA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Las otras tres ceremonias de esta consola —transferencia, edad, verificación—
 * entran por `app/api/…`, y allí es correcto: son las que el navegador dispara
 * con `fetch` y hay una pantalla que sondea el resultado.
 *
 * Aquí no hace falta abrir una dirección pública para nada: la acción de
 * servidor hace el mismo trabajo, el token de la organización no baja al
 * navegador y no se añade superficie.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ⚠ AHORA LOS VALORES SÍ VIENEN DEL NAVEGADOR, Y ESO CAMBIA LAS REGLAS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Aquí decía —con razón, mientras fue verdad— que no se validaba ni la longitud
 * ni la forma de los valores «porque no vienen de fuera»: el navegador mandaba
 * un identificador de caso y los valores salían del catálogo, que vive en el
 * servidor.
 *
 * **Eso ya no es cierto.** El compositor deja escribir los campos, así que lo
 * que llega aquí es texto de fuera que va a acabar en la pantalla donde alguien
 * firma. Lo que se hace con él, en este orden:
 *
 *  1. **Se lee con desconfianza.** Una acción de servidor recibe lo que el
 *     navegador quiera mandar; el tipo de TypeScript no es una verja. Por eso
 *     `readDraft` comprueba cada campo uno a uno y devuelve `null` a la primera
 *     cosa que no encaje, en vez de confiar en la firma de la función.
 *  2. **Se comprueba contra el catálogo de plantillas** con los mismos motivos
 *     que contestaría te-api (`missing_required_field:document`). No sustituye a
 *     su validación —la última palabra es suya— pero evita mandar algo que ya se
 *     sabe que va a salir con un 400.
 *  3. **Y lo que el navegador NO puede cambiar se pone aquí, desde el
 *     catálogo**: la plantilla, el `kind`, con qué se firma, los atributos que se
 *     le piden a la credencial y a quién se le pregunta. Se puede editar **lo que
 *     el titular lee**, nunca **qué ceremonia se ejecuta** ni **qué prueba se
 *     exige**. Ésa es la frontera entera de este fichero: si un día alguien acepta
 *     `template` o `signWith` del cuerpo, el compositor pasa de componer
 *     peticiones a elegir qué se comprueba, que es otra cosa.
 *
 * Sin borrador —`fields` ausente— se manda el caso tal y como está en el
 * catálogo, byte por byte. Es el camino de un clic que había antes y sigue
 * intacto.
 *
 * ## Firmar con credencial son dos llamadas, como en la puerta de edad
 *
 * Una credencial la comprueba **el verificador de TripleEnable**, no este CRM.
 * Así que un caso que se firma con credencial abre antes su sesión de
 * verificador (`POST /v1/b2b/presentations`) y pasa el `requestUri` dentro de la
 * petición, exactamente como `requestAgeCheck`. Sin eso la petición se crea y
 * **no la puede aprobar nadie**, que es peor que no mandarla.
 *
 * La sesión además se anota en el diario del banco: el desenlace vuelve por el
 * webhook `presentation.settled`, que actualiza la fila **por
 * `presentationId`**. Sin fila, el sí o el no del titular no llega nunca a la
 * consola — y es también lo único que permite emparejar el evento recibido con
 * la petición mandada, porque el evento no lleva `requestId`.
 */

/** Lo que la pantalla pinta después de pulsar. */
export interface SendCeremonyResult {
  readonly requestId?: string;
  readonly expiresAt?: string;
  /** La sesión del verificador, cuando el caso se firma con credencial. */
  readonly presentationId?: string;
  /**
   * **La petición HTTP que salió**, con el portador tapado.
   *
   * Es el objeto que se serializó, devuelto por `requestCeremony` — no una
   * reconstrucción. Es lo que permite que el bloque de «lo que se mandó» sea
   * verdad incluso en la mitad de credencial, donde el `requestUri` no existía
   * cuando la pantalla pintó la vista previa.
   */
  readonly sent?: CeremonyHttpRequest;
  /** `pending`, tal y como lo dice te-api. */
  readonly status?: string;
  readonly template?: string;
  /** La revisión que puso el catálogo **de te-api**. Ver `CeremonyRequestResult`. */
  readonly templateVersion?: number;
  /** El enlace para el mostrador, o `null` si el despliegue no tiene canal QR. */
  readonly link?: string | null;
  /**
   * Cuándo se mandó, según este servidor.
   *
   * De aquí sale el corte de «lo recibido»: no hay forma de emparejar un evento
   * con una petición del marco —te-api no manda `requestId` en ningún evento—
   * así que lo que se puede afirmar es «esto ha llegado desde que pulsaste».
   */
  readonly sentAt?: string;
  readonly error?: string;
  /**
   * El código del motivo, sin traducir: `missing_required_field:document`.
   *
   * Va **además** de la frase, no en su lugar. Es la misma palabra que
   * contestaría te-api y la que se busca en su registro, y quien mira esta
   * pantalla está probando el marco contra un despliegue.
   */
  readonly reason?: string;
}

export async function sendCeremonyAction(
  externalId: string,
  caseId: string,
  fields?: readonly CeremonyDraftField[],
): Promise<SendCeremonyResult> {
  const t = await getTranslator();

  const ceremony = findCeremonyCase(caseId);
  if (ceremony === undefined) return { error: t('errors.ceremonyUnknownCase') };

  const session = await getEmployeeSession();

  // La ficha se busca **dentro de la organización de la sesión**: sin el
  // `orgId`, un identificador de cliente de otro banco encontraría su ficha.
  const customer = await findCustomer(session.organization.orgId, externalId.trim());
  if (customer === null) return { error: t('errors.customerNotFound') };

  // ── El borrador, o el catálogo ────────────────────────────────────────────
  //
  // `undefined` es el camino de siempre y manda el caso sin tocar. Lo que llega
  // se lee con desconfianza: ver la cabecera, punto 1.
  const draft = fields === undefined ? ceremony.fields : readDraft(fields);
  if (draft === null) return { error: t('errors.ceremonyBadDraft'), reason: 'malformed_draft' };

  const checked = checkCeremonyDraft({
    template: ceremony.template,
    kind: ceremony.kind,
    signWith: ceremony.signWith,
    fields: draft,
  });
  if (!checked.ok) {
    return { error: t('errors.ceremonyDraftRefused'), reason: checked.reason };
  }

  try {
    if (ceremony.signWith === 'identity') {
      const asked = await requestCeremony(session.organization, {
        subjectReference: customer.externalId,
        // Del catálogo y no del navegador. Ver la cabecera, punto 3.
        kind: ceremony.kind,
        signWith: 'identity',
        template: ceremony.template,
        fields: draft,
      });
      return exchangeToResult(asked);
    }

    // ── Firmar con credencial: la sesión primero ────────────────────────
    //
    // El tipo sale del **padrón de te-api**, no de una constante: es el que esa
    // organización puede pedir de vuelta, y el catálogo de casos no puede
    // saberlo porque el mismo caso lo enseña un banco, una aseguradora o una
    // clínica con tipos distintos.
    const organization = await fetchB2bOrganizationCached(session.organization);
    const credentialType = organization.credentialTypes[0]?.type;
    if (credentialType === undefined) return { error: t('errors.ceremonyNoCredentialType') };

    const claims = ceremony.claims ?? [];
    if (claims.length === 0) return { error: t('errors.ceremonyNoClaims') };

    const presentation = await requestPresentation(session.organization, {
      type: credentialType,
      subjectReference: customer.externalId,
      claims,
    });

    const asked = await requestCeremony(session.organization, {
      subjectReference: customer.externalId,
      kind: ceremony.kind,
      signWith: 'credential',
      credentialType,
      template: ceremony.template,
      requestUri: presentation.requestUri,
      fields: draft,
    });

    // El diario del banco. Se anota **después** de que la petición exista, por
    // lo mismo que en la puerta de edad: una comprobación «pendiente» que nunca
    // se llegó a pedir aparecería en el historial del cliente y el agente
    // creería que le preguntó.
    await recordVerification({
      orgId: session.organization.orgId,
      externalId: customer.externalId,
      presentationId: presentation.presentationId,
      typeKey: credentialType,
      requestedClaims: claims,
      // No se pinta QR: se le pregunta al teléfono que ya tiene en el bolsillo.
      channel: 'phone',
      issuerDid: organization.did,
      authorizationRequestUrl: presentation.authorizationRequestUrl,
      // Rama del teléfono: no hay mostrador y por tanto no hay código.
      counterLink: null,
      requestUri: presentation.requestUri,
      expiresAt: asked.result.expiresAt,
      agentId: session.agent.id,
      agentName: session.agent.displayName,
      actor: session.actor,
      requestedAt: new Date().toISOString(),
      // El timbre de esta ceremonia es la petición del marco, no un `wakeup`.
      wakeupId: undefined,
      wakeupAt: undefined,
    });

    return { ...exchangeToResult(asked), presentationId: presentation.presentationId };
  } catch (error) {
    logConsoleFailure(error, `el caso ${caseId} del catálogo falló`);
    // El error de te-api **sí se enseña traducido y con su `requestId`**, al
    // revés que en la transferencia. Aquí es lo correcto: quien mira esta
    // pantalla está probando el catálogo contra un despliegue, no atendiendo a
    // un cliente, y `unknown_template` es exactamente lo que necesita leer
    // cuando la plantilla todavía no está en te-api.
    return {
      error:
        error instanceof TeApiError
          ? describeTeApiError(t, error)
          : t('errors.ceremonyUpstream'),
      // El código crudo de te-api al lado de la frase, por lo mismo que el del
      // catálogo: es lo que se busca en su registro.
      ...(error instanceof TeApiError ? { reason: error.code } : {}),
    };
  }
}

/** Lo que devuelve `requestCeremony`, aplanado para la pantalla. */
function exchangeToResult(
  exchange: Awaited<ReturnType<typeof requestCeremony>>,
): SendCeremonyResult {
  return {
    requestId: exchange.result.requestId,
    expiresAt: exchange.result.expiresAt,
    status: exchange.result.status,
    template: exchange.result.template,
    templateVersion: exchange.result.templateVersion,
    link: exchange.result.link,
    sent: exchange.sent,
    sentAt: new Date().toISOString(),
  };
}

/**
 * Lee el borrador que manda el navegador. `null` a la primera cosa que no encaje.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  UNA ACCIÓN DE SERVIDOR NO VALIDA NADA POR TENER TIPOS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * El argumento llega serializado desde el navegador y puede ser cualquier cosa:
 * la firma `readonly CeremonyDraftField[]` es una promesa del compilador para
 * quien la llama desde el mismo árbol, no una verja en tiempo de ejecución. Sin
 * este lector, un `value` que fuera un objeto acabaría en `JSON.stringify` y de
 * ahí en el cuerpo que se manda a te-api, que lo rechazaría — pero con un 400
 * que no dice nada útil y después de gastar el cubo de tasa de la organización.
 *
 * **Todo o nada**, y sin arreglar por el camino: un campo que no encaja no se
 * descarta ni se recorta, porque lo que se está componiendo es lo que alguien va
 * a leer antes de firmar. Recortar aquí un valor de 600 caracteres sería mandar
 * a firmar algo distinto de lo que se escribió.
 *
 * Las longitudes y las claves obligatorias **no se miran aquí**: eso es del
 * catálogo (`checkCeremonyDraft`), que además contesta con el motivo de te-api.
 * Aquí sólo se comprueba que esto sea, de forma, una lista de campos.
 */
function readDraft(value: unknown): readonly CeremonyDraftField[] | null {
  if (!Array.isArray(value)) return null;

  const fields: CeremonyDraftField[] = [];
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) return null;
    const record = entry as Record<string, unknown>;

    const key = record['key'];
    const label = record['label'];
    const fieldValue = record['value'];
    const sub = record['sub'];
    const type = record['type'];
    const style = record['style'];

    if (typeof key !== 'string' || typeof label !== 'string' || typeof fieldValue !== 'string') {
      return null;
    }
    if (sub !== undefined && typeof sub !== 'string') return null;
    if (type !== 'text' && type !== 'mono' && type !== 'numeric') return null;
    if (style !== 'hero' && style !== 'normal' && style !== 'quiet') return null;

    fields.push({
      key,
      label,
      value: fieldValue,
      // La cadena vacía se lee como «no hay segunda línea», que es lo que manda
      // un formulario cuya casilla está en blanco. Mandarla vacía sería un 400
      // de te-api (`z.string().min(1)`) por un campo que nadie rellenó.
      ...(sub === undefined || sub === '' ? {} : { sub }),
      type,
      style,
    });
  }

  return fields;
}

/**
 * **Lo que ha llegado por el cable desde que se mandó la petición.** La prueba
 * en bruto, para quien está integrando.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ESTO YA NO ES CÓMO SE ENTERA LA PANTALLA DEL DESENLACE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Aquí decía que ésta era «la otra mitad del viaje», y ése era el fallo que el
 * dueño encontró enseñando el compositor: el desenlace de una ceremonia **no se
 * lee de un barrido del diario de webhooks por hora**. Se lee de la fila de esa
 * ceremonia, que es lo que hace la ficha del cliente y por eso la ficha sí
 * enseñaba lo que había pasado mientras el compositor se quedaba en blanco. Eso
 * lo contesta ahora `readCeremonyOutcomeAction`, aquí abajo.
 *
 * Lo que queda aquí no se ha quitado —sigue siendo una capacidad y sigue siendo
 * la única que enseña el **sobre entero, firmado, tal y como llegó**— pero es lo
 * que es: la evidencia del canal, no el veredicto. Quien mira esta pantalla para
 * integrar quiere ver el JSON del `presentation.settled` con su firma
 * comprobada; quien la mira para enseñar la ceremonia quiere saber si el titular
 * dijo que sí.
 *
 * ## No hay temporizador **en ésta**, y no es un olvido
 *
 * La llama el botón de comprobar y nada más. Los eventos llegan solos por el
 * webhook y se archivan lleguen o no con alguien mirando; la pantalla de
 * `/events` los enseña todos. Un temporizador aquí traería el diario entero de
 * la organización cada tres segundos para responder a una pregunta que ya
 * contesta la consulta de al lado, que sí lee una sola fila.
 *
 * ## Y por qué el corte es una hora y no un identificador
 *
 * Porque no hay identificador. Ningún evento de te-api lleva `requestId`: los
 * dos que existen son `presentation.settled` —que se identifica por
 * `presentationId`— y `webhook.test`. Ver `lib/webhook-events.ts`, donde está
 * escrito el hueco entero y qué haría falta para cerrarlo.
 */
export interface CeremonyEventsResult {
  readonly events?: readonly WebhookEventRecord[];
  readonly error?: string;
}

export async function readCeremonyEventsAction(since: string): Promise<CeremonyEventsResult> {
  const t = await getTranslator();

  // El corte lo manda el navegador, así que se lee y se acota. Una fecha
  // inválida se rechaza en vez de caer a «desde siempre», que traería el diario
  // entero de la organización a una pantalla que preguntaba por un instante.
  const at = new Date(since);
  const stamp = at.getTime();
  if (Number.isNaN(stamp)) return { error: t('errors.generic') };

  // Y no se deja mirar más atrás de un día: una pestaña abierta desde ayer sigue
  // teniendo su corte en el pasado, y lo que esta pantalla contesta es «qué ha
  // llegado desde que pulsaste», no «enséñame el diario». Para eso está
  // `/events`, que es la pantalla del diario y ya existe.
  const floor = Date.now() - 24 * 60 * 60 * 1000;
  const from = new Date(stamp < floor ? floor : stamp).toISOString();

  try {
    const session = await getEmployeeSession();
    return { events: await listWebhookEventsSince(session.organization.orgId, from) };
  } catch (error) {
    logConsoleFailure(error, 'no se pudieron leer los eventos de una ceremonia');
    return { error: t('errors.generic') };
  }
}

/**
 * **El desenlace de la ceremonia, leído de la fila de esa ceremonia.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  LA MISMA FUENTE QUE LA FICHA DEL CLIENTE, QUE ES LA QUE SÍ FUNCIONABA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * El compositor se enteraba —o no— barriendo el diario de webhooks por hora:
 * «enséñame lo que ha entrado desde que pulsé». Eso contesta *qué llegó por el
 * cable*, que es otra pregunta, y contestaba en blanco casi siempre. Mientras
 * tanto la ficha del cliente **sí** enseñaba el desenlace, porque lee la fila de
 * `verification` — la misma que cierra el receptor de webhooks al aterrizar
 * `presentation.settled`, y la misma que sondea `/verifications/<id>`.
 *
 * Esta función es esa lectura, sin ruta nueva y sin una segunda fuente:
 * `findVerification` es la que ya usa `GET /api/credentials/present`, con el
 * `orgId` de la sesión dentro y no como parámetro — pedir la comprobación de
 * otra organización se comporta igual que pedir una inventada.
 *
 * ## Y sigue sin haber una llamada a te-api aquí
 *
 * Ni una. Lo que se lee es el diario de este banco, que es donde el webhook dejó
 * el veredicto. La regla escrita en el receptor —«el sitio donde se arregla un
 * campo que falta es el evento, en te-api, nunca una llamada de vuelta desde
 * aquí»— vale igual para esta pantalla.
 *
 * ## Lo que esto NO puede contestar, y por qué no se disimula
 *
 * Una ceremonia que firma con **la identidad de la cartera** no tiene fila que
 * leer: no abre sesión de verificador, así que no hay `presentationId`, y te-api
 * no publica hoy **ni evento ni ruta B2B** con el desenlace de una petición del
 * marco —lo comprobado en su código: los dos únicos eventos son
 * `presentation.settled` y `webhook.test`, y no existe ningún `GET
 * /v1/requests/:id` ni `/v1/b2b/requests`—. La pantalla dice eso con todas las
 * letras en vez de dejar un hueco girando.
 *
 * `null` en `found` es el tercer caso y hay que separarlo del error: la fila
 * puede tardar en existir si el navegador pregunta antes de que la escritura
 * termine. Se lee como «todavía no», no como «ha fallado algo».
 */
export interface CeremonyOutcomeResult {
  /** `false` = esta organización no tiene fila con ese identificador. */
  readonly found?: boolean;
  readonly status?: VerificationStatus;
  /** El plazo de te-api. Es lo que distingue «esperando» de «sin respuesta». */
  readonly expiresAt?: string;
  /** Cuándo lo supo **este servidor**, no cuándo firmó el titular. */
  readonly settledAt?: string | null;
  /** Cuándo firmó el teléfono del titular, del recibo. Ver `PresentationProof`. */
  readonly signedAt?: string | null;
  readonly disclosedClaims?: Record<string, unknown> | null;
  readonly holderKey?: string | null;
  readonly holderLinkId?: string | null;
  readonly error?: string;
}

export async function readCeremonyOutcomeAction(
  presentationId: string,
): Promise<CeremonyOutcomeResult> {
  const t = await getTranslator();

  // Lo manda el navegador, así que se lee con la misma desconfianza que el
  // borrador: una cadena vacía no es una consulta, es un `where` sin filtro.
  const id = typeof presentationId === 'string' ? presentationId.trim() : '';
  if (id === '') return { error: t('errors.generic') };

  try {
    const session = await getEmployeeSession();
    const verification = await findVerification(session.organization.orgId, id);
    if (verification === null) return { found: false };

    return {
      found: true,
      status: verification.status,
      expiresAt: verification.expiresAt,
      settledAt: verification.settledAt,
      signedAt: verification.proof?.signedAt ?? null,
      // Lo que el titular decidió enseñar, tal cual lo dejó el evento. No se
      // recorta aquí: quien filtra por lo que se pidió es te-api, y una segunda
      // criba en esta consola enseñaría menos de lo que el titular enseñó.
      disclosedClaims: verification.disclosedClaims,
      holderKey: verification.holderKey,
      holderLinkId: verification.holderLinkId,
    };
  } catch (error) {
    logConsoleFailure(error, 'no se pudo leer el desenlace de una ceremonia');
    return { error: t('errors.generic') };
  }
}
