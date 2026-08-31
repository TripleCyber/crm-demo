import 'server-only';

import { NextResponse } from 'next/server';

import { getOrganization, OrganizationConfigError, type OrganizationConfig } from './organization';

/**
 * La configuración para una ruta del portal, o la respuesta que hay que dar
 * cuando todavía no hay ninguna.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ESTE ESTADO ES NUEVO, Y POR ESO HACE FALTA ESTA FUNCIÓN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Las tres rutas del portal —`/portal/login`, `/portal/callback` y
 * `/portal/logout`— llamaban a `getOrganization()` sin protegerlo, y era
 * correcto: mientras la configuración viniera del entorno, **un proceso sin
 * configurar no llegaba a arrancar**, así que nadie podía pedir esas rutas en
 * ese estado.
 *
 * Desde que la configuración vive en la base y se escribe desde la consola
 * (`./tenant-settings.ts`), una instalación recién publicada **arranca sin
 * configurar a propósito** — es el estado de sus primeros cinco minutos. Sin
 * esto, pedir `/portal/login` en esa ventana devolvía un 500 con la traza en el
 * registro, que es la peor forma de decir «todavía no me han configurado».
 *
 * ## Por qué 503 y no una redirección a la pantalla que lo explica
 *
 * Porque **no hay a dónde redirigir**. El `home` del portal se compone con la
 * dirección pública declarada de esta instalación, que es justamente uno de los
 * valores que faltan; y componerlo con la cabecera `Host` es lo que este
 * proyecto no hace en ninguna parte, porque la escribe quien llama.
 *
 * 503 y no 500 porque no está roto: no está listo. Es la misma distinción que
 * hace el `did.json` entre `configuration_error` y `not_found`, y la que
 * permite que un supervisor que mire códigos de estado distinga «hay que
 * arreglarlo» de «hay que terminar de instalarlo».
 *
 * La comprobación de salud del contenedor **no pasa por aquí** y sigue
 * contestando 200 (`api/health/route.ts`): un despliegue a medio configurar
 * tiene que seguir sirviendo, o el proxy dejaría de enrutarle y no habría forma
 * de llegar a la pantalla que lo configura.
 */
export async function requireOrganization(): Promise<
  { readonly ok: true; readonly organization: OrganizationConfig } | { readonly ok: false; readonly response: NextResponse }
> {
  try {
    return { ok: true, organization: await getOrganization() };
  } catch (error) {
    if (error instanceof OrganizationConfigError) {
      // El mensaje entero, con la lista de lo que falta: esta respuesta la lee
      // quien despliega y no un titular. No lleva ningún secreto — nombra
      // campos, nunca valores.
      console.error('[portal] petición al portal de una instalación sin configurar', {
        missing: error.missing,
      });
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'not_configured', missing: error.missing },
          { status: 503 },
        ),
      };
    }
    throw error;
  }
}
