'use client';

import { useEffect, useState } from 'react';

import { formatClock } from '@/lib/format';
import { describeVerification, type VerificationStatus } from '@/lib/verification-status';
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

/**
 * Lo que el AGENTE tiene que hacer mientras se espera, **según por dónde se
 * avisó**.
 *
 * Cambia porque lo que hay que hacer a continuación es distinto: por teléfono
 * hay que pedirle a la persona que mire el móvil; en la sucursal, que apunte con
 * la cámara a esta pantalla.
 */
const PENDING_TEXT: Record<Channel, string> = {
  phone: 'Le hemos avisado a su móvil. Pídale que abra la app y confirme.',
  qr: 'Enséñele el código. Tiene que escanearlo con su cartera y confirmar ahí.',
};

/** Cómo acabó, en cuatro palabras, para el último hito de la línea de tiempo. */
const OUTCOME_MILESTONE: Record<Exclude<VerificationStatus, 'pending'>, string> = {
  verified: 'Ha confirmado desde su cartera',
  rejected: 'Ha dicho que no ha sido él',
  failed: 'La credencial no ha valido',
  expired: 'Caducó sin respuesta',
};

export function VerificationTracker({
  verification,
  qrSvg,
  labelFor,
  organizationName,
}: {
  verification: TrackedVerification;
  /** El QR, ya dibujado en el servidor. Sólo en el canal que lo usa. */
  qrSvg: string | undefined;
  /** De nombre de atributo a rótulo. Se resuelve en el servidor. */
  labelFor: Record<string, string>;
  /** El nombre de la organización, para el recibo. No está escrito en el código. */
  organizationName: string;
}) {
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
          setError(payload.error ?? `la consulta ha fallado (${response.status})`);
          return;
        }
        // Un sondeo bueno borra el aviso del anterior: dejarlo puesto haría que
        // una pantalla que ya funciona pareciera rota.
        setError(undefined);
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
  }, [pending, deadline, verification.presentationId]);

  useEffect(() => {
    if (!pending) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [pending]);

  return (
    <>
      {/*
        Los cinco finales, cada uno con su bloque y su título. El título dice el
        resultado en cuatro palabras y el cuerpo explica qué hacer.

        El ROJO sigue siendo sólo del fraude. `rejected` y `failed` NO se
        colapsan: te-api los devuelve separados a propósito y para quien está
        al teléfono son sucesos opuestos —uno es «esta persona dice que no es
        ella» y hay que cortar; el otro es «la credencial no ha valido» y se
        reintenta—.
      */}
      {status === 'pending' && !overdue && (
        <div className="outcome waiting">
          <span className="outcome-mark" aria-hidden="true" />
          <div>
            <h3>Esperando al titular</h3>
            <p>{PENDING_TEXT[verification.channel]}</p>
          </div>
        </div>
      )}

      {/*
        Pendiente y con el plazo vencido. No se afirma que te-api la haya dado
        por caducada —eso lo dirá él— pero tampoco se sigue diciendo «esperando»
        sobre algo cuyo plazo se agotó hace rato.
      */}
      {status === 'pending' && overdue && (
        <div className="outcome warn">
          <span className="outcome-mark" aria-hidden="true" />
          <div>
            <h3>Sin respuesta</h3>
            <p>El plazo se agotó y nadie contestó. Vuelva a avisarle desde su ficha.</p>
          </div>
        </div>
      )}

      {status === 'verified' && (
        <div className="outcome ok">
          <span className="outcome-mark" aria-hidden="true" />
          <div>
            <h3>Es quien dice ser</h3>
            <p>
              Ha presentado su credencial y la verificación ha salido bien. Puede continuar con la
              operación.
            </p>
          </div>
        </div>
      )}

      {status === 'rejected' && (
        <div className="outcome alarm">
          <span className="outcome-mark" aria-hidden="true" />
          <div>
            <h3>El titular dice que no ha sido él</h3>
            <p>
              Ha <strong>rechazado la petición desde su cartera</strong>. No continúe con la
              operación y curse el aviso de fraude: si usted está hablando con alguien y el titular
              dice que no, hay dos personas distintas.
            </p>
          </div>
        </div>
      )}

      {status === 'failed' && (
        <div className="outcome warn">
          <span className="outcome-mark" aria-hidden="true" />
          <div>
            <h3>La credencial no ha valido</h3>
            <p>
              No es un «no soy yo»: es la credencial fallando —caducada, revocada o de otro
              titular—. Se puede volver a intentar.
            </p>
          </div>
        </div>
      )}

      {status === 'expired' && (
        <div className="outcome warn">
          <span className="outcome-mark" aria-hidden="true" />
          <div>
            <h3>Caducó sin respuesta</h3>
            <p>Nadie contestó dentro del plazo. Vuelva a avisarle.</p>
            {/*
              T9 (`docs/TAREAS.md` §3.2): hoy una denuncia del titular
              —«no estoy en ninguna llamada»— llega a te-api y muere ahí sin
              tocar la sesión de presentación, así que acaba **aquí**, con
              el ámbar de caducidad, y no en el bloque rojo de arriba. La
              pantalla no lo puede distinguir y por eso no afirma que el
              titular no mirara el móvil. Cuando el puente exista, `rejected`
              llegará solo y pintará rojo sin tocar este componente.
            */}
            {/*
              Se queda porque **cambia lo que el agente tiene que hacer**: sin
              esta frase, un plazo agotado se lee como «no ha mirado el móvil» y
              podría ser una denuncia. Lo que se ha quitado es el rodeo por
              nuestra tubería —«mientras el aviso de fraude no llegue hasta
              aquí»—, que explica el mecanismo en vez de decir qué hacer.
            */}
            <p className="muted" style={{ margin: 0 }}>
              Una denuncia del titular —«no estoy en ninguna llamada»— se ve hoy exactamente igual
              que un plazo agotado. Si sospecha, pregúntele.
            </p>
          </div>
        </div>
      )}

      {error !== undefined && <p className="alert">{error}</p>}

      <PresentationTimeline
        verification={verification}
        status={status}
        overdue={overdue}
        now={now}
        settledAt={settledAt}
      />

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
          <h2>{verification.channel === 'qr' ? 'Su código' : 'Abrir en la cartera'}</h2>
          {verification.channel === 'qr' && (
            <>
              {/*
                El SVG lo genera `qrcode` en NUESTRO servidor a partir del
                enlace que devolvió te-api; no es HTML de terceros.
              */}
              <div className="qr" dangerouslySetInnerHTML={{ __html: qrSvg ?? '' }} />
            </>
          )}
          <WalletLink uri={verification.authorizationRequestUrl} label="la solicitud" />
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
          <p style={{ margin: 0 }}>
            Que le haya sonado el móvil <strong>no lo confirma nadie</strong>. Si no contesta,
            pregúntele si tiene la app instalada en vez de darlo por hecho.
          </p>
          <details className="tech">
            <summary>Ver el detalle técnico</summary>
            <p>
              Aviso <span className="mono">{verification.wakeupId ?? '—'}</span>. te-api contesta lo
              mismo tenga cartera el titular o no, y es deliberado: si distinguiera, esta pantalla
              serviría para averiguar quién tiene la app probando identificadores.
            </p>
          </details>
        </div>
      )}

      {status === 'verified' && (
        <PresentationReceipt
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
  verification,
  status,
  overdue,
  now,
  settledAt,
}: {
  verification: TrackedVerification;
  status: VerificationStatus;
  overdue: boolean;
  now: number;
  settledAt: string | null;
}) {
  const waiting = status === 'pending' && !overdue;

  return (
    <div className="timeline-block">
      <h3>Estado</h3>
      <ol className="timeline">
        <li className="done">
          <div>
            <strong>Solicitud creada</strong>
            <span>firmada a nombre de esta entidad</span>
          </div>
          <time>{formatClock(verification.requestedAt)}</time>
        </li>

        {verification.wakeupAt !== null && (
          <li className="done">
            <div>
              <strong>Aviso enviado a su móvil</strong>
              {/*
                Se dice, y en la superficie: es algo que no se sabe del mundo,
                no una carencia de esta consola. Lo que se ha quitado es el
                nombre de nuestra pieza interna — al agente le da igual quién
                acepta el timbre, le importa que no puede darlo por sonado.
              */}
              <span>salió el aviso; que le suene el móvil no lo confirma nadie</span>
            </div>
            <time>{formatClock(verification.wakeupAt)}</time>
          </li>
        )}

        {waiting && (
          <li className="current">
            <div>
              <strong>Esperando su respuesta</strong>
              <span>Caduca sola cuando llegue a cero; entonces hay que volver a avisar.</span>
            </div>
            <time>{countdown(verification.expiresAt, now)}</time>
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
              <strong>El plazo se agotó</strong>
              <span>hora a la que caducaba la solicitud</span>
            </div>
            <time>{formatClock(verification.expiresAt)}</time>
          </li>
        )}

        {status !== 'pending' && (
          <li className={`done ${describeVerification(status, verification.expiresAt).tone}`}>
            <div>
              <strong>{OUTCOME_MILESTONE[status]}</strong>
              {/*
                Sigue sin ser «la hora en la que firmó»: entre las dos hay hasta
                un intervalo de sondeo. Lo que se ha quitado son los segundos
                —la cadencia es cocina— y no la salvedad, que es la que impide
                que este registro afirme una hora que el banco no vio.
              */}
              <span>hora en la que esta consola lo supo</span>
            </div>
            <time>{settledAt === null ? '—' : formatClock(settledAt)}</time>
          </li>
        )}
      </ol>
      {/*
        La arquitectura, entera y plegada. Es la frase favorita de un ingeniero
        —y con razón, porque es comprobable abriendo la pestaña de red— y la
        primera que hace abandonar a un director de operaciones.
      */}
      <details className="tech">
        <summary>Ver el detalle técnico</summary>
        <p>
          Esta pantalla <strong>no habla con TripleEnable</strong>: pregunta cada{' '}
          {POLL_INTERVAL_MS / 1000} segundos al servidor de esta organización (
          <span className="mono">GET /api/credentials/present</span>), y es él quien consulta a
          te-api (<span className="mono">GET /v1/b2b/presentations/:id</span>) con el token de la
          organización. Ni el token ni el secreto que lo pide bajan al navegador, y se comprueba
          abriendo la pestaña de red.
        </p>
        <p>
          La solicitud se abrió en el verificador de TripleEnable, firmada con el DID de esta
          organización. No tiene verificador propio ni clave de verificación.
        </p>
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
  verification,
  disclosed,
  proof,
  labelFor,
  settledAt,
  organizationName,
}: {
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
      <h3>Recibo · lo que {organizationName} guarda</h3>
      <dl className="facts">
        <dt>Confirmado</dt>
        <dd>
          {settledAt === null
            ? '—'
            : `${formatClock(settledAt)} · hora en la que esta consola lo supo`}
        </dd>
        <dt>Petición</dt>
        <dd className="mono">{verification.presentationId}</dd>
        <dt>Credencial exigida</dt>
        <dd>{verification.typeKey}</dd>
        {/*
          El emisor, con la palabra del banco. El DID exacto sigue estando, en
          el detalle de abajo: es la referencia que un perito necesita, y no lo
          que un director de operaciones lee para saber contra qué se comprobó.
        */}
        <dt>Emisor exigido</dt>
        <dd>{organizationName}</dd>
        {/*
          El `sub` que te-api exigió. Viene de la ficha —es el mismo que se mandó
          al abrir la sesión— y no se lee del enlace de autorización, donde no
          está: el `sub` viaja dentro del objeto de solicitud firmado, no en la URI.
        */}
        <dt>Titular exigido</dt>
        <dd className="mono">{verification.externalId}</dd>

        {/*
          Las tres piezas que atan la firma a una llave. Cada una con su
          condición: si el campo no viene, la fila no existe. Ni hueco, ni
          guion, ni explicación.
        */}
        {proof.holderKey != null && proof.holderKey !== '' && (
          <>
            <dt>Llave del titular</dt>
            <dd className="mono">{proof.holderKey}</dd>
          </>
        )}
        {proof.holderLinkId != null && proof.holderLinkId !== '' && (
          <>
            <dt>Vínculo del titular</dt>
            <dd className="mono">{proof.holderLinkId}</dd>
          </>
        )}
        {proof.signedAt != null && proof.signedAt !== '' && (
          <>
            <dt>Firmado por el titular</dt>
            <dd>{new Date(proof.signedAt).toLocaleString('es-ES')}</dd>
          </>
        )}
        {proof.keyBinding != null && proof.keyBinding !== '' && (
          <>
            <dt>Firma de la presentación</dt>
            <dd className="mono">{proof.keyBinding}</dd>
          </>
        )}
      </dl>

      {disclosedEntries.length > 0 && (
        <>
          <h4>Lo que enseñó</h4>
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
        <strong>Verificado contra el emisor y contra el titular.</strong> La firma la puso la
        cartera del titular; este recibo es lo que {organizationName} archiva de la comprobación.
      </p>

      <details className="tech">
        <summary>Ver el detalle técnico</summary>
        <dl className="facts">
          <dt>Formato</dt>
          <dd>
            <span className="mono">SD-JWT VC</span> presentada por{' '}
            <span className="mono">OID4VP</span>
          </dd>
          <dt>Tipo exigido</dt>
          <dd className="mono">{verification.typeKey}</dd>
          <dt>Emisor exigido</dt>
          <dd className="mono">{verification.issuerDid}</dd>
          {disclosedEntries.length > 0 && (
            <>
              <dt>Atributos revelados</dt>
              <dd className="mono">{disclosedEntries.map(([name]) => name).join(' ')}</dd>
            </>
          )}
          {proof.keyBinding != null && proof.keyBinding !== '' && (
            <>
              <dt>Firma</dt>
              <dd>
                la del <span className="mono">KB-JWT</span>, que ata esta presentación a la llave
                del titular
              </dd>
            </>
          )}
        </dl>
      </details>
    </div>
  );
}

/** `1:41`, para el hito en curso. */
function countdown(expiresAt: string, now: number): string {
  const remaining = new Date(expiresAt).getTime() - now;
  if (Number.isNaN(remaining) || remaining <= 0) return '0:00';
  const totalSeconds = Math.floor(remaining / 1000);
  return `${String(Math.floor(totalSeconds / 60))}:${(totalSeconds % 60)
    .toString()
    .padStart(2, '0')}`;
}
