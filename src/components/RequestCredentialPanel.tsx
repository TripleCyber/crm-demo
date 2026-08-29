'use client';

import { useEffect, useMemo, useState } from 'react';

/**
 * El panel de **pedir** credencial — la vuelta del ciclo, y las pantallas
 * **C1**, **C2** y **C3** del artifact «Llamada Verificada».
 *
 * El de al lado emite; éste pide. El agente elige qué atributos necesita, el
 * titular decide si los enseña, y cuando contesta aquí aparece lo que enseñó.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ESTE COMPONENTE NO SABE CÓMO SE LLAMA EL BANCO NI QUÉ EMITE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * No hay ni un `given_name` ni un `cliente` escritos aquí. Los tipos salen del
 * padrón de te-api y los atributos y los rótulos de la configuración de esa
 * organización (`credential-profiles.ts`), resueltos en el servidor. Una
 * organización que comprueba otra cosa —una póliza, una colegiación— funciona
 * con esta misma pantalla y sin tocarla.
 *
 * Lo que sí es de este CRM, y se queda, es **el canal**: un CRM sabe por qué vía
 * está hablando con su cliente, y por eso puede rotular «está al teléfono» o
 * «está delante». Eso es un dato real, no una suposición.
 *
 * ## Los dos niveles, que son dos ceremonias y no dos botones
 *
 * **Nivel 1 · «verificar quién habla»** — que la persona que está al teléfono
 * sea quien dice. Es lo que hay construido y funciona de punta a punta.
 *
 * **Nivel 2 · «autorizar operación»** — firmar un importe y un destinatario. Es
 * F7, y **aquí no se manda nada**: seleccionar ese nivel enseña lo que falta y
 * por qué no se puede simular. Lo que no se hace es enviar la ceremonia de
 * nivel 1 con el rótulo del nivel 2, que es exactamente el ataque que las dos
 * ceremonias existen para impedir — si el gesto es el mismo, acostumbrarse a
 * uno enseña a ejecutar el otro por reflejo.
 *
 * ## Dos canales dentro del nivel 1, porque son dos situaciones distintas
 *
 * - **Por teléfono.** El agente tiene al titular al aparato y necesita saber que
 *   es él. El titular **no ve esta pantalla**: está al otro lado de una llamada
 *   con su móvil en la mano. Por eso se le hace sonar el teléfono —el timbre de
 *   `POST /v1/b2b/wakeups`— y el QR no pinta nada.
 * - **En la sucursal.** El cliente está delante y mira esta misma pantalla.
 *   Entonces sí: sale el QR y lo escanea con su cartera.
 *
 * Los dos abren **la misma sesión de presentación** y se consultan igual. Lo
 * único que cambia es cómo se entera el titular de que le están preguntando.
 *
 * Habla **sólo con `/api/credentials/present` de este mismo servidor**, igual
 * que el panel de emisión y por la misma razón: el token M2M de la organización
 * no baja al navegador. Y no hay ningún verificador aquí: la sesión la abre
 * te-api en el suyo.
 *
 * ## La línea de tiempo, y la frase del artifact
 *
 * El artifact escribe en C2 «esta pantalla no sondea a TripleEnable: la cartera
 * responde a nuestro propio servidor». La segunda mitad describe el **modo
 * directo** —el banco con su propio verificador, que es el fork de walt.id que
 * todavía no existe—; hoy el verificador es el de TripleEnable, por la regla
 * escrita del dueño de que la verificación se hace en nuestra infraestructura.
 *
 * Lo que sí es verdad hoy, y es lo que la pantalla dice: **el navegador no
 * habla con TripleEnable**. Pregunta a este mismo servidor, y es él quien
 * consulta a te-api con el token de la organización. Esa propiedad —ningún
 * secreto en el navegador, ninguna petición del agente a un tercero— es la que
 * un empleado puede comprobar abriendo la pestaña de red, y es la que se
 * escribe. La otra se escribirá cuando sea cierta.
 *
 * Lo que el artifact pide de verdad en C2 es que la espera **avance sola**, y
 * eso sí se cumple: los hitos llevan la hora del servidor del banco, se pintan
 * en cuanto ocurren, y el que está en curso cuenta hacia atrás.
 */

