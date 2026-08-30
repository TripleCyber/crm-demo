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
        <header className="page-head">
          <div>
            <p className="eyebrow">Integración</p>
            <h1>Diagnóstico</h1>
          </div>
        </header>
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
      <header className="page-head">
        <div>
          <p className="eyebrow">Integración</p>
          <h1>Diagnóstico</h1>
          <p className="page-sub">
            Esta llamada sale del servidor del CRM con el token M2M de la organización. No hay
            ninguna sesión de empleado por medio: borra las cookies y responde igual.
          </p>
        </div>
      </header>

      {/*
        ═══════════════════════════════════════════════════════════════════════
         AQUÍ VIVE LA COCINA, Y POR ESO EXISTE ESTA PANTALLA
        ═══════════════════════════════════════════════════════════════════════

        Las pantallas de atención al cliente las mira quien decide comprar la
        integración, y ahí la garantía **se afirma**. El mecanismo —quién llama
        a quién, con qué credencial y cada cuánto— está aquí y en los «ver el
        detalle técnico» de cada pantalla.

        No es esconderlo: es que ningún ingeniero del banco pueda decir que se
        le oculta algo **y** que ningún director tenga que leer una ruta HTTP
        para entender qué compra. Las dos cosas a la vez, que era el encargo.
      */}
      <div className="card">
        <h2>Cómo habla esta consola con TripleEnable</h2>
        <dl className="facts">
          <dt>Quién llama</dt>
          <dd>
            El servidor de este CRM, nunca el navegador del agente. Ni el token M2M ni el secreto
            con el que se pide bajan al puesto: se comprueba abriendo la pestaña de red.
          </dd>
          <dt>Emitir</dt>
          <dd>
            <span className="mono">POST /v1/b2b/credentials</span>. Los claims los compone
            este servidor leyendo la ficha del padrón; del navegador sólo llega el identificador
            del cliente.
          </dd>
          <dt>Verificar</dt>
          <dd>
            <span className="mono">POST /v1/b2b/presentations</span> abre la sesión en el
            verificador de TripleEnable y devuelve el enlace <span className="mono">OID4VP</span>.
            Este banco no tiene verificador ni clave de verificación.
          </dd>
          <dt>Avisar al móvil</dt>
          <dd>
            <span className="mono">POST /v1/b2b/wakeups</span>. La respuesta es la misma tenga
            cartera el titular o no —es deliberado: si distinguiera, serviría para averiguar quién
            tiene la app probando identificadores—, así que no confirma que haya sonado nada.
          </dd>
          <dt>Seguir una verificación</dt>
          <dd>
            La pantalla de la ceremonia sondea este mismo servidor cada 3 s y es él quien consulta{' '}
            <span className="mono">GET /v1/b2b/presentations/:id</span>. Tres segundos y no uno
            porque la puerta B2B lleva un cubo de tasa por organización compartido con la emisión.
          </dd>
          <dt>El padrón de clientes</dt>
          <dd>
            No sale de aquí. Vive en la base de este CRM y ni te-api ni Logto la leen nunca; lo
            único que viaja de un cliente es lo que se firma dentro de su credencial.
          </dd>
        </dl>
      </div>

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
