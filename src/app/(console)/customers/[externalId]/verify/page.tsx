import Link from 'next/link';
import { notFound } from 'next/navigation';

import { TransferLauncher } from '@/components/TransferLauncher';
import { VerificationLauncher } from '@/components/VerificationLauncher';
import { getTranslator } from '@/i18n/server';
import { loadCustomerContext } from '@/lib/customer-context';

/**
 * **C1 · verificar identidad.** La pantalla que lanza la ceremonia.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  LANZAR Y SEGUIR SON DOS DIRECCIONES DISTINTAS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Aquí se decide **qué se pide y por dónde se avisa**. En cuanto la sesión está
 * abierta, el navegador se va a `/verifications/<id>`, que es donde vive la
 * espera y el recibo. Están separadas porque tienen dueños distintos: esto es
 * un formulario que se rellena una vez, y aquello es una ceremonia que hay que
 * seguir, que puede durar cinco minutos y que a lo mejor termina de mirar otro
 * compañero.
 *
 * El nivel llega por la dirección (`?level=transaction`) porque los dos enlaces
 * de la ficha son los dos niveles del artifact, y el que se pulsa tiene que ser
 * el que se abre. Cualquier otro valor es el nivel 1: no se acepta un tercer
 * nivel por parámetro.
 */

export const dynamic = 'force-dynamic';

export default async function VerifyCustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ externalId: string }>;
  searchParams: Promise<{ level?: string | string[] }>;
}) {
  const t = await getTranslator();
  const { externalId } = await params;
  const { level: rawLevel } = await searchParams;
  const { session, customer, credentialTypes, teApiWarning, walletLinked } =
    await loadCustomerContext(externalId);

  if (customer === null) notFound();

  const requestedLevel = Array.isArray(rawLevel) ? rawLevel[0] : rawLevel;
  const initialLevel = requestedLevel === 'transaction' ? 'transaction' : 'identity';

  const href = `/customers/${encodeURIComponent(customer.externalId)}`;
  const holderName = `${customer.givenName} ${customer.familyName}`;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">
            <Link href="/customers">{t('nav.customers')}</Link> ·{' '}
            <Link href={href}>{holderName}</Link>
          </p>
          <h1>{t('verify.title')}</h1>
          <p className="page-facts">
            <span className="mono">{customer.externalId}</span>
            {customer.phone !== null && (
              <span>
                {t('verify.phone')} <span className="mono">{customer.phone}</span>
              </span>
            )}
          </p>
        </div>
      </header>

      {teApiWarning !== undefined && (
        <p className="alert">{t('verify.teApiWarning', { reason: teApiWarning })}</p>
      )}

      {/*
        `agent` baja al navegador a propósito y no es un descuido: no es un
        secreto, es lo que el titular va a ver en su móvil, y el agente tiene que
        poder leerlo en pantalla para decirlo en voz alta.
      */}
      {/*
        **Los dos niveles dejan de compartir formulario, y es la fase 5.**
        Hasta ahora el nivel 2 pintaba el mismo lanzador con otro `kind`, que
        sólo cambiaba a qué pantalla enrutaba el aviso: no llevaba importe ni
        destino, así que el titular aprobaba «una operación» sin que nada dijera
        cuál. Una transferencia es otra ceremonia del marco —`kind: authorize`
        con la plantilla `exchange.transfer.v1`— y lo que la persona firma son
        esos dos datos.

        Se elige aquí y no dentro de un lanzador con un `if` por campo: el
        primero que se olvidara mandaría una transferencia por la tubería de una
        verificación.
      */}
      {initialLevel === 'transaction' ? (
        <TransferLauncher
          externalId={customer.externalId}
          holderName={holderName}
          walletLinked={walletLinked}
        />
      ) : (
        <VerificationLauncher
          externalId={customer.externalId}
          holderName={holderName}
          credentialTypes={credentialTypes}
          agent={session.agent}
          initialLevel={initialLevel}
          walletLinked={walletLinked}
        />
      )}
    </>
  );
}
