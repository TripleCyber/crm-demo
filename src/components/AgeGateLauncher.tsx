'use client';

import Link from 'next/link';
import { useState } from 'react';

import { useTranslator } from '@/i18n/client';

/**
 * **Pedirle al titular que demuestre que es mayor de edad.** Fase 6 del marco.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  LA PANTALLA MÁS CORTA DE LA CONSOLA, Y ESO ES EL DISEÑO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `VerificationLauncher` tiene una lista de atributos para marcar.
 * `TransferLauncher` tiene un importe y un destino. **Ésta no tiene nada que
 * decidir**: se pregunta una cosa y se recibe una.
 *
 * No hay lista de atributos, y no es una omisión. Ofrecer marcar más
 * convertiría una puerta de edad en una divulgación de datos con otro nombre, y
 * el primero que lo usara no se daría cuenta. Lo único que el agente escribe es
 * el motivo, y es opcional.
 *
 * ## Lo que la pantalla dice de la persona, y por qué
 *
 * La frase de arriba —«su fecha de nacimiento se queda en su teléfono: sólo
 * viaja el sí o el no»— **es cierta y está comprobada** en el servidor, en las
 * dos puntas: el filtro de `toPresentationResult` y el cuerpo del webhook, los
 * dos con su prueba y con la fecha **presente en la credencial** para que el
 * caso valga. No es una promesa de folleto: es lo que el agente puede decirle a
 * quien le pregunte por teléfono si esto es seguro.
 */
export function AgeGateLauncher({
  externalId,
  holderName,
  credentialTypes,
  walletLinked,
}: {
  externalId: string;
  holderName: string;
  /** Los tipos declarados por la organización. Ver `typeHelp`. */
  credentialTypes: readonly { readonly type: string; readonly label: string }[];
  /** `undefined` = no se pudo preguntar al directorio, y no es `false`. */
  walletLinked: boolean | undefined;
}) {
  const t = useTranslator();
  const [credentialType, setCredentialType] = useState(credentialTypes[0]?.type ?? '');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asked, setAsked] = useState<{
    presentationId: string;
    delivered: boolean;
  } | null>(null);

  const ask = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/age/check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          externalId,
          credentialType,
          ...(reason.trim() === '' ? {} : { reason: reason.trim() }),
        }),
      });
      const payload = (await response.json()) as {
        presentationId?: string;
        delivered?: boolean;
        error?: string;
      };
      if (!response.ok || payload.presentationId === undefined) {
        setError(payload.error ?? t('errors.generic'));
        return;
      }
      setAsked({
        presentationId: payload.presentationId,
        delivered: payload.delivered === true,
      });
    } catch {
      setError(t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  if (asked !== null) {
    return (
      <div className="card">
        <h2>{t('age.askedTitle')}</h2>
        <p>{asked.delivered ? t('age.askedDelivered') : t('age.askedNotDelivered')}</p>
        {/*
          El identificador de la **sesión del verificador**, que es el que el
          webhook va a nombrar. El de la petición del marco es del titular y de
          su historial; seguir la ceremonia desde aquí se hace con éste.
        */}
        <p className="page-facts">
          <Link href={`/verifications/${encodeURIComponent(asked.presentationId)}`}>
            {t('age.follow')}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>{t('age.title', { holder: holderName })}</h2>
      <p>{t('age.body')}</p>

      {walletLinked === false && <p className="alert">{t('age.noWallet')}</p>}

      <label className="field">
        <span>{t('age.typeLabel')}</span>
        <select value={credentialType} onChange={(event) => setCredentialType(event.target.value)}>
          {credentialTypes.map((option) => (
            <option key={option.type} value={option.type}>
              {option.label}
            </option>
          ))}
        </select>
        <small>{t('age.typeHelp')}</small>
      </label>

      <label className="field">
        <span>{t('age.reasonLabel')}</span>
        <input
          type="text"
          value={reason}
          placeholder={t('age.reasonPlaceholder')}
          onChange={(event) => setReason(event.target.value)}
        />
        <small>{t('age.reasonHelp')}</small>
      </label>

      {error !== null && <p className="alert">{error}</p>}

      <button type="button" disabled={credentialType === '' || busy} onClick={() => void ask()}>
        {busy ? t('age.asking') : t('age.ask')}
      </button>
    </div>
  );
}
