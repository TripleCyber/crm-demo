import { NextResponse } from 'next/server';

import { buildEndSessionUrl } from '@/lib/portal-oidc';
import { clearSession } from '@/lib/portal-session';
import { requireOrganization } from '@/lib/portal-guard';

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
  // La cookie de aquí ya se ha borrado arriba, así que salir por 503 deja al
  // titular con la sesión local cerrada aunque no se pueda cerrar la de Logto.
  // Es el orden correcto de los dos: lo que se puede hacer, hecho.
  const resolved = await requireOrganization();
  if (!resolved.ok) return resolved.response;
  return NextResponse.redirect(await buildEndSessionUrl(resolved.organization));
}
