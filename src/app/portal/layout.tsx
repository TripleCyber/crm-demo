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
    // Genérico y no el nombre de un banco concreto: si la configuración está
    // rota no se sabe de qué organización es este despliegue, y ponerle el
    // nombre del primero que hubo sería afirmarlo sin saberlo.
    bankName = 'Portal de clientes';
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
