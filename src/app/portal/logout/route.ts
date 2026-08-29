import { NextResponse } from 'next/server';

import { buildEndSessionUrl } from '@/lib/portal-oidc';
import { clearSession } from '@/lib/portal-session';

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
  return NextResponse.redirect(buildEndSessionUrl());
}
