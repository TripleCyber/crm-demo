import 'server-only';

import { randomBytes } from 'node:crypto';
import { cache } from 'react';

import { query } from './db';

/**
 * **La configuración de esta instalación, guardada en su propia base.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  LA REGLA. SI SÓLO SE LEE UN PÁRRAFO DE ESTE FICHERO, QUE SEA ÉSTE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   1. **La base manda.** En tiempo de ejecución, la única fuente de verdad de
 *      la configuración es la fila de `tenant_settings`. Nada de lo que hay aquí
 *      abajo vuelve a mirar `process.env` una vez que esa fila existe.
 *
 *   2. **El entorno siembra, y sólo una vez.** La primera vez que un proceso no
 *      encuentra la fila, la crea con lo que haya en las variables de entorno
 *      —las mismas de siempre, con los mismos nombres— y la marca
 *      `seeded_from_env`. A partir de ese instante, cambiar una variable y
 *      volver a desplegar **no hace nada**, y la pantalla de ajustes lo dice con
 *      esas palabras.
 *
 *   3. **`DATABASE_URL` es la excepción y no puede no serlo.** Es de donde sale
 *      todo lo demás, así que no puede guardarse dentro de lo que ella misma
 *      abre. Sigue siendo obligatoria en el entorno, y es la única que lo es.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  LO QUE SIGUE VIVIENDO SÓLO EN EL ENTORNO, Y POR QUÉ NO ROMPE LA REGLA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Dos familias de variables no están en esta tabla y se leen del entorno como
 * siempre. **No son una segunda fuente de verdad**, porque no hay ni un valor
 * que se pueda declarar en los dos sitios: son claves distintas, y la regla de
 * arriba dice quién gana para las que sí están aquí.
 *
 *  · **`CRM_AGENT_ACTOR`, `CRM_AGENT_ID`, `CRM_AGENT_NAME`** (`./session.ts`) —
 *    quién es el empleado que atiende. Es el **sustituto provisional del login
 *    de empleado**, que es la casilla de F4a que queda pendiente. Ponerlo en una
 *    pantalla de ajustes lo convertiría en configuración de la empresa, y no lo
 *    es: es de la persona, y cuando entre el login saldrá del token y esas tres
 *    variables desaparecerán. Meterlas aquí sería construir algo para tirarlo.
 *
 *  · **`CRM_TYPE_<CLAVE>_CLAIMS`, `…_DEFAULT_CLAIMS`, `…_LABEL`**
 *    (`./credential-profiles.ts`) — qué atributos lleva cada tipo de credencial.
 *    El juego de claves lo decide el **padrón de te-api**, no esta pantalla: los
 *    nombres de variable se componen con el `type_key` que declara el partner, y
 *    un formulario tendría que descubrirlos llamando a te-api antes de poder
 *    pintarse. Se queda como está hasta que haga falta, y todas tienen valor por
 *    defecto: ninguna es obligatoria para arrancar.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  POR QUÉ SE DEMOTA EL ENTORNO EN VEZ DE QUITARLO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La regla de esta casa es **extender, nunca quitar**. Un despliegue que ya
 * tenía su bloque de variables completo tiene que seguir arrancando exactamente
 * igual el día que se suba esta versión: la primera petición siembra la fila con
 * lo que había, y todo queda donde estaba. Nadie tiene que hacer nada.
 *
 * Lo que **sí** se retira es la ambigüedad. Dos fuentes de verdad sin una regla
 * escrita es peor que cualquiera de las dos sola: alguien cambia el nombre de la
 * organización en Coolify, no pasa nada, y se pierde media tarde en averiguar
 * cuál de los dos sitios se estaba leyendo. Así que la regla existe, es una
 * sola, y está escrita en el sitio donde alguien la va a buscar — aquí, en
 * `.env.example` y en la propia pantalla de ajustes.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  Y POR QUÉ ESTO NO SE CACHEA EN EL PROCESO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `getOrganization()` guardaba su resultado en una constante de módulo, y era lo
 * correcto mientras la configuración fuera el entorno: el entorno no cambia sin
 * reiniciar.
 *
 * Ahora sí cambia, y desde una pantalla. Una caché de proceso significaría que
 * guardar los ajustes surte efecto en el trabajador que atendió el formulario y
 * en ninguno de los otros, que es exactamente el fallo que nadie reproduce.
 * Se lee de la base en cada petición.
 *
 * `cache()` de React lo memoriza **dentro de una misma petición**, que es donde
 * sí hace falta: la disposición, la pantalla y la sesión piden la configuración
 * tres veces para pintar una pantalla, y son tres `select` a una tabla de una
 * fila. Esa memoria muere con la petición, así que no puede quedarse vieja.
 */

