'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { DELIVERY_OPTIONS, type DeliveryChannel } from '@/lib/delivery';

/**
 * La pantalla de emisión — **C0** del artifact «Llamada Verificada».
 *
 * Habla **sólo con `/api/credentials/issue` de este mismo servidor**. Nunca con
 * te-api y nunca con walt.id: para llamar a te-api hace falta el token M2M de
 * la organización, y ese token —y el secreto con el que se pide— no bajan al
 * navegador. Ver la nota larga en la ruta.
 *
 * De lo que se manda, lo único que identifica al titular es el `externalId`.
 * Los datos que van dentro de la credencial los lee el servidor de la ficha.
 *
 * ## Por qué esto es una pantalla y no un bloque de la ficha
 *
 * Porque emitir es **firmar en nombre del banco** un documento que dura años, y
 * eso no se hace de paso mientras se mira otra cosa. Al tener su propia
 * dirección, la pantalla puede dedicar la mitad derecha a *qué se va a firmar*
 * —el titular, el emisor y los atributos, en grande— y la izquierda a *cómo
 * llega*. En un bloque de la ficha las dos mitades competían con los datos del
 * cliente por el mismo hueco, y lo que se leía era el desplegable.
 *
 * ## Las tres cosas que hay que enseñar antes de emitir
 *
 * 1. **Quién es el titular.** Un agente que emite mirando un desplegable y no
 *    un nombre acaba emitiendo la credencial del cliente de al lado.
 * 2. **Los números oficiales que llevará dentro.** Quien firma tiene que ver
 *    lo que firma, y esto es lo que después permite que la cartera diga «te
 *    llama desde uno de los números que guarda tu credencial».
 * 3. **Que el código de un solo uso va por OTRO canal.** Es la frase que hace
 *    que el `tx_code` sirva de algo.
 *
 * ## Los cuatro canales son entrega, no autoridad
 *
 * Correo, enlace, QR y «desde nuestra app» entregan **la misma oferta**: la
 * misma URI, la misma firma y el mismo `tx_code`. Elegir canal no cambia lo que
 * la cartera va a comprobar. Por eso el selector está donde está —junto al
 * botón de enviar, no junto al tipo de credencial— y por eso el enlace se
 * enseña siempre: es la misma URI en los cuatro, y el agente tiene que poder
 * leerla.
 */

/** Un atributo del tipo, con el valor que esta ficha le pondría. */
interface ClaimPreview {
  readonly name: string;
  readonly label: string;
  /** Lo que saldría de la ficha, o `null` si esta ficha no lo rellena. */
  readonly value: string | null;
}

interface CredentialTypeOption {
  /** El `type_key` del padrón de te-api. Es lo que se le manda al servidor. */
  readonly type: string;
  /**
   * El rótulo de configuración. Cuando no hay ninguno declarado **es el propio
   * `type_key`**, y entonces no se enseña dos veces.
   */
  readonly label: string;
  readonly maxValidityDays: number;
  readonly claims: readonly ClaimPreview[];
}

interface MailDraft {
  readonly to: string;
  readonly subject: string;
  readonly body: string;
  readonly href: string;
}

interface IssueResult {
  readonly offerId: string;
  readonly offerUri: string;
  readonly expiresAt: string;
  readonly pin: string | null;
  readonly delivery: DeliveryChannel;
  readonly officialNumbers: readonly string[];
  /** Sólo en el canal QR. */
  readonly qrSvg?: string;
  /** Sólo en el canal correo. */
  readonly mail?: MailDraft;
  /** Sólo en el canal «desde nuestra app». */
  readonly portalUrl?: string;
}