/** Un atributo pedible, ya resuelto en el servidor. */
interface CredentialClaimOption {
  readonly name: string;
  readonly label: string;
}

/** Un tipo del padrón, con lo que lleva y cómo se rotula. */
interface CredentialTypeOption {
  readonly type: string;
  readonly label: string;
  readonly maxValidityDays: number;
  readonly claims: readonly CredentialClaimOption[];
  readonly defaultClaims: readonly string[];
}

/** Cómo se avisa al titular. El mismo valor que entiende la ruta del servidor. */
type Channel = 'qr' | 'phone';

/** Los dos niveles de la ceremonia. Ver la cabecera. */
type Level = 'identity' | 'transaction';

interface PresentationStarted {
  readonly presentationId: string;
  readonly authorizationRequestUrl: string;
  readonly requestUri: string;
  readonly expiresAt: string;
  readonly claims: readonly string[];
  readonly channel: Channel;
  /** Hora del servidor del banco en la que te-api devolvió la sesión. */
  readonly requestedAt: string;
  /** Hora del servidor del banco en la que salió el timbre. Sólo en `phone`. */
  readonly wakeupAt?: string;
  /** El `iss` que te-api le exigirá a la credencial presentada. */
  readonly issuerDid: string;
  readonly type: string;
  /** Sólo en el canal QR. */
  readonly qrSvg?: string;
  /** Sólo en el canal teléfono. No significa que haya sonado nada: ver abajo. */
  readonly wakeupId?: string;
}

type Status = 'pending' | 'verified' | 'rejected' | 'failed' | 'expired';

