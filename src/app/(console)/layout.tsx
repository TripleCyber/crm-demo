import Link from 'next/link';

import { getEmployeeSession } from '@/lib/session';

/**
 * La consola de agentes. **No es el portal del cliente** (`/portal`), y la
 * separación es de estructura: son dos grupos de rutas con dos cabeceras y dos
 * sesiones distintas, así que la navegación del banco no aparece nunca en la
 * pantalla de un titular.
 *
 * El grupo `(console)` no cambia ninguna URL: `/customers` y `/diagnostics`
 * siguen respondiendo exactamente donde respondían.
 */
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  // La organización se lee aquí sólo para rotularla. Si la configuración está a
  // medias, la barra lo dice y las pantallas siguen cargando: enterarse de que
  // falta una variable de entorno con una pantalla en blanco es la peor forma
  // de enterarse.
  // El nombre del banco sale de la organización activa y no está escrito aquí:
  // la consola de un segundo partner llevaría el rótulo del primero, que es la
  // clase de detalle que nadie mira hasta que lo ve un cliente.
  let bankName = 'Consola de agentes';
  let organizationLabel: string;
  try {
    const session = await getEmployeeSession();
    bankName = session.organization.displayName;
    organizationLabel = `${session.organization.displayName} · ${session.organization.orgId}`;
  } catch (error) {
    organizationLabel = error instanceof Error ? `sin configurar: ${error.message}` : 'sin configurar';
  }

  return (
    <>
      <header className="topbar">
        <strong>{bankName}</strong>
        <nav>
          <Link href="/customers">Clientes</Link>
          <Link href="/customers/new">Alta</Link>
          <Link href="/diagnostics">Diagnóstico</Link>
        </nav>
        <span className="org">{organizationLabel}</span>
      </header>
      <main>{children}</main>
    </>
  );
}
