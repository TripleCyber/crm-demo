import 'server-only';

/**
 * El mapa `orgId → { m2mClientId, m2mSecret, issuerUrl, verifierUrl }`.
 *
 * ## Por qué un mapa y no cuatro variables sueltas
 *
 * Hoy Banco Demo es el único inquilino, y con cuatro variables planas
 * (`CRM_M2M_CLIENT_ID`, …) esto funcionaría igual. El día que entre el segundo
 * banco, esas cuatro variables hay que convertirlas en un mapa y **cada sitio
 * que las lea hay que reescribirlo**. Nace ya como mapa para que añadir el
 * segundo inquilino sea añadir cinco variables de entorno y nada más.
 *
 * ## Cómo se declara una organización
 *
 * Por prefijo, con un *slug* en mayúsculas y sin guiones bajos:
 *
 *     CRM_ORG_BANCODEMO_ID=ww51qgtvpc9h
 *     CRM_ORG_BANCODEMO_NAME=Banco Demo, S.A.
 *     CRM_ORG_BANCODEMO_M2M_CLIENT_ID=<app M2M de esa organización>
 *     CRM_ORG_BANCODEMO_M2M_SECRET=<su secreto>
 *     CRM_ORG_BANCODEMO_ISSUER_URL=https://te-api.idp.tripleenable.com
 *     CRM_ORG_BANCODEMO_VERIFIER_URL=https://te-api.idp.tripleenable.com
 *
 * El slug **no puede llevar guion bajo** y eso no es capricho: el descubrimiento
 * busca las claves que terminan en `_ID`, y con guiones bajos permitidos
 * `CRM_ORG_BANCODEMO_M2M_CLIENT_ID` se leería como una organización llamada
 * `BANCODEMO_M2M_CLIENT`. Con el juego de caracteres cerrado a `[A-Z0-9]`, esa
 * clave sencillamente no encaja.
 *
 * ## `issuerUrl` y `verifierUrl` son de te-api. NUNCA de walt.id
 *
 * Los nombres vienen del contrato de F4a y son los que hay que respetar, pero
 * lo que va dentro es **la base de te-api** que emite (F4b) y la que verifica
 * (F4c) para esa organización. El CRM no habla con walt.id jamás: el emisor no
 * tiene autenticación ninguna y publica las claves privadas de sus perfiles, y
 * lo único que lo protege es no tener dominio. Todo lo que este CRM necesita
 * sale de `/v1/b2b/` de te-api.
 *
 * Están separados porque son dos capacidades distintas y no tienen por qué
 * vivir en el mismo despliegue el día que haya una región aparte; hoy, en el
 * `.env.example`, las dos apuntan a la misma URL.
 *
 * ## Este fichero no puede acabar en el navegador
 *
 * `import 'server-only'` convierte en **error de compilación** que un
 * componente de cliente lo importe, aunque sea por una constante inofensiva.
 * Es la línea que hace comprobable el requisito de auditoría «ni un secreto en
 * el navegador»: no depende de que nadie se acuerde.
 */

export interface OrganizationConfig {
  /** El `organization_id` de Logto. Es la clave del mapa. */
  readonly orgId: string;
  /** Nombre para la interfaz. El legal de verdad lo dice te-api en `/organization`. */
  readonly displayName: string;
  /** La aplicación M2M de ESTA organización. Sólo servidor. */
  readonly m2mClientId: string;
  /** Su secreto. Sólo servidor, y no se escribe en ningún log. */
  readonly m2mSecret: string;
  /** Base de te-api para emitir. Ver arriba: te-api, no walt.id. */
  readonly issuerUrl: string;
  /** Base de te-api para verificar (F4c). Ver arriba: te-api, no walt.id. */
  readonly verifierUrl: string;
  /**
   * F2 · La aplicación OIDC del **portal de clientes** de esta organización.
   *
   * `undefined` = esta organización no tiene portal declarado, y entonces
   * `/portal` lo dice en pantalla en vez de romperse a mitad del login.
   *
   * **No es la aplicación M2M de arriba y no puede serlo.** La M2M autentica al
   * servidor del CRM contra te-api; ésta autentica a una **persona** contra
   * Logto. Su `client_id` es además el `aud` que te-api exige en el ID token
   * (`te.partner_org.portal_client_id`), así que compartirlas haría que el
   * mismo identificador significara dos cosas distintas.
   */
  readonly portal: PortalAppConfig | undefined;
}