/**
 * Los valores por defecto de la plataforma.
 *
 * Son las dos direcciones del producto —te-api y Logto— y el recurso B2B que
 * las une. Están aquí escritas porque **sólo hay dos backends** y no dos por
 * cliente: ponerlas de respaldo es lo que hace verdad que una instalación nueva
 * arranque con `DATABASE_URL` y nada más, que es el encargo.
 *
 * Se pueden cambiar desde la pantalla —un Logto de pruebas es un caso real— y
 * por eso están en la tabla y no como constantes a secas. Lo que no hacen es
 * obligar a declararlas para arrancar.
 */
export const PLATFORM_DEFAULTS = {
  logtoEndpoint: 'https://auth.idp.tripleenable.com',
  teApiBaseUrl: 'https://te-api.idp.tripleenable.com',
  b2bResource: 'https://te-api.idp.tripleenable.com/v1/b2b',
  /**
   * Los scopes que se le piden a Logto.
   *
   * Los tres que este CRM usa. `webhooks:manage` entró el 2026-08-31 con el
   * botón de «mandar un evento de prueba», que llama a
   * `POST /v1/b2b/webhook/test`: te-api lo acepta con `webhooks:manage` y
   * también con `credentials:issue` por un puente explícito, así que una
   * organización con el rol de siempre sigue pudiendo probar.
   *
   * Pedirlo de más no rompe nada y por eso va en el valor por defecto: **Logto
   * recorta en silencio lo que el rol no tenga concedido**, sin error. Por eso
   * el sitio donde se comprueba qué se consiguió es el `scope` del token —lo
   * enseña Diagnóstico— y nunca esta lista.
   */
  b2bScope: 'credentials:issue verifications:request webhooks:manage',
} as const;

/**
 * La fila, tal cual, sin validar.
 *
 * Aquí no se comprueba nada: esto es «lo que hay escrito», y quien decide si
 * eso basta para arrancar es `./organization.ts`. La separación importa porque
 * la pantalla de ajustes necesita poder leer y volver a escribir una
 * configuración **incompleta** — es justo el estado en el que la va a encontrar
 * quien acaba de desplegar.
 */
export interface TenantSettings {
  readonly orgId: string | undefined;
  readonly displayName: string | undefined;
  readonly domain: string | undefined;
  readonly m2mClientId: string | undefined;
  readonly m2mSecret: string | undefined;
  readonly brandAccent: string | undefined;
  readonly brandSurface: string | undefined;
  readonly brandMonogram: string | undefined;
  readonly referenceClaim: string | undefined;
  readonly officialNumbers: readonly string[];
  readonly portalClientId: string | undefined;
  readonly portalClientSecret: string | undefined;
  readonly portalLinkType: string | undefined;
  readonly portalBaseUrl: string | undefined;
  readonly portalCookieSecret: string | undefined;
  readonly webhookSecret: string | undefined;
  readonly logtoEndpoint: string;
  readonly teApiBaseUrl: string;
  readonly b2bResource: string;
  readonly b2bScope: string;
  /** `true` si la fila nació de las variables de entorno y no del formulario. */
  readonly seededFromEnv: boolean;
  readonly updatedAt: string;
}

