'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useTranslator } from '@/i18n/client';
import type { MessageKey, Translator } from '@/i18n/translate';
import { formatClock, formatCountdown, formatDateTime } from '@/lib/format';
import { verificationTone, type VerificationStatus } from '@/lib/verification-status';
import { VerificationStage } from './VerificationStage';

/**
 * El seguimiento de una comprobación — **C2** (en curso) y **C3** (recibo) del
 * artifact «Llamada Verificada».
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ESTA PANTALLA TIENE DIRECCIÓN PROPIA, Y ESO ES LO QUE LA HACE ÚTIL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `/verifications/<presentationId>` se puede recargar sin perder la ceremonia,
 * mandar por chat a un compañero que la termine, y volver a abrir mañana con el
 * recibo dentro. Antes esto era un trozo de estado dentro de un panel de la
 * ficha: refrescar la pestaña lo borraba todo.
 *
 * El estado inicial llega **del servidor**, leído del diario del banco. Este
 * componente sólo pregunta mientras siga pendiente.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  A QUIÉN SE LE PREGUNTA, QUE ES LO QUE CAMBIÓ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Esta pantalla pregunta cada tres segundos **al servidor de esta organización**,
 * y ese servidor contesta **de su propia base**. Antes, cada una de esas
 * preguntas se convertía en una llamada a te-api: cien por ceremonia para
 * averiguar un hecho que ocurre una vez.
 *
 * Ese segundo salto ya no existe. El desenlace entra en el diario **por el
 * webhook de te-api**, que llega solo, llega firmado y llega también con la
 * pestaña cerrada. Lo que queda aquí es un temporizador contra el propio
 * servidor de la maqueta: no gasta el cubo de tasa de la organización, no cruza
 * ninguna frontera, y es lo que permite que la pantalla se entere sin recargar.
 *
 * **Lo que no puede volver es preguntarle a te-api desde aquí ni desde el
 * servidor.** Si al recibo le falta un dato, el sitio donde se arregla es el
 * evento —en te-api—, no una llamada de vuelta. Ver `lib/te-api.ts`, donde está
 * escrito qué trae el evento hoy y qué no.
 *
 * ## Qué hace este fichero y qué hace el escenario
 *
 * Aquí vive **el ciclo**: la consulta, el desenlace, el reintento y las horas. En
 * `VerificationStage` vive **cómo se ve** ese ciclo —el reloj del plazo, el
 * latido de cada consulta contestada, el sello del final y el número de
 * cliente—. Están separados porque son dos oficios: uno decide *qué es verdad*
 * y el otro *cómo se enseña*, y mezclarlos es lo que hace que al retocar una
 * animación se toque sin querer cuándo se deja de preguntar.
 *
 * Lo que este fichero le pasa al escenario no es «pinta esto bonito»: son
 * **hechos con hora** —cuándo contestó la última consulta, si el desenlace ha
 * ocurrido con la pantalla delante— para que allí no haya que inventarse
 * ninguno. Ver la cabecera de `VerificationStage`, que es donde está escrita la
 * regla de no animar lo que no ha pasado.
 *
 * ## Para quién está escrita esta pantalla
 *
 * Para **quien decide comprar la integración**, y por debajo para el ingeniero
 * de ese mismo banco que la va a auditar. Los dos tienen razón en lo que
 * piden, así que están en dos niveles y no en dos pantallas:
 *
 *  · **La superficie afirma la garantía** —«es quien dice ser», «verificado
 *    contra el emisor y contra el titular»— con las palabras del banco. No
 *    explica el mecanismo: un director de operaciones no lee rutas HTTP ni
 *    nombres de nuestros contenedores, y si lo primero que ve es una ruta,
 *    deja de leer.
 *  · **El mecanismo vive en «ver el detalle técnico»**, plegado y cerrado de
 *    salida. Sigue estando entero —cadencia de la consulta, rutas, protocolos— y
 *    sigue siendo consultable: ningún ingeniero del banco puede decir que se
 *    le oculta nada. Ver `.tech` en `globals.css`.
 *
 * ## La línea de tiempo, y la frase del artifact
 *
 * El artifact escribe en C2 «esta pantalla no sondea a TripleEnable: la cartera
 * responde a nuestro propio servidor». La segunda mitad describe el **modo
 * directo** —el banco con su propio verificador, que es el fork de walt.id que
 * todavía no existe—; hoy el verificador es el de TripleEnable, por la regla
 * escrita del dueño de que la verificación se hace en nuestra infraestructura.
 *
 * Lo que sí es verdad hoy, y sigue escrito **dentro del detalle técnico**: el
 * navegador no habla con TripleEnable. Pregunta a este mismo servidor, que le
 * contesta de su propia base. Esa propiedad —ningún secreto en el navegador,
 * ninguna petición del agente a un tercero— es la que un empleado puede
 * comprobar abriendo la pestaña de red, y por eso se escribe donde la busca
 * quien la va a comprobar.
 *
 * Y ahora la frase del artifact es verdad entera, no a medias: **esta pantalla
 * no sondea a TripleEnable**, y su servidor tampoco.
 */

/** Cómo se avisó al titular. */
type Channel = 'qr' | 'phone';

/**
 * El recibo firmado, tal y como viaja en el evento y se guarda en el diario.
 *
 * Se declara aquí en vez de importarse de `lib/verifications.ts` por lo mismo
 * que `StatusResponse`: aquel módulo es `server-only` y no debe entrar en el
 * paquete del navegador ni siquiera como tipo. Es la misma forma; si allí
 * cambia, aquí también, y el compilador lo dice porque la página servidor pasa
 * la fila entera.
 */
interface PresentationProof {
  readonly presentation?: string | null;
  readonly keyBinding?: string | null;
  readonly sdHash?: string | null;
  readonly audience?: string | null;
  readonly nonce?: string | null;
  readonly signedAt?: string | null;
}

