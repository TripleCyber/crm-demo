import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CeremonyCatalogue } from '@/components/CeremonyCatalogue';
import { getTranslator } from '@/i18n/server';
import { monogramOf } from '@/lib/brand';
import { CEREMONY_CASES, CEREMONY_INDUSTRIES } from '@/lib/ceremony-catalogue';
import { loadCustomerContext } from '@/lib/customer-context';

import {
  readCeremonyEventsAction,
  readCeremonyOutcomeAction,
  sendCeremonyAction,
} from './actions';

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
 * Y no hay ruta de API nueva. Lo que el navegador manda son **los campos ya
 * compuestos y el identificador del caso**; la acción de servidor de al lado
 * pone la plantilla, el `kind` y con qué se firma —eso no se negocia con el
 * navegador— y llama a `POST /v1/requests`, que es la ruta genérica del marco y
 * sirve cualquier plantilla.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  LO QUE ESTA PANTALLA LE PASA AL NAVEGADOR, Y POR QUÉ NADA DE ELLO ES SECRETO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  · **La base de te-api.** La necesita para pintar el bloque de la petición
 *    mientras alguien escribe, sin una ida y vuelta por letra. Baja la **base** y
 *    no la URL entera: el camino lo pone `buildCeremonyHttpRequest`, que es el
 *    mismo que la manda, y componerla aquí sería la primera copia de la que se
 *    separan las dos. Es la dirección pública de te-api; el token, que es lo que
 *    abre esa puerta, no baja nunca (`lib/b2b-http.ts`).
 *  · **El nombre legal del padrón.** Es lo que te-api copia en `asker_name` y lo
 *    que entra en la frase que el titular firma, así que sin él el ensayo de esa
 *    frase diría un nombre y la de verdad otro.
 *  · **Los dos colores de la marca.** Para enseñar **cuál es la marca de esta
 *    organización** al lado de la línea que dice que la marca **no viaja en la
 *    petición**: te-api la congela de su padrón al crear la fila. Son los mismos
 *    colores que ya pinta la barra lateral de esta consola.
 */

export const dynamic = 'force-dynamic';

export default async function CeremoniesPage({
  params,
}: {
  params: Promise<{ externalId: string }>;
}) {
  const t = await getTranslator();
  const { externalId } = await params;
  const { session, customer, teApiWarning, walletLinked, legalName, credentialTypes } =
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
        /*
          El nombre que va a leer el titular, con el rótulo de la consola de
          respaldo: cuando te-api no ha contestado no se sabe el legal, y decir
          «Bank Demo» en el ensayo es mejor que dejar la frase sin nombre —que es
          lo que `renderCeremonyStatement` trataría como un fallo—. La pantalla
          ya está avisando arriba de que no se pudo preguntar.
        */
        askerName={legalName ?? session.organization.displayName}
        verifierUrl={session.organization.verifierUrl}
        /*
          El tipo con el que se va a pedir la credencial en los casos que firman
          con una. **Es el primero del padrón de te-api**, y lo elige aquí la
          misma expresión que la acción de servidor: `resolveCredentialTypes` es
          un `map` sobre lo que devuelve `GET /v1/b2b/organization`, así que el
          orden es el mismo y el primero también.

          Se pasa para que la vista previa enseñe el cuerpo **exacto** en vez de
          un hueco. Que las dos expresiones puedan separarse un día no deja
          mentir a la pantalla: lo que se pinta después de mandar es el cuerpo
          que devolvió el servidor, con el tipo que de verdad viajó.
        */
        credentialType={credentialTypes[0]?.type}
        brand={
          session.organization.brand === undefined
            ? undefined
            : {
                accent: session.organization.brand.accent,
                surface: session.organization.brand.surface,
                monogram: monogramOf(session.organization),
              }
        }
        walletLinked={walletLinked}
        send={sendCeremonyAction}
        /*
          Las dos lecturas de la vuelta, y son distintas a propósito:
          `readOutcome` lee **la fila de esta ceremonia** —la misma que enseña la
          ficha del cliente— y `readEvents` el sobre firmado que llegó por el
          cable. La primera contesta «qué dijo el titular», la segunda «qué entró
          por el webhook». Ver la cabecera de `actions.ts`.
        */
        readOutcome={readCeremonyOutcomeAction}
        readEvents={readCeremonyEventsAction}
      />
    </>
  );
}
