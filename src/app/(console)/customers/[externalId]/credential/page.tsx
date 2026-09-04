import Link from 'next/link';
import { notFound } from 'next/navigation';

import { IssueCredentialForm } from '@/components/IssueCredentialForm';
import { getTranslator } from '@/i18n/server';
import { loadCustomerContext } from '@/lib/customer-context';
import { displayAttribute, findCustomerAttribute, referenceOf } from '@/lib/customers';

/**
 * **C0 · emitir credencial.** Su propia pantalla, y no un bloque de la ficha.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  LOS VALORES DE LA CREDENCIAL SE RESUELVEN AQUÍ, EN EL SERVIDOR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * El formulario de al lado recibe los atributos **ya rellenados desde la fila
 * del padrón** y sólo para enseñarlos. No los manda de vuelta al emitir: la
 * ruta `POST /api/credentials/issue` acepta un `externalId` y ya está, y vuelve
 * a leer la ficha para componer los claims. Si el contenido de la credencial
 * viniera del navegador, cualquiera con la consola de red abierta emitiría una
 * credencial firmada por este banco diciendo lo que le apeteciera — y la firma
 * sería buena.
 *
 * Los tipos **salen de te-api** (`GET /v1/b2b/organization`), no de una lista
 * escrita aquí: el desplegable no puede ofrecer un tipo que el padrón de la
 * organización no tiene, porque la lista y la comprobación vienen de la misma
 * fuente. Los atributos de cada tipo y los rótulos salen de
 * `credential-profiles.ts`, que los lee de configuración — te-api no los
 * expone.
 *
 * Si te-api no contesta, la pantalla lo dice y no ofrece nada: emitir a ciegas
 * un tipo que a lo mejor no existe deja al agente esperando un error del
 * servidor para enterarse.
 */

export const dynamic = 'force-dynamic';

export default async function IssueCredentialPage({
  params,
}: {
  params: Promise<{ externalId: string }>;
}) {
  const t = await getTranslator();
  const { externalId } = await params;
  const { session, customer, credentialTypes, issuerDid, teApiWarning } =
    await loadCustomerContext(externalId);

  if (customer === null) notFound();

  const href = `/customers/${encodeURIComponent(customer.externalId)}`;
  const holderName = `${customer.givenName} ${customer.familyName}`;

  // La referencia del sector, compuesta aquí: el formulario es de navegador y
  // no puede leer el catálogo de atributos, que es `server-only`.
  const holderReference = referenceOf(customer);

  // El cruce de las tres fuentes: el padrón dice qué tipos hay, la
  // configuración qué lleva cada uno, y la ficha con qué se rellenan.
  //
  // El valor baja **ya escrito para pantalla** (`displayAttribute`) y no crudo.
  // Antes daba igual porque todos los atributos eran texto; desde que los hay
  // derivados, el crudo de `age_over_18` es un `true` — y la vista previa de lo
  // que se va a firmar es el peor sitio para que el agente tenga que traducir de
  // cabeza. Lo que se firma sigue siendo el `true`, y lo compone el servidor al
  // emitir (`buildCredentialClaims`); esto es sólo lo que se lee.
  const types = credentialTypes.map((option) => ({
    type: option.type,
    label: option.label,
    maxValidityDays: option.maxValidityDays,
    claims: option.claims.map((claim) => {
      const attribute = findCustomerAttribute(claim.name);
      return {
        name: claim.name,
        label: claim.label,
        value: attribute === undefined ? null : displayAttribute(t, attribute, customer),
      };
    }),
  }));

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">
            <Link href="/customers">{t('nav.customers')}</Link> ·{' '}
            <Link href={href}>{holderName}</Link>
          </p>
          <h1>{t('credential.title')}</h1>
          {/*
            Decía «TripleEnable no ve lo que va dentro», y **es falso**: los
            claims viajan a te-api, que es quien firma —ver el cuerpo que arma
            `api/credentials/issue/route.ts`—. Se corrige aquí y no se
            reescribe en bonito: una frase de venta que un ingeniero del banco
            desmonta en una tarde cuesta el contrato entero.

            Lo cierto, que además vende igual de bien: **el contenido lo decide
            el banco** y sale de su padrón, nunca del navegador.
          */}
          <p className="page-sub">{t.rich('credential.subtitle')}</p>
        </div>
      </header>

      {teApiWarning !== undefined && (
        <p className="alert">{t('credential.teApiWarning', { reason: teApiWarning })}</p>
      )}

      {/*
        `officialNumbers` baja al navegador y no es un descuido: son los
        teléfonos públicos del banco, los mismos que están en su web, y el
        agente tiene que verlos antes de firmarlos dentro de una credencial que
        va a durar años. Lo que no baja nunca es el secreto M2M, que vive en
        `organizations.ts` detrás de `import 'server-only'`.
      */}
      <IssueCredentialForm
        externalId={customer.externalId}
        holder={{
          displayName: holderName,
          reference:
            holderReference === undefined
              ? null
              : (holderReference.attribute.display === undefined
                  ? holderReference.value
                  : holderReference.attribute.display(holderReference.value)),
        }}
        issuerDid={issuerDid}
        officialNumbers={session.organization.officialNumbers}
        credentialTypes={types}
      />
    </>
  );
}