/**
 * Las piezas que atan la presentación a **una llave concreta de una persona
 * concreta**, y que son las que convierten el recibo en una prueba que un
 * tercero puede verificar sin preguntarnos.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  AHORA LLEGAN, Y ESO CAMBIA LO QUE ES ESTA PANTALLA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Aquí había un aviso que decía que las cuatro llegaban vacías: te-api las
 * tenía, pero el evento `presentation.settled` las excluía a propósito para no
 * sacar dato personal por un canal saliente, y este CRM ya no consultaba la
 * ruta que las servía. Esa política está revocada. El evento lleva ahora **todo
 * lo que trae la confirmación del titular**, así que estas filas dejan de ser
 * una promesa y pasan a ser el contenido del recibo.
 *
 * El argumento, que está entero en la cabecera de `api/webhooks/te-api`: el
 * webhook es un destino que la propia organización dio de alta y verificó, el
 * cuerpo va firmado, y esa organización **ya tiene derecho a estos datos** — es
 * quien pidió la verificación y el titular consintió enseñárselos. Lo que sigue
 * en pie es la otra mitad: **el receptor no vuelve a llamar a te-api**, ni desde
 * aquí ni desde el servidor.
 *
 * Cada campo **sigue teniendo su condición** y la fila que no tiene dato no se
 * pinta. Eso no era un apaño para el hueco: es que los cuatro son opcionales por
 * contrato —no vienen si el desenlace no es `verified`, ni si te-api recortó el
 * cuerpo por tamaño, ni si el evento es de una versión anterior—, y un recibo
 * que rotula un campo vacío afirma que falta algo que quizá nunca hubo.
 *
 * ## Por qué esta forma es plana y la de la base no
 *
 * En el diario, el recibo firmado vive entero en una columna `jsonb` porque es
 * una unidad que no se debe trocear. Aquí se aplana —una propiedad por fila del
 * recibo— porque este objeto no se guarda: se pinta. `holderProofOf` es el único
 * sitio donde se pasa de una forma a la otra, y así el JSX se lee sin encadenar
 * opcionales dentro de cada condición.
 */
interface HolderProof {
  /**
   * La huella RFC 7638 de la llave con la que firmó el titular.
   *
   * No es un `did:key:`: el `cnf` que pone nuestro emisor es una JWK cruda, y
   * te-api entrega la huella sin inventarse una conversión a DID. 44
   * caracteres, estable, y es lo que un perito compara de un vistazo.
   */
  readonly holderKey?: string | null;
  /**
   * La llave en sí, como JWK.
   *
   * La huella identifica; **ésta verifica**. Sin la parte pública no se puede
   * comprobar la firma del KB-JWT, así que un recibo con huella y sin llave
   * obligaría a pedirle la llave a alguien — que es exactamente lo que este
   * recibo existe para evitar.
   */
  readonly holderKeyJwk?: Record<string, unknown> | null;
  /**
   * El vínculo de esta persona con **esta** organización.
   *
   * Antes este campo se llamaba `holderProfileId` y esperaba el `te_…`. te-api
   * no lo entrega, y hace bien: ese identificador es el mismo en todas las
   * organizaciones, así que dos bancos que archivaran sus recibos podrían
   * cruzarlos y averiguar que su cliente y el del otro son la misma persona.
   * Esto contesta lo mismo y no sirve para eso.
   */
  readonly holderLinkId?: string | null;
  /** El KB-JWT: es lo que ata esa presentación a esa llave. */
  readonly keyBinding?: string | null;
  /**
   * Cuándo firmó **el titular**, según su propio teléfono.
   *
   * Es distinto de `settledAt`, que es cuándo se enteró esta consola: entre las
   * dos hay el tiempo que tarde el evento en llegar. Ahora se archivan las dos,
   * con rótulos distintos, y la diferencia entre ellas se lee en la línea de
   * tiempo sin restar nada a mano.
   */
  readonly signedAt?: string | null;
  /** El `sd_hash` firmado: ata la firma a **esta** presentación y a ninguna otra. */
  readonly sdHash?: string | null;
  /** El `aud` del KB-JWT: el verificador para el que se firmó. */
  readonly audience?: string | null;
  /** El `nonce` de la petición: lo que impide reutilizar una firma vieja. */
  readonly nonce?: string | null;
}

/**
 * Aplana lo que trae el diario a las filas que pinta el recibo.
 *
 * Es el único sitio donde se abre `proof`, y por eso está aquí y no repartido
 * por el JSX: la fila guarda `holderKey` y `holderLinkId` en sus propias
 * columnas —se comparan y se indexan— y el resto dentro del recibo firmado, que
 * es una unidad. La pantalla no tiene por qué saber esa distinción.
 *
 * Lo usan los dos caminos por los que el recibo puede aparecer: el estado
 * inicial que baja del servidor y la respuesta del sondeo local que llega
 * cuando el titular firma con la pantalla delante.
 */
function holderProofOf(source: {
  readonly holderKey?: string | null;
  readonly holderKeyJwk?: Record<string, unknown> | null;
  readonly holderLinkId?: string | null;
  readonly proof?: PresentationProof | null;
}): HolderProof {
  return {
    holderKey: source.holderKey ?? null,
    holderKeyJwk: source.holderKeyJwk ?? null,
    holderLinkId: source.holderLinkId ?? null,
    keyBinding: source.proof?.keyBinding ?? null,
    signedAt: source.proof?.signedAt ?? null,
    sdHash: source.proof?.sdHash ?? null,
    audience: source.proof?.audience ?? null,
    nonce: source.proof?.nonce ?? null,
  };
}

export interface TrackedVerification extends HolderProof {
  readonly presentationId: string;
  readonly channel: Channel;
  readonly typeKey: string;
  /**
   * Los atributos que se pidieron, tal y como se mandaron.
   *
   * Están aquí por **el reintento**: volver a intentarlo tiene que pedir lo
   * mismo que se pidió, y lo que se pidió lo sabe el diario del banco. Sin
   * esto, el botón tendría que adivinarlo o mandar al agente a rellenar otra
   * vez el formulario, que es justo el camino que no hay que rehacer.
   */
  readonly requestedClaims: readonly string[];
  readonly issuerDid: string;
  readonly externalId: string;
  readonly authorizationRequestUrl: string;
  readonly requestUri: string;
  readonly expiresAt: string;
  readonly requestedAt: string;
  readonly wakeupId: string | null;
  readonly wakeupAt: string | null;
  readonly settledAt: string | null;
  readonly status: VerificationStatus;
  readonly disclosedClaims: Record<string, unknown> | null;
  /**
   * El recibo firmado entero, tal y como lo guardó el diario.
   *
   * `holderKey`, `holderKeyJwk` y `holderLinkId` los hereda de `HolderProof` y
   * la fila los trae con esos mismos nombres, así que la página servidor pasa la
   * fila entera sin traducir nada. Las otras cinco piezas —el KB-JWT, la hora
   * que firmó el titular, el `sd_hash`, el `aud` y el `nonce`— viven aquí dentro
   * porque en la base son una sola columna, y `holderProofOf` es quien las saca.
   */
  readonly proof: PresentationProof | null;
}

