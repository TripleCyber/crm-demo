import Link from 'next/link';
import { notFound } from 'next/navigation';

import { IssueCredentialPanel } from '@/components/IssueCredentialPanel';
import { RequestCredentialPanel } from '@/components/RequestCredentialPanel';
import { buildCredentialClaims, findCustomer } from '@/lib/customers';
import { getEmployeeSession } from '@/lib/session';
import { describeTeApiError, fetchB2bOrganization, TeApiError } from '@/lib/te-api';

/**
 * La ficha del cliente, con el botón de emitir.
 *
 * Los tipos de credencial del desplegable **salen de te-api**
 * (`GET /v1/b2b/organization`), no de una lista escrita aquí. Es lo que hace que
 * el desplegable no pueda ofrecer un tipo que el padrón de la organización no
 * tiene: la lista y la comprobación vienen de la misma fuente.
 *
 * Si te-api no contesta, la ficha se enseña igual con el aviso: poder consultar
 * un cliente no tiene por qué depender de que la emisión esté operativa.
 */

export const dynamic = 'force-dynamic';

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ externalId: string }>;
}) {
  const { externalId } = await params;
  const session = await getEmployeeSession();
  const customer = await findCustomer(session.organization.orgId, decodeURIComponent(externalId));

  if (customer === null) notFound();

  let credentialTypes: ReadonlyArray<{ type: string; maxValidityDays: number }> = [];
  let issuerDid: string | undefined;
  let teApiWarning: string | undefined;

  try {
    const organization = await fetchB2bOrganization(session.organization);
    credentialTypes = organization.credentialTypes;
    issuerDid = organization.did;
  } catch (error) {
    teApiWarning =
      error instanceof TeApiError
        ? describeTeApiError(error)
        : error instanceof Error
          ? error.message
          : 'te-api no responde';
  }

  const claims = buildCredentialClaims(customer);

  return (
    <>
      <h1>
        {customer.givenName} {customer.familyName}
      </h1>
      <p className="muted">
        <Link href="/customers">← Clientes</Link>
      </p>

      <div className="card">
        <h2>Ficha</h2>
        <dl className="facts">
          <dt>Identificador</dt>
          <dd className="mono">{customer.externalId}</dd>
          <dt>Correo</dt>
          <dd>{customer.email ?? '—'}</dd>
          <dt>Teléfono</dt>
          <dd>{customer.phone ?? '—'}</dd>
          <dt>Cuenta</dt>
          <dd>{customer.accountLast4 === null ? '—' : `···· ${customer.accountLast4}`}</dd>
          <dt>Cliente desde</dt>
          <dd>{customer.customerSince ?? '—'}</dd>
        </dl>
      </div>

      <div className="card">
        <h2>Lo que iría en la credencial</h2>
        <p className="muted">
          Se construye desde esta ficha, en el servidor. El correo y el teléfono no entran: los
          claims divulgables de esta credencial son los cuatro de <code>CONTRATOS.md</code> §1.2, y
          un dato metido «ya que estamos» acaba en todas las presentaciones que se hagan con ella.
        </p>
        <dl className="facts">
          <dt>sub</dt>
          <dd className="mono">{customer.externalId}</dd>
          {issuerDid !== undefined && (
            <>
              <dt>iss</dt>
              <dd className="mono">{issuerDid}</dd>
            </>
          )}
          {Object.entries(claims).map(([name, value]) => (
            <div key={name} style={{ display: 'contents' }}>
              <dt>{name}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {teApiWarning !== undefined && (
        <p className="alert">No se ha podido consultar te-api: {teApiWarning}</p>
      )}

      <IssueCredentialPanel externalId={customer.externalId} credentialTypes={credentialTypes} />

      {/*
        La vuelta del ciclo. Los atributos que se pueden pedir son los que ESTA
        credencial lleva, y salen de la misma función que los construye al
        emitir: pedir uno que el banco no emite sería una petición que ninguna
        cartera puede satisfacer.
      */}
      <RequestCredentialPanel
        externalId={customer.externalId}
        credentialTypes={credentialTypes}
        issuableClaims={Object.keys(claims)}
      />
    </>
  );
}
