import { NextResponse, type NextRequest } from 'next/server';

import { findCustomerByEmail } from '@/lib/customers';
import { getActiveOrganization } from '@/lib/organizations';
import { exchangeCode, getPortalBaseUrl, PortalLoginError } from '@/lib/portal-oidc';
import { saveSession, takeAuthorizationRequest, type LinkOutcome } from '@/lib/portal-session';
import { describeTeApiError, linkCustomer, TeApiError } from '@/lib/te-api';

/**
 * `GET /portal/callback` — **aquí ocurre el vínculo**.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  POR QUÉ SE VINCULA AQUÍ Y NO EN UN BOTÓN DE LA PANTALLA SIGUIENTE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Porque te-api sólo acepta ID tokens de **menos de cinco minutos**
 * (`src/b2b/portal-id-token.ts`), y a propósito: un ID token viejo que sigue
 * vinculando es un ID token filtrado que sigue vinculando. Guardarlo para
 * usarlo cuando al titular le apetezca pulsar un botón produce un fallo
 * intermitente que parece de red y no lo es.
 *
 * Así que el ID token se usa en el mismo salto en el que llega y **no se
 * guarda en ninguna parte**: ni en la cookie, ni en la base, ni en el log. Lo
 * que sobrevive es el resultado, que no es canjeable por nada.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LOS CUATRO PASOS, EN ESTE ORDEN
 * ─────────────────────────────────────────────────────────────────────────
 *
 *  1. Comprobar el `state` contra la cookie que puso `/portal/login`.
 *  2. Canjear el código y **verificar** el ID token (firma, `iss`, `aud`,
 *     `nonce`).
 *  3. Traducir el correo verificado a una ficha del padrón **del banco**.
 *  4. `POST /v1/b2b/links` de te-api, con el ID token en crudo.
 *
 * Ningún paso se salta si falla el anterior, y el fallo se cuenta en la
 * pantalla en vez de en un 500: quien está delante es un titular, no un
 * integrador.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const home = new URL('/portal', getPortalBaseUrl());
  const params = request.nextUrl.searchParams;

  // La petición de autorización se lee y se borra SIEMPRE, aunque Logto haya
  // devuelto un error: dejarla viva permitiría reproducir el `state`.
  const authorizationRequest = await takeAuthorizationRequest();

  const logtoError = params.get('error');
  if (logtoError !== null) {
    // `error_description` de Logto no se pinta: puede nombrar el `client_id`.
    console.error('[portal] Logto devolvió error en el callback', {
      error: logtoError,
      description: params.get('error_description')?.slice(0, 300),
    });
    home.searchParams.set('error', 'logto');
    return NextResponse.redirect(home);
  }

  const code = params.get('code');
  const state = params.get('state');

  if (authorizationRequest === null || code === null || state === null) {
    home.searchParams.set('error', 'sesion-perdida');
    return NextResponse.redirect(home);
  }

  // El `state` se compara entero. No hay caso «empieza por» ni «contiene»: un
  // `state` que no es exactamente el que se mandó es una respuesta que no es a
  // esta petición.
  if (state !== authorizationRequest.state) {
    home.searchParams.set('error', 'state');
    return NextResponse.redirect(home);
  }

  const organization = getActiveOrganization();
  if (organization.portal === undefined) {
    home.searchParams.set('error', 'sin-portal');
    return NextResponse.redirect(home);
  }

  let identity;
  try {
    identity = await exchangeCode(organization.portal, code, authorizationRequest);
  } catch (error) {
    // Un `PortalLoginError` ya trae el motivo recortado; cualquier otra cosa es
    // un fallo de red o un cambio de forma en la respuesta de Logto. Los dos
    // salen igual en pantalla —el detalle va al log— porque lo que el titular
    // puede hacer es el mismo en los dos casos: volver a intentarlo.
    console.error(
      '[portal] el canje del código no completó',
      error instanceof PortalLoginError ? error.message : error,
    );
    home.searchParams.set('error', 'canje');
    return NextResponse.redirect(home);
  }

  // ── Paso 3 · quién es esta persona EN EL BANCO ─────────────────────────
  //
  // La traducción «correo verificado → ficha del padrón» es del banco y no sale
  // de aquí. te-api nunca ve el correo: recibe el `external_id`, y ni siquiera
  // en claro (lo convierte en huella antes de guardarlo).
  const customer =
    identity.email === null ? null : await findCustomerByEmail(organization.orgId, identity.email);

  let outcome: LinkOutcome;

  if (customer === null) {
    outcome = {
      ok: false,
      message:
        identity.email === null
          ? 'Logto no nos ha dado tu correo, así que no podemos encontrar tu ficha de cliente.'
          : 'No encontramos ninguna ficha de cliente con ese correo en Banco Demo.',
    };
  } else {
    try {
      const link = await linkCustomer(organization, {
        subjectReference: customer.externalId,
        idToken: identity.idToken,
        ...(organization.portal.linkType === undefined
          ? {}
          : { type: organization.portal.linkType }),
      });
      outcome = { ok: true, linkId: link.linkId, replaced: link.replaced };
    } catch (error) {
      if (error instanceof TeApiError) {
        outcome = {
          ok: false,
          message: describeTeApiError(error, 'link'),
          ...(error.requestId === undefined ? {} : { requestId: error.requestId }),
        };
      } else {
        console.error('[portal] el vínculo falló por algo que no es te-api', error);
        outcome = { ok: false, message: 'No hemos podido hablar con TripleEnable ahora mismo.' };
      }
    }
  }

  await saveSession({
    logtoUserId: identity.logtoUserId,
    email: identity.email,
    displayName: identity.name,
    customerExternalId: customer?.externalId ?? null,
    outcome,
    linkedAt: new Date().toISOString(),
  });

  return NextResponse.redirect(home);
}
