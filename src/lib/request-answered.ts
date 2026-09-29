import type { MessageKey, Translator } from '@/i18n/translate';

import type { CeremonyKind } from './ceremony-catalogue';
import { isCeremonyTemplateId, type CeremonyTemplateId } from './ceremony-templates';
import type { TerminalVerificationStatus, VerificationTone } from './verification-status';

/**
 * **`request.answered`: la vuelta de una petición del marco.** Lo que faltaba.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  EL HUECO QUE ESTE FICHERO CIERRA, DICHO COMO LO DIJO EL DUEÑO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * *«El CRM sigue sin reaccionar a las autorizaciones… en eventos no se ve cuando
 * el usuario responde.»* Y era verdad: te-api mandaba dos eventos
 * —`presentation.settled` y `webhook.test`— y ninguno hablaba de una petición
 * del marco. Una `doc.sign.v1` firmada con la identidad de la cartera se
 * aprobaba, se rechazaba o caducaba **sin producir una sola fila** en este lado.
 * Media docena de comentarios de este repositorio decían ese hueco con todas las
 * letras; ya no es cierto y se han corregido en el mismo cambio.
 *
 * El sobre es el de siempre —el mismo `id`/`type`/`apiVersion`/`createdAt`/
 * `organizationId`/`data`, la misma firma, la misma cabecera— y por eso el
 * receptor no le hace ningún caso especial: se comprueba, se archiva y se
 * despacha igual que los otros dos. Lo único propio es lo que va dentro de
 * `data`, y de eso trata este fichero.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  POR QUÉ ESTO ES UNA UNIÓN POR PLANTILLA Y NO UN OBJETO A SECAS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Las catorce plantillas contestan **hoy** con la misma forma: quién contestó a
 * qué, cuándo, y con cuál de las tres palabras. Un tipo plano bastaría para eso,
 * así que el argumento no es que el cuerpo varíe — es qué pasa cuando aparezca
 * la decimoquinta.
 *
 * Con un `template: string` aparece, se archiva y se pinta como una fila sin
 * nombre: la pantalla no sabe llamarla de ninguna manera y nadie se entera hasta
 * que alguien la ve en producción. Con la unión, `CEREMONY_NAME` es un
 * `Record<CeremonyTemplateId, …>` y **añadir la entrada al espejo rompe la
 * compilación** hasta que alguien decida cómo se llama en las dos lenguas. El
 * tipo no describe una diferencia que exista: la obliga a declararse el día que
 * exista.
 *
 * Y hay un segundo sitio donde vive: el día que te-api le dé campos propios a
 * una plantilla —el hash sellado de una `doc.sign.v1`, el `handover_ref` de la
 * otra punta de una `custody.handover.v1`— la rama de esa plantilla es donde se
 * escriben, sin tocar las otras trece.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  LO QUE NO SE RECONOCE SE GUARDA IGUAL. LAS DOS MITADES DE ESA REGLA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  · **Una plantilla que este espejo no lleve** entra como `known: false` y se
 *    enseña con su nombre crudo. El catálogo de verdad es de te-api y esta copia
 *    puede ir por detrás; convertir eso en un rechazo ataría los dos despliegues
 *    para siempre.
 *  · **Un campo de más en `data`** no invalida nada y **no se pierde**: el
 *    receptor archiva el sobre entero en `webhook_event.payload`, así que un
 *    campo que este lector todavía no conoce aparece solo en el detalle técnico
 *    de la pantalla. Ése es justo el trato que `db/007_webhook_event.sql`
 *    defiende, y es lo que permite que te-api añada —por ejemplo— la
 *    `reference` del socio sin coordinar un despliegue.
 *
 * Lo único que sí se exige para dar el cuerpo por legible son **dos** cosas: el
 * `requestId`, porque sin él la respuesta no se puede atar a nada, y un
 * `outcome` de los tres, porque inventar el desenlace de una firma es
 * exactamente lo que no se puede hacer.
 *
 * ## Este módulo es puro
 *
 * Ni `server-only` ni base ni red: lo importan el receptor, la pantalla de
 * eventos **y el compositor**, que corre en el navegador. Misma regla que
 * `lib/verification-status.ts` y por el mismo motivo.
 */

