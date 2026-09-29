import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AgeGateLauncher } from '@/components/AgeGateLauncher';
import { getTranslator } from '@/i18n/server';
import { loadCustomerContext } from '@/lib/customer-context';

/**
 * **La puerta de edad.** Fase 6 del marco de peticiones.
 *
 * Página aparte y no un nivel de `/verify`, por la misma razón por la que la
 * transferencia también es su propia pantalla: lo que se pide aquí no es «estos
 * atributos» sino **una sola pregunta**, y la pantalla del titular es otra
 * —`age.gate.v1`, con el sí de héroe y enfrente lo que no se enseña—.
 *
 * Meterlo como tercer nivel de `?level=` habría obligado a un `if` por campo en
 * el lanzador de verificación, que es exactamente lo que se evitó al separar la
 * transferencia.
 */

export const dynamic = 'force-dynamic';

export default async function AgeCustomerPage({
  params,
}: {
  params: Promise<{ externalId: string }>;
}) {
  const t = await getTranslator();
  const { externalId } = await params;
  const { customer, credentialTypes, teApiWarning, walletLinked } =
    await loadCustomerContext(externalId);

  if (customer === null) notFound();

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
          {/*
            El rótulo del **sitio**, no el de la acción: la tarjeta de abajo
            dice a quién se le pregunta y qué. Los dos decían lo mismo, uno
            debajo del otro.
          */}
          <h1>{t('age.pageTitle')}</h1>
        </div>
      </header>

      {teApiWarning !== undefined && (
        <p className="alert">{t('verify.teApiWarning', { reason: teApiWarning })}</p>
      )}

      <AgeGateLauncher
        externalId={customer.externalId}
        holderName={holderName}
        credentialTypes={credentialTypes}
        walletLinked={walletLinked}
      />
    </>
  );
}