/**
 * Lo que la pantalla puede cambiar.
 *
 * Los tres secretos van aparte del resto y con un tipo distinto a propósito:
 * `undefined` significa **«no lo toques»** y no «bórralo». Un formulario que
 * enseña la huella y deja el campo en blanco manda el blanco en cada guardado, y
 * con `undefined = borrar` cualquier cambio de color se llevaría por delante el
 * secreto M2M. Para borrarlos de verdad está `clearSecrets`.
 */
export interface TenantSettingsPatch {
  readonly orgId?: string | undefined;
  readonly displayName?: string | undefined;
  readonly domain?: string | undefined;
  readonly m2mClientId?: string | undefined;
  readonly brandAccent?: string | undefined;
  readonly brandSurface?: string | undefined;
  readonly brandMonogram?: string | undefined;
  readonly referenceClaim?: string | undefined;
  readonly officialNumbers?: readonly string[] | undefined;
  readonly portalClientId?: string | undefined;
  readonly portalLinkType?: string | undefined;
  readonly portalBaseUrl?: string | undefined;
  readonly logtoEndpoint?: string | undefined;
  readonly teApiBaseUrl?: string | undefined;
  readonly b2bResource?: string | undefined;
  readonly b2bScope?: string | undefined;
  /** Sólo si se ha escrito uno nuevo. `undefined` = se queda el que había. */
  readonly m2mSecret?: string | undefined;
  readonly portalClientSecret?: string | undefined;
  readonly webhookSecret?: string | undefined;
  /** Los secretos que hay que dejar vacíos de verdad. */
  readonly clearSecrets?: readonly SecretField[];
}

/** Los tres secretos que la pantalla escribe pero no relee. */
export type SecretField = 'm2mSecret' | 'portalClientSecret' | 'webhookSecret';

interface SettingsRow extends Record<string, unknown> {
  org_id: string | null;
  display_name: string | null;
  domain: string | null;
  m2m_client_id: string | null;
  m2m_secret: string | null;
  brand_accent: string | null;
  brand_surface: string | null;
  brand_monogram: string | null;
  reference_claim: string | null;
  official_numbers: string[] | null;
  portal_client_id: string | null;
  portal_client_secret: string | null;
  portal_link_type: string | null;
  portal_base_url: string | null;
  portal_cookie_secret: string | null;
  webhook_secret: string | null;
  logto_endpoint: string | null;
  te_api_base_url: string | null;
  b2b_resource: string | null;
  b2b_scope: string | null;
  seeded_from_env: boolean;
  updated_at: Date;
}

const COLUMNS = `org_id, display_name, domain, m2m_client_id, m2m_secret,
                 brand_accent, brand_surface, brand_monogram, reference_claim,
                 official_numbers, portal_client_id, portal_client_secret,
                 portal_link_type, portal_base_url, portal_cookie_secret,
                 webhook_secret, logto_endpoint, te_api_base_url, b2b_resource,
                 b2b_scope, seeded_from_env, updated_at`;

