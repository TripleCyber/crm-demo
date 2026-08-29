import { findCustomer } from '@/lib/customers';
import { getActiveOrganization } from '@/lib/organizations';
import { getRedirectUri } from '@/lib/portal-oidc';
import { getSession, type PortalSession } from '@/lib/portal-session';

/**
 * La pantalla del portal del cliente. Tiene exactamente tres estados:
 *
 *   · **sin entrar** — el botón de «Entrar con TripleEnable», y ya.
 *   · **vinculado** — el `linkId`, la ficha que se ató y qué significa eso.
 *   · **no se pudo** — qué falló, con el `requestId` cuando te-api lo dio.
 *
 * No hay un cuarto estado «entrado pero sin vincular»: el vínculo se pide en el
 * callback, en el mismo salto en que llega el ID token
 * (`./callback/route.ts`), así que quien tiene sesión ya sabe cómo acabó.
 */
export const dynamic = 'force-dynamic';

/** Los motivos que `/portal/login` y `/portal/callback` saben devolver. */
const ERROR_MESSAGES: Record<string, string> = {
  'sin-portal':
    'Este portal no tiene aplicación de Logto configurada todavía. Faltan ' +
    'CRM_ORG_<SLUG>_PORTAL_CLIENT_ID y CRM_ORG_<SLUG>_PORTAL_CLIENT_SECRET.',
  'sesion-perdida':
    'Se perdió el hilo del login. Suele pasar al volver con el botón «atrás» o si la ' +
    'pestaña ha estado abierta mucho rato. Vuelve a empezar.',
  state: 'La respuesta de Logto no corresponde a esta petición de login. Vuelve a empezar.',
  logto: 'Logto no ha completado el login. Vuelve a intentarlo.',
  canje: 'No hemos podido completar el login con TripleEnable. Vuelve a intentarlo.',
};

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawError = params.error;
  const errorKey = typeof rawError === 'string' ? rawError : undefined;

  // La configuración se comprueba aquí ENTERA —organización, aplicación de
  // portal y dirección pública— para poder decir qué falta. `getRedirectUri()`
  // no se usa para nada en esta pantalla: se llama porque es lo que valida
  // `CRM_PORTAL_BASE_URL`, y sin ella `/portal/login` no puede componer el
  // `redirect_uri`. Comprobar sólo la mitad deja el botón activo y manda a la
  // persona a un error de Logto, que es la peor forma de enterarse.
  let configurationProblem: string | null = null;
  try {
    const organization = getActiveOrganization();
    if (organization.portal === undefined) {
      configurationProblem =
        'faltan CRM_ORG_<SLUG>_PORTAL_CLIENT_ID y CRM_ORG_<SLUG>_PORTAL_CLIENT_SECRET';
    } else {
      getRedirectUri();
    }
  } catch (error) {
    // `OrganizationConfigError` y el `Error` de `getPortalBaseUrl()` nombran los
    // dos la variable que falta, así que se enseña el mensaje tal cual. Los dos
    // son `Error`, y por eso no hay dos ramas: es una comprobación que parecía
    // más cuidadosa y sólo era la misma escrita dos veces.
    configurationProblem = error instanceof Error ? error.message : 'configuración incompleta';
  }

  const session = await getSession();

  return (
    <>
      <h1>Tu cuenta de Banco Demo</h1>
      <p className="muted">
        Vincula tu cuenta de Banco Demo con tu identidad de TripleEnable. A partir de ese
        momento podremos avisarte en tu móvil cuando haya que confirmar algo, sin llamarte por
        teléfono y sin pedirte datos por correo.
      </p>

      {configurationProblem !== null && (
        <div className="alert">Portal sin configurar: {configurationProblem}</div>
      )}

      {errorKey !== undefined && (
        <div className="alert">{ERROR_MESSAGES[errorKey] ?? 'Algo no ha salido bien.'}</div>
      )}

      {session === null ? (
        <SignedOut disabled={configurationProblem !== null} />
      ) : (
        <SignedIn session={session} />
      )}
    </>
  );
}