export function IssueCredentialForm({
  externalId,
  holder,
  issuerDid,
  officialNumbers,
  credentialTypes,
}: {
  externalId: string;
  /**
   * El titular, tal y como hay que leerlo antes de emitir. Baja al navegador
   * porque es el dato sobre el que se decide: no es una repetición de la
   * cabecera, es la comprobación que hace el agente antes de pulsar.
   */
  holder: { readonly displayName: string; readonly accountLast4: string | null };
  /** El `iss` de la credencial. Sale del padrón de te-api, no de aquí. */
  issuerDid: string | undefined;
  /**
   * Los teléfonos que la organización declara y que **van dentro** de la
   * credencial (`official_numbers`). Vacío = no hay ninguno declarado, y
   * entonces la pantalla lo dice en vez de callarse.
   */
  officialNumbers: readonly string[];
  credentialTypes: readonly CredentialTypeOption[];
}) {
  const [type, setType] = useState(credentialTypes[0]?.type ?? '');
  const [validityDays, setValidityDays] = useState('');
  const [withPin, setWithPin] = useState(true);
  const [delivery, setDelivery] = useState<DeliveryChannel>('qr');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [result, setResult] = useState<IssueResult | undefined>();
  const [copied, setCopied] = useState(false);

  const selectedType = useMemo(
    () => credentialTypes.find((option) => option.type === type),
    [credentialTypes, type],
  );

  /**
   * Lo que hay que leer en cuanto la oferta existe: el QR, el enlace y el
   * código de un solo uso.
   *
   * Sale **debajo** del formulario, así que sin esto el agente pulsa «enviar»,
   * no ve cambiar nada y vuelve a pulsar — con el cliente al teléfono
   * esperando. Se lleva la vista al resultado, que es lo que hay que decir en
   * voz alta a continuación.
   */
  const resultRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (result === undefined) return;
    resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [result]);

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
          delivery,
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
        <h2>No hay ningún tipo que emitir</h2>
        <p className="alert">
          Esta organización no declara ningún tipo de credencial. Compruébalo en{' '}
          <a href="/diagnostics">Diagnóstico</a>: el catálogo lo declara TripleEnable, no esta
          consola.
        </p>
      </div>
    );
  }

  return (
    <div className="split wide-side">
      <div className="col-main">
        <div className="card">
          <h2>La oferta</h2>

          <div className="row">
            <label className="field">
              <span>Tipo de credencial</span>
              {/*
                El rótulo, y sólo el rótulo. Cuando la organización no declara
                ninguno, `label` **es** el `type_key` y se lee igual; lo que ya
                no se hace es enseñar los dos —«Cliente del banco · cliente»—,
                que en un desplegable obliga a leer dos veces para elegir una.
                El `type_key` está en el detalle técnico del panel de al lado.
              */}
              <select value={type} onChange={(event) => setType(event.target.value)}>
                {credentialTypes.map((option) => (
                  <option key={option.type} value={option.type}>
                    {option.label} (máx. {option.maxValidityDays} días)
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

          <label className="field" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <input
              type="checkbox"
              checked={withPin}
              onChange={(event) => setWithPin(event.target.checked)}
              style={{ width: 'auto', marginTop: 3 }}
            />
            <span style={{ margin: 0, fontWeight: 400 }}>
              Con código de un solo uso — sin él, quien reciba la oferta por el canal que sea se
              lleva la credencial
            </span>
          </label>

          {/*
            Los cuatro canales. Botones de radio de verdad —no cuatro `<button>`—
            porque es una elección entre alternativas excluyentes y así funciona el
            teclado y lo lee un lector de pantalla sin ayuda.
          */}
          <fieldset className="field channels" style={{ border: 0, padding: 0, margin: '4px 0 16px' }}>
            <legend style={{ padding: 0 }}>Cómo se la mandamos</legend>
            {DELIVERY_OPTIONS.map((option) => (
              <label key={option.value} className="channel">
                <input
                  type="radio"
                  name="delivery"
                  value={option.value}
                  checked={delivery === option.value}
                  onChange={() => setDelivery(option.value)}
                />
                <span>
                  {option.label}
                  <small>{option.hint}</small>
                </span>
              </label>
            ))}
            <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
              Los cuatro entregan la misma oferta, con la misma firma. El canal decide cómo llega,
              no si es de fiar: eso lo decide la firma del emisor, y la comprueba la cartera.
            </p>
          </fieldset>

          <button type="button" onClick={issue} disabled={busy || type === ''}>
            {busy ? 'Enviando…' : 'Enviar oferta'}
          </button>

          {error !== undefined && (
            <p className="alert" style={{ marginTop: 16 }}>
              {error}
            </p>
          )}
        </div>

        {result !== undefined && (
          <div className="card" ref={resultRef}>
            <h2>Oferta creada</h2>
            <p className="alert ok">
              Caduca el {new Date(result.expiresAt).toLocaleString('es-ES')}.
            </p>

            {result.delivery === 'qr' && (
              /*
                El SVG lo genera `qrcode` en NUESTRO servidor a partir de la URI
                que devolvió te-api; no es HTML de terceros. Es la única forma de
                insertar un SVG que llega como texto.
              */
              <div className="qr" dangerouslySetInnerHTML={{ __html: result.qrSvg ?? '' }} />
            )}

            {result.delivery === 'email' && result.mail !== undefined && (
              <div className="delivery">
                <h3>Correo a {result.mail.to}</h3>
                <p>
                  Se abre en tu propio programa de correo, ya redactado. Sale a tu nombre y no de un
                  buzón automático — que es lo que pasa de verdad cuando llama un agente.
                </p>
                <p>
                  <a className="button-link" href={result.mail.href}>
                    Abrir el borrador
                  </a>
                </p>
                <pre>{result.mail.body}</pre>
                <p className="muted" style={{ margin: 0 }}>
                  El código de un solo uso <strong>no está</strong> en ese texto, y no es un olvido:
                  si viajara en el mismo correo que el enlace, quien leyera el buzón tendría las dos
                  mitades.
                </p>
              </div>
            )}

            {result.delivery === 'app' && (
              <div className="delivery">
                <h3>Esperándole en el portal</h3>
                <p>
                  La oferta queda guardada para este cliente. La verá al entrar en{' '}
                  <span className="mono">{result.portalUrl}</span> con su cuenta de TripleEnable, y
                  sólo la ve él: es el único de los cuatro canales en el que quien recoge la oferta
                  está autenticado.
                </p>
                <p className="muted" style={{ margin: 0 }}>
                  Dile por teléfono que entre en su área de cliente. Y el código de un solo uso, en
                  voz alta por esta misma llamada.
                </p>
              </div>
            )}

            {/* El enlace, siempre y en texto. Es la misma URI en los cuatro
                canales: hay carteras que se abren desde el enlace y pantallas
                desde las que no se puede fotografiar nada. */}
            <p style={{ marginTop: 16 }}>
              <span className="mono">{result.offerUri}</span>
            </p>
            <button type="button" className="secondary" onClick={copyLink}>
              {copied ? 'Enlace copiado' : 'Copiar enlace'}
            </button>

            {result.officialNumbers.length > 0 && (
              <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
                Ha ido dentro: <span className="mono">{result.officialNumbers.join(' · ')}</span>
              </p>
            )}

            <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
              Oferta <span className="mono">{result.offerId}</span>
            </p>
          </div>
        )}

        {result?.pin != null && (
          <div className="card">
            <h2>Código de un solo uso</h2>
            <p className="pin">{result.pin}</p>
            <p className="muted" style={{ margin: 0 }}>
              Dáselo por teléfono o en la oficina,{' '}
              <strong>nunca por el mismo canal que el enlace</strong>. Si viajan juntos, el código
              no protege de nada.
            </p>
          </div>
        )}
      </div>

      {/*
        La mitad derecha: **lo que se va a firmar**. Sigue al desplegable, así
        que cambiar de tipo cambia lo que se lee aquí — que es justo lo que hay
        que comprobar antes de pulsar.
      */}
      <div className="col-side">
        <div className="panel">
          {/*
            ═══════════════════════════════════════════════════════════════════
             UN RÓTULO POR FILA, NO DOS
            ═══════════════════════════════════════════════════════════════════

            Hasta el 2026-08-29 cada fila apilaba el rótulo humano y la clave
            cruda —TITULAR/SUB, NOMBRE/GIVEN_NAME, ÚLTIMOS CUATRO/ACCOUNT_LAST4—
            y el panel medía el doble para decir dos veces lo mismo, la segunda
            en un idioma que el lector no habla. Las claves no se han perdido:
            están abajo, en el detalle plegado, que es donde las busca quien las
            necesita —el que va a escribir la integración— y donde no estorban a
            quien decide comprarla.
          */}
          <h2>Lo que llevará dentro</h2>

          <dl className="facts">
            <dt>Titular</dt>
            <dd>
              {holder.displayName}
              {holder.accountLast4 === null ? null : ` · ···· ${holder.accountLast4}`}
            </dd>
            <dt>Identificador</dt>
            <dd className="mono">{externalId}</dd>
            {issuerDid !== undefined && (
              <>
                <dt>Emisor</dt>
                <dd className="mono">{issuerDid}</dd>
              </>
            )}
          </dl>

          {selectedType !== undefined && (
            <div className="type-block">
              <h3>{selectedType.label}</h3>
              {selectedType.claims.length === 0 ? (
                <p className="none" style={{ margin: 0, fontSize: 13 }}>
                  Esta ficha no rellena ningún atributo de este tipo.
                </p>
              ) : (
                <dl className="facts">
                  {selectedType.claims.map((claim) => (
                    <div key={claim.name} style={{ display: 'contents' }}>
                      <dt>{claim.label}</dt>
                      <dd>{claim.value ?? <span className="none">—</span>}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )}

          {/*
            Los números oficiales, ANTES de emitir. No es información de cortesía:
            es lo único de la credencial que un estafador no puede fabricar, y el
            agente tiene que poder ver que son los de su banco antes de firmarlos
            dentro de un documento que dura años.
          */}
          <div className="official">
            <h3>Números oficiales</h3>
            {officialNumbers.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                Esta organización no declara ninguno, así que la credencial saldrá sin ellos y el
                titular no podrá contrastar desde qué número le llaman. Se declaran en{' '}
                <span className="mono">CRM_ORG_&lt;SLUG&gt;_OFFICIAL_NUMBERS</span>.
              </p>
            ) : (
              <>
                <ul>
                  {officialNumbers.map((number) => (
                    <li key={number}>{number}</li>
                  ))}
                </ul>
                <p className="muted" style={{ margin: 0 }}>
                  Van firmados dentro de la credencial. El titular los puede consultar sin llamada y
                  sin conexión, y por eso su cartera puede decir «uno de los números que guarda tu
                  credencial» en vez de «te llama tu banco».
                </p>
              </>
            )}
          </div>

          <p className="panel-note">
            El correo y el teléfono del cliente <strong>no entran</strong> en ninguna credencial: no
            están en el catálogo de atributos divulgables, y un dato metido «ya que estamos» acaba
            en todas las presentaciones que se hagan con ella.
          </p>

          {/*
            Lo que se ha quitado de arriba, entero y en un solo sitio. Es
            además el mejor sitio para ello: quien va a integrar necesita la
            correspondencia rótulo → nombre de claim de un vistazo, y aquí la
            tiene en una tabla en vez de repartida por seis filas.
          */}
          <details className="tech">
            <summary>Ver el detalle técnico</summary>
            <dl className="facts">
              <dt>Formato</dt>
              <dd className="mono">SD-JWT VC</dd>
              <dt>sub</dt>
              <dd className="mono">{externalId}</dd>
              {issuerDid !== undefined && (
                <>
                  <dt>iss</dt>
                  <dd className="mono">{issuerDid}</dd>
                </>
              )}
              {selectedType !== undefined && (
                <>
                  <dt>type_key</dt>
                  <dd className="mono">{selectedType.type}</dd>
                  {selectedType.claims.map((claim) => (
                    <div key={claim.name} style={{ display: 'contents' }}>
                      <dt className="mono">{claim.name}</dt>
                      <dd>{claim.label}</dd>
                    </div>
                  ))}
                </>
              )}
              {officialNumbers.length > 0 && (
                <>
                  <dt className="mono">official_numbers</dt>
                  <dd className="mono">{officialNumbers.join(' · ')}</dd>
                </>
              )}
            </dl>
          </details>
        </div>
      </div>
    </div>
  );
}