function toSettings(row: SettingsRow): TenantSettings {
  return {
    orgId: nullToUndefined(row.org_id),
    displayName: nullToUndefined(row.display_name),
    domain: nullToUndefined(row.domain),
    m2mClientId: nullToUndefined(row.m2m_client_id),
    m2mSecret: nullToUndefined(row.m2m_secret),
    brandAccent: nullToUndefined(row.brand_accent),
    brandSurface: nullToUndefined(row.brand_surface),
    brandMonogram: nullToUndefined(row.brand_monogram),
    referenceClaim: nullToUndefined(row.reference_claim),
    officialNumbers: row.official_numbers ?? [],
    portalClientId: nullToUndefined(row.portal_client_id),
    portalClientSecret: nullToUndefined(row.portal_client_secret),
    portalLinkType: nullToUndefined(row.portal_link_type),
    portalBaseUrl: nullToUndefined(row.portal_base_url),
    portalCookieSecret: nullToUndefined(row.portal_cookie_secret),
    webhookSecret: nullToUndefined(row.webhook_secret),
    // Los de plataforma nunca salen vacíos: si la fila los tiene a `null`
    // —sembrada por un despliegue que no los declaraba— vale el valor por
    // defecto. Es lo que hace que una instalación nueva no tenga que rellenar
    // tres URLs que son iguales en todas.
    logtoEndpoint: nullToUndefined(row.logto_endpoint) ?? PLATFORM_DEFAULTS.logtoEndpoint,
    teApiBaseUrl: nullToUndefined(row.te_api_base_url) ?? PLATFORM_DEFAULTS.teApiBaseUrl,
    b2bResource: nullToUndefined(row.b2b_resource) ?? PLATFORM_DEFAULTS.b2bResource,
    b2bScope: nullToUndefined(row.b2b_scope) ?? PLATFORM_DEFAULTS.b2bScope,
    seededFromEnv: row.seeded_from_env,
    updatedAt: row.updated_at.toISOString(),
  };
}

function nullToUndefined(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? undefined : trimmed;
}

/** Una variable de entorno vacía es una variable sin poner. */
function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  if (value === undefined) return undefined;
  if (value === '') {
    // Presente y vacía casi siempre es la trampa de la almohadilla:
    // `CRM_BRAND_COLOR=#5b3ea6` sin comillas vale la cadena vacía, porque en un
    // `.env` todo lo que va detrás de la `#` es un comentario. Costó una tarde
    // el 2026-08-31, y el síntoma era el peor posible: la consola salía azul,
    // sin ningún error, con la variable escrita correctamente en el fichero.
    //
    // Ya no puede tumbar el arranque —la configuración vive en la base— así que
    // lo que queda es dejar constancia. La pantalla de ajustes enseña la casilla
    // vacía, que es el segundo sitio donde se ve.
    console.warn(
      `[crm] ${name} está presente pero vacía y no se sembrará. ` +
        "Si el valor empezaba por '#', el .env se lo comió como comentario: " +
        'escríbelo sin la almohadilla o entre comillas.',
    );
    return undefined;
  }
  return value;
}

/**
 * Los teléfonos oficiales de una cadena separada por comas.
 *
 * **Comas y sólo comas**, aunque otras listas de este proyecto acepten espacios:
 * un teléfono se escribe con espacios (`+34 918 40 22 47`) y partirlo por ellos
 * convierte un número en cinco. Los espacios interiores se normalizan a uno
 * porque el valor acaba dentro de una credencial firmada, y dos emisiones que el
 * operador escribió igual no pueden diferir en un espacio de más.
 */
export function parseOfficialNumbers(raw: string | undefined): readonly string[] {
  return (raw ?? '')
    .split(',')
    .map((entry) => entry.trim().replace(/\s+/g, ' '))
    .filter((entry) => entry !== '');
}

/**
 * La siembra: la fila que se crea la primera vez que no hay ninguna.
 *
 * Lee las variables de siempre, con los nombres de siempre. Lo que no esté
 * queda a `null` y la pantalla lo pide.
 */