/**
 * Lo que contesta `GET /api/credentials/present`, que es **el diario de este
 * banco** y no una copia de la respuesta de te-api.
 *
 * Todos los campos salen de la misma fila. Aquí hubo tres —estado, claims y la
 * hora del desenlace— porque el webhook no traía nada más; ahora trae también la
 * confirmación del titular entera, y la ruta la devuelve. **No es una fuente
 * nueva**: son cuatro columnas más del mismo `select`, y esta ruta sigue sin
 * llamar a te-api ni una vez.
 *
 * Por qué viaja hasta aquí y no basta con lo que bajó al cargar la página: la
 * ceremonia ocurre **con la pantalla abierta**. El titular firma, el webhook
 * aterriza, y la consulta siguiente tiene que poder pintar el recibo entero sin
 * que nadie recargue. Con sólo el estado, aparecía la mitad de arriba del recibo
 * y las filas de la firma no salían hasta volver a entrar.
 *
 * Se declara aquí, y no se importa de `lib/verifications.ts`, para no arrastrar
 * un módulo de servidor al paquete del navegador ni siquiera como tipo.
 */
interface StatusResponse {
  readonly status: VerificationStatus;
  readonly claims: Record<string, unknown> | null;
  /**
   * Cuándo escribió el diario el desenlace, sellado por el servidor.
   *
   * Antes esta hora se la inventaba el navegador (`new Date()` en el momento de
   * recibir el sondeo). Ahora viene de la fila, que es la hora en la que llegó
   * el evento firmado — la única que el banco puede defender.
   */
  readonly settledAt: string | null;
  readonly holderKey: string | null;
  readonly holderKeyJwk: Record<string, unknown> | null;
  readonly holderLinkId: string | null;
  readonly proof: PresentationProof | null;
}

/**
 * Cada cuánto se vuelve a preguntar mientras la petición sigue viva.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ESTO YA NO LLEGA A te-api, Y POR ESO SE PUEDE DEJAR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Tres segundos era la cadencia que se podía permitir cuando cada pregunta se
 * convertía en una llamada a la puerta B2B de te-api, que lleva un **cubo de
 * tasa por organización** compartido con la emisión (`TE_B2B_RATE_PER_ORG`, 600
 * por diez minutos por defecto): una pantalla a un segundo se comía la mitad del
 * presupuesto de todo el banco y el que se quedaba fuera era el agente de al
 * lado intentando emitir.
 *
 * Ese coste ya no existe: la respuesta sale de la base de esta maqueta. Se deja
 * en tres segundos igual, porque es la cadencia con la que el escenario está
 * afinado —el latido, el «hace 2 s»— y bajarla no gana nada que un ojo humano
 * note.
 */
const POLL_INTERVAL_MS = 3000;

/**
 * Cuánto se sigue preguntando después de que venza el plazo.
 *
 * te-api liquida la petición en cuanto pasa la hora y manda el evento, así que
 * un margen corto basta para recoger lo que el webhook acabe de escribir. Sin
 * este tope, una pestaña olvidada en un puesto interrogaría este servidor hasta
 * que alguien la cerrara, para mirar algo que ya no va a cambiar.
 */
const POLL_GRACE_MS = 20_000;

/** Cómo acabó, en cuatro palabras, para el último hito de la línea de tiempo. */
const OUTCOME_MILESTONE: Record<Exclude<VerificationStatus, 'pending'>, MessageKey> = {
  verified: 'tracker.outcomeVerified',
  rejected: 'tracker.outcomeRejected',
  failed: 'tracker.outcomeFailed',
  expired: 'tracker.outcomeExpired',
};