function SignedOut({ disabled }: { disabled: boolean }) {
  return (
    <div className="card">
      <h2>Entra para vincular</h2>
      <p className="muted">
        Te llevamos a TripleEnable para que confirmes que eres tú. Nosotros no vemos tu
        contraseña en ningún momento.
      </p>
      {disabled ? (
        <p className="muted">
          El acceso está deshabilitado porque falta configuración. Mira el aviso de arriba.
        </p>
      ) : (
        // Un enlace y no un formulario: `/portal/login` es idempotente —genera
        // material nuevo y redirige— y así funciona también con JavaScript
        // apagado, que en un portal de banco no es una excentricidad.
        <p>
          <a className="button-link" href="/portal/login">
            Entrar con TripleEnable
          </a>
        </p>
      )}
    </div>
  );
}

async function SignedIn({ session }: { session: PortalSession }) {
  // La ficha se vuelve a leer del padrón en vez de guardarla en la cookie: si
  // el banco corrige un apellido, la pantalla lo enseña corregido sin que el
  // titular tenga que volver a entrar.
  const organization = getActiveOrganization();
  const customer =
    session.customerExternalId === null
      ? null
      : await findCustomer(organization.orgId, session.customerExternalId);

  const { outcome } = session;

  return (
    <>
      <div className={outcome.ok ? 'alert ok' : 'alert'}>
        {outcome.ok
          ? 'Tu cuenta de Banco Demo está vinculada con tu identidad de TripleEnable.'
          : (outcome.message ?? 'No hemos podido completar el vínculo.')}
      </div>

      <div className="card">
        <h2>Quién eres</h2>
        <dl className="facts">
          <dt>Has entrado como</dt>
          <dd>{session.displayName ?? session.email ?? session.logtoUserId}</dd>
          {session.email !== null && (
            <>
              <dt>Correo verificado</dt>
              <dd>{session.email}</dd>
            </>
          )}
          {customer !== null && (
            <>
              <dt>Tu ficha en Banco Demo</dt>
              <dd>
                {customer.givenName} {customer.familyName}{' '}
                <span className="mono">({customer.externalId})</span>
              </dd>
            </>
          )}
          {customer !== null && customer.accountLast4 !== null && (
            <>
              <dt>Cuenta</dt>
              <dd className="mono">•••• {customer.accountLast4}</dd>
            </>
          )}
        </dl>
      </div>

      {outcome.ok && (
        <div className="card">
          <h2>El vínculo</h2>
          <dl className="facts">
            <dt>Referencia</dt>
            <dd className="mono">{outcome.linkId}</dd>
            {/*
              «Confirmado el» y no «Hecho el»: esta fecha es la del último
              login, no la de cuando nació el vínculo. te-api devuelve
              `{ linkId, replaced }` y nada más — la fecha de creación es dato
              del titular y la enseña su cartera, no el portal del banco. Y el
              vínculo es idempotente: entrar otra vez lo confirma, no lo rehace.
              Poner «Hecho el» encima de la fecha de hoy sería mentir con un
              dato que además es fácil de comprobar.
            */}
            <dt>Confirmado el</dt>
            <dd>{new Date(session.linkedAt).toLocaleString('es-ES')}</dd>
            {outcome.replaced === true && (
              <>
                <dt>Vínculo anterior</dt>
                <dd>Sustituido por éste.</dd>
              </>
            )}
          </dl>
          <p className="muted" style={{ marginTop: 16, marginBottom: 0 }}>
            Banco Demo no sabe qué identidad de TripleEnable hay detrás, y TripleEnable no sabe
            que eres cliente nuestro: lo único que existe es esta referencia. Puedes retirarla
            desde tu cartera cuando quieras.
          </p>
        </div>
      )}

      {!outcome.ok && outcome.requestId !== undefined && (
        <div className="card">
          <h2>Para soporte</h2>
          <p className="muted" style={{ margin: 0 }}>
            Si nos llamas, dinos esta referencia:{' '}
            <span className="mono">{outcome.requestId}</span>
          </p>
        </div>
      )}

      <p>
        <a href="/portal/login">Volver a vincular</a> · <a href="/portal/logout">Cerrar sesión</a>
      </p>
    </>
  );
}
