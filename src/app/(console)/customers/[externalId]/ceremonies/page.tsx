import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CeremonyCatalogue } from '@/components/CeremonyCatalogue';
import { getTranslator } from '@/i18n/server';
import { CEREMONY_CASES, CEREMONY_INDUSTRIES } from '@/lib/ceremony-catalogue';
import { loadCustomerContext } from '@/lib/customer-context';

import { sendCeremonyAction } from './actions';

/**
 * **El catálogo de verificaciones**, colgado de la ficha del cliente.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  PANTALLA NUEVA AL LADO, NO UN CAMBIO EN LAS QUE HAY
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La comprobación de identidad, la transferencia, la puerta de edad y la
 * emisión **se quedan exactamente como están**. Esto es una dirección más bajo
 * la ficha, con su propia acción de servidor, y no toca ninguna de ellas: es la
 * misma regla que separó en su día la transferencia de la verificación —«un `if`
 * sobre el nivel en cada campo, y el primero que se olvidara mandaría una
 * transferencia por la tubería de una verificación»—, aplicada a diez plantillas
 * en vez de a dos.
 *
 * Y no hay ruta de API nueva. Lo que el navegador manda es **un identificador de
 * caso**, no valores, así que no hay nada que recibir y medir: la acción de
 * servidor de al lado compone la petición con los valores del catálogo y llama a
 * `POST /v1/requests`, que es la ruta genérica del marco y sirve cualquier
 * plantilla.
 */

export const dynamic = 'force-dynamic';

export default async function CeremoniesPage({
  params,
}: {
  params: Promise<{ externalId: string }>;
}) {
  const t = await getTranslator();
  const { externalId } = await params;
  const { session, customer, teApiWarning, walletLinked } = await loadCustomerContext(externalId);

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
            El rótulo del **sitio**, no el de la acción: la ficha de la derecha
            dice qué se va a pedir y a quién. La misma disciplina que en la
            puerta de edad.
          */}
          <h1>{t('ceremonies.pageTitle')}</h1>
          <p className="page-sub">
            {t('ceremonies.pageSub', {
              cases: CEREMONY_CASES.length,
              industries: CEREMONY_INDUSTRIES.length,
              holder: holderName,
            })}
          </p>
        </div>
      </header>

      {teApiWarning !== undefined && (
        <p className="alert">{t('verify.teApiWarning', { reason: teApiWarning })}</p>
      )}

      <CeremonyCatalogue
        externalId={customer.externalId}
        organizationName={session.organization.displayName}
        walletLinked={walletLinked}
        send={sendCeremonyAction}
      />
    </>
  );
}
