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
 * Desde que la organización se elige por el `Host`, esa ruta ya no puede
 * contestar a la comprobación: Docker la llama a `127.0.0.1`, que no es el
 * dominio de nadie, así que no hay organización que resolver y devuelve 500. El
 * contenedor arrancaba bien, servía bien, y Docker lo marcaba enfermo; el proxy
 * dejaba de enrutarle y los tres dominios daban 503. Pasó el 2026-08-30 y estuvo
 * caído hasta que se volvió a la imagen anterior.
 *
 * Y el fallo era peor de lo que parecía, porque no era sólo el `127.0.0.1`:
 * atada a una organización, la salud del contenedor dependía de que el token
 * M2M de ESA organización funcionara. Un secreto mal puesto en Seguros Aurora
 * habría tumbado también a Banco Demo y a la Clínica, que no tienen nada que
 * ver. Con tres inquilinos, preguntar por uno para saber si el proceso vive es
 * la pregunta equivocada.
 *
 * Aquí se pregunta lo único que la comprobación tiene que saber: si el proceso
 * está en pie y sirviendo. Sin base, sin Logto, sin te-api y sin `Host`. Que la
 * configuración de cada organización esté bien es otra pregunta, y tiene su
 * sitio: la pantalla de Diagnóstico, que la contesta por organización y con
 * detalle.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(): NextResponse {
  return NextResponse.json({ status: 'ok', service: 'crm-demo' });
}