function seedFromEnvironment(): Record<string, unknown> {
  const teApiBase = env('TE_API_BASE_URL');
  return {
    org_id: env('CRM_ORG_ID') ?? null,
    display_name: env('CRM_ORG_NAME') ?? null,
    domain: env('CRM_ORG_DOMAIN') ?? null,
    m2m_client_id: env('CRM_M2M_CLIENT_ID') ?? null,
    m2m_secret: env('CRM_M2M_SECRET') ?? null,
    brand_accent: env('CRM_BRAND_COLOR') ?? null,
    brand_surface: env('CRM_BRAND_SURFACE') ?? null,
    brand_monogram: env('CRM_BRAND_MONOGRAM') ?? null,
    reference_claim: env('CRM_REFERENCE_CLAIM') ?? null,
    official_numbers: parseOfficialNumbers(env('CRM_OFFICIAL_NUMBERS')),
    portal_client_id: env('CRM_PORTAL_CLIENT_ID') ?? null,
    portal_client_secret: env('CRM_PORTAL_CLIENT_SECRET') ?? null,
    portal_link_type: env('CRM_PORTAL_LINK_TYPE') ?? null,
    portal_base_url: env('CRM_PORTAL_BASE_URL') ?? null,
    // Si no viene, se GENERA. Ver la columna en `db/008_tenant_settings.sql`:
    // pedirle a quien despliega que invente 32 caracteres aleatorios es pedirle
    // que ponga `changeme`, y una cookie de sesión firmada con `changeme` la
    // escribe cualquiera.
    portal_cookie_secret: env('CRM_PORTAL_COOKIE_SECRET') ?? randomBytes(32).toString('base64url'),
    webhook_secret: env('CRM_WEBHOOK_SECRET') ?? null,
    logto_endpoint: env('LOGTO_ENDPOINT') ?? null,
    te_api_base_url: teApiBase ?? null,
    b2b_resource: env('TE_B2B_RESOURCE') ?? null,
    b2b_scope: env('TE_B2B_SCOPE') ?? null,
    // «Nació del entorno» = alguna variable de configuración estaba puesta. La
    // clave de la cookie no cuenta: se genera siempre, así que contarla marcaría
    // como sembrada una instalación completamente en blanco.
    seeded_from_env:
      env('CRM_ORG_ID') !== undefined ||
      env('CRM_M2M_CLIENT_ID') !== undefined ||
      env('CRM_ORG_DOMAIN') !== undefined,
  };
}

/**
 * La fila de configuración, creándola si no estaba.
 *
 * El `insert … on conflict (id) do nothing` es lo que hace que dos peticiones
 * simultáneas al arrancar no siembren dos veces: la `check (id = 1)` deja una
 * sola fila posible y el conflicto lo resuelve Postgres, no un `if` de aquí que
 * perdería la carrera.
 */
async function readOrSeed(): Promise<TenantSettings> {
  const existing = await query<SettingsRow>(
    `select ${COLUMNS} from tenant_settings where id = 1`,
  );
  const found = existing[0];
  if (found !== undefined) return toSettings(found);

  const seed = seedFromEnvironment();
  await query(
    `insert into tenant_settings
       (id, org_id, display_name, domain, m2m_client_id, m2m_secret,
        brand_accent, brand_surface, brand_monogram, reference_claim,
        official_numbers, portal_client_id, portal_client_secret,
        portal_link_type, portal_base_url, portal_cookie_secret,
        webhook_secret, logto_endpoint, te_api_base_url, b2b_resource,
        b2b_scope, seeded_from_env)
     values (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
             $15, $16, $17, $18, $19, $20, $21)
     on conflict (id) do nothing`,
    [
      seed['org_id'],
      seed['display_name'],
      seed['domain'],
      seed['m2m_client_id'],
      seed['m2m_secret'],
      seed['brand_accent'],
      seed['brand_surface'],
      seed['brand_monogram'],
      seed['reference_claim'],
      seed['official_numbers'],
      seed['portal_client_id'],
      seed['portal_client_secret'],
      seed['portal_link_type'],
      seed['portal_base_url'],
      seed['portal_cookie_secret'],
      seed['webhook_secret'],
      seed['logto_endpoint'],
      seed['te_api_base_url'],
      seed['b2b_resource'],
      seed['b2b_scope'],
      seed['seeded_from_env'],
    ],
  );

  const created = await query<SettingsRow>(
    `select ${COLUMNS} from tenant_settings where id = 1`,
  );
  const row = created[0];
  if (row === undefined) {
    // No puede pasar: se acaba de insertar o ya estaba. Si pasa, es que la
    // migración 008 no está aplicada y el mensaje tiene que decirlo, porque el
    // error de Postgres («relation "tenant_settings" does not exist») ya lo
    // habría dicho antes.
    throw new Error('tenant_settings has no row after seeding: run npm run db:migrate');
  }
  return toSettings(row);
}

