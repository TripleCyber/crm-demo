import Link from 'next/link';

import { CustomerForm } from '@/components/CustomerForm';
import { getTranslator } from '@/i18n/server';
import { describeConsoleFailure } from '@/lib/console-failures';
import { getOrganization, type OrganizationConfig } from '@/lib/organization';

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
 * decisión de qué referencia de sector se ofrece —la cuenta o el punto de
 * suministro— no hace falta tomarla allí. Se toma **aquí**, que es servidor, y
 * baja resuelta como una propiedad: una palabra de un juego cerrado, nunca la
 * organización.
 *
 * Es la misma configuración que lee el resto de la consola (`getOrganization`),
 * así que la pantalla de alta y el padrón en el que escribe no pueden discrepar
 * sobre de quién son.
 */

/**
 * Se pinta por petición, igual que el listado.
 *
 * La configuración se lee del entorno del proceso que sirve, no del que
 * construye la imagen: prerenderizar esta pantalla la congelaría con la
 * referencia de sector que hubiera —o sin ninguna— en tiempo de construcción.
 */
export const dynamic = 'force-dynamic';

export default async function NewCustomerPage() {
  const t = await getTranslator();

  /*
    ═══════════════════════════════════════════════════════════════════════════
     SI LA CONFIGURACIÓN NO SE PUEDE LEER, EL FORMULARIO NO SE PINTA
    ═══════════════════════════════════════════════════════════════════════════

    Y eso es nuevo. Antes el formulario se pintaba igual, con las cuatro
    referencias, porque sin saber de qué empresa era la pantalla esconder tres
    campos habría sido esconderlos a ciegas.

    Ahora no hay tal cosa: la referencia de sector es obligatoria y sin ella el
    proceso no llega hasta aquí con una configuración a medias. Lo único que
    puede fallar es que esté mal escrita, y entonces **no hay referencia que
    ofrecer**: un alta sin la casilla del dato con el que el titular reconoce su
    relación es un alta que hay que repetir a mano, cliente por cliente. Se
    prefiere el aviso, que además nombra qué hacer.

    El mensaje crudo —que nombra la variable y los valores válidos— va al
    registro y a Diagnóstico, que es la pantalla de quien puede arreglarlo.
  */
  let organization: OrganizationConfig | undefined;
  let failure: string | undefined;
  try {
    organization = await getOrganization();
  } catch (error) {
    failure = describeConsoleFailure(t, error, 'el alta de cliente no pudo leer su configuración');
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
      {organization === undefined ? (
        <p className="alert">{failure}</p>
      ) : (
        <CustomerForm referenceClaim={organization.referenceClaim} />
      )}
    </>
  );
}