export function VerificationTracker({
  verification,
  labelFor,
  organizationName,
  holderName,
  counterQrSvg = null,
}: {
  verification: TrackedVerification;
  /**
   * **El código del mostrador**, ya dibujado en este servidor a partir del
   * enlace que devolvió te-api. Nulo cuando no hay ninguno que pintar: en la
   * rama del teléfono, o con el canal QR apagado en aquel despliegue.
   */
  counterQrSvg?: string | null;
  /** De nombre de atributo a rótulo. Se resuelve en el servidor. */
  labelFor: Record<string, string>;
  /** El nombre de la organización, para el recibo. No está escrito en el código. */
  organizationName: string;
  /**
   * El nombre del padrón, o `null` si la ficha ya no está.
   *
   * Baja hasta aquí porque el escenario lo enseña **al lado del número de
   * cliente**: los dos juntos son «con quién estoy hablando», y esa pregunta
   * no se contesta con un nombre suelto en la miga de pan de arriba.
   */
  holderName: string | null;
}) {
  const router = useRouter();
  const t = useTranslator();
  const [status, setStatus] = useState<VerificationStatus>(verification.status);
  const [disclosed, setDisclosed] = useState(verification.disclosedClaims);
  /**
   * La prueba de quién firmó. **Vuelve a ser estado, y ése es el cambio.**
   *
   * Aquí había una constante con un comentario que decía que nada podía
   * cambiarla durante la ceremonia: el webhook no traía ninguna de las piezas,
   * así que valían lo que valieran al cargar. Eso dejó de ser cierto — el evento
   * trae ahora la confirmación del titular entera (ver `HolderProof`), y el
   * caso normal es justamente el que la constante no sabía atender: la
   * ceremonia ocurre **con esta pantalla delante**.
   *
   * El titular firma, el webhook aterriza en el diario, y el sondeo local trae
   * el recibo en la consulta siguiente. Con una constante, el agente veía
   * aparecer «es quien dice ser» y un recibo sin la firma debajo, y sólo al
   * recargar salía entero. Un `set` que nadie llama era una promesa falsa;
   * ahora hay quien lo llama.
   */
  const [proof, setProof] = useState<HolderProof>(() => holderProofOf(verification));
  /**
   * Cuándo supo el banco que la petición había terminado.
   *
   * No es la hora en la que el titular firmó: entre las dos está lo que tarde el
   * evento en llegar. Se guarda igual porque es el único instante que este
   * servidor puede defender —«a esta hora lo supimos»— y porque cierra la línea
   * de tiempo con un dato en vez de con un hueco. El rótulo lo dice.
   */
  const [settledAt, setSettledAt] = useState(verification.settledAt);
  const [error, setError] = useState<string | undefined>();
  /**
   * El reloj de la cuenta atrás. **No toca la red**: sólo vuelve a pintar el
   * «caduca en 4:12» para que la espera no parezca una pantalla colgada.
   */
  const [now, setNow] = useState(() => Date.now());

  /**
   * Cuándo contestó la última consulta, y cuántas van.
   *
   * ═══════════════════════════════════════════════════════════════════════
   *  ESTO ES LO QUE HACE QUE LA ESPERA NO PAREZCA UNA PANTALLA COLGADA
   * ═══════════════════════════════════════════════════════════════════════
   *
   * El escenario pinta con ellos «Comprobando si ha contestado · hace 2 s» y
   * un punto que late. Late **cuando ha habido una respuesta de verdad**, no
   * cuando pasan tres segundos: si la red se cae, el punto se para y el «hace
   * …» crece, que es exactamente lo que hay que ver. Un latido de adorno
   * seguiría animándose con el cable desenchufado.
   *
   * `pollTick` sube en cada respuesta buena y sirve de llave de React para el
   * punto: al cambiar, el elemento se remonta y su animación vuelve a correr.
   * Es la forma más barata de lanzar una animación por suceso sin guardar
   * temporizadores.
   *
   * Sólo cuenta la consulta que **contestó bien**: un corte o un fallo de la
   * base no son un latido, y dejarlos contar haría que el punto siguiera
   * latiendo mientras la pantalla ya no sabe nada.
   */
  const [lastPolledAt, setLastPolledAt] = useState<number | null>(null);
  const [pollTick, setPollTick] = useState(0);
  /**
   * Si el desenlace ha ocurrido **con esta pantalla delante**.
   *
   * Es lo que separa «ha pasado ahora» de «pasó ayer»: se pone una sola vez, en
   * la consulta que trae el final, y nunca al cargar. Abrir mañana el recibo de
   * hoy enseña el mismo resultado quieto, porque animar un desenlace de hace
   * catorce horas sería representar un suceso que no está ocurriendo.
   */
  const [justSettled, setJustSettled] = useState(false);
  /** El reintento en curso. Ver `retry`. */
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | undefined>();

  const pending = status === 'pending';
  const deadline = new Date(verification.expiresAt).getTime();
  const overdue = !Number.isNaN(deadline) && now > deadline;

  useEffect(() => {
    if (!pending) return;

    let stopped = false;
    // El temporizador se declara antes que `poll` porque `poll` lo apaga: sin
    // esto, pasado el tope de cortesía el intervalo seguía disparando cada tres
    // segundos hasta que alguien cerrara la pantalla, sólo para salir por la
    // primera línea. No pedía red, pero mantenía vivo un temporizador que ya no
    // servía para nada.
    let timer: ReturnType<typeof setInterval> | undefined;

    const stop = () => {
      stopped = true;
      if (timer !== undefined) clearInterval(timer);
    };

    const poll = async () => {
      // El tope de cortesía: si el plazo venció hace rato y el diario sigue
      // diciendo «pendiente», el evento no va a llegar ya. Ver `POLL_GRACE_MS`.
      if (!Number.isNaN(deadline) && Date.now() > deadline + POLL_GRACE_MS) {
        stop();
        return;
      }
      try {
        const response = await fetch(
          `/api/credentials/present?presentationId=${encodeURIComponent(verification.presentationId)}`,
          { cache: 'no-store' },
        );
        if (stopped) return;
        const payload = (await response.json()) as StatusResponse & { error?: string };
        if (!response.ok) {
          // Se enseña, pero **no se para**: un corte suelto o una base que
          // tropieza no invalidan la petición, y el titular puede estar
          // contestando justo ahora. La siguiente consulta lo vuelve a intentar.
          setError(payload.error ?? t('tracker.pollFailed', { status: response.status }));
          return;
        }
        // Una consulta buena borra el aviso de la anterior: dejarlo puesto haría
        // que una pantalla que ya funciona pareciera rota.
        setError(undefined);
        // El latido. Va aquí y no antes del `ok` a propósito: ver `pollTick`.
        setLastPolledAt(Date.now());
        setPollTick((tick) => tick + 1);
        if (payload.status !== 'pending') {
          setDisclosed(payload.claims);
          // El recibo, en el mismo momento que el desenlace y no al recargar.
          // Va dentro de este `if` y no en cada consulta a propósito: mientras
          // la fila está pendiente los cuatro campos son `null`, y volver a
          // fijar un objeto nuevo cada tres segundos remontaría el recibo por
          // nada. Aquí ocurre una vez, que es las veces que ocurre el hecho.
          setProof(holderProofOf(payload));
          // La hora la pone **el servidor**, no este navegador. Aquí había un
          // `new Date()`, que es el reloj de quien tenga el puesto delante: una
          // línea de tiempo que un agente puede mover cambiando la hora de su
          // Windows no sirve para reclamar nada, y es la misma regla que el
          // `POST` de la ruta ya seguía para los otros dos hitos. El respaldo
          // sólo cubre una fila cerrada sin sello, que no debería existir.
          setSettledAt(payload.settledAt ?? new Date().toISOString());
          // El orden importa poco para React —agrupa los dos— pero se escribe
          // así porque se lee así: **primero ha pasado, y por eso se enseña**.
          setJustSettled(true);
          setStatus(payload.status);
        }
      } catch {
        // Un fallo de red suelto no para el ciclo: el siguiente lo vuelve a
        // intentar, y el QR sigue siendo válido mientras no caduque.
        //
        // Pero **se dice**, igual que el `!response.ok` de arriba. Callarlo
        // dejaba la pantalla diciendo «esperando al titular» con el latido
        // congelado y sin nada que explicara por qué: el agente está al teléfono
        // y no puede distinguir «el cliente no ha contestado todavía» de «esta
        // pantalla lleva un minuto sin hablar con nadie». Una espera muda es
        // peor que un aviso, porque parece que funciona.
        if (stopped) return;
        setError(t('tracker.noServer'));
      }
    };

    void poll();
    // `poll` corre síncrono hasta el primer `await`, y el tope de cortesía está
    // antes de él: si ya se ha pasado, `stopped` es `true` aquí y no hay que
    // montar el intervalo siquiera.
    if (!stopped) timer = setInterval(() => void poll(), POLL_INTERVAL_MS);
    return stop;
    // `pending` es un booleano y cambia una vez: el efecto se monta dos veces en
    // toda la ceremonia. Depender del objeto de estado haría que cada respuesta
    // volviera a montarlo, cancelara el temporizador y preguntara de inmediato —
    // eso no es una consulta cada tres segundos, es un bucle tan rápido como
    // conteste la red. Pasó, y se vio en el cubo de tasa de te-api: 611 llamadas
    // en 52 segundos desde una sola pantalla. Hoy ese bucle ya no llegaría a
    // te-api, pero seguiría siendo un bucle y la dependencia se queda como está.
    //
    // `t` entra en las dependencias porque el efecto lo usa, y no vuelve a
    // montar el ciclo: `useTranslator` lo memoriza por idioma, así que sólo
    // cambia cuando de verdad se cambia de idioma — y entonces la pantalla
    // entera se está recargando de todas formas.
  }, [pending, deadline, verification.presentationId, t]);

  // El reloj de la cuenta atrás. **No toca la red**: sólo vuelve a pintar el
  // «caduca en 4:12». Se queda tal cual — lo que se retiró es el tráfico a
  // te-api, no la sensación de que la pantalla está viva.
  useEffect(() => {
    if (!pending) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [pending]);

  /**
   * **Volver a intentarlo**, sin rehacer el camino.
   *
   * ═══════════════════════════════════════════════════════════════════════
   *  LO QUE SE VUELVE A PEDIR ES LO QUE SE PIDIÓ, Y LO DICE EL DIARIO
   * ═══════════════════════════════════════════════════════════════════════
   *
   * Hasta ahora, de esta pantalla no se salía: una credencial que no valía o
   * un plazo agotado dejaban al agente —con el cliente al teléfono— teniendo
   * que volver a la ficha, entrar en «verificar identidad», elegir otra vez el
   * tipo, marcar otra vez los atributos y acertar otra vez con el canal. Cinco
   * pasos para repetir algo que ya estaba decidido.
   *
   * El botón manda **los cuatro mismos valores** —cliente, tipo, atributos y
   * canal— leídos de la fila del diario, que es donde se anotó lo que se pidió
   * de verdad. No se copian del formulario, que ya no está en pantalla, ni se
   * adivinan: se leen de lo que este servidor escribió al lanzarla.
   *
   * Es una petición **nueva**, con su identificador, su plazo y su fila: no se
   * reabre la anterior. Un plazo agotado no se puede resucitar —te-api ya la
   * dio por muerta— y reescribir la fila borraría del historial del cliente que
   * hubo un primer intento que nadie contestó, que es justo lo que un banco
   * necesita poder demostrar. Por eso se navega al identificador nuevo.
   *
   * La ruta vuelve a comprobarlo todo con la sesión del servidor —la
   * organización, el cliente, el tipo y que esos atributos existan en esa
   * ficha—, así que esto no es una puerta de atrás: es el mismo botón de
   * lanzar con los valores ya puestos.
   */
  const retry = async () => {
    setRetrying(true);
    setRetryError(undefined);
    try {
      const response = await fetch('/api/credentials/present', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalId: verification.externalId,
          type: verification.typeKey,
          claims: verification.requestedClaims,
          channel: verification.channel,
        }),
      });
      const payload = (await response.json()) as { presentationId?: string; error?: string };
      if (!response.ok || typeof payload.presentationId !== 'string') {
        setRetryError(payload.error ?? t('tracker.retryFailed', { status: response.status }));
        setRetrying(false);
        return;
      }
      // No se quita el `retrying`: la navegación tarda un instante y devolver
      // el botón a su sitio antes de irse invita a pulsarlo dos veces — y dos
      // pulsaciones son dos timbres en el móvil de la misma persona. Es la
      // misma decisión que en `VerificationLauncher`, y por lo mismo.
      router.push(`/verifications/${encodeURIComponent(payload.presentationId)}`);
    } catch (cause) {
      setRetryError(cause instanceof Error ? cause.message : t('tracker.noServer'));
      setRetrying(false);
    }
  };

  return (
    <>
      {/*
        EL ESCENARIO: los cinco desenlaces y la espera, en un solo bloque.

        Antes eran cinco cajas de color, una por estado, cada una con su copia
        del punto y del título. Ahora es un componente al que se le pasan los
        hechos —el estado, el plazo, quién es el titular, cuándo contestó la
        última consulta— y él decide cómo se ve. Ganar eso importaba por dos
        razones que no son de estilo:

         · el ROJO sigue siendo sólo del fraude, y ahora **por construcción**:
           el tono lo pide una sola vez a `describeVerification` en vez de estar
           escrito a mano cinco veces. `rejected` y `failed` no se pueden
           colapsar por descuido al tocar una de las cinco cajas;
         · la identidad del titular está en **los cinco** desenlaces y en el
           mismo sitio, porque es un solo bloque y no cinco.
      */}
      <VerificationStage
        status={status}
        overdue={overdue}
        channel={verification.channel}
        requestedAt={verification.requestedAt}
        expiresAt={verification.expiresAt}
        now={now}
        holderName={holderName}
        externalId={verification.externalId}
        signedAt={proof.signedAt}
        settledAt={settledAt}
        justSettled={justSettled}
        lastPolledAt={lastPolledAt}
        pollTick={pollTick}
        onRetry={() => void retry()}
        retrying={retrying}
        retryError={retryError}
        configureHref={`/customers/${encodeURIComponent(verification.externalId)}/verify`}
      />

      {error !== undefined && <p className="alert">{error}</p>}

      {/*
        EL QR ES DEL MOSTRADOR, Y AHORA APUNTA A LA PETICIÓN DEL MARCO.

        Aquí había un QR y un enlace compuestos del `openid4vp://` de la sesión
        del verificador. Ésos se fueron con el camino crudo: llevaban a la
        pantalla genérica de presentación de la cartera, que no dice de qué va la
        llamada ni quién pregunta.

        El que hay ahora **lo construye te-api** y viaja en la respuesta de
        `POST /v1/requests` (`link`). Abre la ceremonia del marco, o sea la
        plantilla `bank.call.v2` — la misma que ve quien recibe el aviso en el
        teléfono. Aquí no se fabrica ningún enlace: el selector del emisor es
        configuración de aquel despliegue.

        **Sólo en el mostrador.** En la rama del teléfono el cliente no está
        delante de esta pantalla y un código aquí no sirve de nada; ahí lo que
        hace falta es saber dónde tiene que mirar.

        Y sólo mientras la petición está viva: pasado el plazo el código lleva a
        algo que ya no se puede contestar.
      */}
      {status === 'pending' && !overdue && (
        <div className="card">
          <h2>{t(verification.channel === 'qr' ? 'tracker.codeTitle' : 'tracker.inboxTitle')}</h2>
          {verification.channel === 'qr' && counterQrSvg !== null ? (
            /*
              El SVG lo dibuja `qrcode` en NUESTRO servidor a partir del enlace
              que devolvió te-api; no es HTML de terceros.
            */
            <div className="qr" dangerouslySetInnerHTML={{ __html: counterQrSvg }} />
          ) : (
            <p className="muted" style={{ marginBottom: 0 }}>
              {t('tracker.inboxBody')}
            </p>
          )}
        </div>
      )}

      {/*
        Lo que no sabemos del mundo **se sigue diciendo**, y en la superficie:
        que le haya sonado el móvil no lo confirma nadie. Es distinto de una
        carencia nuestra —eso se arregla—; esto es un hecho del mundo, y
        callarlo haría que el agente diera por avisado a quien no lo está.

        **Ahora sale en los dos canales, y antes sólo en el del teléfono.** No es
        una ampliación de celo: desde que el mostrador entrega la petición del
        marco, entrega por push igual que el teléfono, así que la misma duda le
        aplica igual. Dejarla en una sola rama habría hecho que el canal más
        nuevo fuera el que menos cuenta.

        El detalle técnico sí sigue siendo del timbre, porque es lo único que
        tiene identificador que cruzar con un registro: `POST /v1/requests` no
        devuelve ninguno equivalente.
      */}
      {status === 'pending' && (
        <div className="muted">
          <p style={{ margin: 0 }}>{t.rich('tracker.wakeupUnconfirmed')}</p>
          {verification.wakeupId !== null && (
            <details className="tech">
              <summary>{t('common.technicalDetail')}</summary>
              <p>{t.rich('tracker.wakeupTechnical', { id: verification.wakeupId })}</p>
            </details>
          )}
        </div>
      )}

      {/*
        LA LÍNEA DE TIEMPO VA LA ÚLTIMA, Y ANTES IBA ENCIMA.

        Es el registro, no la acción. Mientras se espera, lo que el agente
        necesita a mano es el estado y dónde está la solicitud —qué decirle al
        titular—; la sucesión de hitos con sus horas se consulta después, o
        mañana, cuando alguien reconstruye la llamada. Con el registro en medio,
        lo que había que leer quedaba por debajo del pliegue en un portátil de
        sucursal.

        Lo que iba aquí arriba era el código QR y el enlace. Se fueron con el
        camino crudo de OID4VP; el orden se queda, porque la razón no era el QR
        sino que la acción va antes que el archivo.
      */}
      <PresentationTimeline
        t={t}
        verification={verification}
        status={status}
        overdue={overdue}
        now={now}
        settledAt={settledAt}
        signedAt={proof.signedAt}
      />

      {status === 'verified' && (
        <PresentationReceipt
          t={t}
          verification={verification}
          disclosed={disclosed}
          proof={proof}
          labelFor={labelFor}
          settledAt={settledAt}
          organizationName={organizationName}
        />
      )}
    </>
  );
}

