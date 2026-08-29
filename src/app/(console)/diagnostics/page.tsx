import { getEmployeeSession } from '@/lib/session';
import { describeTeApiError, fetchB2bOrganization, TeApiError } from '@/lib/te-api';

/**
 * Diagnóstico de la integración: `GET /v1/b2b/organization` y lo que contesta.
 *
 * Es la pantalla que se mira **antes** de emitirle una credencial a nadie. Si
 * responde, están bien las cuatro cosas que pueden estar mal: el secreto M2M,
 * el recurso B2B (`aud`), el scope y el alta de la organización en el padrón de
 * te-api. Si no responde, te-api contesta el mismo 404 para todas ellas, y lo
 * único accionable es el `requestId` — por eso se enseña.
 *
 * Aquí NO se pinta ni el `client_id` ni nada parecido al secreto. La página
 * dice si la costura funciona, no con qué credencial.
 */

export const dynamic = 'force-dynamic';

export default async function DiagnosticsPage() {
  const session = await getEmployeeSession().catch((error: unknown) => error as Error);

  if (session instanceof Error) {
    return (
      <>
        <h1>Diagnóstico</h1>
        <p className="alert">La configuración del CRM está incompleta: {session.message}</p>
      </>
    );
  }

  let organization: Awaited<ReturnType<typeof fetchB2bOrganization>> | undefined;
  let failure: string | undefined;

  try {
    organization = await fetchB2bOrganization(session.organization);
  } catch (error) {
    failure =
      error instanceof TeApiError
        ? describeTeApiError(error)
        : error instanceof Error
          ? error.message
          : 'fallo desconocido';
  }

  return (
    <>
      <h1>Diagnóstico</h1>
      <p className="muted">
        Esta llamada sale del servidor del CRM con el token M2M de la organización. No hay ninguna
        sesión de empleado por medio: borra las cookies y responde igual. Es la condición de F4 §0.
      </p>

      <div className="card">
        <h2>Configuración local</h2>
        <dl className="facts">
          <dt>Organización</dt>
          <dd className="mono">{session.organization.orgId}</dd>
          <dt>Nombre</dt>
          <dd>{session.organization.displayName}</dd>
          <dt>te-api (emisión)</dt>
          <dd className="mono">{session.organization.issuerUrl}</dd>
          <dt>te-api (verificación)</dt>
          <dd className="mono">{session.organization.verifierUrl}</dd>
        </dl>
      </div>

      {failure !== undefined && <p className="alert">{failure}</p>}

      {organization !== undefined && (
        <div className="card">
          <h2>Lo que dice te-api</h2>
          <dl className="facts">
            <dt>organizationId</dt>
            <dd className="mono">{organization.organizationId}</dd>
            <dt>legalName</dt>
            <dd>{organization.legalName}</dd>
            <dt>did</dt>
            <dd className="mono">{organization.did}</dd>
            <dt>scopes del token</dt>
            <dd className="mono">{organization.scopes.join(' ') || '—'}</dd>
            <dt>tipos que puede emitir</dt>
            <dd>
              {organization.credentialTypes.length === 0
                ? '—'
                : organization.credentialTypes
                    .map((entry) => `${entry.type} (máx. ${entry.maxValidityDays} d)`)
                    .join(', ')}
            </dd>
          </dl>
        </div>
      )}
    </>
  );
}
