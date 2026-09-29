import { NextResponse } from 'next/server';

/**
 * `GET /api/health` — ¿está vivo este proceso?
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  POR QUÉ NO VALE `/api/organization`, Y POR QUÉ TIRÓ PRODUCCIÓN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La comprobación de salud del contenedor apuntaba a `/api/organization`. Eso
 * funcionaba mientras la consola era de una sola organización: la resolvía de
 * una variable de entorno y contestaba igual desde cualquier sitio.
 *
 * Cuando la organización se elegía por el `Host`, esa ruta no podía contestar a
 * la comprobación: Docker la llama a `127.0.0.1`, que no era el dominio de
 * nadie, así que no había organización que resolver y devolvía 500. El
 * contenedor arrancaba bien, servía bien, y Docker lo marcaba enfermo; el proxy
 * dejaba de enrutarle y los dominios daban 503. Pasó el 2026-08-30 y estuvo
 * caído hasta que se volvió a la imagen anterior.
 *
 * **Con una organización por instalación el `Host` ya no estorba**, pero esta
 * ruta se queda igual y por la mitad del motivo que siempre tuvo: atada a
 * `/api/organization`, la salud del contenedor dependería de que el token M2M
 * saliera de Logto y de que te-api contestara. Un secreto caducado marcaría el
 * proceso como enfermo, el proxy dejaría de enrutarle, y una consola que sólo
 * quería consultar el teléfono de un cliente se quedaría sin servir por algo que
 * no le hacía falta.
 *
 * Aquí se pregunta lo único que la comprobación tiene que saber: si el proceso
 * está en pie y sirviendo. Sin base, sin Logto y sin te-api. Que la
 * configuración esté bien es otra pregunta, y tiene su sitio: la pantalla de
 * Diagnóstico, que la contesta con detalle.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(): NextResponse {
  return NextResponse.json({ status: 'ok', service: 'crm-demo' });
}