/**
 * **C2 · en curso.** La línea de tiempo, con las horas que este banco conoce.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  SÓLO SE PINTAN HITOS QUE ESTE SERVIDOR HA VISTO OCURRIR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * El artifact dibuja tres marcas: «solicitud creada», «su cartera nos la ha
 * pedido» y «esperando su respuesta». La segunda no está aquí, y no por
 * pereza: es el momento en que la cartera va a buscar el objeto de solicitud, y
 * **hoy va al verificador de TripleEnable**, no al de este banco. te-api no lo
 * cuenta —su evento `presentation.settled` lleva el desenlace y las horas de la
 * petición, no los pasos de la cartera—, así que el banco no puede saberlo.
 * Inventar esa marca sería poner una hora falsa en un registro que existe para
 * reclamar.
 *
 * En su sitio va la que sí ocurre y sí se mide: **cuándo salió el timbre**. Es
 * un hito real, con la hora de este servidor, y es además el que le importa al
 * agente —es el que le dice si ya puede pedirle al cliente que mire el móvil—.
 *
 * La marca de la respuesta lleva un rótulo distinto por lo mismo: es la hora en
 * la que el banco se enteró, no la hora en la que el titular firmó. Entre las
 * dos está lo que tarde el evento de te-api en llegar, y decirlo cuesta una
 * palabra.
 */