/** La aplicación OIDC del portal de clientes: *traditional web*, con secreto. */
export interface PortalAppConfig {
  readonly clientId: string;
  /** Sólo servidor. El canje del código va con `client_secret_basic`. */
  readonly clientSecret: string;
  /**
   * El `type` que el portal declara al vincular (`cliente`, `empleado`, …).
   *
   * Opcional en te-api y opcional aquí: el vínculo nace del login, no de la
   * credencial, y exigirlo obligaría a emitir antes de poder vincular. Se pone
   * cuando el portal sirve a un solo tipo de titular —el caso de un portal de
   * clientes— porque entonces es lo que la cartera enseña en la lista de
   * vínculos, y «Banco Demo · cliente» se lee mejor que «Banco Demo».
   *
   * Tiene que ser un `type_key` del padrón de **esa** organización en te-api, o
   * la llamada sale con `400 invalid_request` y el vínculo no se crea.
   */
  readonly linkType: string | undefined;
}

/** Lo que es común a todas las organizaciones: hay un solo Logto. */
export interface LogtoConfig {
  /** `https://auth.idp.tripleenable.com` — el emisor de los tokens M2M. */
  readonly endpoint: string;
  /** El indicador del recurso B2B. Es el `aud` que te-api exige. */
  readonly b2bResource: string;
  /**
   * Los scopes que se le piden a Logto, separados por espacios.
   *
   * Se piden explícitos porque **Logto no los da por defecto**, y además
   * **recorta en silencio** lo que el rol no tenga concedido: si pides dos y el
   * rol sólo tiene uno, el token sale con uno y no hay error. Por eso el sitio
   * donde se comprueba que esto funciona es el `scope` del token, no la consola.
   */
  readonly b2bScope: string;
}

/** Falta una variable o está vacía. El mensaje nombra la variable, nunca el valor. */
export class OrganizationConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrganizationConfigError';
  }
}

const ORG_KEY_PATTERN = /^CRM_ORG_([A-Z0-9]+)_ID$/;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    throw new OrganizationConfigError(`falta la variable de entorno ${name}`);
  }
  return value.trim();
}

function readSlug(slug: string): OrganizationConfig {
  const prefix = `CRM_ORG_${slug}`;
  const orgId = requireEnv(`${prefix}_ID`);
  // La base de te-api es la misma para las dos capacidades en el despliegue de
  // hoy, así que `TE_API_BASE_URL` sirve de respaldo y declarar una
  // organización cuesta cuatro variables en vez de seis.
  const fallbackBase = process.env.TE_API_BASE_URL?.trim();
  const issuerUrl = process.env[`${prefix}_ISSUER_URL`]?.trim() ?? fallbackBase;
  const verifierUrl = process.env[`${prefix}_VERIFIER_URL`]?.trim() ?? fallbackBase;

  if (issuerUrl === undefined || issuerUrl === '') {
    throw new OrganizationConfigError(`falta ${prefix}_ISSUER_URL (o TE_API_BASE_URL)`);
  }
  if (verifierUrl === undefined || verifierUrl === '') {
    throw new OrganizationConfigError(`falta ${prefix}_VERIFIER_URL (o TE_API_BASE_URL)`);
  }

  // El portal es opcional, pero **a medias no**: con el `client_id` y sin el
  // secreto, el login llegaría hasta el canje del código y moriría allí, con
  // la persona ya autenticada y un error que parece de Logto. Declarar uno
  // obliga a declarar el otro, y se ve al arrancar.
  const portalClientId = process.env[`${prefix}_PORTAL_CLIENT_ID`]?.trim();
  const portalClientSecret = process.env[`${prefix}_PORTAL_CLIENT_SECRET`]?.trim();
  if ((portalClientId === undefined || portalClientId === '') !== (portalClientSecret === undefined || portalClientSecret === '')) {
    throw new OrganizationConfigError(
      `${prefix}_PORTAL_CLIENT_ID y ${prefix}_PORTAL_CLIENT_SECRET van juntas o no van`,
    );
  }

  return {
    orgId,
    displayName: process.env[`${prefix}_NAME`]?.trim() ?? orgId,
    m2mClientId: requireEnv(`${prefix}_M2M_CLIENT_ID`),
    m2mSecret: requireEnv(`${prefix}_M2M_SECRET`),
    // Sin barra final: las URLs se componen con plantillas, y
    // `…/v1/b2b` sobre una base con barra doble es un 404 que cuesta ver.
    issuerUrl: issuerUrl.replace(/\/+$/, ''),
    verifierUrl: verifierUrl.replace(/\/+$/, ''),
    portal:
      portalClientId === undefined || portalClientId === '' || portalClientSecret === undefined
        ? undefined
        : {
            clientId: portalClientId,
            clientSecret: portalClientSecret,
            linkType: emptyToUndefined(process.env[`${prefix}_PORTAL_LINK_TYPE`]),
          },
  };
}

function emptyToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? undefined : trimmed;
}

/**
 * El mapa se construye una vez por proceso.
 *
 * En Next.js el módulo se evalúa en cada trabajador, así que memorizarlo no
 * crea estado compartido entre despliegues: es sólo no releer `process.env` en
 * cada petición. Cambiar una variable exige reiniciar, que es justo lo que se
 * quiere de una credencial.
 */
let organizationsCache: ReadonlyMap<string, OrganizationConfig> | undefined;

export function getOrganizations(): ReadonlyMap<string, OrganizationConfig> {
  if (organizationsCache !== undefined) return organizationsCache;

  const organizations = new Map<string, OrganizationConfig>();
  for (const key of Object.keys(process.env)) {
    const match = ORG_KEY_PATTERN.exec(key);
    if (match === null) continue;
    const slug = match[1];
    if (slug === undefined) continue;
    const organization = readSlug(slug);
    // Dos slugs con el mismo `organization_id` es una errata de copiar y pegar
    // que dejaría al CRM emitiendo con el secreto equivocado sin avisar.
    if (organizations.has(organization.orgId)) {
      throw new OrganizationConfigError(
        `dos organizaciones declaradas con el mismo id ${organization.orgId}`,
      );
    }
    organizations.set(organization.orgId, organization);
  }

  if (organizations.size === 0) {
    throw new OrganizationConfigError(
      'no hay ninguna organización declarada: falta CRM_ORG_<SLUG>_ID (ver .env.example)',
    );
  }

  organizationsCache = organizations;
  return organizations;
}

/** La configuración de una organización, o error si no está declarada. */
export function getOrganization(orgId: string): OrganizationConfig {
  const organization = getOrganizations().get(orgId);
  if (organization === undefined) {
    throw new OrganizationConfigError(`la organización ${orgId} no está declarada en el entorno`);
  }
  return organization;
}

/**
 * La organización con la que trabaja este despliegue del CRM.
 *
 * `CRM_ACTIVE_ORG_ID` la elige; si sólo hay una declarada, ésa. **Es una sola
 * función y la usan las dos secciones** —la consola de agentes (`./session.ts`)
 * y el portal del cliente— porque las dos tienen que responder lo mismo: si el
 * portal sirviera a un banco y la consola a otro, el vínculo se pediría para
 * una organización y el cliente saldría del padrón de la otra.
 *
 * Cuando entre el login de empleado, la consola dejará de llamar aquí y sacará
 * la organización del ID token; el portal seguirá usando esto, porque el portal
 * de un banco sirve a **ese** banco y a ninguno más.
 */
export function getActiveOrganization(): OrganizationConfig {
  const requested = process.env.CRM_ACTIVE_ORG_ID?.trim();
  if (requested !== undefined && requested !== '') return getOrganization(requested);

  const organizations = getOrganizations();
  const [only] = [...organizations.values()];
  if (organizations.size !== 1 || only === undefined) {
    throw new OrganizationConfigError(
      'hay varias organizaciones declaradas: fija CRM_ACTIVE_ORG_ID para elegir con cuál se trabaja',
    );
  }
  return only;
}

let logtoCache: LogtoConfig | undefined;

export function getLogtoConfig(): LogtoConfig {
  if (logtoCache !== undefined) return logtoCache;
  logtoCache = {
    endpoint: requireEnv('LOGTO_ENDPOINT').replace(/\/+$/, ''),
    b2bResource: requireEnv('TE_B2B_RESOURCE'),
    // Los dos que existen hoy en el recurso B2B. `verifications:request` se creó
    // el 2026-08-29 para que una integración que sólo verifica por teléfono no
    // necesite permiso para EMITIR credenciales, que es lo que pasaba antes.
    //
    // Van los dos porque este CRM hace las dos cosas. Un partner que sólo
    // verifique se da de alta con un rol propio, sin `credentials:issue`: es lo
    // que hace que «sólo las organizaciones autorizadas emiten» se cumpla en la
    // consola y no sólo en el comentario.
    b2bScope: process.env.TE_B2B_SCOPE?.trim() ?? 'credentials:issue verifications:request',
  };
  return logtoCache;
}