/** El nombre del tipo, escrito una vez y leído en cuatro sitios. */
export const REQUEST_ANSWERED_EVENT = 'request.answered';

/**
 * Lo que contestó el titular. Tres palabras, y ninguna más.
 *
 * `declined` y `not_me` **no son la misma cosa** y ésa es la distinción que hay
 * que llevar entera hasta la pantalla: con la primera la persona leyó lo que se
 * le pedía y dijo que no; con la segunda está diciendo que quien lo pidió no
 * era ella. Una es un final normal de la ceremonia y la otra es un aviso de
 * suplantación.
 */
export type RequestOutcome = 'approved' | 'declined' | 'not_me';

/** Lo que trae `data`, con la plantilla fuera: ver las dos ramas de abajo. */
interface AnsweredRequestCommon {
  /**
   * **La petición a la que esto contesta.** Es la correlación entera.
   *
   * El mismo identificador que devolvió `POST /v1/requests` a quien la mandó, y
   * lo único que ata una respuesta a lo que se envió. Por eso es obligatorio
   * para dar el cuerpo por legible, y por eso se pinta en la fila del diario sin
   * tener que desplegar nada: quien está integrando compara esa cadena con la
   * que anotó al enviar.
   */
  readonly requestId: string;
  /** La revisión del catálogo que clavó te-api al crearla. */
  readonly templateVersion: number | null;
  /** Qué se ejecutó. Eje aparte de la plantilla, igual que al pedirla. */
  readonly kind: CeremonyKind | null;
  readonly outcome: RequestOutcome;
  /**
   * Cuándo contestó **el titular**, en ISO 8601.
   *
   * No es cuándo llegó el evento ni cuándo lo registró te-api: entre las tres
   * hay lo que tarde la cola, y la pantalla las separa con rótulos distintos.
   * `null` si no venía o si no es una fecha que se pueda leer — un
   * «Invalid Date» pintado en una celda es peor que un guion.
   */
  readonly answeredAt: string | null;
  /**
   * La referencia con la que **este CRM** nombró al titular al crear la
   * petición, devuelta tal cual. Es su `externalId`, así que sirve para cruzar
   * con el padrón sin pasar por `verification`.
   */
  readonly subjectReference: string | null;
  /**
   * La sesión del verificador, si la ceremonia llevaba una. `null` en las que
   * firman con la identidad de la cartera, que son la mayoría del catálogo.
   */
  readonly presentationId: string | null;
  /**
   * **La etiqueta que puso quien preguntó, devuelta.** Opcional por partida
   * doble: te-api puede no publicarla todavía, y un socio puede no mandarla.
   *
   * Se lee y se enseña si viene porque es la correlación *del otro lado* — el
   * número de expediente del socio, no el identificador de te-api— y es lo que
   * permite atar la respuesta a una fila del sistema de quien pregunta sin
   * guardar una tabla de equivalencias. Que no venga no rompe nada: el
   * `requestId` ya basta.
   */
  readonly reference: string | null;
}

/**
 * La respuesta a una petición de **una plantilla que este espejo conoce**.
 *
 * Genérica sobre el nombre para que la unión de abajo discrimine por `template`:
 * `answer.template === 'doc.sign.v1'` estrecha, y el día que una plantilla tenga
 * campos propios se declaran aquí por rama.
 */
export interface AnsweredRequestOf<T extends CeremonyTemplateId> extends AnsweredRequestCommon {
  readonly known: true;
  readonly template: T;
}

/** Las catorce, como unión discriminada por `template`. */
export type KnownAnsweredRequest = {
  [T in CeremonyTemplateId]: AnsweredRequestOf<T>;
}[CeremonyTemplateId];

/**
 * Una plantilla que esta copia no lleva —o un evento sin `template`—.
 *
 * No es un fallo y no se rechaza: ver la cabecera. Lo que cambia es que la
 * pantalla la nombra con su cadena cruda en vez de con un rótulo traducido,
 * porque no hay ninguno que sea verdad.
 */
