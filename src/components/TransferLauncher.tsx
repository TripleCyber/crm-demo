'use client';

import { useState } from 'react';

import { useTranslator } from '@/i18n/client';

/**
 * **Pedirle al titular que autorice una transferencia.** Fase 5 del marco.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ESTA PANTALLA NO PREGUNTA QUIÉN ES: PREGUNTA SI MANDA EL DINERO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Es la hermana de `VerificationLauncher` y **no comparte código con ella a
 * propósito**. Aquélla elige qué atributos se piden y por qué canal se avisa;
 * ésta escribe un importe y un destino. Compartir el formulario habría obligado
 * a un `if` sobre el nivel en cada campo, y el primero que se olvidara habría
 * mandado una transferencia por la tubería de una verificación.
 *
 * ## Los dos campos son el consentimiento, no un formulario
 *
 * Lo que se escribe aquí **entra en el texto que el titular firma** —te-api lo
 * compone con la plantilla `exchange.transfer.v1`— y el importe se pinta de
 * héroe en su teléfono. De ahí las dos decisiones de esta pantalla:
 *
 *  - **No hay valores por defecto.** Un importe pre-rellenado es un importe que
 *    alguien puede mandar sin haberlo leído.
 *  - **Se enseña abajo, tal cual, lo que va a ver el titular.** Es lo mismo que
 *    hace la pantalla de la llamada con el asunto, y por el mismo motivo: el
 *    agente tiene que poder decir en voz alta lo que la otra persona está
 *    leyendo. Si no coinciden, algo va mal y los dos lo notan.
 *
 * ## No hay QR
 *
 * Una transferencia se autoriza en el teléfono de quien paga, y ese teléfono ya
 * está en su bolsillo. Pintar un QR aquí sería ofrecerle al agente que le dicte
 * un código a alguien para que autorice un movimiento de dinero, que es la forma
 * exacta de la estafa que este producto existe para hacer imposible.
 */
export function TransferLauncher({
  externalId,
  holderName,
  walletLinked,
}: {
  externalId: string;
  holderName: string;
  /**
   * Si el titular tiene cartera vinculada con esta organización.
   *
   * Sale del directorio (`GET /v1/b2b/links`) y **no del intento**: pedir para
   * enterarse de que no hay a quién pedirle gasta el presupuesto de avisos de
   * una persona para responder una pregunta que ya se podía hacer.
   *
   * `undefined` es «no se pudo preguntar al directorio», y **no se trata como
   * `false`**: avisar de que no hay cartera cuando lo que pasó es que te-api no
   * contestó sería afirmar algo del cliente a partir de un fallo nuestro.
   */
  walletLinked: boolean | undefined;
}) {
  const t = useTranslator();
  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asked, setAsked] = useState<{ requestId: string; delivered: boolean } | null>(null);

  const ready = amount.trim() !== '' && destination.trim() !== '';

  const ask = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/transfers/approve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ externalId, amount: amount.trim(), destination: destination.trim() }),
      });
      const payload = (await response.json()) as {
        requestId?: string;
        delivered?: boolean;
        error?: string;
      };
      if (!response.ok || payload.requestId === undefined) {
        setError(payload.error ?? t('errors.generic'));
        return;
      }
      setAsked({ requestId: payload.requestId, delivered: payload.delivered === true });
    } catch {
      setError(t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  if (asked !== null) {
    return (
      <div className="card">
        <h2>{t('transfer.askedTitle')}</h2>
        {/*
          `delivered: false` **no es un error y no se pinta como tal**: es que
          esa persona no tiene ningún aparato al que avisar, o que su presupuesto
          de avisos está agotado. La petición existe y sigue viva; lo que no hay
          es un teléfono que suene. Decírselo al agente es lo que le deja llamar
          por otra vía en vez de esperar mirando una pantalla.
        */}
        <p>{asked.delivered ? t('transfer.askedDelivered') : t('transfer.askedNotDelivered')}</p>
        <p className="page-facts">
          <span className="mono">{asked.requestId}</span>
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>{t('transfer.title', { holder: holderName })}</h2>

      {walletLinked === false && <p className="alert">{t('transfer.noWallet')}</p>}

      <label className="field">
        <span>{t('transfer.amountLabel')}</span>
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          placeholder={t('transfer.amountPlaceholder')}
          onChange={(event) => setAmount(event.target.value)}
        />
        <small>{t('transfer.amountHelp')}</small>
      </label>

      <label className="field">
        <span>{t('transfer.destinationLabel')}</span>
        <input
          type="text"
          value={destination}
          placeholder={t('transfer.destinationPlaceholder')}
          onChange={(event) => setDestination(event.target.value)}
        />
        <small>{t('transfer.destinationHelp')}</small>
      </label>

      {/*
        Lo que va a leer el titular, tal cual. Ver la cabecera: el agente tiene
        que poder decirlo en voz alta.
      */}
      {ready && (
        <div className="card inner">
          <h3>{t('transfer.previewTitle')}</h3>
          <p className="page-facts">
            <span>
              {t('transfer.previewAmount')} <span className="mono">{amount.trim()}</span>
            </span>
            <span>
              {t('transfer.previewDestination')} <span className="mono">{destination.trim()}</span>
            </span>
          </p>
        </div>
      )}

      {error !== null && <p className="alert">{error}</p>}

      <button type="button" disabled={!ready || busy} onClick={() => void ask()}>
        {busy ? t('transfer.asking') : t('transfer.ask')}
      </button>
    </div>
  );
}
