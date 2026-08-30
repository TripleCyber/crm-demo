import type { Metadata } from 'next';

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
  try {
    const organization = await getRequestOrganization();
    return {
      title: organization.displayName,
      description: `Consola de agentes y portal de clientes de ${organization.displayName}`,
    };
  } catch {
    return { title: 'CRM', description: 'Consola de agentes y portal de clientes' };
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
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
