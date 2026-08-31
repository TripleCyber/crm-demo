import type { Metadata } from 'next';

import { LocaleProvider } from '@/i18n/client';
import { getLocale, getTranslator } from '@/i18n/server';
import { getRequestOrganization } from '@/lib/request-organization';

import './globals.css';

/**
 * El título de la pestaña, con el nombre de **la organización del dominio**.
 *
 * Era una constante con «Banco Demo» dentro, y con tres dominios sobre el mismo
 * despliegue eso pone el nombre del banco en la pestaña del portal de la
 * clínica. Es de las cosas que nadie mira hasta que la ve un cliente, y una
 * captura de pantalla la conserva.
 *
 * Si la organización no se puede resolver se queda un rótulo genérico: no se
 * afirma el nombre de ninguna.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  try {
    const organization = await getRequestOrganization();
    return {
      title: organization.displayName,
      description: t('app.description', { organization: organization.displayName }),
    };
  } catch {
    return { title: t('app.fallbackTitle'), description: t('app.fallbackDescription') };
  }
}

/**
 * La raíz sólo pone el documento. **La cabecera vive en cada sección.**
 *
 * Hay dos secciones y no se parecen en nada:
 *
 *   · `(console)` — la consola de agentes. La usa un empleado del banco desde
 *     el mostrador, ve el padrón entero de clientes y emite credenciales.
 *   · `portal`    — el portal del cliente. Lo usa el titular, ve **su** ficha y
 *     nada más, y lo único que puede hacer es vincular su cuenta.
 *
 * Están separadas por una razón que no es estética: si compartieran cabecera,
 * compartirían navegación, y un enlace a «Clientes» pintado en el portal es un
 * enlace que un titular va a pulsar. La separación estructural —dos grupos de
 * rutas, dos disposiciones, dos sesiones distintas— hace que ese enlace no
 * exista en vez de que esté escondido.
 *
 * Lo que sí es de la raíz es **el idioma**, y por dos motivos que no se pueden
 * repartir: el atributo `lang` del documento es de aquí —lo lee el corrector
 * ortográfico del navegador y el lector de pantalla para elegir voz— y el
 * contexto que da el idioma a los componentes de navegador tiene que envolver
 * las dos secciones, porque las dos tienen.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  return (
    <html lang={locale}>
      <body>
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
