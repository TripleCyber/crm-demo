'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useTranslator } from '@/i18n/client';
import type { MessageKey, Translator } from '@/i18n/translate';
import { formatClock, formatCountdown, formatDateTime } from '@/lib/format';
import { verificationTone, type VerificationStatus } from '@/lib/verification-status';
import { VerificationStage } from './VerificationStage';
import { WalletLink } from './WalletLink';

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
 * componente sólo sondea mientras siga pendiente.
 *
 * ## Qué hace este fichero y qué hace el escenario
 *
 * Aquí vive **el ciclo**: el sondeo, el desenlace, el reintento y las horas. En
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
 *    salida. Sigue estando entero —cadencia del sondeo, rutas, protocolos— y
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
 * navegador no habla con TripleEnable. Pregunta a este mismo servidor, y es él
 * quien consulta a te-api con el token de la organización. Esa propiedad
 * —ningún secreto en el navegador, ninguna petición del agente a un tercero— es
 * la que un empleado puede comprobar abriendo la pestaña de red, y por eso se
 * escribe donde la busca quien la va a comprobar.
 */

/** Cómo se avisó al titular. */
type Channel = 'qr' | 'phone';

/**
 * Las tres piezas que atan la presentación a **una llave concreta de una
 * persona concreta**, y que son las que convierten el recibo en una prueba que
 * un tercero puede verificar sin preguntarnos.
 *
 * Hoy `GET /v1/b2b/presentations/:id` no las devuelve todavía —están en curso
 * en te-api—, así que llegan `undefined` y **cada fila simplemente no se
 * pinta**. Lo que no se hace es rotular el hueco: la pantalla del comprador no
 * es el sitio donde se anuncian las carencias de nuestra propia implementación.
 * Eso se arregla, no se explica.
 *
 * Los nombres son los de la respuesta de te-api. Si allí se llaman de otra
 * forma, el cambio es renombrar aquí y nada más: nadie más en el CRM los toca.
 */
interface HolderProof {
  /**
   * La huella RFC 7638 de la llave con la que firmó el titular.
   *
   * No es un `did:key:`: el `cnf` que pone nuestro emisor es una JWK cruda, y
   * te-api entrega la huella sin inventarse una conversión a DID. 44
   * caracteres, estable, y es lo que un perito compara.
   */
  readonly holderKey?: string | null;
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
   * dos hay hasta un intervalo de sondeo. Hasta que te-api lo devolvió, el
   * banco sólo podía archivar la segunda.
   */
  readonly signedAt?: string | null;
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
}

/**
 * Lo que contesta `GET /api/credentials/present`, que es lo que contesta te-api
 * sin tocar.
 *
 * **No extiende `HolderProof`**: no tienen la misma forma, y ahí estuvo el
 * error. `HolderProof` es lo que pinta el recibo —cuatro cadenas planas—;
 * esto es el contrato de te-api, donde `holderKey` es un objeto y las piezas
 * de la firma viajan juntas dentro de `proof` porque sueltas no prueban nada.
 * El aplanado se hace en el sondeo, en un solo sitio. Se declara aquí, y no se
 * importa de `lib/te-api.ts`, para no arrastrar un módulo de servidor al
 * paquete del navegador ni siquiera como tipo.
 */
interface StatusResponse {
  readonly status: VerificationStatus;
  readonly claims: Record<string, unknown> | null;
  readonly holderKey?: { readonly thumbprint: string } | null;
  readonly holderLinkId?: string | null;
  readonly proof?: { readonly keyBinding: string; readonly signedAt: string } | null;
}

/**
 * Cada cuánto se vuelve a preguntar mientras la petición sigue viva.
 *
 * Tres segundos y no uno: la consulta pasa por la puerta B2B de te-api, que
 * lleva un **cubo de tasa por organización** compartido con la emisión
 * (`TE_B2B_RATE_PER_ORG`, 600 por diez minutos por defecto). Una pantalla
 * sondeando cada segundo durante los cinco minutos que vive la petición se come
 * la mitad del presupuesto de todo el banco, y el que se queda fuera es el
 * agente de al lado que intentaba emitir.
 */
const POLL_INTERVAL_MS = 3000;

