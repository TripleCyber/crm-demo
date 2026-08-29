'use client';

import { useEffect, useState } from 'react';

/**
 * El panel de **pedir** credencial — la vuelta del ciclo.
 *
 * El de al lado emite; éste pide. El agente elige qué atributos necesita, sale
 * un QR, el titular lo escanea con su cartera y decide si enseña o no. Cuando
 * contesta, aquí aparece lo que enseñó.
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

interface PresentationStarted {
  readonly presentationId: string;
  readonly authorizationRequestUrl: string;
  readonly requestUri: string;
  readonly expiresAt: string;
  readonly claims: readonly string[];
  readonly qrSvg: string;
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

const STATUS_TEXT: Record<Status, string> = {
  pending: 'Esperando a que el titular conteste en su cartera…',
  verified: 'Credencial presentada y verificada.',
  // Rechazado y fallido se cuentan distinto **porque son distintos**: uno se
  // vuelve a intentar y el otro no.
  rejected: 'El titular ha rechazado la petición desde su cartera.',
  failed: 'La credencial presentada no ha superado la verificación.',
  expired: 'La petición ha caducado sin respuesta.',
};

export function RequestCredentialPanel({
  externalId,
  credentialTypes,
  issuableClaims,
}: {
  externalId: string;
  credentialTypes: readonly CredentialTypeOption[];
  /** Los atributos que ESTA credencial lleva. Salen de la ficha, en el servidor. */
  issuableClaims: readonly string[];
}) {
  const [type, setType] = useState(credentialTypes[0]?.type ?? '');
  // Por defecto, nombre y apellido: lo mínimo para confirmar con quién se
  // habla. Pedirlo todo «ya que estamos» es exactamente lo que la divulgación
  // selectiva existe para no tener que hacer.
  const [selected, setSelected] = useState<readonly string[]>(() =>
    issuableClaims.filter((name) => name === 'given_name' || name === 'family_name'),
  );
  const [busy, setBusy] = useState(false);
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

  const startRequest = async () => {
    setBusy(true);
    setError(undefined);
    setStarted(undefined);
    setResult(undefined);
    setDone(false);
    try {
      const response = await fetch('/api/credentials/present', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ externalId, type, claims: selected }),
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
      setBusy(false);
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

  return (
    <div className="card">
      <h2>Pedir credencial</h2>
      <p className="muted">
        El titular escanea el QR con su cartera y decide qué enseña. La verificación la hace{' '}
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

      <button
        type="button"
        onClick={startRequest}
        disabled={busy || type === '' || selected.length === 0}
      >
        {busy ? 'Pidiendo…' : 'Pedir credencial'}
      </button>

      {error !== undefined && (
        <p className="alert" style={{ marginTop: 16 }}>
          {error}
        </p>
      )}

      {started !== undefined && (
        <div style={{ marginTop: 20 }}>
          <p className={result?.status === 'verified' ? 'alert ok' : 'alert'}>
            {STATUS_TEXT[result?.status ?? 'pending']}
          </p>

          {(result === undefined || result.status === 'pending') && (
            <>
              {/*
                El SVG lo genera `qrcode` en NUESTRO servidor a partir del
                enlace que devolvió te-api; no es HTML de terceros.
              */}
              <div className="qr" dangerouslySetInnerHTML={{ __html: started.qrSvg }} />
              <p style={{ marginTop: 16 }}>
                <span className="mono">{started.authorizationRequestUrl}</span>
              </p>
              <p className="muted">
                Caduca el {new Date(started.expiresAt).toLocaleString('es-ES')}.
              </p>
            </>
          )}

          {result?.status === 'verified' && result.claims !== null && (
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
