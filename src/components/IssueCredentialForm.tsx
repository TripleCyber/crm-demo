'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { useTranslator } from '@/i18n/client';
import { DELIVERY_OPTIONS, type DeliveryChannel } from '@/lib/delivery';
import { formatDateTime } from '@/lib/format';

import { WalletLink } from './WalletLink';

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
  holder: {
    readonly displayName: string;
    /**
     * La referencia de su sector, **ya escrita**: `···· 4471` en el banco,
     * `SP-16000412201` en la comercializadora de energía.
     *
     * Llega compuesta desde el servidor y no como un `accountLast4` en crudo,
     * que es lo que había: este componente es de navegador y no puede importar
     * `src/lib` —todo eso es `server-only`—, así que no sabe ni puede saber qué
     * referencia usa esta organización. Que la componga quien sí lo sabe.
     */
    readonly reference: string | null;
  };
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
  const t = useTranslator();

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
        // El error del servidor viene YA TRADUCIDO —la ruta resuelve el idioma
        // con la misma cookie— así que se enseña tal cual. El respaldo de aquí
        // es para una respuesta sin cuerpo, que es la única que no lo trae.
        setError(payload.error ?? t('credential.failed', { status: response.status }));
        return;
      }
      setResult(payload as IssueResult);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('credential.noServer'));
    } finally {
      setBusy(false);
    }
  };

  if (credentialTypes.length === 0) {
    return (
      <div className="card">
        <h2>{t('credential.noTypesTitle')}</h2>
        <p className="alert">{t.rich('credential.noTypesBody', { href: '/diagnostics' })}</p>
      </div>
    );
  }

  return (
    <div className="split wide-side">
      <div className="col-main">
        <div className="card">
          <h2>{t('credential.offerTitle')}</h2>

          <div className="row">
            <label className="field">
              <span>{t('credential.type')}</span>
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
                    {t('credential.typeOption', {
                      label: option.label,
                      days: option.maxValidityDays,
                    })}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t('credential.validity')}</span>
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
            <span style={{ margin: 0, fontWeight: 400 }}>{t('credential.withPin')}</span>
          </label>

          {/*
            Los cuatro canales. Botones de radio de verdad —no cuatro `<button>`—
            porque es una elección entre alternativas excluyentes y así funciona el
            teclado y lo lee un lector de pantalla sin ayuda.
          */}
          <fieldset className="field channels" style={{ border: 0, padding: 0, margin: '4px 0 16px' }}>
            <legend style={{ padding: 0 }}>{t('credential.channelsLegend')}</legend>
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
                  {t(option.labelKey)}
                  <small>{t(option.hintKey)}</small>
                </span>
              </label>
            ))}
            <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
              {t('credential.channelsNote')}
            </p>
          </fieldset>

          <button type="button" onClick={issue} disabled={busy || type === ''}>
            {t(busy ? 'credential.sending' : 'credential.send')}
          </button>

          {error !== undefined && (
            <p className="alert" style={{ marginTop: 16 }}>
              {error}
            </p>
          )}
        </div>

        {result !== undefined && (
          <div className="card" ref={resultRef}>
            <h2>{t('credential.offerCreated')}</h2>
            <p className="alert ok">
              {t('credential.offerExpires', { date: formatDateTime(result.expiresAt, t.locale) })}
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
                <h3>{t('credential.mailTo', { address: result.mail.to })}</h3>
                <p>{t('credential.mailIntro')}</p>
                <p>
                  <a className="button-link" href={result.mail.href}>
                    {t('credential.mailOpenDraft')}
                  </a>
                </p>
                <pre>{result.mail.body}</pre>
                <p className="muted" style={{ margin: 0 }}>
                  {t.rich('credential.mailNote')}
                </p>
              </div>
            )}

            {/* El enlace, siempre. Es la misma URI en los tres canales: hay
                carteras que se abren desde el enlace y pantallas desde las que
                no se puede fotografiar nada. Y ahora se puede TOCAR, que es lo
                que hace falta cuando la consola se abre desde el móvil. */}
            <WalletLink uri={result.offerUri} label={t('credential.walletLinkLabel')} />

            {result.officialNumbers.length > 0 && (
              <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
                {t('credential.officialNumbersSent', {
                  numbers: result.officialNumbers.join(' · '),
                })}
              </p>
            )}

            <p className="muted mono" style={{ marginTop: 12, marginBottom: 0 }}>
              {t('credential.offerId', { id: result.offerId })}
            </p>
          </div>
        )}

        {result?.pin != null && (
          <div className="card">
            <h2>{t('credential.pinTitle')}</h2>
            <p className="pin">{result.pin}</p>
            <p className="muted" style={{ margin: 0 }}>
              {t.rich('credential.pinNote')}
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
          <h2>{t('credential.payloadTitle')}</h2>

          <dl className="facts">
            <dt>{t('credential.holder')}</dt>
            <dd>
              {holder.displayName}
              {holder.reference === null ? null : ` · ${holder.reference}`}
            </dd>
            <dt>{t('credential.identifier')}</dt>
            <dd className="mono">{externalId}</dd>
            {issuerDid !== undefined && (
              <>
                <dt>{t('credential.issuer')}</dt>
                <dd className="mono">{issuerDid}</dd>
              </>
            )}
          </dl>

          {selectedType !== undefined && (
            <div className="type-block">
              <h3>{selectedType.label}</h3>
              {selectedType.claims.length === 0 ? (
                <p className="none" style={{ margin: 0, fontSize: 13 }}>
                  {t('credential.noClaims')}
                </p>
              ) : (
                <dl className="facts">
                  {selectedType.claims.map((claim) => (
                    <div key={claim.name} style={{ display: 'contents' }}>
                      <dt>{claim.label}</dt>
                      <dd>{claim.value ?? <span className="none">{t('common.dash')}</span>}</dd>
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
            <h3>{t('credential.officialNumbers')}</h3>
            {officialNumbers.length === 0 ? (
              /*
                ═══════════════════════════════════════════════════════════════
                 AQUÍ PONÍA EL NOMBRE DE UNA VARIABLE DE ENTORNO, Y ESTABA MAL
                ═══════════════════════════════════════════════════════════════

                Decía «Se declaran en una variable de entorno». Quien lee
                esto es un agente de atención al cliente con un teléfono en la
                mano: ese nombre no le dice qué hacer, le dice que la
                herramienta que está usando está a medio montar. Y además no lo
                puede arreglar él.

                Lo que sí necesita saber es lo que ahora pone: qué le falta a la
                credencial que va a firmar, qué consecuencia tiene para el
                titular, y a quién pedírselo. El nombre exacto de la variable
                está en Diagnóstico, que es la pantalla de quien sí puede
                ponerla — y por eso el enlace va ahí y no a una explicación.
              */
              <p className="muted" style={{ margin: 0 }}>
                {t.rich('credential.officialNumbersMissing', { href: '/diagnostics' })}
              </p>
            ) : (
              <>
                <ul>
                  {officialNumbers.map((number) => (
                    <li key={number}>{number}</li>
                  ))}
                </ul>
                <p className="muted" style={{ margin: 0 }}>
                  {t('credential.officialNumbersNote')}
                </p>
              </>
            )}
          </div>

          <p className="panel-note">{t.rich('credential.contactNote')}</p>

          {/*
            Lo que se ha quitado de arriba, entero y en un solo sitio. Es
            además el mejor sitio para ello: quien va a integrar necesita la
            correspondencia rótulo → nombre de claim de un vistazo, y aquí la
            tiene en una tabla en vez de repartida por seis filas.
          */}
          <details className="tech">
            <summary>{t('common.technicalDetail')}</summary>
            <dl className="facts">
              <dt>{t('credential.format')}</dt>
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