/**
 * Cuánto se sigue preguntando después de que venza el plazo.
 *
 * te-api contesta `expired` en cuanto pasa la hora, así que un margen corto
 * basta para recogerlo. Sin este tope, una pestaña olvidada en un puesto
 * sondearía este servidor —y él a te-api— hasta que alguien la cerrara: son
 * 1.200 llamadas por hora del presupuesto del banco para mirar algo que ya no
 * va a cambiar.
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
  qrSvg,
  labelFor,
  organizationName,
  holderName,
}: {
  verification: TrackedVerification;
  /** El QR, ya dibujado en el servidor. Sólo en el canal que lo usa. */
  qrSvg: string | undefined;
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
   * La prueba de quién firmó. Arranca con lo que traiga el diario y se
   * completa con lo que conteste el sondeo. Mientras te-api no las devuelva las
   * tres siguen vacías, y el recibo se pinta sin esas filas.
   */
  const [proof, setProof] = useState<HolderProof>({
    holderKey: verification.holderKey,
    holderLinkId: verification.holderLinkId,
    keyBinding: verification.keyBinding,
    signedAt: verification.signedAt,
  });
  /**
   * Cuándo supo el banco que la petición había terminado.
   *
   * No es la hora en la que el titular firmó: entre las dos hay hasta un
   * intervalo de sondeo. Se guarda igual porque es el único instante que este
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
   * Sólo cuenta la consulta que **contestó bien**: un 429 del cubo de tasa o
   * un corte no son un latido, y dejarlos contar haría que el punto siguiera
   * latiendo mientras la pantalla ya no sabe nada.
   */
  const [lastPolledAt, setLastPolledAt] = useState<number | null>(null);
  const [pollTick, setPollTick] = useState(0);
  /**
   * Si el desenlace ha ocurrido **con esta pantalla delante**.
   *
   * Es lo que separa «ha pasado ahora» de «pasó ayer»: se pone una sola vez, en
   * el sondeo que trae el final, y nunca al cargar. Abrir mañana el recibo de
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

    const poll = async () => {
      // El tope de cortesía: si el plazo venció hace rato y te-api sigue
      // diciendo «pendiente», no hay nada más que esperar. Ver `POLL_GRACE_MS`.
      if (!Number.isNaN(deadline) && Date.now() > deadline + POLL_GRACE_MS) {
        stopped = true;
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
          // Se enseña, pero **no se para**: un 429 del cubo de tasa o un corte
          // suelto no invalidan la petición, y el titular puede estar
          // contestando justo ahora. El siguiente sondeo lo vuelve a intentar.
          setError(payload.error ?? t('tracker.pollFailed', { status: response.status }));
          return;
        }
        // Un sondeo bueno borra el aviso del anterior: dejarlo puesto haría que
        // una pantalla que ya funciona pareciera rota.
        setError(undefined);
        // El latido. Va aquí y no antes del `ok` a propósito: ver `pollTick`.
        setLastPolledAt(Date.now());
        setPollTick((tick) => tick + 1);
        if (payload.status !== 'pending') {
          setDisclosed(payload.claims);
          // La forma de te-api no es plana: `holderKey` es un objeto con la
          // huella y la JWK, y las cuatro piezas de la firma viajan juntas
          // dentro de `proof` porque sueltas no prueban nada. Aquí se aplana a
          // lo que pinta el recibo; la JWK entera y el resto de `proof` no se
          // guardan porque esta pantalla no los enseña. Cada fila sigue
          // apareciendo sola, y faltando sin explicación, según venga o no.
          setProof({
            holderKey: payload.holderKey?.thumbprint,
            holderLinkId: payload.holderLinkId,
            keyBinding: payload.proof?.keyBinding,
            signedAt: payload.proof?.signedAt,
          });
          setSettledAt(new Date().toISOString());
          // El orden importa poco para React —agrupa los dos— pero se escribe
          // así porque se lee así: **primero ha pasado, y por eso se enseña**.
          setJustSettled(true);
          setStatus(payload.status);
        }
      } catch {
        // Un fallo de red suelto no borra la pantalla: el siguiente sondeo lo
        // vuelve a intentar, y el QR sigue siendo válido mientras no caduque.
      }
    };

    void poll();
    const timer = setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
    // `pending` es un booleano y cambia una vez: el efecto se monta dos veces en
    // toda la ceremonia. Depender del objeto de estado haría que cada respuesta
    // volviera a montarlo, cancelara el temporizador y sondeara de inmediato —
    // eso no es un sondeo cada tres segundos, es un bucle tan rápido como
    // conteste la red. Pasó, y se vio en el cubo de tasa de te-api: 611 llamadas
    // en 52 segundos desde una sola pantalla.
    //
    // `t` entra en las dependencias porque el efecto lo usa, y no vuelve a
    // montar el sondeo: `useTranslator` lo memoriza por idioma, así que sólo
    // cambia cuando de verdad se cambia de idioma — y entonces la pantalla
    // entera se está recargando de todas formas.
  }, [pending, deadline, verification.presentationId, t]);

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
        EL ENLACE SE OFRECE EN LOS DOS CANALES, Y ANTES SÓLO EN UNO.

        El QR es del canal `qr` y ahí se queda: es para el cliente que está
        delante del mostrador. El ENLACE es otra cosa —abre la cartera del
        aparato que lo toca— y sirve igual en los dos casos:

        - en `qr`, para quien tiene la consola abierta en su propio móvil y no
          puede fotografiar su propia pantalla;
        - en `phone`, para comprobar que el enlace funciona SIN depender de que
          llegue el aviso push, que es una pieza aparte que puede fallar sola.
          Antes, si el aviso no llegaba, no había ninguna otra forma de entrar
          en la ceremonia desde esta pantalla.

        Sólo mientras la petición está viva: pasado el plazo el enlace lleva a
        una sesión que el verificador ya no reconoce, y la cartera enseñaría un
        error en vez de una ceremonia.
      */}
      {status === 'pending' && !overdue && (
        <div className="card">
          <h2>{t(verification.channel === 'qr' ? 'tracker.codeTitle' : 'tracker.walletTitle')}</h2>
          {verification.channel === 'qr' && (
            <>
              {/*
                El SVG lo genera `qrcode` en NUESTRO servidor a partir del
                enlace que devolvió te-api; no es HTML de terceros.
              */}
              <div className="qr" dangerouslySetInnerHTML={{ __html: qrSvg ?? '' }} />
            </>
          )}
          <WalletLink
            uri={verification.authorizationRequestUrl}
            label={t('tracker.walletLinkLabel')}
          />
        </div>
      )}

      {/*
        Lo que no sabemos del mundo **se sigue diciendo**, y en la superficie:
        que le haya sonado el móvil no lo confirma nadie. Es distinto de una
        carencia nuestra —eso se arregla—; esto es un hecho del mundo, y
        callarlo haría que el agente diera por avisado a quien no lo está.

        Lo que baja al detalle es el POR QUÉ del diseño y el identificador del
        aviso: es lo que hace falta para cruzarlo con un registro, no para
        atender la llamada.
      */}
      {status === 'pending' && verification.channel === 'phone' && (
        <div className="muted">
          <p style={{ margin: 0 }}>{t.rich('tracker.wakeupUnconfirmed')}</p>
          <details className="tech">
            <summary>{t('common.technicalDetail')}</summary>
            <p>{t.rich('tracker.wakeupTechnical', { id: verification.wakeupId ?? '—' })}</p>
          </details>
        </div>
      )}

      {/*
        LA LÍNEA DE TIEMPO VA DEBAJO DEL CÓDIGO, Y ANTES IBA ENCIMA.

        Es el registro, no la acción. Mientras se espera, lo que el agente
        necesita a mano es el código o el enlace —lo que hay que enseñarle o
        mandarle al titular—; la sucesión de hitos con sus horas se consulta
        después, o mañana, cuando alguien reconstruye la llamada. Con el
        registro en medio, lo que había que tocar quedaba por debajo del pliegue
        en un portátil de sucursal.
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
 * cuenta —`GET /v1/b2b/presentations/:id` devuelve `{status, claims}` y nada
 * más—, así que el banco no puede saberlo. Inventar esa marca sería poner una
 * hora falsa en un registro que existe para reclamar.
 *
 * En su sitio va la que sí ocurre y sí se mide: **cuándo salió el timbre**. Es
 * un hito real, con la hora de este servidor, y es además el que le importa al
 * agente —es el que le dice si ya puede pedirle al cliente que mire el móvil—.
 *
 * La marca de la respuesta lleva un rótulo distinto por lo mismo: es la hora en
 * la que el banco se enteró, no la hora en la que el titular firmó. Entre las
 * dos hay hasta un intervalo de sondeo, y decirlo cuesta una palabra.
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
   * Es el hito que le faltaba a esta línea: hasta que te-api lo devolvió, el
   * banco sólo podía archivar cuándo se enteró él. Se pinta sólo si viene —una
   * presentación de antes de que te-api lo sirviera no lo tiene—, y cuando no
   * viene la línea se lee igual de bien con un hito menos.
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
          consola se entera hay hasta un intervalo de consulta, y esa diferencia
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
                Sigue sin ser «la hora en la que firmó»: entre las dos hay hasta
                un intervalo de sondeo. Lo que se ha quitado son los segundos
                —la cadencia es cocina— y no la salvedad, que es la que impide
                que este registro afirme una hora que el banco no vio.
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
 * Las tres filas —llave, perfil y firma— están construidas y esperando en
 * `HolderProof`: llegan por `GET /v1/b2b/presentations/:id` y **cada una se
 * pinta cuando su campo viene**. Mientras no vengan, la fila no sale y el
 * recibo no explica por qué.
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
  /** Llave, perfil y firma. Ver `HolderProof`: hoy pueden venir las tres vacías. */
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
          Las tres piezas que atan la firma a una llave. Cada una con su
          condición: si el campo no viene, la fila no existe. Ni hueco, ni
          guion, ni explicación.
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
        </dl>
      </details>
    </div>
  );
}
