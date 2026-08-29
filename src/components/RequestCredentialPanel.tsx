'use client';

import { useEffect, useState } from 'react';

/**
 * El panel de **pedir** credencial — la vuelta del ciclo.
 *
 * El de al lado emite; éste pide. El agente elige qué atributos necesita, el
 * titular decide si los enseña, y cuando contesta aquí aparece lo que enseñó.
 *
 * ## Dos canales, porque son dos situaciones distintas
 *
 * - **Por teléfono.** Pedro tiene a Juan al aparato y necesita saber que es
 *   Juan. Juan **no ve esta pantalla**: está al otro lado de una llamada con su
 *   móvil en la mano. Por eso se le hace sonar el teléfono —el timbre de
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

interface CredentialTypeOption {
  readonly type: string;
  readonly maxValidityDays: number;
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
 * Lo que se dice mientras se espera, **según por dónde se avisó**.
 *
 * Cambia porque lo que el agente tiene que hacer a continuación es distinto: por
 * teléfono hay que pedirle a la persona que mire el móvil; en la sucursal, que
 * apunte con la cámara a esta pantalla.
 */
const PENDING_TEXT: Record<Channel, string> = {
  phone: 'Le hemos avisado a su móvil. Pídale que abra la app y confirme.',
  qr: 'Esperando a que el titular escanee el QR y conteste en su cartera…',
};

export function RequestCredentialPanel({
  externalId,
  credentialTypes,
  issuableClaims,
  agent,
}: {
  externalId: string;
  credentialTypes: readonly CredentialTypeOption[];
  /** Los atributos que ESTA credencial lleva. Salen de la ficha, en el servidor. */
  issuableClaims: readonly string[];
  /**
   * Quién sale en el móvil del titular. Viene de la sesión del servidor y es
   * *atribución*: te-api no lo verifica. Se pinta aquí para que el agente vea
   * con qué nombre le está llegando la llamada al cliente y pueda decirlo en
   * voz alta — es la mitad que hace que la comprobación sirva de algo.
   */
  agent: { readonly id: string; readonly displayName: string };
}) {
  const [type, setType] = useState(credentialTypes[0]?.type ?? '');
  // Por defecto, nombre y apellido: lo mínimo para confirmar con quién se
  // habla. Pedirlo todo «ya que estamos» es exactamente lo que la divulgación
  // selectiva existe para no tener que hacer.
  const [selected, setSelected] = useState<readonly string[]>(() =>
    issuableClaims.filter((name) => name === 'given_name' || name === 'family_name'),
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

  const toggle = (name: string) => {
    setSelected((current) =>
      current.includes(name) ? current.filter((other) => other !== name) : [...current, name],
    );
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

  if (credentialTypes.length === 0 || issuableClaims.length === 0) {
    return (
      <div className="card">
        <h2>Pedir credencial</h2>
        <p className="alert">
          No hay tipos de credencial o esta ficha no tiene ningún atributo que pedir. Compruébalo en{' '}
          <a href="/diagnostics">Diagnóstico</a>.
        </p>
      </div>
    );
  }

  const status = result?.status ?? 'pending';

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
          <span>Tipo</span>
          <select value={type} onChange={(event) => setType(event.target.value)}>
            {credentialTypes.map((option) => (
              <option key={option.type} value={option.type}>
                {option.type}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ padding: 0 }}>Qué se pide</legend>
        {issuableClaims.map((name) => (
          <label
            key={name}
            style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}
          >
            <input
              type="checkbox"
              checked={selected.includes(name)}
              onChange={() => toggle(name)}
              style={{ width: 'auto' }}
            />
            <span className="mono" style={{ margin: 0 }}>
              {name}
            </span>
          </label>
        ))}
        <p className="muted" style={{ marginTop: 8 }}>
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
          {status === 'pending' && <p className="alert warn">{PENDING_TEXT[started.channel]}</p>}

          {status === 'verified' && (
            <p className="alert ok">Es quien dice ser. Credencial presentada y verificada.</p>
          )}

          {/*
            `rejected` y `failed` NO se colapsan, y aquí es donde más se nota.
            te-api los devuelve separados a propósito y para quien está al
            teléfono son sucesos opuestos: uno es «esta persona dice que no es
            ella», que es un aviso de fraude y hay que cortar; el otro es «la
            credencial no ha valido», que se vuelve a intentar. Compartir el
            mismo rojo y la misma frase desharía la distinción que el contrato
            de te-api se molesta en mantener.
          */}
          {status === 'rejected' && (
            <p className="alert">
              <strong>El titular ha dicho que no ha sido él.</strong> Ha rechazado la petición desde
              su cartera. No continúe con la operación por teléfono y curse el aviso de fraude: si
              usted está hablando con alguien y el titular está diciendo que no, hay dos personas
              distintas.
            </p>
          )}

          {status === 'failed' && (
            <p className="alert warn">
              La credencial presentada no ha superado la verificación. No es un «no soy yo»: es la
              credencial no valiendo —caducada, revocada o de otro titular—. Se puede volver a
              intentar.
            </p>
          )}

          {status === 'expired' && (
            <p className="alert warn">
              La petición ha caducado sin respuesta. Vuelva a avisarle.
            </p>
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

          {status === 'pending' && (
            <p className="muted">Caduca el {new Date(started.expiresAt).toLocaleString('es-ES')}.</p>
          )}

          {status === 'verified' && result?.claims !== null && result?.claims !== undefined && (
            <dl className="facts">
              {Object.entries(result.claims).map(([name, value]) => (
                <div key={name} style={{ display: 'contents' }}>
                  <dt>{name}</dt>
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
