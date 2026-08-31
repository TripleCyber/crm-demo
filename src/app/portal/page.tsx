import { getTranslator } from '@/i18n/server';
import type { MessageKey, Translator } from '@/i18n/translate';
import { findPendingOffer } from '@/lib/credential-offers';
import { findCustomer } from '@/lib/customers';
import { getOrganization, type OrganizationConfig } from '@/lib/organization';
import { getRedirectUri } from '@/lib/portal-oidc';
import { getSession, type PortalSession } from '@/lib/portal-session';
import { formatDateTime } from '@/lib/format';

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
 *
 * ## El cuarto canal de entrega vive aquí
 *
 * Cuando el agente emite eligiendo «desde nuestra app», la oferta se queda
 * esperando y esta pantalla la enseña. Es el único de los cuatro canales en el
 * que quien recoge la oferta **está autenticado** al recogerla: el QR lo
 * escanea quien esté delante, el enlace lo abre quien lo tenga y el correo lo
 * lee quien tenga el buzón. Aquí ha habido que pasar por Logto.
 *
 * Lo que sigue sin estar aquí es el **código de un solo uso**. No se guarda y
 * no se enseña: si viajara por el mismo sitio que la oferta dejaría de atar
 * nada. Se dice en voz alta por la llamada, y punto.
 */
export const dynamic = 'force-dynamic';

/**
 * Los motivos que `/portal/login` y `/portal/callback` saben devolver.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  AQUÍ NO SE NOMBRA NI UNA VARIABLE DE ENTORNO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Quien lee esta pantalla es un CLIENTE. `CRM_PORTAL_CLIENT_ID` no le dice qué
 * hacer, le dice que su banco está a medio montar — y además no lo puede
 * arreglar él ni la persona a la que va a llamar. Se le dice qué no
 * funciona y a quién preguntar; el nombre de la variable vive en Diagnóstico,
 * que es la pantalla de quien sí puede ponerla.
 */
const ERROR_MESSAGES: Record<string, MessageKey> = {
  'no-portal': 'portal.errorNoPortal',
  'session-lost': 'portal.errorSessionLost',
  // Estos dos los lee un CLIENTE del banco, no un operador: «Logto» ahí es un
  // nombre de una pieza nuestra que no significa nada para él y que además le
  // dice que su banco depende de algo que no sabe qué es.
  state: 'portal.errorState',
  provider: 'portal.errorProvider',
  exchange: 'portal.errorExchange',
};

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslator();
  const params = await searchParams;
  const rawError = params.error;
  const errorKey = typeof rawError === 'string' ? rawError : undefined;

  // La configuración se comprueba aquí ENTERA —organización, aplicación de
  // portal y dirección pública— para poder decir qué falta. `getRedirectUri()`
  // no se usa para nada en esta pantalla: se llama porque es lo que valida
  // `CRM_PORTAL_BASE_URL`, y sin ella `/portal/login` no puede componer el
  // `redirect_uri`. Comprobar sólo la mitad deja el botón activo y manda a la
  // persona a un error de Logto, que es la peor forma de enterarse.
  let organization: OrganizationConfig | undefined;
  let configurationProblem: string | null = null;
  try {
    organization = await getOrganization();
    if (organization.portal === undefined) {
      configurationProblem = t('portal.errorNoPortal');
    } else {
      getRedirectUri(organization);
    }
  } catch {
    // El mensaje del error NO se enseña, y ése es el cambio: nombra la variable
    // de entorno que falta, y quien lee esta pantalla es un titular. El detalle
    // técnico sigue estando entero en Diagnóstico, que es donde lo mira quien
    // puede arreglarlo.
    configurationProblem = t('portal.errorUnavailable');
  }

  const session = await getSession();

  return (
    <>
      {/*
        El nombre sale de la configuración de esta instalación y no está
        escrito aquí: un rótulo fijo con «Banco Demo» dentro le diría al cliente
        de cualquier otra empresa que despliegue este CRM que ésta es su cuenta
        del banco.

        Sin configuración legible se cae a «tu cuenta», que es verdad sin nombrar
        a nadie: afirmar un nombre de empresa que no se ha podido leer sería
        justo la clase de dato inventado que este proyecto no pone.
      */}
      <h1>
        {organization === undefined
          ? t('portal.titleGeneric')
          : t('portal.title', { organization: organization.displayName })}
      </h1>
      <p className="muted">{t('portal.intro')}</p>

      {configurationProblem !== null && <div className="alert">{configurationProblem}</div>}

      {errorKey !== undefined && (
        <div className="alert">
          {/*
            Un motivo que esta versión no conoce —un enlace viejo, un parámetro
            a mano— cae en la frase genérica en vez de pintar el propio
            parámetro, que es texto que escribe quien llama.
          */}
          {t(ERROR_MESSAGES[errorKey] ?? 'portal.errorGeneric')}
        </div>
      )}

      {/*
        Sin organización resuelta no se pinta la mitad de «ya estás dentro»: esa
        mitad lee el padrón, y sin saber de qué organización es la petición no
        hay padrón que leer. El aviso de arriba ya está puesto, así que la
        pantalla dice qué pasa en vez de quedarse a medias.
      */}
      {session === null || organization === undefined ? (
        <SignedOut t={t} disabled={configurationProblem !== null} />
      ) : (
        <SignedIn t={t} session={session} organization={organization} />
      )}
    </>
  );
}

