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
      {/*
        La línea que el artifact pone bajo el nombre en C1. Sale de la fila y no
        se compone con nada que el CRM no sepa: no hay ninguna insignia de
        «credencial activa» ni de «perfil verificado», porque **el CRM no
        conoce ninguno de los dos estados**. te-api no le cuenta si el titular
        aceptó la oferta ni con qué nivel de garantía nació su perfil, y una
        insignia verde que no pregunta a nadie es peor que ninguna: el agente
        la creería.
      */}
      <p className="muted">
        {customer.customerSince === null
          ? null
          : `Cliente desde ${formatCustomerSince(customer.customerSince)}`}
        {customer.customerSince !== null && customer.accountLast4 !== null ? ' · ' : null}
        {customer.accountLast4 === null ? null : `cuenta ···· ${customer.accountLast4}`}
        {customer.customerSince !== null || customer.accountLast4 !== null ? <br /> : null}
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

      {/*
        `officialNumbers` baja al navegador y no es un descuido: son los
        teléfonos públicos del banco, los mismos que están en su web, y el
        agente tiene que verlos antes de firmarlos dentro de una credencial que
        va a durar años. Lo que no baja nunca es el secreto M2M, que vive en
        `organizations.ts` detrás de `import 'server-only'`.
      */}
      <IssueCredentialPanel
        externalId={customer.externalId}
        holder={{
          displayName: `${customer.givenName} ${customer.familyName}`,
          accountLast4: customer.accountLast4,
        }}
        officialNumbers={session.organization.officialNumbers}
        credentialTypes={credentialTypes}
      />

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

/**
 * `2024-03-12` → `12 mar 2024`, **sin restar un día por el camino**.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  `new Date('2024-03-12')` NO ES EL 12 DE MARZO AQUÍ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Una cadena `YYYY-MM-DD` a secas la interpreta JavaScript como medianoche
 * **UTC**, y al pintarla en una zona al oeste de Greenwich sale el día
 * anterior. Se vio en pantalla: la ficha de un cliente de alta el 12 de marzo
 * ponía «11 mar 2024».
 *
 * Es exactamente el mismo fallo que `src/lib/customers.ts` evita formateando
 * `customer_since` en Postgres —ahí está su nota larga— y que se volvió a
 * colar por la puerta de al lado en cuanto alguien construyó un `Date` con esa
 * cadena. La `T00:00:00` sin zona obliga a interpretarla en **hora local**,
 * que es lo que significa una fecha de alta comercial: un día del calendario,
 * sin hora y sin huso.
 */
function formatCustomerSince(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