function PresentationTimeline({
  t,
  verification,
  status,
  overdue,
  now,
  settledAt,
  signedAt,
}: {
  t: Translator;
  verification: TrackedVerification;
  status: VerificationStatus;
  overdue: boolean;
  now: number;
  settledAt: string | null;
  /**
   * Cuándo firmó **el titular**, según el reloj de su teléfono.
   *
   * Es el hito que le faltaba a esta línea: mientras el evento no lo trajo, el
   * banco sólo podía archivar cuándo se enteró él. Ahora viene dentro de `proof`
   * y se pinta —pero sólo si viene: una presentación liquidada antes de que el
   * evento lo llevara no lo tiene, y entonces la línea se lee igual de bien con
   * un hito menos y sin una hora inventada.
   */
  signedAt: string | null | undefined;
}) {
  const waiting = status === 'pending' && !overdue;

  return (
    <div className="timeline-block">
      <h3>{t('tracker.timelineTitle')}</h3>
      <ol className="timeline">
        <li className="done">
          <div>
            <strong>{t('tracker.milestoneCreated')}</strong>
            <span>{t('tracker.milestoneCreatedHint')}</span>
          </div>
          <time>{formatClock(verification.requestedAt, t.locale)}</time>
        </li>

        {verification.wakeupAt !== null && (
          <li className="done">
            <div>
              <strong>{t('tracker.milestoneWakeup')}</strong>
              {/*
                Se dice, y en la superficie: es algo que no se sabe del mundo,
                no una carencia de esta consola. Lo que se ha quitado es el
                nombre de nuestra pieza interna — al agente le da igual quién
                acepta el timbre, le importa que no puede darlo por sonado.
              */}
              <span>{t('tracker.milestoneWakeupHint')}</span>
            </div>
            <time>{formatClock(verification.wakeupAt, t.locale)}</time>
          </li>
        )}

        {waiting && (
          <li className="current">
            <div>
              <strong>{t('tracker.milestoneWaiting')}</strong>
              <span>{t('tracker.milestoneWaitingHint')}</span>
            </div>
            <time>{formatCountdown(verification.expiresAt, now)}</time>
          </li>
        )}

        {/*
          LA HORA DEL TITULAR, QUE NO ES LA NUESTRA.

          Este hito lo firma su teléfono, no este servidor, y por eso es el
          único de la línea cuya hora el banco **no** pone. Va antes del
          desenlace porque ocurrió antes: entre que el titular firma y que esta
          consola se entera está lo que tarde el evento, y esa diferencia
          —que se ve aquí de un vistazo, dos horas seguidas en la misma
          columna— es exactamente lo que el recibo necesitaba para dejar de ser
          «cuándo lo supimos» y pasar a ser «cuándo lo hizo».

          Sólo se pinta si te-api lo devuelve. No hay hueco ni guion cuando
          falta: una hora inventada en un registro que existe para reclamar es
          peor que un hito de menos.
        */}
        {signedAt != null && signedAt !== '' && (
          <li className="done ok">
            <div>
              <strong>{t('tracker.milestoneSigned')}</strong>
              <span>{t('tracker.milestoneSignedHint')}</span>
            </div>
            <time>{formatClock(signedAt, t.locale)}</time>
          </li>
        )}

        {/*
          El último hito lleva el color de CÓMO acabó, no el verde de «este paso
          ya ocurrió». Un punto verde al lado de «ha dicho que no ha sido él» es
          una contradicción que se lee antes que el texto, y quien mira esta
          pantalla la mira de reojo mientras habla por teléfono.
        */}
        {status === 'pending' && overdue && (
          <li className="done caution">
            <div>
              <strong>{t('tracker.milestoneOverdue')}</strong>
              <span>{t('tracker.milestoneOverdueHint')}</span>
            </div>
            <time>{formatClock(verification.expiresAt, t.locale)}</time>
          </li>
        )}

        {status !== 'pending' && (
          <li className={`done ${verificationTone(status, verification.expiresAt)}`}>
            <div>
              <strong>{t(OUTCOME_MILESTONE[status])}</strong>
              {/*
                Sigue sin ser «la hora en la que firmó»: entre las dos está lo
                que tarde el evento en llegar. Lo que se ha quitado son los
                segundos —la cadencia es cocina— y no la salvedad, que es la que
                impide que este registro afirme una hora que el banco no vio.
              */}
              <span>{t('tracker.milestoneSettledHint')}</span>
            </div>
            <time>{settledAt === null ? '—' : formatClock(settledAt, t.locale)}</time>
          </li>
        )}
      </ol>
      {/*
        La arquitectura, entera y plegada. Es la frase favorita de un ingeniero
        —y con razón, porque es comprobable abriendo la pestaña de red— y la
        primera que hace abandonar a un director de operaciones.
      */}
      <details className="tech">
        <summary>{t('common.technicalDetail')}</summary>
        <p>{t.rich('tracker.architectureNote', { seconds: POLL_INTERVAL_MS / 1000 })}</p>
        <p>{t('tracker.verifierNote')}</p>
      </details>
    </div>
  );
}

