import Link from 'next/link';
import { notFound } from 'next/navigation';

import { IssueCredentialPanel } from '@/components/IssueCredentialPanel';
import { RequestCredentialPanel } from '@/components/RequestCredentialPanel';
import { resolveCredentialTypes, type CredentialTypeView } from '@/lib/credential-profiles';
import { findCustomer, findCustomerAttribute } from '@/lib/customers';
import { getEmployeeSession } from '@/lib/session';
import { describeTeApiError, fetchB2bOrganizationCached, TeApiError } from '@/lib/te-api';

/**
 * La ficha del cliente, con los dos medios ciclos: emitir y comprobar.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  NADA DE ESTA PANTALLA SABE QUE EL BANCO SE LLAMA BANCO DEMO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Los tipos de credencial **salen de te-api** (`GET /v1/b2b/organization`), no
 * de una lista escrita aquí: el desplegable no puede ofrecer un tipo que el
 * padrón de la organización no tiene, porque la lista y la comprobación vienen
 * de la misma fuente.
 *
 * Los **atributos** de cada tipo y los **rótulos** salen de
 * `credential-profiles.ts`, que los lee de configuración — te-api no los
 * expone. Un segundo partner con otro tipo se declara con tres variables de
 * entorno y esta pantalla no cambia.
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

  let credentialTypes: readonly CredentialTypeView[] = [];
  let issuerDid: string | undefined;
  let teApiWarning: string | undefined;

  try {
    const organization = await fetchB2bOrganizationCached(session.organization);
    // El cruce de las tres fuentes: el padrón dice qué tipos hay, la
    // configuración qué lleva cada uno, y la ficha cuáles puede rellenar.
    credentialTypes = resolveCredentialTypes(organization.credentialTypes, customer);
    issuerDid = organization.did;
  } catch (error) {
    teApiWarning =
      error instanceof TeApiError
        ? describeTeApiError(error)
        : error instanceof Error
          ? error.message
          : 'te-api no responde';
  }

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

      {/*
        Un bloque por tipo declarado, y no una lista fija de cuatro claims.
        `sub` e `iss` van una sola vez arriba porque no dependen del tipo: el
        primero es el id de esta ficha y el segundo el DID de la organización.
      */}
      <div className="card">
        <h2>Lo que iría en la credencial</h2>
        <p className="muted">
          Se construye desde esta ficha, en el servidor. El correo y el teléfono no entran en
          ninguna: no están en el catálogo de atributos divulgables del padrón, y un dato metido
          «ya que estamos» acaba en todas las presentaciones que se hagan con esa credencial.
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
        </dl>

        {credentialTypes.map((option) => (
          <div key={option.type} className="type-block">
            {/*
              El `type_key` sólo se repite detrás del rótulo cuando son cosas
              distintas. Sin rótulo declarado, `label` ES el `type_key`, y
              «cliente cliente» es ruido.
            */}
            <h3>
              {option.label}
              {option.label === option.type ? null : (
                <span className="mono">{option.type}</span>
              )}
            </h3>
            {option.claims.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                Esta ficha no rellena ningún atributo de este tipo.
              </p>
            ) : (
              <dl className="facts">
                {option.claims.map((claim) => (
                  <div key={claim.name} style={{ display: 'contents' }}>
                    <dt>
                      {claim.label} <span className="mono">{claim.name}</span>
                    </dt>
                    <dd>{findCustomerAttribute(claim.name)?.read(customer) ?? '—'}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        ))}
      </div>

      {teApiWarning !== undefined && (
        <p className="alert">No se ha podido consultar te-api: {teApiWarning}</p>
      )}

      <IssueCredentialPanel externalId={customer.externalId} credentialTypes={credentialTypes} />

      {/*
        La vuelta del ciclo. Los atributos que se pueden pedir son los de cada
        tipo cruzados con lo que esta ficha rellena, y salen de la misma
        resolución que los construye al emitir: pedir uno que el banco no emite
        sería una petición que ninguna cartera puede satisfacer.

        `agent` baja al navegador a propósito y no es un descuido: no es un
        secreto, es lo que el titular va a ver en su móvil, y el agente tiene que
        poder leerlo en pantalla para decirlo en voz alta.
      */}
      <RequestCredentialPanel
        externalId={customer.externalId}
        credentialTypes={credentialTypes}
        agent={session.agent}
      />
    </>
  );
}
