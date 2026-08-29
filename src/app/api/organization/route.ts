import { NextResponse } from 'next/server';

import { getEmployeeSession } from '@/lib/session';
import { describeTeApiError, fetchB2bOrganization, TeApiError } from '@/lib/te-api';

/**
 * `GET /api/organization` — el «¿quién soy?» de la integración.
 *
 * Es la comprobación que se hace ANTES de emitirle nada a nadie: si esto
 * contesta, el token M2M sale bien de Logto, lleva el recurso B2B y el scope
 * correctos, y la organización está activa en el padrón de te-api. Sin ella, la
 * primera prueba de que la configuración es buena sería una credencial de
 * verdad en la cartera de una persona de verdad, y cada error de configuración
 * habría que revocarlo después.
 *
 * Sirve además para demostrar el requisito de auditoría de F4 §0: se llama con
 * las cookies borradas y responde igual, porque no hay ninguna sesión de
 * empleado por medio.
 *
 *     curl -s http://localhost:3000/api/organization | jq
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    const session = await getEmployeeSession();
    const organization = await fetchB2bOrganization(session.organization);
    return NextResponse.json(organization);
  } catch (error) {
    if (error instanceof TeApiError) {
      return NextResponse.json(
        { error: describeTeApiError(error), requestId: error.requestId },
        { status: error.status === 404 ? 502 : error.status },
      );
    }
    // Aquí caen los fallos de configuración (`OrganizationConfigError`) y los
    // de Logto (`B2bTokenError`). Su mensaje SÍ se enseña: nombra la variable
    // que falta y nunca lleva el secreto dentro.
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'fallo desconocido' },
      { status: 500 },
    );
  }
}
