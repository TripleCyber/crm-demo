import { NextResponse } from 'next/server';

import { buildEndSessionUrl } from '@/lib/portal-oidc';
import { clearSession } from '@/lib/portal-session';
import { getOrganization } from '@/lib/organization';

/**
 * `GET /portal/logout` — cierra la sesión del portal **y la de Logto**.
 *
 * Las dos, y no sólo la cookie de aquí: si se borrara sólo la nuestra, el
 * siguiente «Entrar» volvería a entrar solo, sin pedir nada, y el titular que
 * cierra sesión en un ordenador compartido se quedaría convencido de que ha
 * salido. Lo que se ve es lo que tiene que haber pasado.
 *
 * No se manda `id_token_hint`: el ID token no se guarda en ninguna parte (ver
 * `src/lib/portal-session.ts`). Sin él Logto pide confirmación al cerrar, que
 * en un portal de banco tampoco sobra.
 */
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  await clearSession();
  // La organización sale del dominio por el que se entró, igual que en el
  // login: el `post_logout_redirect_uri` tiene que devolver al titular al
  // portal DE SU organización, no al del primero que hubiera declarado.
  return NextResponse.redirect(buildEndSessionUrl(getOrganization()));
}
