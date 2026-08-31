import Link from 'next/link';

import { LocaleSwitch } from '@/components/LocaleSwitch';
import { RailNav } from '@/components/RailNav';
import { getTranslator } from '@/i18n/server';
import { monogramOf } from '@/lib/brand';
import { getEmployeeSession } from '@/lib/session';

/**
 * La consola de agentes. **No es el portal del cliente** (`/portal`), y la
 * separación es de estructura: son dos grupos de rutas con dos cabeceras y dos
 * sesiones distintas, así que la navegación del banco no aparece nunca en la
 * pantalla de un titular.
 *
 * El grupo `(console)` no cambia ninguna URL: `/customers` y `/diagnostics`
 * siguen respondiendo exactamente donde respondían.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  POR QUÉ UNA BARRA LATERAL Y NO UNA CABECERA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Porque esta consola ya no es una pantalla, son cinco, y dos de ellas
 * —clientes y verificaciones— son **secciones** entre las que se va y se
 * vuelve todo el día. Una fila de enlaces arriba sirve para tres pantallas
 * sueltas; en cuanto hay secciones, lo que hace falta es un sitio fijo que diga
 * siempre dónde estás. Es la forma que tiene cualquier herramienta interna de
 * un banco, y no por moda: la columna de la izquierda no se mueve al navegar,
 * así que el agente no tiene que volver a buscarla en cada salto.
 *
 * Abajo del todo va **quién eres**, y eso no es decoración de perfil: ese
 * nombre y ese número son exactamente lo que le sale al titular en el móvil
 * cuando suena el timbre. Que el agente lo tenga a la vista mientras habla por
 * teléfono es la mitad de la ceremonia — tiene que poder decir en voz alta lo
 * mismo que el cliente está leyendo.
 */
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslator();

  // La organización se lee aquí sólo para rotularla. Si la configuración está a
  // medias, la barra lo dice y las pantallas siguen cargando: enterarse de que
  // falta configuración con una pantalla en blanco es la peor forma de
  // enterarse — y desde que la configuración se escribe desde la propia consola,
  // una pantalla en blanco dejaría sin arreglo a quien podría arreglarlo.
  // El nombre del banco sale de la organización activa y no está escrito aquí:
  // la consola de un segundo partner llevaría el rótulo del primero, que es la
  // clase de detalle que nadie mira hasta que lo ve un cliente.
  let bankName = t('nav.consoleFallbackName');
  let orgId: string | undefined;
  let misconfigured = false;
  let agent: { id: string; displayName: string } | undefined;
  // El monograma se queda vacío mientras no se sepa de quién es la pantalla, y
  // entonces el disco no se pinta: dibujar una inicial cuando no se sabe de qué
  // empresa es sería inventarse una marca.
  let monogram = '';

  try {
    const session = await getEmployeeSession();
    bankName = session.organization.displayName;
    orgId = session.organization.orgId;
    agent = session.agent;
    monogram = monogramOf(session.organization);
  } catch {
    // El mensaje del error **no se pinta aquí**, y es a propósito: lista los
    // campos que faltan, y quien tiene esta barra delante es un agente con un
    // cliente al teléfono. Se le dice que la consola está sin configurar y
    // dónde se arregla; la lista entera está en Ajustes, que es la pantalla que
    // la puede arreglar.
    misconfigured = true;
  }

  return (
    <div className="console">
      <aside className="rail">
        <div className="rail-brand">
          {/*
            El monograma es el logotipo que esta consola puede tener el día que
            una organización se da de alta: no hay fichero de imagen ninguno, y
            hasta que lo haya la pantalla tiene que enseñar algo que se
            reconozca de lejos. Es decorativo —el nombre está escrito al lado, y
            en serif— así que sale del árbol de accesibilidad: un lector de
            pantalla que dice «LE» antes de «Larkfield Energy» sólo estorba.
          */}
          {monogram !== '' && (
            <span className="brand-mark" aria-hidden="true">
              {monogram}
            </span>
          )}
          <strong>{bankName}</strong>
          {orgId === undefined ? (
            // Un enlace y no un rótulo: es lo único accionable de una consola
            // sin configurar, y quien la abre recién publicada llega aquí antes
            // que a ninguna otra cosa. Decir «sin configurar» y no decir dónde
            // se arregla es la mitad del mensaje.
            <Link className="rail-org warn" href="/settings">
              {t('nav.unconfigured')}
            </Link>
          ) : (
            <span className="rail-org mono">{orgId}</span>
          )}
        </div>

        <RailNav />

        {agent === undefined ? (
          <div className="rail-agent">
            <p className="rail-agent-warn">
              {t(misconfigured ? 'nav.unconfiguredAgent' : 'nav.unidentifiedAgent')}
            </p>
          </div>
        ) : (
          <div className="rail-agent">
            <span className="rail-avatar" aria-hidden="true">
              {initialsOf(agent.displayName)}
            </span>
            <div>
              <strong>{agent.displayName}</strong>
              <span>
                {t('nav.agentNumber')} <span className="mono">{agent.id}</span>
              </span>
            </div>
          </div>
        )}

        {/*
          El selector de idioma, al final de la barra y debajo de quién eres.
          No es una acción de la ceremonia —se toca una vez y no se vuelve— así
          que va donde no compite con la navegación, que es lo que se pulsa todo
          el día.
        */}
        <LocaleSwitch />
      </aside>

      <main className="workspace">{children}</main>
    </div>
  );
}

/**
 * Las iniciales del empleado para el disco de la barra.
 *
 * Dos letras como mucho, y de las dos primeras **palabras**: «Pedro Ramírez» da
 * «PR», y «Agente de Banco Demo» —el rótulo de cuando no hay login todavía— da
 * «AD», que no pretende ser el nombre de nadie. No se dibuja ninguna foto: no
 * hay ninguna que enseñar y un avatar generado es un dato inventado más.
 */
function initialsOf(displayName: string): string {
  return displayName
    .split(/\s+/)
    .filter((word) => word !== '')
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}