interface PresentationStatus {
  readonly status: Status;
  readonly claims: Record<string, unknown> | null;
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
 * Lo que el AGENTE tiene que hacer mientras se espera, **según por dónde se
 * avisó**.
 *
 * Cambia porque lo que hay que hacer a continuación es distinto: por teléfono
 * hay que pedirle a la persona que mire el móvil; en la sucursal, que apunte con
 * la cámara a esta pantalla. Es lo único de la espera que depende del canal —
 * el resto (cuánto queda y qué ha pasado ya) es igual en los dos y lo cuenta la
 * línea de tiempo.
 */
const PENDING_TEXT: Record<Channel, string> = {
  phone: 'Le hemos avisado a su móvil. Pídale que abra la app y confirme.',
  qr: 'Enséñele el código. Tiene que escanearlo con su cartera y confirmar ahí.',
};

/** Cómo acabó, en cuatro palabras, para el último hito de la línea de tiempo. */
const OUTCOME_MILESTONE: Record<Exclude<Status, 'pending'>, string> = {
  verified: 'Ha confirmado desde su cartera',
  rejected: 'Ha dicho que no ha sido él',
  failed: 'La credencial no ha valido',
  expired: 'Caducó sin respuesta',
};

export function RequestCredentialPanel({
  externalId,
  credentialTypes,
  agent,
}: {
  externalId: string;
  /**
   * Los tipos que el padrón de esta organización declara, con los atributos que
   * cada uno lleva **en esta ficha**. Se resuelven en el servidor cruzando
   * te-api, la configuración y la fila del cliente.
   */
  credentialTypes: readonly CredentialTypeOption[];
  /**
   * Quién sale en el móvil del titular. Viene de la sesión del servidor y es
   * *atribución*: te-api no lo verifica. Se pinta aquí para que el agente vea
   * con qué nombre le está llegando la llamada al cliente y pueda decirlo en
   * voz alta — es la mitad que hace que la comprobación sirva de algo.
   */
  agent: { readonly id: string; readonly displayName: string };
}) {
  const [level, setLevel] = useState<Level>('identity');
  const [type, setType] = useState(credentialTypes[0]?.type ?? '');

  const selectedType = useMemo(
    () => credentialTypes.find((option) => option.type === type),
    [credentialTypes, type],
  );

  // Lo marcado de salida lo dice el tipo, no este componente. Antes era
  // `given_name`/`family_name` escrito aquí, que acertaba con un banco y fallaba
  // con el siguiente; ahora sale de `defaultClaims`, que el servidor resuelve
  // con el catálogo del padrón de esa organización.
  const [selected, setSelected] = useState<readonly string[]>(
    () => credentialTypes[0]?.defaultClaims ?? [],
  );
  /** Qué botón se está atendiendo, para deshabilitar sólo ése. */
  const [busy, setBusy] = useState<Channel | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [started, setStarted] = useState<PresentationStarted | undefined>();
  const [result, setResult] = useState<PresentationStatus | undefined>();
  /**
   * Cuándo supo ESTA pantalla que la petición había terminado.
   *
   * No es la hora en la que el titular firmó: entre las dos hay hasta un
   * intervalo de sondeo. Se guarda igual porque es el único instante que este
   * servidor puede defender —«a esta hora lo supimos»— y porque cierra la línea
   * de tiempo con un dato en vez de con un hueco. El rótulo lo dice.
   */
  const [settledAt, setSettledAt] = useState<number | undefined>();
  /**
   * Si la petición ya tiene un final. **Separado de `result` a propósito.**
   *
   * El efecto de sondeo no puede depender de `result`: cada respuesta trae un
   * objeto nuevo, así que el efecto se volvería a montar en cada vuelta,
   * cancelaría el temporizador y sondearía otra vez de inmediato. Eso no es un
   * sondeo cada tres segundos: es un bucle tan rápido como conteste la red.
   * Pasó, y se vio en el cubo de tasa de te-api — 611 llamadas en 52 segundos
   * desde una sola pantalla. Un booleano cambia una vez y el efecto se monta
   * dos veces en toda la ceremonia.
   */
  const [done, setDone] = useState(false);
  /**
   * El reloj de la cuenta atrás. **No toca la red**: sólo vuelve a pintar el
   * «caduca en 4:12» para que la espera no parezca una pantalla colgada.
   */
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (started === undefined || done) return;

    let stopped = false;

    const poll = async () => {
      try {
        const response = await fetch(
          `/api/credentials/present?presentationId=${encodeURIComponent(started.presentationId)}`,
          { cache: 'no-store' },
        );
        if (stopped) return;
        const payload = (await response.json()) as PresentationStatus & { error?: string };
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
        setResult(payload);
        if (payload.status !== 'pending') {
          setSettledAt(Date.now());
          setDone(true);
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
  }, [started, done]);

  useEffect(() => {
    if (started === undefined || done) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [started, done]);

  const toggle = (name: string) => {
    setSelected((current) =>
      current.includes(name) ? current.filter((other) => other !== name) : [...current, name],
    );
  };

  // Cambiar de tipo cambia qué atributos existen, así que la selección del tipo
  // anterior no se puede arrastrar: dejaría marcado algo que el tipo nuevo no
  // lleva, el servidor lo rechazaría y el agente no sabría por qué.
  const chooseType = (next: string) => {
    setType(next);
    setSelected(credentialTypes.find((option) => option.type === next)?.defaultClaims ?? []);
  };

  const startRequest = async (channel: Channel) => {
    setBusy(channel);
    setError(undefined);
    setStarted(undefined);
    setResult(undefined);
    setSettledAt(undefined);
    setDone(false);
    try {
      const response = await fetch('/api/credentials/present', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ externalId, type, claims: selected, channel }),
      });
      const payload = (await response.json()) as Partial<PresentationStarted> & {
        error?: string;
      };
      if (!response.ok) {
        setError(payload.error ?? `la petición ha fallado (${response.status})`);
        return;
      }
      setStarted(payload as PresentationStarted);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'no se ha podido contactar con el servidor');
    } finally {
      setBusy(undefined);
    }
  };

  if (credentialTypes.length === 0) {
    return (
      <div className="card">
        <h2>Antes de pedir ningún dato</h2>
        <p className="alert">
          Esta organización no declara ningún tipo de credencial. Compruébalo en{' '}
          <a href="/diagnostics">Diagnóstico</a>: los tipos salen del padrón de te-api, no de aquí.
        </p>
      </div>
    );
  }

  const claimOptions = selectedType?.claims ?? [];
  const status = result?.status ?? 'pending';
  const labelFor = (name: string) =>
    claimOptions.find((claim) => claim.name === name)?.label ?? name;

  return (
    <div className="card">
      <h2>Antes de pedir ningún dato</h2>
      <p className="muted">
        Se le enviará una solicitud firmada. Dile por teléfono que se la has mandado. La
        verificación la hace <strong>TripleEnable</strong>, no este CRM: aquí no hay verificador ni
        clave, sólo la pregunta y la respuesta.
      </p>

      {/*
        Los dos niveles. Son dos ceremonias distintas, no dos etiquetas del
        mismo botón: el nivel 1 se aprueba deslizando y el nivel 2 tecleando
        cuatro cifras que hay que haber oído. Que el gesto difiera es lo que
        impide que acostumbrarse a uno enseñe a ejecutar el otro sin leer.
      */}
      <div className="levels">
        <button
          type="button"
          className={level === 'identity' ? 'level on' : 'level'}
          aria-pressed={level === 'identity'}
          onClick={() => setLevel('identity')}
        >
          Verificar quién habla
          <small>Nivel 1 · que sea él quien está al teléfono</small>
        </button>
        <button
          type="button"
          className={level === 'transaction' ? 'level on' : 'level'}
          aria-pressed={level === 'transaction'}
          onClick={() => setLevel('transaction')}
        >
          Autorizar operación
          <small>Nivel 2 · firmar un importe · todavía no</small>
        </button>
      </div>

      {level === 'transaction' ? <TransactionLevel /> : null}

      {level === 'identity' && (
        <>
          <div className="row">
            <label className="field">
              <span>Tipo de credencial</span>
              <select value={type} onChange={(event) => chooseType(event.target.value)}>
                {credentialTypes.map((option) => (
                  <option key={option.type} value={option.type}>
                    {/*
                      El rótulo primero y el `type_key` detrás. El rótulo sale de
                      configuración y puede no estar; entonces `label` ES el
                      `type_key` y se lee dos veces, que es mejor que inventarse un
                      nombre bonito a partir de una clave.
                    */}
                    {option.label === option.type ? option.type : `${option.label} · ${option.type}`}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <fieldset className="field claims" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ padding: 0 }}>Qué se le pide</legend>
            {claimOptions.length === 0 ? (
              <p className="alert warn" style={{ marginTop: 8 }}>
                Este tipo no lleva ningún atributo que esta ficha pueda rellenar, así que no hay
                nada que pedirle. Revisa la ficha, o el perfil del tipo en la configuración.
              </p>
            ) : (
              claimOptions.map((claim) => (
                <label key={claim.name} className="claim">
                  <input
                    type="checkbox"
                    checked={selected.includes(claim.name)}
                    onChange={() => toggle(claim.name)}
                  />
                  <span>
                    {claim.label} <span className="mono">{claim.name}</span>
                  </span>
                </label>
              ))
            )}
            <p className="muted" style={{ marginTop: 10 }}>
              Se pide sólo lo que hace falta. Lo que no se marque no sale de la cartera del
              titular, y lo que la cartera enseñe de más tampoco llega hasta aquí: te-api devuelve
              la intersección.
            </p>
          </fieldset>

          {/*
            Los dos botones, y en este orden. El de arriba es el de la llamada de
            teléfono, que es la situación normal de un agente con auriculares
            puestos; el QR sólo sirve si el cliente está en el mostrador mirando
            esta misma pantalla. Rotularlos por la SITUACIÓN y no por la tecnología
            —«está al teléfono» en vez de «push»— es lo que hace que no haya que
            elegir bien para acertar.
          */}
          <div className="row" style={{ alignItems: 'stretch' }}>
            <button
              type="button"
              onClick={() => void startRequest('phone')}
              disabled={busy !== undefined || type === '' || selected.length === 0}
            >
              {busy === 'phone' ? 'Avisando…' : 'Está al teléfono · avisar a su móvil'}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => void startRequest('qr')}
              disabled={busy !== undefined || type === '' || selected.length === 0}
            >
              {busy === 'qr' ? 'Pidiendo…' : 'Está delante · enseñar QR'}
            </button>
          </div>
          <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
            Al titular le llegará a nombre de <strong>{agent.displayName}</strong>, agente{' '}
            <span className="mono">{agent.id}</span>. Dígaselo en voz alta: que el nombre que oye
            por teléfono sea el que ve en la pantalla del móvil es la mitad de la comprobación.
          </p>
        </>
      )}

      {error !== undefined && (
        <p className="alert" style={{ marginTop: 16 }}>
          {error}
        </p>
      )}

      {level === 'identity' && started !== undefined && (
        <div style={{ marginTop: 20 }}>
          {/*
            Los cinco finales, cada uno con su bloque y su título. Antes eran
            cinco párrafos de dos colores y había que leerlos enteros para saber
            cuál era; ahora el título dice el resultado en cuatro palabras y el
            cuerpo explica qué hacer.

            El ROJO sigue siendo sólo del fraude. `rejected` y `failed` NO se
            colapsan: te-api los devuelve separados a propósito y para quien está
            al teléfono son sucesos opuestos —uno es «esta persona dice que no es
            ella» y hay que cortar; el otro es «la credencial no ha valido» y se
            reintenta—.
          */}
          {status === 'pending' && (
            <div className="outcome waiting">
              <span className="outcome-mark" aria-hidden="true" />
              <div>
                <h3>Esperando al titular</h3>
                <p>{PENDING_TEXT[started.channel]}</p>
              </div>
            </div>
          )}

          {status === 'verified' && (
            <div className="outcome ok">
              <span className="outcome-mark" aria-hidden="true" />
              <div>
                <h3>Es quien dice ser</h3>
                <p>
                  Ha presentado su credencial y la verificación ha salido bien. Puede continuar con
                  la operación.
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
                  operación y curse el aviso de fraude: si usted está hablando con alguien y el
                  titular dice que no, hay dos personas distintas.
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
                <p className="muted" style={{ margin: 0 }}>
                  Mientras el aviso de fraude del titular no llegue hasta aquí, una denuncia suya
                  se ve exactamente igual que un plazo agotado. Si sospecha, pregúntele.
                </p>
              </div>
            </div>
          )}

          <PresentationTimeline
            started={started}
            status={status}
            now={now}
            settledAt={settledAt}
          />

          {status === 'pending' && started.channel === 'qr' && (
            <>
              {/*
                El SVG lo genera `qrcode` en NUESTRO servidor a partir del
                enlace que devolvió te-api; no es HTML de terceros.
              */}
              <div className="qr" dangerouslySetInnerHTML={{ __html: started.qrSvg ?? '' }} />
              <p style={{ marginTop: 16 }}>
                <span className="mono">{started.authorizationRequestUrl}</span>
              </p>
            </>
          )}

          {status === 'pending' && started.channel === 'phone' && (
            <p className="muted">
              Aviso <span className="mono">{started.wakeupId}</span>. te-api contesta lo mismo tenga
              cartera o no —es deliberado, si no esta pantalla serviría para averiguar quién tiene
              la app probando identificadores—, así que esto <strong>no</strong> confirma que le
              haya sonado el teléfono. Si no contesta, pregúntele si tiene la app instalada en vez
              de darlo por hecho.
            </p>
          )}

          {status === 'verified' && (
            <PresentationReceipt
              started={started}
              externalId={externalId}
              claims={result?.claims ?? null}
              labelFor={labelFor}
              settledAt={settledAt}
            />
          )}

          <p className="muted" style={{ marginTop: 12 }}>
            Petición <span className="mono">{started.presentationId}</span>
            <br />
            La cartera va a buscar la solicitud a{' '}
            <span className="mono">{started.requestUri}</span> — infraestructura de TripleEnable.
          </p>
        </div>
      )}
    </div>
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
 * la que esta pantalla se enteró, no la hora en la que el titular firmó. Entre
 * las dos hay hasta un intervalo de sondeo, y decirlo cuesta una palabra.
 */
function PresentationTimeline({
  started,
  status,
  now,
  settledAt,
}: {
  started: PresentationStarted;
  status: Status;
  now: number;
  settledAt: number | undefined;
}) {
  const pending = status === 'pending';

  return (
    <div className="timeline-block">
      <h3>Estado</h3>
      <ol className="timeline">
        <li className="done">
          <div>
            <strong>Solicitud creada</strong>
            <span>en el verificador de TripleEnable, a nombre de esta organización</span>
          </div>
          <time>{clockOf(started.requestedAt)}</time>
        </li>

        {started.wakeupAt !== undefined && (
          <li className="done">
            <div>
              <strong>Aviso enviado a su móvil</strong>
              <span>
                te-api lo acepta igual tenga cartera o no, así que esto no confirma que haya sonado
              </span>
            </div>
            <time>{clockOf(started.wakeupAt)}</time>
          </li>
        )}

        {pending ? (
          <li className="current">
            <div>
              <strong>Esperando su respuesta</strong>
              <span>{remainingText(started.expiresAt, now)}</span>
            </div>
            <time>{countdown(started.expiresAt, now)}</time>
          </li>
        ) : (
          <li className="done">
            <div>
              <strong>{OUTCOME_MILESTONE[status]}</strong>
              <span>hora en la que esta pantalla lo supo, con hasta 3 s de retraso</span>
            </div>
            <time>{settledAt === undefined ? '—' : clockOf(new Date(settledAt).toISOString())}</time>
          </li>
        )}
      </ol>
      <p className="muted" style={{ margin: 0 }}>
        Esta pantalla <strong>no habla con TripleEnable</strong>: pregunta cada{' '}
        {POLL_INTERVAL_MS / 1000} segundos al servidor de este banco, y es él quien consulta a
        te-api con el token de la organización. Ni el token ni el secreto que lo pide bajan al
        navegador.
      </p>
    </div>
  );
}

/**
 * **C3 · verificada.** El recibo de lo que se comprobó.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  LAS TRES FILAS DEL ARTIFACT QUE NO ESTÁN, Y POR QUÉ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * El artifact enseña «llave `did:key:z6Mk…`», «perfil `te_4f8a…· activo`» y
 * «firma `0x8f2c…`». Ninguna de las tres la devuelve te-api hoy: `GET
 * /v1/b2b/presentations/:id` contesta `{presentationId, status, claims}` y no
 * expone el KB-JWT al partner. Y la fila del perfil es literalmente la primera
 * pieza de la hoja de ruta del artifact —«te-api · el padrón: publicar la
 * did:key del titular y servir la consulta llave → perfil → ¿activa?»—, que
 * está sin construir.
 *
 * Así que el recibo enseña **lo que sí se comprobó y quién lo comprobó**, que
 * no es poco: el emisor exigido, el `sub` exigido, el tipo, y los atributos que
 * el titular decidió enseñar. Un recibo con tres campos inventados sería peor
 * que uno con cuatro campos ciertos.
 */
function PresentationReceipt({
  started,
  externalId,
  claims,
  labelFor,
  settledAt,
}: {
  started: PresentationStarted;
  /**
   * El `sub` que te-api exigió. Viene de la ficha —es el mismo que se mandó al
   * abrir la sesión— y no se lee del enlace de autorización, donde no está: el
   * `sub` viaja dentro del objeto de solicitud firmado, no en la URI.
   */
  externalId: string;
  claims: Record<string, unknown> | null;
  labelFor: (name: string) => string;
  settledAt: number | undefined;
}) {
  return (
    <div className="receipt">
      <h3>Recibo · lo que Banco Demo guarda</h3>
      <dl className="facts">
        <dt>Confirmado</dt>
        <dd>
          {settledAt === undefined
            ? '—'
            : `${clockOf(new Date(settledAt).toISOString())} · hora en la que esta consola lo supo`}
        </dd>
        <dt>Petición</dt>
        <dd className="mono">{started.presentationId}</dd>
        <dt>Tipo exigido</dt>
        <dd className="mono">{started.type}</dd>
        <dt>Emisor exigido</dt>
        <dd className="mono">{started.issuerDid}</dd>
        <dt>Titular exigido</dt>
        <dd className="mono">{externalId}</dd>
      </dl>

      {claims !== null && Object.keys(claims).length > 0 && (
        <>
          <h4>Lo que enseñó</h4>
          <dl className="facts">
            {Object.entries(claims).map(([name, value]) => (
              <div key={name} style={{ display: 'contents' }}>
                <dt>
                  {labelFor(name)} <span className="mono">{name}</span>
                </dt>
                <dd>{typeof value === 'string' ? value : JSON.stringify(value)}</dd>
              </div>
            ))}
          </dl>
        </>
      )}

      <p className="muted" style={{ marginTop: 14, marginBottom: 0 }}>
        Lo firmó la cartera del titular y lo verificó TripleEnable contra ese emisor y ese
        titular. <strong>Falta la mitad del recibo</strong>: la llave (<span className="mono">
        did:key:…</span>), el perfil (<span className="mono">te_…</span>) y la firma del KB-JWT. No
        se pintan porque te-api no las devuelve —<span className="mono">
        GET /v1/b2b/presentations/:id</span> da <span className="mono">status</span> y{' '}
        <span className="mono">claims</span>—, y sin ellas el banco no puede archivar una prueba
        que un tercero verifique por su cuenta.
      </p>
    </div>
  );
}

/**
 * **Nivel 2 · autorizar operación.** Lo que hay, lo que falta, y por qué no se
 * simula.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ESTE PANEL NO MANDA NADA, Y ES LA DECISIÓN, NO UNA LIMITACIÓN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Se podría mandar hoy mismo un `kind: 'transaction'` a `POST /v1/b2b/wakeups`
 * —la ruta lo acepta y está probada— y rotular el botón «autorizar operación».
 * Sería mentira, y de la peligrosa:
 *
 *  - **El importe no viaja.** El cuerpo del timbre no tiene campo para él, y la
 *    cartera todavía no implementa `transaction_data` de OID4VP, así que la
 *    firma del titular no cubriría lo que leyó. Una firma que no cubre el
 *    importe es indistinguible de una de «verifica que eres tú».
 *  - **Las cuatro cifras no llegan a nadie.** te-api las acuña —`createWakeup`
 *    escribe `match_digits` porque el motor las exige a toda fila del canal
 *    push— pero **no las devuelve**: ni en la respuesta del timbre, ni en
 *    `GET /v1/requests/pending`, que es de donde las leería la cartera. Y
 *    `POST /v1/requests/:id/outcome` no las pide al responder, así que nadie
 *    las comprueba. Un número de cuatro cifras que el CRM se inventara y que
 *    nadie coteja no es una comprobación: es enseñarle al agente a dictar
 *    números por teléfono, que es justo el reflejo que un estafador explota.
 *
 * Por eso el panel dice qué falta y en dónde. Cuando esté, esta pantalla es una
 * cifra grande y una advertencia — la parte fácil.
 */
function TransactionLevel() {
  return (
    <div className="level-pane">
      <p className="alert warn" style={{ marginBottom: 16 }}>
        El nivel 2 todavía no se puede ejecutar, y esta pantalla no lo simula.
      </p>

      <p>
        Autorizar una operación es <strong>otra ceremonia</strong>, no la misma con otro rótulo: el
        titular tiene que ver el importe, firmarlo —de forma que la firma cubra lo que leyó— y
        teclear cuatro cifras que sólo pueden haber llegado por la voz de quien le está llamando.
        Mandar la ceremonia del nivel 1 con este nombre acostumbraría a todo el mundo a autorizar
        transferencias deslizando, que es exactamente lo que las dos ceremonias existen para
        impedir.
      </p>

      <h3>Qué falta, y dónde</h3>
      <dl className="facts">
        <dt>Cartera</dt>
        <dd>
          <span className="mono">transaction_data</span> de OID4VP en el KB-JWT, y negarse a firmar
          si no coincide con lo que se pintó. Es el único trabajo de criptografía nuevo del plan.
        </dd>
        <dt>te-api · las cuatro cifras</dt>
        <dd>
          Ya las acuña <span className="mono">createWakeup</span>, pero no salen: hacen falta en la
          respuesta de <span className="mono">POST /v1/b2b/wakeups</span> —para que este CRM las
          enseñe— y en <span className="mono">GET /v1/requests/pending</span> —para que la cartera
          las pida—, y <span className="mono">POST /v1/requests/:id/outcome</span> tiene que
          comprobarlas y matar el reto al primer fallo.
        </dd>
        <dt>te-api · la operación</dt>
        <dd>
          El timbre no lleva importe ni destinatario. Sin ellos no hay nada que resumir dentro del{' '}
          <span className="mono">transaction_data</span>.
        </dd>
      </dl>

      <p className="muted" style={{ marginBottom: 0 }}>
        Mientras tanto, para confirmar que quien está al teléfono es el titular, usa el nivel 1.
        No autoriza ninguna operación y lo dice: es lo que separa esta ceremonia de un permiso.
      </p>
    </div>
  );
}

/** `14:32:07` en la zona de quien mira la pantalla, que es quien la lee. */
function clockOf(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('es-ES', { hour12: false });
}

/** `1:41`, para el hito en curso. Vacío cuando ya no queda nada. */
function countdown(expiresAt: string, now: number): string {
  const remaining = new Date(expiresAt).getTime() - now;
  if (Number.isNaN(remaining) || remaining <= 0) return '0:00';
  const totalSeconds = Math.floor(remaining / 1000);
  return `${String(Math.floor(totalSeconds / 60))}:${(totalSeconds % 60)
    .toString()
    .padStart(2, '0')}`;
}

/**
 * Cuánto le queda a la petición, en palabras.
 *
 * La espera tiene que decir lo que está pasando: una pantalla que sólo pone
 * «esperando…» durante cinco minutos no se distingue de una colgada, y el
 * agente —que está al teléfono con alguien— necesita saber si le queda tiempo o
 * si ya toca volver a avisar.
 */
function remainingText(expiresAt: string, now: number): string {
  const remaining = new Date(expiresAt).getTime() - now;
  if (Number.isNaN(remaining)) return '';
  if (remaining <= 0) return 'El plazo se ha agotado.';
  return 'Caduca sola cuando llegue a cero; entonces hay que volver a avisar.';
}
