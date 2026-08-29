'use client';

import { useEffect, useMemo, useState } from 'react';

/**
 * El panel de **pedir** credencial — la vuelta del ciclo.
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
 * ## Dos canales, porque son dos situaciones distintas
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
 * ## Por qué se sondea
 *
 * Porque no hay webhook. te-api no acepta uno del partner a propósito: el
 * destino lo elegiría quien pide, y el verificador de TripleEnable acabaría
 * haciendo peticiones salientes a donde le dijeran. Sondear desde la pantalla
 * que ya está abierta cuesta una petición cada tres segundos y no abre nada.
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

interface PresentationStarted {
  readonly presentationId: string;
  readonly authorizationRequestUrl: string;
  readonly requestUri: string;
  readonly expiresAt: string;
  readonly claims: readonly string[];
  readonly channel: Channel;
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
 * el resto (que se está preguntando cada tres segundos, y cuánto queda) es
 * igual en los dos y se dice aparte.
 */
const PENDING_TEXT: Record<Channel, string> = {
  phone: 'Le hemos avisado a su móvil. Pídale que abra la app y confirme.',
  qr: 'Enséñele el código. Tiene que escanearlo con su cartera y confirmar ahí.',
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
        if (payload.status !== 'pending') setDone(true);
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
        <h2>Comprobar quién es</h2>
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
      <h2>Comprobar quién es</h2>
      <p className="muted">
        El titular decide qué enseña, desde su cartera. La verificación la hace{' '}
        <strong>TripleEnable</strong>, no este CRM: aquí no hay verificador ni clave, sólo la
        pregunta y la respuesta.
      </p>

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
            Este tipo no lleva ningún atributo que esta ficha pueda rellenar, así que no hay nada
            que pedirle. Revisa la ficha, o el perfil del tipo en la configuración.
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
          Se pide sólo lo que hace falta. Lo que no se marque no sale de la cartera del titular, y
          lo que la cartera enseñe de más tampoco llega hasta aquí: te-api devuelve la
          intersección.
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
        <span className="mono">{agent.id}</span>. Dígaselo en voz alta: que el nombre que oye por
        teléfono sea el que ve en la pantalla del móvil es la mitad de la comprobación.
      </p>

      {error !== undefined && (
        <p className="alert" style={{ marginTop: 16 }}>
          {error}
        </p>
      )}

      {started !== undefined && (
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
                <p className="muted" style={{ margin: 0 }}>
                  Se comprueba cada {POLL_INTERVAL_MS / 1000} segundos. {remainingText(started.expiresAt, now)}
                </p>
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
                <p>
                  Nadie contestó dentro del plazo. Vuelva a avisarle.
                </p>
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
                  Mientras el aviso de fraude del titular no llegue hasta aquí, una denuncia suya se
                  ve exactamente igual que un plazo agotado. Si sospecha, pregúntele.
                </p>
              </div>
            </div>
          )}

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

          {status === 'verified' && result?.claims !== null && result?.claims !== undefined && (
            <dl className="facts" style={{ marginTop: 16 }}>
              {Object.entries(result.claims).map(([name, value]) => (
                <div key={name} style={{ display: 'contents' }}>
                  <dt>
                    {labelFor(name)} <span className="mono">{name}</span>
                  </dt>
                  <dd>{typeof value === 'string' ? value : JSON.stringify(value)}</dd>
                </div>
              ))}
            </dl>
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
  const totalSeconds = Math.floor(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `Caduca en ${String(minutes)}:${seconds.toString().padStart(2, '0')}.`;
}