export interface UnknownAnsweredRequest extends AnsweredRequestCommon {
  readonly known: false;
  readonly template: string | null;
}

export type AnsweredRequest = KnownAnsweredRequest | UnknownAnsweredRequest;

/**
 * **El rótulo de cada ceremonia, exhaustivo por construcción.**
 *
 * Éste es el `Record` del que habla la cabecera: una plantilla nueva en
 * `CEREMONY_TEMPLATES` ensancha `CeremonyTemplateId` y deja de compilar aquí
 * hasta que alguien escriba cómo se llama. Es barato, y es la diferencia entre
 * que una ceremonia nueva se estrene con nombre o se estrene como una fila que
 * nadie sabe leer.
 *
 * Las claves no pueden ser el propio nombre de la plantilla: `MessageKey` es un
 * camino de puntos y `templates.doc.sign.v1` bajaría cuatro niveles del
 * catálogo. De ahí el nombre en camello.
 */
const CEREMONY_NAME: Record<CeremonyTemplateId, MessageKey> = {
  'auth.signin.v1': 'ceremonyName.authSignin',
  'bank.call.v2': 'ceremonyName.bankCall',
  'exchange.transfer.v1': 'ceremonyName.exchangeTransfer',
  'age.gate.v1': 'ceremonyName.ageGate',
  'doc.sign.v1': 'ceremonyName.docSign',
  'account.change.v1': 'ceremonyName.accountChange',
  'pro.seal.v1': 'ceremonyName.proSeal',
  'custody.handover.v1': 'ceremonyName.custodyHandover',
  'data.consent.v1': 'ceremonyName.dataConsent',
  'access.grant.v1': 'ceremonyName.accessGrant',
  'attr.minimal.v2': 'ceremonyName.attrMinimalV2',
  'claim.attest.v1': 'ceremonyName.claimAttest',
  'agent.identify.v1': 'ceremonyName.agentIdentify',
  'attr.minimal.v1': 'ceremonyName.attrMinimalV1',
};

/**
 * Cómo se llama la ceremonia que contestó, para leerlo en una celda.
 *
 * Una plantilla desconocida devuelve su nombre crudo y no «desconocida»: la
 * cadena es información —se busca en el registro de te-api— y la palabra
 * «desconocida» no lo es.
 */
export function describeAnsweredCeremony(t: Translator, answer: AnsweredRequest): string {
  if (answer.known) return t(CEREMONY_NAME[answer.template]);
  return answer.template ?? t('common.dash');
}

/** Cómo se lee un desenlace: el color, dos palabras y una frase. */
export interface RequestVerdict {
  readonly tone: VerificationTone;
  readonly label: string;
  readonly detail: string;
}

/**
 * El tono va **en código y no en el catálogo**, por lo mismo que en
 * `verification-status.ts`: quien traduce cambia palabras, no decide de qué
 * color se pinta un aviso de suplantación. Y el reparto es el mismo, para que
 * las dos pantallas se lean igual: rojo sólo para `not_me`.
 */
const OUTCOMES: Record<RequestOutcome, { tone: VerificationTone; label: MessageKey; detail: MessageKey }> = {
  approved: { tone: 'ok', label: 'answered.approvedLabel', detail: 'answered.approvedDetail' },
  declined: { tone: 'caution', label: 'answered.declinedLabel', detail: 'answered.declinedDetail' },
  not_me: { tone: 'alarm', label: 'answered.notMeLabel', detail: 'answered.notMeDetail' },
};

export function describeRequestOutcome(t: Translator, outcome: RequestOutcome): RequestVerdict {
  const shape = OUTCOMES[outcome];
  return { tone: shape.tone, label: t(shape.label), detail: t(shape.detail) };
}

/**
 * **La conversión al vocabulario del diario**, para poder cerrar la fila.
 *
 * Total por construcción —tres entradas para tres valores, sin `default`— así
 * que aquí no hace falta validar nada: quien llama ya tiene un `RequestOutcome`
 * porque el lector de abajo se negó a fabricar uno.
 *
 * Las tres equivalencias, y por qué:
 *
 *  · `approved` → `verified`. La ceremonia hizo lo que se le pedía.
 *  · `declined` → `declined`. **Un valor propio**, que entró en el vocabulario
 *    con este evento: los cinco de una presentación no saben decir «leyó y dijo
 *    que no» sin llamarlo fraude o avería. Ver `lib/verification-status.ts`.
 *  · `not_me`   → `rejected`. Es literalmente lo que `rejected` significa en
 *    esta consola —«dijo desde su cartera que no era él»— y es el único rojo.
 */
