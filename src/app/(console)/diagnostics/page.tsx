import { query } from '@/lib/db';
import { didWebOf } from '@/lib/did-document';
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
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  Y AQUÍ ES DONDE VIVEN LOS NOMBRES DE LAS VARIABLES DE ENTORNO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Estaban repartidos por las pantallas de atención al cliente —la de emisión
 * decía «se declaran en `CRM_ORG_<SLUG>_OFFICIAL_NUMBERS`»— y ahí no sirven
 * para nada: quien las lee tiene un cliente al teléfono y no puede tocar la
 * configuración del despliegue. Aquí sí sirven, porque esta pantalla la mira
 * quien puede ponerlas.
 *
 * La regla, para el siguiente que añada una pantalla: **el nombre de una
 * variable de entorno se dice en Diagnóstico y en ningún otro sitio.** En las
 * demás se dice qué falta y a quién pedírselo.
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

  // La base se comprueba desde que las pantallas de atención dejaron de enseñar
  // el mensaje crudo del error y mandan aquí a por el detalle. Si esta pantalla
  // no supiera contestar por la base, «el detalle está en Diagnóstico» sería
  // una frase que no se cumple, y un aviso no sustituye a la comprobación.
  const database = await checkDatabase(session.organization.orgId);

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
            Esta organización no tiene verificador ni clave de verificación.
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
          {/*
            El dominio, porque es lo que ELIGE esta organización. Los tres
            dominios los sirve el mismo despliegue, así que «¿por qué veo el
            padrón de éstos?» se contesta aquí y no adivinando.
          */}
          <dt>Dominio</dt>
          <dd className="mono">
            {session.organization.domain ?? (
              <span className="warn">
                sin declarar · falta CRM_ORG_&lt;SLUG&gt;_DOMAIN
              </span>
            )}
          </dd>
          <dt>did:web publicado</dt>
          <dd className="mono">
            {session.organization.domain === undefined ? (
              // Sin dominio no hay documento DID que publicar, y la ruta
              // devuelve 404. Decirlo aquí ahorra el ciclo de depuración de
              // «la cartera rechaza mis credenciales y no sé por qué»: el
              // síntoma en el teléfono es «no podemos verificar quién emite
              // esto», que no se parece a «falta una variable».
              <span className="warn">ninguno · /.well-known/did.json responde 404</span>
            ) : (
              didWebOf(session.organization.domain)
            )}
          </dd>
          <dt>Números oficiales</dt>
          <dd>
            {session.organization.officialNumbers.length === 0 ? (
              <span className="warn">
                ninguno declarado · <span className="mono">CRM_ORG_&lt;SLUG&gt;_OFFICIAL_NUMBERS</span>
              </span>
            ) : (
              <span className="mono">{session.organization.officialNumbers.join(' · ')}</span>
            )}
          </dd>
          <dt>te-api (emisión)</dt>
          <dd className="mono">{session.organization.issuerUrl}</dd>
          <dt>te-api (verificación)</dt>
          <dd className="mono">{session.organization.verifierUrl}</dd>
          <dt>Portal del cliente</dt>
          <dd>
            {session.organization.portal === undefined ? (
              <span className="warn">
                sin aplicación declarada ·{' '}
                <span className="mono">
                  CRM_ORG_&lt;SLUG&gt;_PORTAL_CLIENT_ID
                </span>{' '}
                y{' '}
                <span className="mono">
                  CRM_ORG_&lt;SLUG&gt;_PORTAL_CLIENT_SECRET
                </span>
              </span>
            ) : (
              // El `client_id` del portal sí se enseña, y el M2M no. No es una
              // incoherencia: éste viaja en la URL de autorización de cada
              // login, así que ya lo ve cualquiera que mire la barra del
              // navegador, y es además el `aud` que te-api exige — el valor que
              // hay que cuadrar cuando el vínculo falla con un 403 mudo.
              <span className="mono">{session.organization.portal.clientId}</span>
            )}
          </dd>
        </dl>
      </div>

      {/*
        ═══════════════════════════════════════════════════════════════════════
         DE QUIÉN ES ESTA PANTALLA, Y POR QUÉ
        ═══════════════════════════════════════════════════════════════════════

        Un solo despliegue contesta en los tres dominios, así que «¿por qué veo
        el padrón de esta organización?» es una pregunta legítima y la contesta
        el dominio de la petición. Está escrito aquí para que no haya que
        deducirlo de la barra lateral.
      */}
      <div className="card">
        <h2>Cómo se elige la organización</h2>
        <dl className="facts">
          <dt>Quién elige</dt>
          <dd>
            El dominio por el que entró la petición. Cada organización declara el suyo en{' '}
            <span className="mono">CRM_ORG_&lt;SLUG&gt;_DOMAIN</span>, y un solo despliegue
            contesta en los tres.
          </dd>
          <dt>Si el dominio no es de nadie</dt>
          <dd>
            Se usa <span className="mono">CRM_ACTIVE_ORG_ID</span>, que es una decisión escrita
            por quien despliega. En producción no se pone: sin ella, una dirección que no
            corresponde a ninguna organización lo dice en vez de enseñar el padrón de la primera.
          </dd>
          <dt>El documento DID no tiene respaldo</dt>
          <dd>
            <span className="mono">/.well-known/did.json</span> responde <strong>404</strong> en
            un dominio que no es de ninguna organización. Servir el de otra sería publicar su
            identidad en un dominio que no le corresponde.
          </dd>
        </dl>
      </div>

      <div className="card">
        <h2>La base del CRM</h2>
        <dl className="facts">
          <dt>Conexión</dt>
          <dd>
            {database.ok ? (
              'Responde.'
            ) : (
              // El mensaje crudo, aquí sí: nombra la tabla o la variable que
              // falta y lo lee quien puede ponerla. `DATABASE_URL` no se pinta
              // —lleva la contraseña dentro—, sólo lo que contestó Postgres.
              <span className="warn">{database.error}</span>
            )}
          </dd>
          {database.ok && (
            <>
              <dt>Clientes de esta organización</dt>
              <dd className="mono">{database.customers}</dd>
            </>
          )}
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

/** Lo que se sabe de la base sin enseñar la cadena de conexión. */
interface DatabaseCheck {
  readonly ok: boolean;
  readonly customers: number;
  readonly error: string | undefined;
}

/**
 * Una consulta de verdad, no un `select 1`.
 *
 * Cuenta las filas de `customer` de esta organización porque eso comprueba de
 * paso las dos cosas que fallan de verdad: que las migraciones estén aplicadas
 * —una base conectada pero sin tabla contesta a `select 1` tan campante— y que
 * esta organización tenga padrón. Cero clientes no es un error y se enseña como
 * lo que es: un número.
 */
async function checkDatabase(orgId: string): Promise<DatabaseCheck> {
  try {
    const rows = await query<{ count: string }>(
      'select count(*)::text as count from customer where org_id = $1',
      [orgId],
    );
    return { ok: true, customers: Number(rows[0]?.count ?? '0'), error: undefined };
  } catch (error) {
    return {
      ok: false,
      customers: 0,
      error: error instanceof Error ? error.message : 'la base no responde',
    };
  }
}
