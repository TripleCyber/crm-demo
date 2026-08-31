import Link from 'next/link';

import { CustomerForm } from '@/components/CustomerForm';
import { getTranslator } from '@/i18n/server';
import { describeConsoleFailure } from '@/lib/console-failures';
import type { OrganizationConfig } from '@/lib/organizations';
import { getRequestOrganization } from '@/lib/request-organization';

/**
 * El alta de cliente.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ESTA PANTALLA SÍ SABE DE QUÉ ORGANIZACIÓN ES, Y POR ESO EL FORMULARIO NO
 *  TIENE QUE SABERLO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `CustomerForm` es de cliente y no puede leer nada de `src/lib` que toque
 * secretos o base: es lo que garantiza que no baje uno al navegador. Pero la
 * decisión de qué referencia de sector se ofrece —la cuenta, la póliza, la
 * historia o el punto de suministro— no hace falta tomarla allí. Se toma
 * **aquí**, que es servidor, y baja resuelta como una propiedad: una de cuatro
 * palabras conocidas, nunca la organización.
 *
 * Es la misma resolución por dominio que usa el resto de la consola
 * (`getRequestOrganization`), así que la pantalla de alta y el padrón en el que
 * escribe no pueden discrepar sobre de quién son.
 */

/**
 * Se pinta por petición, igual que el listado.
 *
 * Desde que la organización sale del `Host`, esta pantalla depende de la
 * petición: prerenderizarla en la compilación daría el formulario de una
 * organización cualquiera —o de ninguna— servido en los cuatro dominios.
 */
export const dynamic = 'force-dynamic';

export default async function NewCustomerPage() {
  const t = await getTranslator();

  /*
    ═══════════════════════════════════════════════════════════════════════════
     SI LA ORGANIZACIÓN NO SE PUEDE RESOLVER, SE DICE. NO SE DISIMULA
    ═══════════════════════════════════════════════════════════════════════════

    Aquí caen dos cosas distintas y las dos importan:

     · el `Host` no es de ninguna organización y no hay `CRM_ACTIVE_ORG_ID`, y
     · una variable de esa organización está mal escrita — entre ellas
       `CRM_ORG_<SLUG>_REFERENCE_CLAIM` con un valor que no es de los cuatro.

    Las dos son configuración, así que se tratan como en el listado: aviso
    traducido para quien atiende, y el mensaje crudo —que nombra la variable y
    los cuatro valores válidos— al registro y a Diagnóstico, que es la pantalla
    de quien puede arreglarlo.

    El formulario se sigue pintando, con las cuatro referencias: es lo que había
    antes de que esta pantalla mirara la organización, y sin saber de qué empresa
    es, esconder tres campos sería esconderlos a ciegas. Lo que NO puede pasar es
    que ocurra en silencio, y para eso está la banda de arriba — una referencia
    mal declarada tiene que verse, no degradarse a «las cuatro» como si nadie la
    hubiera declarado.
  */
  let organization: OrganizationConfig | undefined;
  let failure: string | undefined;
  try {
    organization = await getRequestOrganization();
  } catch (error) {
    failure = describeConsoleFailure(t, error, 'el alta de cliente no supo de qué organización es');
  }

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">
            <Link href="/customers">{t('nav.customers')}</Link>
          </p>
          <h1>{t('customerNew.title')}</h1>
          {/*
            La consecuencia primero —cambiar el identificador rompe el vínculo—
            porque es lo que hay que saber ANTES de teclear. Cómo se llama ese
            campo por dentro no cambia nada de lo que se decide aquí, y va
            debajo, para quien vaya a integrar.
          */}
          <p className="page-sub">{t('customerNew.subtitle')}</p>
          <details className="tech">
            <summary>{t('common.technicalDetail')}</summary>
            <p style={{ maxWidth: '70ch' }}>{t.rich('customerNew.technical')}</p>
          </details>
        </div>
      </header>
      {failure !== undefined && <p className="alert">{failure}</p>}
      <CustomerForm referenceClaim={organization?.referenceClaim} />
    </>
  );
}