/**
 * **C3 · verificada.** El recibo de lo que se comprobó.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  AQUÍ SE CIERRA LA VENTA, ASÍ QUE AQUÍ NO SE ROTULA LO QUE FALTA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Este recibo lo mira quien va a firmar el contrato. Hasta el 2026-08-29 el pie
 * decía «**falta la mitad del recibo**» y enumeraba las tres piezas que te-api
 * no devolvía todavía. Eso es una nota de un desarrollador para otro puesta en
 * la pantalla del comprador, y es la peor frase que había en la consola: un
 * banco no compra una prueba a la que le falta la mitad.
 *
 * La regla, que vale para todo lo demás: **una carencia de nuestra propia
 * implementación se arregla, no se rotula**. Lo que sí se sigue diciendo es lo
 * que no se sabe *del mundo* —si el titular guardó la credencial, si le sonó el
 * móvil—, porque eso no lo arregla ningún cambio de código y callarlo llevaría
 * al agente a dar por hecho lo que no puede.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  Y AHORA EL RECIBO SE PINTA ENTERO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Aquí había un aviso que decía que **los atributos divulgados** salían vacíos
 * —llegaban por el sondeo a te-api, el sondeo se retiró, y el evento no los
 * llevaba—. Ya no: `presentation.settled` trae ahora todo lo que trae la
 * confirmación del titular, así que el bloque «lo que enseñó» sale con lo que
 * enseñó, y las filas de la llave, el vínculo y la firma salen con la prueba.
 * El porqué de que el dato pueda viajar por ese canal está en la cabecera de
 * `api/webhooks/te-api`; lo que no cambia es que nadie vuelve a llamar a te-api.
 *
 * **Cada fila sigue teniendo su condición, y eso no era el apaño del hueco.**
 * Los campos son opcionales por contrato —no vienen si el desenlace no es
 * `verified`, ni si te-api recortó el cuerpo por tamaño, ni si el evento es de
 * una versión anterior—, y un recibo que rotula un campo vacío afirma que falta
 * algo que quizá nunca hubo. La regla se mantiene entera: la fila que no tiene
 * dato **no existe**, ni con hueco ni con guion ni con explicación.
 */
