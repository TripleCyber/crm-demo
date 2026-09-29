import type { Metadata } from 'next';

import { LocaleProvider } from '@/i18n/client';
import { getLocale, getTranslator } from '@/i18n/server';
import { brandStyleOf } from '@/lib/brand';
import { getOrganization } from '@/lib/organization';

import './globals.css';

/**
 * El título de la pestaña, con el nombre de la organización de esta instalación.
 *
 * Era una constante con «Banco Demo» dentro, y eso pone el nombre del banco en
 * la pestaña de cualquier otra empresa que despliegue este CRM. Es de las cosas
 * que nadie mira hasta que la ve un cliente, y una captura de pantalla la
 * conserva.
 *
 * Si la configuración no se puede leer se queda un rótulo genérico: no se afirma
 * el nombre de ninguna empresa.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  try {
    const organization = await getOrganization();
    return {
      title: organization.displayName,
      description: t('app.description', { organization: organization.displayName }),
    };
  } catch {
    return { title: t('app.fallbackTitle'), description: t('app.fallbackDescription') };
  }
}

/**
 * La raíz sólo pone el documento. **La cabecera vive en la sección.**
 *
 * Hoy hay una sola: `(console)`, la consola de agentes. La usa un empleado del
 * banco desde el mostrador, ve el padrón entero de clientes y emite
 * credenciales — es una herramienta **interna**, y no hay ninguna pantalla de
 * esta aplicación a la que entre un cliente.
 *
 * Hubo una segunda, `portal`, para que el titular entrara con su cuenta y
 * vinculara su cartera. Se retiró: un banco no registra su CRM como aplicación
 * OIDC para que entren sus clientes —ya tiene su banca electrónica—, y el
 * vínculo no nacía de ese login de todas formas. Nace cuando el titular acepta
 * una credencial de esta entidad en su cartera.
 *
 * La raíz sigue sin poner cabecera, y no por inercia: el día que haya una
 * segunda sección, compartir cabecera sería compartir navegación. Que cada
 * grupo de rutas ponga la suya hace que un enlace a «Clientes» no exista fuera
 * de la consola, en vez de que esté escondido.
 *
 * Lo que sí es de la raíz es **el idioma**, y por dos motivos que no se pueden
 * repartir: el atributo `lang` del documento es de aquí —lo lee el corrector
 * ortográfico del navegador y el lector de pantalla para elegir voz— y el
 * contexto que da el idioma a los componentes de navegador tiene que envolver
 * la aplicación entera.
 *
 * Y **la marca**, por lo mismo: los tokens de color de la organización del
 * dominio se ponen en el `<body>`, que es el único elemento que envuelve a las
 * dos secciones. Puestos aquí llegan pintados desde el servidor —sin
 * JavaScript, y sin un primer fotograma con el color de otra empresa— y las
 * reglas de `globals.css` no se enteran: siguen leyendo `var(--navy-deep)` y lo
 * que cambia es lo que esa variable vale en esta petición. El porqué de cada
 * token está en `src/lib/brand.ts`.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  // Si la configuración está rota, la pantalla que lo explica tiene que poder
  // pintarse. Sin marca es la paleta de la hoja, que es exactamente lo que había
  // antes de que existiera esto.
  let brandStyle;
  try {
    brandStyle = brandStyleOf(await getOrganization());
  } catch {
    brandStyle = undefined;
  }

  return (
    <html lang={locale}>
      <body style={brandStyle}>
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
