import { CopyValue } from '@/components/CopyValue';
import { SettingsChecks } from '@/components/SettingsChecks';
import { SettingsForm, type SecretState } from '@/components/SettingsForm';
import { getTranslator } from '@/i18n/server';
import { describeConsoleFailure } from '@/lib/console-failures';
import {
  getOrganization,
  normalizeDomain,
  OrganizationConfigError,
  webhookUrlFor,
} from '@/lib/organization';
import { fingerprintOrUndefined } from '@/lib/secret-fingerprint';
import { loadTenantSettings } from '@/lib/tenant-settings';

/**
 * **Los ajustes de esta instalación.** La pantalla que sustituye al `.env`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  POR QUÉ EXISTE: UNA INSTALACIÓN RECIÉN PUBLICADA TIENE QUE PODER
 *  CONFIGURARSE SOLA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * El recorrido que este CRM tiene que poder enseñar es: se publica la
 * aplicación, se dan de alta sus aplicaciones en tenant-admin, y se pegan aquí.
 * Ese recorrido no se puede enseñar si a mitad hay que irse a la caja de
 * variables de entorno del proveedor de hosting y volver a desplegar.
 *
 * Así que la configuración vive en la base (`db/008_tenant_settings.sql`) y se
 * escribe desde aquí. **La regla de quién manda —la base— y qué pinta el entorno
 * —sembrar la primera vez— está escrita entera en `src/lib/tenant-settings.ts`**,
 * y esta pantalla la repite en su cabecera para quien llegue por aquí.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  Y LO PRIMERO QUE ENSEÑA ES SU PROPIA DIRECCIÓN DE WEBHOOK
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Arriba del todo, entera y con botón de copiar, antes que ninguna casilla. No
 * es orden de importancia teórica: es que **es el único dato de esta pantalla
 * que hay que llevarse a otro sitio**. Todo lo demás se pega aquí desde
 * tenant-admin; esto viaja al revés, y si se teclea mal produce el fallo más
 * caro de la integración — te-api entrega en una dirección que no existe, el
 * destino se suspende, y en esta consola no se ve nada: la bandeja de eventos
 * sale vacía, que es indistinguible de «todavía no ha pasado nada».
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  QUIÉN PUEDE ABRIR ESTA PANTALLA HOY, DICHO SIN ADORNOS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **Cualquiera que tenga la dirección.** La consola de agentes no tiene
 * autenticación: `getEmployeeSession()` no lee ninguna cookie ni ningún token —
 * lee la configuración del proceso y unas variables de entorno con el nombre del
 * empleado (`src/lib/session.ts`, que lo dice con estas palabras: «hasta
 * entonces esta consola no está autenticada y no puede publicarse en una URL a
 * la que llegue nadie de fuera»). El portal del cliente **sí** tiene OIDC contra
 * Logto; la consola no. El login de empleado es la casilla de F4a que queda
 * pendiente.
 *
 * Eso vale, con esa advertencia, para una consola que enseña un padrón de
 * clientes de demostración. **No vale igual para un secreto de máquina**: el
 * secreto M2M de esta organización da acceso a `/v1/b2b/`, o sea a **emitir
 * credenciales en nombre de esta empresa**. Quien se lo lleve no ve datos: firma
 * documentos.
 *
 * Lo que se hace con eso, y lo que no:
 *
 *  · **Los secretos se escriben y no se releen.** Ni el M2M, ni el de firma del
 *    webhook, ni el del portal vuelven a salir de este servidor una vez
 *    guardados. Lo que se enseña es su huella —SHA-256 recortado y los cuatro
 *    últimos caracteres—, calculada **igual que en tenant-admin** para poder
 *    compararlas a ojo. Una captura de esta pantalla no contiene ningún secreto.
 *  · **No se inventa aquí un inicio de sesión.** Un login de mentira —una
 *    contraseña en una variable, un token en la URL— es peor que no tener
 *    ninguno: parece que protege y no protege, y quien lo vea dejará de
 *    preguntarse por el asunto. El login de empleado es un trabajo aparte, con
 *    Logto, y tiene su sitio en F4a.
 *  · **La pantalla lo dice.** El aviso de arriba no es letra pequeña: quien abra
 *    esto tiene que leer que la consola no está autenticada antes de decidir
 *    publicar la instalación en una dirección pública.
 *
 * Lo que queda pendiente y no es de este cambio: hasta que exista el login, una
 * instalación con secretos de verdad **no puede quedarse en una URL pública sin
 * nada delante**. Un proxy con contraseña, una lista de direcciones o una red
 * privada son todos suficientes; ninguno lo pone este código.
 */

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const t = await getTranslator();
  const settings = await loadTenantSettings().catch((error: unknown) => error as Error);

  if (settings instanceof Error) {
    // Sin base no hay configuración que enseñar y tampoco hay dónde guardarla.
    // Es el único fallo del que esta pantalla no puede salir sola, y lo que hace
    // falta decir es que se arregla con `DATABASE_URL` y las migraciones.
    return (
      <>
        <header className="page-head">
          <div>
            <p className="eyebrow">{t('settings.eyebrow')}</p>
            <h1>{t('settings.title')}</h1>
          </div>
        </header>
        <p className="alert">
          {t('settings.databaseDown', {
            reason: describeConsoleFailure(t, settings, 'los ajustes no se pudieron leer'),
          })}
        </p>
        <p className="muted">{t('settings.databaseDownNote')}</p>
      </>
    );
  }

  // Se pregunta por la configuración completa **sin dejar que su fallo tumbe la
  // pantalla**: el estado normal de una instalación recién publicada es
  // justamente que falte algo, y la pantalla que lo arregla no puede ser la que
  // se cae por ello.
  let missing: readonly string[] = [];
  let configured = false;
  try {
    await getOrganization();
    configured = true;
  } catch (error) {
    if (error instanceof OrganizationConfigError) missing = error.missing;
    else throw error;
  }

  // La dirección del webhook depende sólo del dominio, así que se puede enseñar
  // aunque el resto esté a medias — y ahí es justamente donde hace falta, porque
  // registrarla en tenant-admin es lo que devuelve el secreto que falta.
  const domain = normalizeDomain(settings.domain);
  const webhookUrl = domain === null ? undefined : webhookUrlFor(domain);

  const secretState = (value: string | undefined): SecretState => {
    const fingerprint = fingerprintOrUndefined(value);
    return fingerprint === undefined
      ? { present: false }
      : { present: true, digest: fingerprint.digest, hint: fingerprint.hint };
  };

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">{t('settings.eyebrow')}</p>
          <h1>{t('settings.title')}</h1>
          <p className="page-sub">{t('settings.subtitle')}</p>
        </div>
      </header>

      {/*
        El estado, arriba y en una frase. Recién desplegada, esta pantalla es la
        primera que se abre y lo que hace falta saber es qué falta — no un
        formulario de veinte casillas sin decir cuáles son las que impiden que
        esto funcione.
      */}
      {configured ? (
        <p className="alert ok">{t('settings.stateConfigured')}</p>
      ) : (
        <p className="alert warn">
          {t('settings.stateIncomplete', {
            // `t.optional` porque la clave se compone con el nombre del campo
            // que devuelve `OrganizationConfigError`, y una clave compuesta en
            // ejecución no puede estar en el tipo. Sin rótulo cae al nombre del
            // campo, que es feo pero verdad — nunca se pinta el nombre de la
            // clave.
            fields: missing
              .map((field) => t.optional(`settings.missing.${field}`) ?? field)
              .join(', '),
          })}
        </p>
      )}

      {/*
        ═══════════════════════════════════════════════════════════════════════
         LA DIRECCIÓN DEL WEBHOOK, LO PRIMERO Y ENTERA
        ═══════════════════════════════════════════════════════════════════════

        Es el único dato de esta pantalla que hay que llevarse a otro sitio. Ver
        la cabecera del fichero.
      */}
      <div className="card">
        <h2>{t('settings.webhookUrlTitle')}</h2>
        {webhookUrl === undefined ? (
          <p className="alert warn">{t('settings.webhookUrlNoDomain')}</p>
        ) : (
          <>
            <CopyValue value={webhookUrl} />
            <p className="muted" style={{ marginBottom: 0 }}>
              {t.rich('settings.webhookUrlNote')}
            </p>
          </>
        )}
      </div>

      {/*
        De dónde salen estos valores. Va antes del formulario y no después,
        porque quien vea sus casillas ya rellenas sin haberlas escrito tiene que
        saber **por qué** están así y, sobre todo, que cambiar la variable de
        entorno ya no hace nada.
      */}
      <div className="card">
        <h2>{t('settings.sourceTitle')}</h2>
        <dl className="facts">
          <dt>{t('settings.sourceRule')}</dt>
          <dd>{t.rich('settings.sourceRuleDetail')}</dd>
          <dt>{t('settings.sourceEnv')}</dt>
          <dd>
            {settings.seededFromEnv
              ? t.rich('settings.sourceEnvSeeded')
              : t.rich('settings.sourceEnvIgnored')}
          </dd>
          <dt>{t('settings.sourceRequired')}</dt>
          <dd>{t.rich('settings.sourceRequiredDetail')}</dd>
        </dl>
      </div>

      {/*
        El aviso de que esta pantalla no está detrás de ningún login. No es letra
        pequeña y no va plegado: quien abra esto tiene que leerlo antes de
        decidir publicar la instalación en una dirección pública. El porqué
        completo está en la cabecera de este fichero.
      */}
      <p className="alert warn">{t.rich('settings.noAuthWarning')}</p>

      <SettingsForm
        values={{
          orgId: settings.orgId ?? '',
          displayName: settings.displayName ?? '',
          domain: settings.domain ?? '',
          m2mClientId: settings.m2mClientId ?? '',
          referenceClaim: settings.referenceClaim ?? '',
          officialNumbers: settings.officialNumbers.join(', '),
          brandAccent: settings.brandAccent ?? '',
          brandSurface: settings.brandSurface ?? '',
          brandMonogram: settings.brandMonogram ?? '',
          portalClientId: settings.portalClientId ?? '',
          portalLinkType: settings.portalLinkType ?? '',
          portalBaseUrl: settings.portalBaseUrl ?? '',
          logtoEndpoint: settings.logtoEndpoint,
          teApiBaseUrl: settings.teApiBaseUrl,
          b2bResource: settings.b2bResource,
          b2bScope: settings.b2bScope,
        }}
        m2mSecret={secretState(settings.m2mSecret)}
        webhookSecret={secretState(settings.webhookSecret)}
        portalClientSecret={secretState(settings.portalClientSecret)}
      />

      <SettingsChecks />
    </>
  );
}