function PresentationReceipt({
  t,
  verification,
  disclosed,
  proof,
  labelFor,
  settledAt,
  organizationName,
}: {
  t: Translator;
  verification: TrackedVerification;
  disclosed: Record<string, unknown> | null;
  /**
   * Llave, vínculo y firma, ya aplanados. Ver `HolderProof`: cada campo puede
   * faltar por separado, y el que falta no se pinta.
   */
  proof: HolderProof;
  labelFor: Record<string, string>;
  settledAt: string | null;
  organizationName: string;
}) {
  const disclosedEntries = disclosed === null ? [] : Object.entries(disclosed);

  return (
    <div className="receipt">
      <h3>{t('tracker.receiptTitle', { organization: organizationName })}</h3>
      <dl className="facts">
        <dt>{t('tracker.receiptConfirmed')}</dt>
        <dd>
          {settledAt === null
            ? '—'
            : t('tracker.receiptConfirmedAt', { time: formatClock(settledAt, t.locale) })}
        </dd>
        <dt>{t('tracker.receiptRequest')}</dt>
        <dd className="mono">{verification.presentationId}</dd>
        <dt>{t('tracker.receiptRequiredCredential')}</dt>
        <dd>{verification.typeKey}</dd>
        {/*
          El emisor, con la palabra del banco. El DID exacto sigue estando, en
          el detalle de abajo: es la referencia que un perito necesita, y no lo
          que un director de operaciones lee para saber contra qué se comprobó.
        */}
        <dt>{t('tracker.receiptRequiredIssuer')}</dt>
        <dd>{organizationName}</dd>
        {/*
          El `sub` que te-api exigió. Viene de la ficha —es el mismo que se mandó
          al abrir la sesión— y no se lee del enlace de autorización, donde no
          está: el `sub` viaja dentro del objeto de solicitud firmado, no en la URI.
        */}
        <dt>{t('tracker.receiptRequiredHolder')}</dt>
        <dd className="mono">{verification.externalId}</dd>

        {/*
          Las cuatro piezas que atan la firma a una llave. Cada una con su
          condición: si el campo no viene, la fila no existe. Ni hueco, ni
          guion, ni explicación.

          En la superficie van éstas y no las forenses: la huella se compara de
          un vistazo y la hora se lee sola. El `nonce`, el `aud`, el `sd_hash` y
          la llave en crudo son material de peritaje y viven abajo, plegados.
        */}
        {proof.holderKey != null && proof.holderKey !== '' && (
          <>
            <dt>{t('tracker.receiptHolderKey')}</dt>
            <dd className="mono">{proof.holderKey}</dd>
          </>
        )}
        {proof.holderLinkId != null && proof.holderLinkId !== '' && (
          <>
            <dt>{t('tracker.receiptHolderLink')}</dt>
            <dd className="mono">{proof.holderLinkId}</dd>
          </>
        )}
        {proof.signedAt != null && proof.signedAt !== '' && (
          <>
            <dt>{t('tracker.receiptSignedAt')}</dt>
            <dd>{formatDateTime(proof.signedAt, t.locale)}</dd>
          </>
        )}
        {proof.keyBinding != null && proof.keyBinding !== '' && (
          <>
            <dt>{t('tracker.receiptKeyBinding')}</dt>
            <dd className="mono">{proof.keyBinding}</dd>
          </>
        )}
      </dl>

      {disclosedEntries.length > 0 && (
        <>
          <h4>{t('tracker.receiptDisclosed')}</h4>
          {/*
            El rótulo humano y nada más. El nombre técnico del atributo
            —`given_name`— está en el detalle de abajo, junto al resto: en el
            recibo duplicaba la altura de cada fila para decir dos veces lo
            mismo, y la segunda vez en un idioma que el lector no habla.
          */}
          <dl className="facts">
            {disclosedEntries.map(([name, value]) => (
              <div key={name} style={{ display: 'contents' }}>
                <dt>{labelFor[name] ?? name}</dt>
                <dd>{typeof value === 'string' ? value : JSON.stringify(value)}</dd>
              </div>
            ))}
          </dl>
        </>
      )}

      {/*
        La garantía **se afirma**. No se explica el mecanismo aquí: el mecanismo
        está tres centímetros más abajo, plegado, para quien lo audite.
      */}
      <p className="muted" style={{ marginTop: 14, marginBottom: 0 }}>
        {t.rich('tracker.receiptGuarantee', { organization: organizationName })}
      </p>

      <details className="tech">
        <summary>{t('common.technicalDetail')}</summary>
        <dl className="facts">
          <dt>{t('tracker.receiptFormat')}</dt>
          <dd>{t.rich('tracker.receiptFormatValue')}</dd>
          <dt>{t('tracker.receiptRequiredType')}</dt>
          <dd className="mono">{verification.typeKey}</dd>
          <dt>{t('tracker.receiptRequiredIssuer')}</dt>
          <dd className="mono">{verification.issuerDid}</dd>
          {disclosedEntries.length > 0 && (
            <>
              <dt>{t('tracker.receiptDisclosedClaims')}</dt>
              <dd className="mono">{disclosedEntries.map(([name]) => name).join(' ')}</dd>
            </>
          )}
          {proof.keyBinding != null && proof.keyBinding !== '' && (
            <>
              <dt>{t('tracker.receiptSignature')}</dt>
              <dd>{t.rich('tracker.receiptSignatureValue')}</dd>
            </>
          )}

          {/*
            ═══════════════════════════════════════════════════════════════
             LO QUE UN PERITO COMPARA, Y POR QUÉ ESTÁ AQUÍ Y NO ARRIBA
            ═══════════════════════════════════════════════════════════════

            El KB-JWT ya se enseñaba, y solo no sirve para nada: para
            comprobarlo hacen falta las cuatro piezas de este bloque —la llave
            con la que verificar la firma, el `nonce` al que contesta, el `aud`
            para el que se firmó y el `sd_hash` que lo ata a esta presentación
            y a ninguna otra—. Sin ellas, «aquí tiene el JWT» es un blob que
            hay que venir a preguntarnos cómo se valida, y este recibo existe
            precisamente para que no haya que preguntarnos nada.

            Van al detalle plegado y no al recibo por lo de siempre: quien
            firma el contrato no compara hashes, y quien los compara sabe
            abrir un `<details>`. Arriba quedan las cuatro filas que un humano
            lee en voz alta por teléfono.

            **Lo que no se pinta es `proof.presentation`**, la cadena entera
            `<SD-JWT>~<disclosure>~…~<KB-JWT>`. Se guarda —está en el diario,
            que es lo que importa para poder reconstruir el caso— pero no se
            enseña: son kilobytes, lleva dentro las divulgaciones en crudo que
            el bloque de arriba ya presenta legibles, y nadie audita eso
            leyéndolo de una pantalla. Se exporta de la base, no se copia de
            aquí.
          */}
          {proof.holderKeyJwk != null && (
            <>
              <dt>{t('tracker.receiptHolderKeyJwk')}</dt>
              <dd className="mono">{JSON.stringify(proof.holderKeyJwk)}</dd>
            </>
          )}
          {proof.nonce != null && proof.nonce !== '' && (
            <>
              <dt>{t('tracker.receiptNonce')}</dt>
              <dd className="mono">{proof.nonce}</dd>
            </>
          )}
          {proof.audience != null && proof.audience !== '' && (
            <>
              <dt>{t('tracker.receiptAudience')}</dt>
              <dd className="mono">{proof.audience}</dd>
            </>
          )}
          {proof.sdHash != null && proof.sdHash !== '' && (
            <>
              <dt>{t('tracker.receiptSdHash')}</dt>
              <dd className="mono">{proof.sdHash}</dd>
            </>
          )}
        </dl>

        {/*
          La nota va **debajo del bloque y sólo si hay bloque**: sin las piezas
          no hay nada que explicar, y una frase que promete una comprobación
          para la que faltan los datos es peor que ninguna frase.
        */}
        {(proof.nonce != null || proof.audience != null || proof.sdHash != null) && (
          <p className="muted" style={{ marginBottom: 0 }}>
            {t.rich('tracker.receiptProofNote')}
          </p>
        )}
      </details>
    </div>
  );
}
