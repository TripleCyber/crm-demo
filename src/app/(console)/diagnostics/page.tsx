import Link from 'next/link';

import { LOCALE_NAMES } from '@/i18n/config';
import { getTranslator } from '@/i18n/server';
import type { Translator } from '@/i18n/translate';
import { monogramOf } from '@/lib/brand';
import { query } from '@/lib/db';
import { didWebOf } from '@/lib/did-document';
import { formatTimestamp } from '@/lib/format';
import { getEmployeeSession } from '@/lib/session';
import { describeTeApiError, fetchB2bOrganization, TeApiError } from '@/lib/te-api';
import { countWebhookEvents, type WebhookEventTally } from '@/lib/webhook-events';

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
 * decía «se declaran en `CRM_OFFICIAL_NUMBERS`»— y ahí no sirven
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
  const t = await getTranslator();
  const session = await getEmployeeSession().catch((error: unknown) => error as Error);

  if (session instanceof Error) {
    return (
      <>
        <header className="page-head">
          <div>
            <p className="eyebrow">{t('diagnostics.eyebrow')}</p>
            <h1>{t('diagnostics.title')}</h1>
          </div>
        </header>
        <p className="alert">{t('diagnostics.incomplete', { reason: session.message })}</p>
      </>
    );
  }

  let organization: Awaited<ReturnType<typeof fetchB2bOrganization>> | undefined;
  let failure: string | undefined;

  // La base se comprueba desde que las pantallas de atención dejaron de enseñar
  // el mensaje crudo del error y mandan aquí a por el detalle. Si esta pantalla
  // no supiera contestar por la base, «el detalle está en Diagnóstico» sería
  // una frase que no se cumple, y un aviso no sustituye a la comprobación.
  const database = await checkDatabase(t, session.organization.orgId);

  // El recuento de webhooks va aparte del `checkDatabase` de arriba porque
  // fallan por cosas distintas: aquélla contesta «¿hay base y migraciones?» y
  // ésta puede fallar sola si `007_webhook_event` no está aplicada. Se traga el
  // error y se enseña como «no se sabe» — una pantalla de diagnóstico que se cae
  // por no poder contar es la que menos puede caerse.
  const webhooks: WebhookEventTally | undefined = await countWebhookEvents(
    session.organization.orgId,
  ).catch(() => undefined);

  try {
    organization = await fetchB2bOrganization(session.organization);
  } catch (error) {
    failure =
      error instanceof TeApiError
        ? describeTeApiError(t, error)
        : error instanceof Error
          ? error.message
          : t('common.unknownFailure');
  }

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">{t('diagnostics.eyebrow')}</p>
          <h1>{t('diagnostics.title')}</h1>
          <p className="page-sub">{t('diagnostics.subtitle')}</p>
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
        <h2>{t('diagnostics.wiringTitle')}</h2>
        <dl className="facts">
          <dt>{t('diagnostics.whoCalls')}</dt>
          <dd>{t('diagnostics.whoCallsDetail')}</dd>
          <dt>{t('diagnostics.issuing')}</dt>
          <dd>{t.rich('diagnostics.issuingDetail')}</dd>
          <dt>{t('diagnostics.verifying')}</dt>
          <dd>{t.rich('diagnostics.verifyingDetail')}</dd>
          <dt>{t('diagnostics.waking')}</dt>
          <dd>{t.rich('diagnostics.wakingDetail')}</dd>
          <dt>{t('diagnostics.following')}</dt>
          <dd>{t.rich('diagnostics.followingDetail')}</dd>
          <dt>{t('diagnostics.roster')}</dt>
          <dd>{t('diagnostics.rosterDetail')}</dd>
        </dl>
      </div>

      <div className="card">
        <h2>{t('diagnostics.localConfigTitle')}</h2>
        <dl className="facts">
          <dt>{t('diagnostics.organization')}</dt>
          <dd className="mono">{session.organization.orgId}</dd>
          <dt>{t('diagnostics.name')}</dt>
          <dd>{session.organization.displayName}</dd>
          {/*
            El dominio, porque es la IDENTIDAD de esta instalación: de él sale el
            `did:web` con el que se firma todo lo que emite. Es obligatorio desde
            que una instalación sirve a una sola empresa —sin él no se arranca—,
            así que aquí ya no hay rama de «sin declarar».
          */}
          <dt>{t('diagnostics.domain')}</dt>
          <dd className="mono">{session.organization.domain}</dd>
          <dt>{t('diagnostics.didPublished')}</dt>
          <dd className="mono">{didWebOf(session.organization.domain)}</dd>
          <dt>{t('diagnostics.officialNumbers')}</dt>
          <dd>
            {session.organization.officialNumbers.length === 0 ? (
              <span className="warn">
                {t('diagnostics.officialNumbersNone')}
                <span className="mono">CRM_OFFICIAL_NUMBERS</span>
              </span>
            ) : (
              <span className="mono">{session.organization.officialNumbers.join(' · ')}</span>
            )}
          </dd>
          {/*
            La marca, porque es lo único de la configuración de una organización
            que se ve **sin poder leerse**: si la barra sale azul cuando tenía
            que salir violeta, lo que hay que saber es si la variable llegó o
            no. Los colores se pintan además de escribirse — un `#5b3ea6` no le
            dice a nadie qué color es.

            No es un secreto: es el color de la pantalla que se está mirando.
          */}
          <dt>{t('diagnostics.brand')}</dt>
          <dd>
            {session.organization.brand === undefined ? (
              <span className="warn">
                {t('diagnostics.brandNone')}
                <span className="mono">CRM_BRAND_COLOR</span> y{' '}
                <span className="mono">CRM_BRAND_SURFACE</span>
              </span>
            ) : (
              <span className="mono">
                <span className="brand-swatch" style={{ background: 'var(--navy)' }} />
                {session.organization.brand.accent}{' '}
                <span className="brand-swatch" style={{ background: 'var(--navy-deep)' }} />
                {session.organization.brand.surface} · {monogramOf(session.organization)}
              </span>
            )}
          </dd>
          <dt>{t('diagnostics.issuerBase')}</dt>
          <dd className="mono">{session.organization.issuerUrl}</dd>
          <dt>{t('diagnostics.verifierBase')}</dt>
          <dd className="mono">{session.organization.verifierUrl}</dd>
          <dt>{t('diagnostics.customerPortal')}</dt>
          <dd>
            {session.organization.portal === undefined ? (
              <span className="warn">
                {t('diagnostics.portalUndeclared')}
                <span className="mono">CRM_PORTAL_CLIENT_ID</span> y{' '}
                <span className="mono">CRM_PORTAL_CLIENT_SECRET</span>
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

        La pregunta se contestaba con el dominio de la petición, porque un
        despliegue servía a cuatro empresas. Ahora se contesta con el entorno del
        proceso, y sigue mereciendo su tarjeta: quien despliega la segunda
        instalación tiene que leer en algún sitio que **es otra publicación de la
        misma imagen** y no una organización más dentro de ésta.
      */}
      <div className="card">
        <h2>{t('diagnostics.orgChoiceTitle')}</h2>
        <dl className="facts">
          <dt>{t('diagnostics.whoChooses')}</dt>
          <dd>{t.rich('diagnostics.whoChoosesDetail')}</dd>
          <dt>{t('diagnostics.twoTenants')}</dt>
          <dd>{t.rich('diagnostics.twoTenantsDetail')}</dd>
          <dt>{t('diagnostics.didNoFallback')}</dt>
          <dd>{t.rich('diagnostics.didNoFallbackDetail')}</dd>
        </dl>
      </div>

      {/*
        ═══════════════════════════════════════════════════════════════════════
         EL WEBHOOK, QUE ES LO ÚNICO QUE ENTRA EN VEZ DE SALIR
        ═══════════════════════════════════════════════════════════════════════

        Todo lo demás de esta pantalla comprueba llamadas que hace el CRM. Ésta
        es la única dirección en la que TripleEnable llama al CRM, así que es la
        única que **no se puede comprobar desde aquí**: la prueba real es un
        evento de prueba lanzado desde la consola. Lo que sí se puede decir es
        qué dirección hay que pegar allí, si hay secreto con el que comprobar la
        firma, y cuántas entregas han llegado y cuántas se han rechazado.

        El número de rechazadas es el que importa y por eso está aquí y no sólo
        en la pantalla de eventos: si no es cero, o alguien está inventando
        eventos o el secreto se rotó y aquí no se actualizó.
      */}
      <div className="card">
        <h2>{t('diagnostics.webhookTitle')}</h2>
        <dl className="facts">
          <dt>{t('diagnostics.webhookUrl')}</dt>
          <dd>
            <span className="mono">
              https://{session.organization.domain}/api/webhooks/te-api
            </span>
            <span className="sub">{t('diagnostics.webhookUrlNote')}</span>
          </dd>
          <dt>{t('diagnostics.webhookSecret')}</dt>
          <dd>
            {session.organization.webhookSecret === undefined ? (
              <span className="warn">
                {t('diagnostics.webhookSecretMissing')}
                <span className="mono">CRM_WEBHOOK_SECRET</span>
              </span>
            ) : (
              // Que LO HAY, nunca cuál. Esta pantalla acaba en capturas.
              t('diagnostics.webhookSecretSet')
            )}
          </dd>
          <dt>{t('diagnostics.webhookReceived')}</dt>
          <dd>
            {webhooks === undefined ? (
              <span className="warn">{t('diagnostics.connectionUnknownError')}</span>
            ) : webhooks.total === 0 ? (
              t('diagnostics.webhookNever')
            ) : (
              <>
                <span className={webhooks.rejected > 0 ? 'warn' : undefined}>
                  {t('diagnostics.webhookTally', {
                    total: webhooks.total,
                    rejected: webhooks.rejected,
                  })}
                </span>
                {webhooks.lastReceivedAt !== null && (
                  <span className="sub">
                    {t('diagnostics.webhookLast', {
                      time: formatTimestamp(webhooks.lastReceivedAt, t.locale),
                    })}
                  </span>
                )}
              </>
            )}
          </dd>
        </dl>
        <p style={{ marginBottom: 0 }}>
          <Link href="/events">{t('diagnostics.webhookLink')}</Link>
        </p>
      </div>

      {/*
        El idioma se explica aquí y no en la barra, por la misma regla que el
        dominio: quien pulsa el selector no necesita saber dónde vive esa
        elección, y quien despliega sí — sobre todo para saber que NO hay que
        reconstruir la imagen ni tocar el entorno para cambiarlo.
      */}
      <div className="card">
        <h2>{t('diagnostics.localeTitle')}</h2>
        <dl className="facts">
          <dt>{t('diagnostics.localeChosenBy')}</dt>
          <dd>{t.rich('diagnostics.localeChosenByDetail')}</dd>
          <dt>{t('diagnostics.localeActive')}</dt>
          <dd>
            <span className="mono">{t.locale}</span> · {LOCALE_NAMES[t.locale]}
          </dd>
          <dt>{t('diagnostics.localeFallback')}</dt>
          <dd>{t('diagnostics.localeFallbackDetail')}</dd>
        </dl>
      </div>

      <div className="card">
        <h2>{t('diagnostics.databaseTitle')}</h2>
        <dl className="facts">
          <dt>{t('diagnostics.connection')}</dt>
          <dd>
            {database.ok ? (
              t('diagnostics.connectionOk')
            ) : (
              // El mensaje crudo, aquí sí: nombra la tabla o la variable que
              // falta y lo lee quien puede ponerla. `DATABASE_URL` no se pinta
              // —lleva la contraseña dentro—, sólo lo que contestó Postgres.
              <span className="warn">{database.error}</span>
            )}
          </dd>
          {database.ok && (
            <>
              <dt>{t('diagnostics.customerCount')}</dt>
              <dd className="mono">{database.customers}</dd>
            </>
          )}
        </dl>
      </div>

      {failure !== undefined && <p className="alert">{failure}</p>}

      {organization !== undefined && (
        <div className="card">
          <h2>{t('diagnostics.teApiTitle')}</h2>
          <dl className="facts">
            <dt>organizationId</dt>
            <dd className="mono">{organization.organizationId}</dd>
            <dt>legalName</dt>
            <dd>{organization.legalName}</dd>
            <dt>did</dt>
            <dd className="mono">{organization.did}</dd>
            <dt>{t('diagnostics.teApiScopes')}</dt>
            <dd className="mono">{organization.scopes.join(' ') || '—'}</dd>
            <dt>{t('diagnostics.teApiIssuableTypes')}</dt>
            <dd>
              {organization.credentialTypes.length === 0
                ? '—'
                : organization.credentialTypes
                    .map((entry) =>
                      t('diagnostics.teApiTypes', {
                        type: entry.type,
                        days: entry.maxValidityDays,
                      }),
                    )
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
async function checkDatabase(t: Translator, orgId: string): Promise<DatabaseCheck> {
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
      error: error instanceof Error ? error.message : t('diagnostics.connectionUnknownError'),
    };
  }
}
