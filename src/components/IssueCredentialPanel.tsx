'use client';

import { useState } from 'react';

/**
 * El panel de emisión de la ficha.
 *
 * Habla **sólo con `/api/credentials/issue` de este mismo servidor**. Nunca con
 * te-api y nunca con walt.id: para llamar a te-api hace falta el token M2M de
 * la organización, y ese token —y el secreto con el que se pide— no bajan al
 * navegador. Ver la nota larga en la ruta.
 *
 * De lo que se manda, lo único que identifica al titular es el `externalId`.
 * Los datos que van dentro de la credencial los lee el servidor de la ficha.
 */

interface CredentialTypeOption {
  readonly type: string;
  readonly maxValidityDays: number;
}

interface IssueResult {
  readonly offerId: string;
  readonly offerUri: string;
  readonly expiresAt: string;
  readonly pin: string | null;
  readonly qrSvg: string;
}

export function IssueCredentialPanel({
  externalId,
  credentialTypes,
}: {
  externalId: string;
  credentialTypes: readonly CredentialTypeOption[];
}) {
  const [type, setType] = useState(credentialTypes[0]?.type ?? '');
  const [validityDays, setValidityDays] = useState('');
  const [withPin, setWithPin] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [result, setResult] = useState<IssueResult | undefined>();
  const [copied, setCopied] = useState(false);

  const issue = async () => {
    setBusy(true);
    setError(undefined);
    setResult(undefined);
    setCopied(false);
    try {
      const response = await fetch('/api/credentials/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalId,
          type,
          // Vacío = no se manda: te-api aplica entonces el tope del tipo, que
          // es lo que hay que respetar cuando el agente no pide nada concreto.
          ...(validityDays.trim() === '' ? {} : { validityDays: Number(validityDays) }),
          withPin,
        }),
      });
      const payload = (await response.json()) as Partial<IssueResult> & {
        error?: string;
        requestId?: string;
      };
      if (!response.ok) {
        setError(payload.error ?? `la emisión ha fallado (${response.status})`);
        return;
      }
      setResult(payload as IssueResult);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'no se ha podido contactar con el servidor');
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    if (result === undefined) return;
    try {
      await navigator.clipboard.writeText(result.offerUri);
      setCopied(true);
    } catch {
      // Sin permiso de portapapeles el enlace sigue visible y seleccionable
      // debajo. No merece un error en pantalla.
    }
  };

  if (credentialTypes.length === 0) {
    return (
      <div className="card">
        <h2>Emitir credencial</h2>
        <p className="alert">
          No hay ningún tipo de credencial disponible para esta organización. Compruébalo en{' '}
          <a href="/diagnostics">Diagnóstico</a>: los tipos salen del padrón de te-api, no de aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Emitir credencial</h2>

      <div className="row">
        <label className="field">
          <span>Tipo</span>
          <select value={type} onChange={(event) => setType(event.target.value)}>
            {credentialTypes.map((option) => (
              <option key={option.type} value={option.type}>
                {option.type} (máx. {option.maxValidityDays} días)
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Vigencia en días (vacío = el tope del tipo)</span>
          <input
            inputMode="numeric"
            value={validityDays}
            onChange={(event) => setValidityDays(event.target.value)}
            placeholder="30"
          />
        </label>
      </div>

      <label className="field" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="checkbox"
          checked={withPin}
          onChange={(event) => setWithPin(event.target.checked)}
          style={{ width: 'auto' }}
        />
        <span style={{ margin: 0 }}>
          Con PIN — sin él, quien fotografíe el QR de esta pantalla se lleva la credencial
        </span>
      </label>

      <button type="button" onClick={issue} disabled={busy || type === ''}>
        {busy ? 'Emitiendo…' : 'Emitir credencial'}
      </button>

      {error !== undefined && (
        <p className="alert" style={{ marginTop: 16 }}>
          {error}
        </p>
      )}

      {result !== undefined && (
        <div style={{ marginTop: 20 }}>
          <p className="alert ok">
            Oferta creada. Caduca el {new Date(result.expiresAt).toLocaleString('es-ES')}.
          </p>

          {/*
            El SVG lo genera `qrcode` en NUESTRO servidor a partir de la URI que
            devolvió te-api; no es HTML de terceros. Es la única forma de
            insertar un SVG que llega como texto.
          */}
          <div className="qr" dangerouslySetInnerHTML={{ __html: result.qrSvg }} />

          {/* El enlace, debajo del QR y en texto. Lo pidió el dueño así: hay
              carteras que se abren desde el enlace y pantallas desde las que no
              se puede fotografiar nada. */}
          <p style={{ marginTop: 16 }}>
            <span className="mono">{result.offerUri}</span>
          </p>
          <button type="button" className="secondary" onClick={copyLink}>
            {copied ? 'Enlace copiado' : 'Copiar enlace'}
          </button>

          {result.pin !== null && (
            <div className="card" style={{ marginTop: 20 }}>
              <h2>Código de un solo uso</h2>
              <p className="pin">{result.pin}</p>
              <p className="muted" style={{ margin: 0 }}>
                Se lee en voz alta al titular, aquí y ahora. <strong>No se manda por el mismo canal
                que el enlace</strong>: si viajan juntos, el código no protege de nada.
              </p>
            </div>
          )}

          <p className="muted" style={{ marginTop: 12 }}>
            Oferta <span className="mono">{result.offerId}</span>
          </p>
        </div>
      )}
    </div>
  );
}
