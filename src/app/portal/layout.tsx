import { getActiveOrganization } from '@/lib/organizations';

/**
 * El portal del cliente. **Otra cabecera, otra sesión, otra persona.**
 *
 * Aquí no se pinta ni un enlace a la consola de agentes: quien mira esta
 * pantalla es un titular, y el padrón de clientes del banco no es asunto suyo.
 * La separación es de estructura (dos grupos de rutas, dos disposiciones) y no
 * un `if` en una cabecera compartida — un `if` se olvida, un fichero aparte no.
 */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  let bankName: string;
  try {
    bankName = getActiveOrganization().displayName;
  } catch {
    // El rótulo no puede tumbar la pantalla que explica que falta configuración.
    bankName = 'Banco Demo';
  }

  return (
    <>
      <header className="topbar portal">
        <strong>{bankName}</strong>
        <span className="org">Portal de clientes</span>
      </header>
      <main className="narrow">{children}</main>
    </>
  );
}
