import { NextResponse } from 'next/server';

import {
  buildAuthorizationUrl,
  getPortalBaseUrl,
  newAuthorizationRequest,
} from '@/lib/portal-oidc';
import { saveAuthorizationRequest } from '@/lib/portal-session';
import { requireOrganization } from '@/lib/portal-guard';

/**
 * `GET /portal/login` — arranca el login OIDC contra Logto.
 *
 * Es una ruta y no un `<a>` directo a Logto porque el `state`, el `nonce` y el
 * `code_verifier` **se generan en el servidor y se guardan en una cookie**
 * antes de saltar. Un enlace estático no puede hacer eso, y sin esos tres
 * valores el callback no tiene contra qué comparar lo que le llegue.
 *
 * `dynamic = 'force-dynamic'` porque escribe una cookie: sin él Next intentaría
 * tratarla como estática y el `state` sería el mismo para todo el mundo.
 */
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  // Sin configuración no hay ni portal ni dirección a la que devolver a nadie.
  // Ver `lib/portal-guard.ts`: es un estado nuevo desde que la configuración se
  // escribe desde la consola en vez de venir del entorno.
  const resolved = await requireOrganization();
  if (!resolved.ok) return resolved.response;
  const { organization } = resolved;

  if (organization.portal === undefined) {
    // Sin aplicación de portal declarada no hay login que empezar. Se manda a
    // la pantalla, que lo explica en el idioma del titular, en vez de producir
    // un error de Logto que nombra un `client_id` vacío.
    //
    // El origen sale de la dirección pública declarada de ESTA organización
    // —la misma función que compone el `redirect_uri`, y no una segunda copia—
    // y **no de la cabecera `Host`**: el `Host` sirve para saber de quién es la
    // petición, pero componer con él una redirección es la forma clásica de
    // acabar con una redirección abierta.
    return NextResponse.redirect(
      new URL('/portal?error=no-portal', getPortalBaseUrl(organization)),
    );
  }

  const authorizationRequest = newAuthorizationRequest();
  await saveAuthorizationRequest(authorizationRequest);

  return NextResponse.redirect(
    await buildAuthorizationUrl(organization, organization.portal, authorizationRequest),
  );
}