export function statusOfOutcome(outcome: RequestOutcome): TerminalVerificationStatus {
  const STATUS: Record<RequestOutcome, TerminalVerificationStatus> = {
    approved: 'verified',
    declined: 'declined',
    not_me: 'rejected',
  };
  return STATUS[outcome];
}

/**
 * Lee el `data` de un `request.answered`. `null` si no es legible.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  LA FIRMA DICE QUIÉN LO MANDÓ, NO QUÉ FORMA TIENE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * El mismo argumento que `readSettlement` en el receptor, y merece repetirse:
 * que el MAC cuadre demuestra que el cuerpo lo escribió te-api, **no** que
 * `templateVersion` sea un número. Eso depende de qué versión esté desplegada al
 * otro lado, y esta consola se despliega por su cuenta.
 *
 * Por eso cada campo pasa por su lector y lo que no encaje se queda a `null`,
 * en vez de tumbar el cuerpo entero: un evento al que le falte el `kind` sigue
 * diciendo quién contestó qué, y es información que la pantalla tiene que poder
 * enseñar. Sólo dos cosas son innegociables, y están arriba.
 */
export function readAnsweredRequest(data: unknown): AnsweredRequest | null {
  if (!isRecord(data)) return null;

  const requestId = asString(data['requestId']);
  if (requestId === null) return null;

  const outcome = asOutcome(data['outcome']);
  if (outcome === null) return null;

  const common: AnsweredRequestCommon = {
    requestId,
    templateVersion: asInteger(data['templateVersion']),
    kind: asKind(data['kind']),
    outcome,
    answeredAt: asTimestamp(data['answeredAt']),
    subjectReference: asString(data['subjectReference']),
    presentationId: asString(data['presentationId']),
    reference: asString(data['reference']),
  };

  const template = asString(data['template']);
  // La puerta de la unión: sólo un nombre que el espejo conoce se estrecha a
  // `CeremonyTemplateId`. Lo demás entra por la otra rama, con su cadena.
  if (template !== null && isCeremonyTemplateId(template)) {
    return { ...common, known: true, template };
  }
  return { ...common, known: false, template };
}

/**
 * Lo mismo, pero desde el **sobre entero** tal y como se guardó en la columna.
 *
 * Existe porque las pantallas no tienen el `data` suelto: tienen `payload`, que
 * es lo que archivó el receptor. Comprueba además el `type`, para que un
 * `presentation.settled` con un `requestId` dentro no se lea nunca como una
 * respuesta del marco.
 */
export function readAnsweredEvent(payload: unknown): AnsweredRequest | null {
  if (!isRecord(payload)) return null;
  if (payload['type'] !== REQUEST_ANSWERED_EVENT) return null;
  return readAnsweredRequest(payload['data']);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Una cadena con contenido, o `null`. La cadena vacía no es un dato. */
function asString(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function asOutcome(value: unknown): RequestOutcome | null {
  return value === 'approved' || value === 'declined' || value === 'not_me' ? value : null;
}

function asKind(value: unknown): CeremonyKind | null {
  return value === 'authenticate' || value === 'verify' || value === 'authorize' || value === 'present'
    ? value
    : null;
}

/** Una revisión de catálogo: entero, y de verdad. `1.5` no es una revisión. */
function asInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

/**
 * Una fecha que se pueda pintar. Se guarda **la cadena original** y no un
 * `Date`: es lo que va a comparar quien depure contra el registro de te-api, y
 * reformatearla aquí perdería la precisión con la que llegó.
 */
function asTimestamp(value: unknown): string | null {
  const text = asString(value);
  if (text === null) return null;
  return Number.isNaN(new Date(text).getTime()) ? null : text;
}