function SignedOut({ t, disabled }: { t: Translator; disabled: boolean }) {
  return (
    <div className="card">
      <h2>{t('portal.signInTitle')}</h2>
      <p className="muted">{t('portal.signInBody')}</p>
      {disabled ? (
        <p className="muted">{t('portal.signInDisabled')}</p>
      ) : (
        // Un enlace y no un formulario: `/portal/login` es idempotente —genera
        // material nuevo y redirige— y así funciona también con JavaScript
        // apagado, que en un portal de banco no es una excentricidad.
        <p>
          <a className="button-link" href="/portal/login">
            {t('portal.signIn')}
          </a>
        </p>
      )}
    </div>
  );
}

async function SignedIn({
  t,
  session,
  organization,
}: {
  t: Translator;
  session: PortalSession;
  // Llega ya resuelta desde arriba y no se vuelve a pedir: si esta mitad de la
  // pantalla resolviera la organización por su cuenta, dos resoluciones del
  // mismo «¿de quién es este portal?» podrían discrepar, y entonces el saludo
  // sería de una organización y la ficha del padrón de otra.
  organization: OrganizationConfig;
}) {
  // La ficha se vuelve a leer del padrón en vez de guardarla en la cookie: si
  // el banco corrige un apellido, la pantalla lo enseña corregido sin que el
  // titular tenga que volver a entrar.
  const customer =
    session.customerExternalId === null
      ? null
      : await findCustomer(organization.orgId, session.customerExternalId);

  // La oferta se busca con la organización Y con el `external_id` que salió del
  // correo verificado del ID token. Ninguna de las dos mitades la elige el
  // navegador, que es lo que impide que alguien pida la oferta de otro.
  const offer =
    customer === null ? null : await findPendingOffer(organization.orgId, customer.externalId);

  const { outcome } = session;

  return (
    <>
      <div className={outcome.ok ? 'alert ok' : 'alert'}>
        {outcome.ok
          ? t('portal.linked', { organization: organization.displayName })
          : t(outcome.messageKey ?? 'portal.linkFailedGeneric', {
              ...outcome.messageValues,
              // La referencia del `requestId` se compone aquí por lo mismo que
              // en `translateTeApiFailure`: la frase la trae el catálogo y el
              // paréntesis del final es siempre el mismo.
              reference:
                outcome.requestId === undefined
                  ? ''
                  : t('errors.teApiReference', { requestId: outcome.requestId }),
            })}
      </div>

      {offer !== null && (
        <div className="card offer">
          <h2>{t('portal.offerTitle')}</h2>
          <p>{t('portal.offerBody')}</p>
          <p>
            <a className="button-link" href={offer.offerUri}>
              {t('portal.offerSave')}
            </a>
          </p>
          <dl className="facts">
            <dt>{t('portal.offerType')}</dt>
            <dd className="mono">{offer.typeKey}</dd>
            <dt>{t('portal.offerExpires')}</dt>
            <dd>{formatDateTime(offer.expiresAt, t.locale)}</dd>
          </dl>
          <p className="muted" style={{ margin: 0 }}>
            {/* Sin decir cuántas cifras: el largo lo elige te-api al crear la
                oferta y esta pantalla no lo recibe. Ver la nota en
                `api/credentials/issue`. */}
            {t.rich('portal.offerPinNote')}
          </p>
        </div>
      )}

      <div className="card">
        <h2>{t('portal.whoTitle')}</h2>
        <dl className="facts">
          <dt>{t('portal.signedInAs')}</dt>
          <dd>{session.displayName ?? session.email ?? session.logtoUserId}</dd>
          {session.email !== null && (
            <>
              <dt>{t('portal.verifiedEmail')}</dt>
              <dd>{session.email}</dd>
            </>
          )}
          {customer !== null && (
            <>
              <dt>{t('portal.yourRecord', { organization: organization.displayName })}</dt>
              <dd>
                {customer.givenName} {customer.familyName}{' '}
                <span className="mono">({customer.externalId})</span>
              </dd>
            </>
          )}
          {customer !== null && customer.accountLast4 !== null && (
            <>
              <dt>{t('portal.account')}</dt>
              <dd className="mono">•••• {customer.accountLast4}</dd>
            </>
          )}
        </dl>
      </div>

      {outcome.ok && (
        <div className="card">
          <h2>{t('portal.linkTitle')}</h2>
          <dl className="facts">
            <dt>{t('portal.linkReference')}</dt>
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
            <dt>{t('portal.linkConfirmedAt')}</dt>
            <dd>{formatDateTime(session.linkedAt, t.locale)}</dd>
            {outcome.replaced === true && (
              <>
                <dt>{t('portal.linkPrevious')}</dt>
                <dd>{t('portal.linkPreviousReplaced')}</dd>
              </>
            )}
          </dl>
          <p className="muted" style={{ marginTop: 16, marginBottom: 0 }}>
            {t('portal.linkNote', { organization: organization.displayName })}
          </p>
        </div>
      )}

      {!outcome.ok && outcome.requestId !== undefined && (
        <div className="card">
          <h2>{t('portal.supportTitle')}</h2>
          <p className="muted" style={{ margin: 0 }}>
            {t('portal.supportBody', { requestId: outcome.requestId })}
          </p>
        </div>
      )}

      <p>
        <a href="/portal/login">{t('portal.relink')}</a> ·{' '}
        <a href="/portal/logout">{t('portal.signOut')}</a>
      </p>
    </>
  );
}
