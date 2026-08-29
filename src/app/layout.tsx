import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'Banco Demo',
  description: 'Consola de agentes y portal de clientes de Banco Demo',
};

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