/**
 * La configuración de esta instalación. Memorizada **por petición**, no por
 * proceso: ver la cabecera de este fichero.
 */
export const loadTenantSettings = cache(readOrSeed);

/**
 * Guarda lo que venga en el parche y devuelve la fila resultante.
 *
 * Se compone un `update` con sólo las columnas presentes en vez de escribir la
 * fila entera. Es lo que permite que la pantalla mande el formulario sin los
 * secretos —que no relee— sin que eso los borre, y lo que deja la puerta abierta
 * a que mañana haya un segundo formulario que toque otras cuatro columnas.
 */
export async function saveTenantSettings(patch: TenantSettingsPatch): Promise<TenantSettings> {
  // Se asegura de que la fila existe antes de actualizarla: guardar en una
  // instalación recién levantada, sin haber pintado ninguna pantalla, tiene que
  // funcionar igual.
  await readOrSeed();

  const assignments: string[] = [];
  const values: unknown[] = [];

  const set = (column: string, value: unknown): void => {
    values.push(value);
    assignments.push(`${column} = $${String(values.length)}`);
  };

  const setText = (column: string, value: string | undefined): void => {
    if (value === undefined) return;
    // La cadena vacía se guarda como `null`. Es lo que espera quien vacía una
    // casilla del formulario para dejar de declarar algo opcional —el monograma,
    // el tipo de vínculo del portal— y guardarla como `''` haría que
    // `nullToUndefined` la tratara igual pero la pantalla la enseñara distinta.
    set(column, value.trim() === '' ? null : value.trim());
  };

  setText('org_id', patch.orgId);
  setText('display_name', patch.displayName);
  setText('domain', patch.domain);
  setText('m2m_client_id', patch.m2mClientId);
  setText('brand_accent', patch.brandAccent);
  setText('brand_surface', patch.brandSurface);
  setText('brand_monogram', patch.brandMonogram);
  setText('reference_claim', patch.referenceClaim);
  setText('portal_client_id', patch.portalClientId);
  setText('portal_link_type', patch.portalLinkType);
  setText('portal_base_url', patch.portalBaseUrl);
  setText('logto_endpoint', patch.logtoEndpoint);
  setText('te_api_base_url', patch.teApiBaseUrl);
  setText('b2b_resource', patch.b2bResource);
  setText('b2b_scope', patch.b2bScope);

  if (patch.officialNumbers !== undefined) set('official_numbers', [...patch.officialNumbers]);

  // Los secretos: sólo si se ha escrito uno. Nunca se vacían por omisión.
  setText('m2m_secret', patch.m2mSecret);
  setText('portal_client_secret', patch.portalClientSecret);
  setText('webhook_secret', patch.webhookSecret);

  for (const field of patch.clearSecrets ?? []) {
    set(SECRET_COLUMNS[field], null);
  }

  // Guardar desde la pantalla deja de ser una instalación «sembrada»: sus
  // valores ya los ha escrito una persona, y decirle que vienen del entorno
  // sería mentira desde el segundo guardado.
  set('seeded_from_env', false);
  assignments.push('updated_at = now()');

  const updated = await query<SettingsRow>(
    `update tenant_settings set ${assignments.join(', ')} where id = 1 returning ${COLUMNS}`,
    values,
  );
  const row = updated[0];
  if (row === undefined) throw new Error('tenant_settings row vanished while saving');
  return toSettings(row);
}

const SECRET_COLUMNS: Record<SecretField, string> = {
  m2mSecret: 'm2m_secret',
  portalClientSecret: 'portal_client_secret',
  webhookSecret: 'webhook_secret',
};
