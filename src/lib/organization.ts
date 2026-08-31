import 'server-only';

import { isReferenceClaim, REFERENCE_CLAIMS, type ReferenceClaim } from './reference-claims';

/**
 * La configuración de **la** organización de este despliegue.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  UNA INSTALACIÓN, UN INQUILINO. NO HAY MAPA Y NO HAY `Host` QUE RESOLVER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Hasta el 2026-08-31 este fichero era un **mapa** `orgId → configuración`,
 * descubierto por prefijo (`CRM_ORG_<SLUG>_ID`), con cuatro inquilinos servidos
 * por el mismo despliegue y **la cabecera `Host` eligiendo de quién era cada
 * pantalla**. Se fue entero, por decisión del dueño, y la razón es que un CRM no
 * es un producto multiinquilino: **el CRM de una empresa es de esa empresa**. Un
 * despliegue que multiplexa cuatro clientes por el `Host` no se parece a nada que
 * uno de ellos vaya a instalar, y arrastraba complejidad —el mapa, el
 * encaminamiento, los alias de desarrollo, la organización activa de respaldo—
 * que existía sólo para sostener esa forma.
 *
 * Lo que hay ahora es plano: **cada variable declara una cosa y no hay que
 * elegir nada en tiempo de petición**. Para servir a dos empresas se publica la
 * aplicación dos veces con dos configuraciones, que es lo que un cliente
 * entiende, lo que se factura por separado y lo que se puede apagar por
 * separado.
 *
 * ## Lo que se ganó, dicho para quien busque el mapa y no lo encuentre
 *
 *  · **El `Host` ya no decide nada.** Era el único sitio del proyecto donde algo
 *    que escribe quien llama elegía qué padrón se enseñaba. Ahora la respuesta a
 *    «¿de quién es esta pantalla?» está en el entorno del proceso y no puede
 *    cambiar entre dos peticiones.
 *  · **La salud del proceso ya no depende de nadie más.** Un secreto M2M mal
 *    puesto tumbaba la demostración de las otras tres empresas, que no tenían
 *    nada que ver (ver la nota de `api/health/route.ts`).
 *  · **El `did.json` deja de ser un problema.** Se compone con `CRM_ORG_DOMAIN`
 *    y siempre dice lo mismo, así que no hay forma de publicar la identidad de
 *    una empresa en el dominio de otra.
 *
 * ## Cómo se declara
 *
 *     CRM_ORG_ID=ww51qgtvpc9h
 *     CRM_ORG_NAME=Banco Demo, S.A.
 *     CRM_ORG_DOMAIN=bank.demo-te.com
 *     CRM_M2M_CLIENT_ID=<app M2M de esa organización>
 *     CRM_M2M_SECRET=<su secreto>
 *
 * Y nada más es obligatorio: el resto tiene respaldo o es opcional de verdad.
 * Lo que falte **revienta al arrancar nombrando la variable**, que es la regla
 * de esta casa y la que hace que un despliegue mal configurado se note en el
 * primer arranque y no en la cartera de un titular tres semanas después.
 *
 * ## `issuerUrl` y `verifierUrl` son de te-api. NUNCA de walt.id
 *
 * Los nombres vienen del contrato de F4a, pero lo que va dentro es **la base de
 * te-api** que emite (F4b) y la que verifica (F4c). El CRM no habla con walt.id
 * jamás: su emisor no tiene autenticación ninguna y publica las claves privadas
 * de sus perfiles, y lo único que lo protege es no tener dominio. Todo lo que
 * este CRM necesita sale de `/v1/b2b/` de te-api.
 *
 * Están separados porque son dos capacidades distintas y no tienen por qué vivir
 * en el mismo despliegue el día que haya una región aparte; hoy las dos caen en
 * `TE_API_BASE_URL`.
 *
 * ## Este fichero no puede acabar en el navegador
 *
 * `import 'server-only'` convierte en **error de compilación** que un componente
 * de cliente lo importe, aunque sea por una constante inofensiva. Es la línea
 * que hace comprobable el requisito de auditoría «ni un secreto en el
 * navegador»: no depende de que nadie se acuerde.
 */

export interface OrganizationConfig {
  /** El `organization_id` de Logto. Lo crea su administrador en tenant-admin. */
  readonly orgId: string;
  /** Nombre para la interfaz. El legal de verdad lo dice te-api en `/organization`. */
  readonly displayName: string;
  /**
   * El dominio de esta instalación — `bank.demo-te.com`, sin esquema.
   *
   * Es **su identidad y no una dirección más**: de aquí sale el
   * `did:web:<dominio>` que publica en `/.well-known/did.json`, que es lo que la
   * cartera resuelve para comprobar quién firmó una credencial. Cambiarlo deja
   * huérfana cada credencial ya emitida.
   *
   * **Obligatorio**, y eso es nuevo. Cuando un despliegue servía cuatro
   * organizaciones, una podía no tener dominio y llegarse a ella por otra vía;
   * aquí no hay otra vía, y una instalación que emite credenciales sin saber su
   * propio dominio publicaría un `did:web` que no resuelve. Se prefiere no
   * arrancar.
   */
  readonly domain: string;
  /** La aplicación M2M de esta organización. Sólo servidor. */
  readonly m2mClientId: string;
  /** Su secreto. Sólo servidor, y no se escribe en ningún log. */
  readonly m2mSecret: string;
  /** Base de te-api para emitir. Ver arriba: te-api, no walt.id. */
  readonly issuerUrl: string;
  /** Base de te-api para verificar (F4c). Ver arriba: te-api, no walt.id. */
  readonly verifierUrl: string;
  /**
   * Los teléfonos desde los que esta organización llama de verdad.
   *
   * ═══════════════════════════════════════════════════════════════════════
   *  NO SON UN ADORNO DE LA PANTALLA: VIAJAN DENTRO DE LA CREDENCIAL
   * ═══════════════════════════════════════════════════════════════════════
   *
   * El identificador de llamada se falsifica en diez segundos, así que «te
   * llama tu banco» no prueba nada. Lo que sí prueba algo es que el número esté
   * **dentro de un documento que el banco firmó y que el titular lleva
   * encima**: eso no lo fabrica un estafador, y además el titular puede
   * consultarlo sin llamada y sin conexión.
   *
   * Por eso se emiten como el claim `official_numbers` de la credencial
   * (`api/credentials/issue`) y por eso la pantalla de emisión los enseña
   * **antes** de emitir: quien firma tiene que ver lo que firma.
   *
   * Vacío = no se declara ninguno, y entonces no se emite el claim y la pantalla
   * lo dice. **No se inventa un número**: un teléfono equivocado dentro de una
   * credencial firmada es peor que ninguno.
   */
  readonly officialNumbers: readonly string[];
  /**
   * F2 · La aplicación OIDC del **portal de clientes**.
   *
   * `undefined` = esta instalación no tiene portal declarado, y entonces
   * `/portal` lo dice en pantalla en vez de romperse a mitad del login.
   *
   * **No es la aplicación M2M de arriba y no puede serlo.** La M2M autentica al
   * servidor del CRM contra te-api; ésta autentica a una **persona** contra
   * Logto. Su `client_id` es además el `aud` que te-api exige en el ID token
   * (`te.partner_org.portal_client_id`), así que compartirlas haría que el mismo
   * identificador significara dos cosas distintas.
   */
  readonly portal: PortalAppConfig | undefined;
  /**
   * La dirección pública del portal (`CRM_PORTAL_BASE_URL`).
   *
   * De aquí sale el `redirect_uri`, y Logto lo compara carácter a carácter con
   * el declarado en la aplicación. No se compone a partir de `domain` —que sería
   * `https://<domain>`— porque en local el portal vive en `http://localhost:3000`
   * y ni el esquema ni el puerto se deducen de un dominio.
   *
   * Y **nunca** de la cabecera `Host`, que la escribe quien llama.
   */
  readonly portalBaseUrl: string | undefined;
  /**
   * Su marca: el color con el que se pinta su consola y su portal.
   *
   * `undefined` = no declara marca y se queda con el azul de la hoja
   * (`globals.css`). Sigue siendo legítimo y no es una rama muerta: es el
   * aspecto por defecto, y una instalación que no tenga color propio todavía
   * arranca igual.
   */
  readonly brand: BrandConfig | undefined;
  /**
   * Cuál de las referencias de sector es la SUYA.
   *
   * ═══════════════════════════════════════════════════════════════════════
   *  ESTO ARREGLÓ UN FORMULARIO QUE LE OFRECÍA A UNA ELÉCTRICA UNA CASILLA
   *  DE «NÚMERO DE HISTORIA CLÍNICA», Y AHORA ES OBLIGATORIO
   * ═══════════════════════════════════════════════════════════════════════
   *
   * La cuenta y el punto de suministro son la misma cosa en dos sectores
   * (`./reference-claims.ts`): el dato con el que el titular reconoce **de qué
   * relación se le está hablando**.
   *
   * Era opcional —sin declarar se ofrecían todas— porque las organizaciones
   * anteriores no la declaraban y su alta no podía cambiar. Ya no hay
   * organizaciones anteriores: **una instalación sabe de qué sector es**, y
   * dejarla sin declarar sólo puede producir un formulario que ofrece la casilla
   * de otro negocio. Sin ella el proceso no arranca, y el mensaje lista los
   * valores válidos.
   */
  readonly referenceClaim: ReferenceClaim;
  /**
   * El secreto con el que te-api firma los webhooks que manda **a esta
   * instalación**, o `undefined` si todavía no se ha registrado ninguno.
   *
   * Lo da la consola de tenant-admin al registrar la URL del webhook, y es lo
   * único que separa un evento de te-api de un `POST` que ha escrito cualquiera:
   * ver `src/lib/webhook-signature.ts`, donde está el porqué largo y la forma
   * exacta de la firma.
   *
   * `undefined` = el receptor **rechaza todo** en vez de aceptar sin comprobar.
   * Un receptor que acepta cualquier cuerpo es una puerta abierta a que un
   * tercero invente eventos de credenciales en el diario de esta empresa.
   */
  readonly webhookSecret: string | undefined;
}

/**
 * La marca de una organización: dos colores y un monograma.
 *
 * Son **dos** colores porque la hoja tiene dos oficios separados y no más: una
 * superficie oscura —la barra de la consola, la cabecera del portal— y un acento
 * sobre papel blanco —enlaces, foco, el filo de la tarjeta de oferta—. Los otros
 * tonos de la familia (`--navy-line`, `--navy-ink`, `--navy-tint`) se
 * **derivan** de esos dos con `color-mix()` en `src/lib/brand.ts`: son mezclas
 * con blanco, no decisiones, y pedirlas por configuración sería regalar cinco
 * maneras de que una empresa quede con un texto ilegible sobre su propia barra.
 *
 * ⚠ **Los colores de estado NO son la marca y no se tocan aquí.** Rojo =
 * fraude, ámbar = ha ido mal, verde = comprobado, azul = en curso
 * (`globals.css`, nota 2). Esa regla vale para toda instalación: si la marca de
 * una empresa pudiera repintar el rojo, un agente que cambia de consola dejaría
 * de poder leer el color.
 */
export interface BrandConfig {
  /**
   * El acento sobre papel blanco. Es lo que hoy es `--navy`.
   *
   * Va sobre blanco y lo lee gente ocho horas seguidas, así que tiene que
   * contrastar de verdad. No se comprueba aquí —haría falta convertir a
   * luminancia y la validación de un `.env` no es el sitio—, pero el que se
   * elija se mira antes: el violeta de Larkfield da 7,9:1 sobre blanco.
   */
  readonly accent: string;
  /**
   * La superficie oscura: la barra lateral de la consola y la cabecera del
   * portal. Es lo que hoy es `--navy-deep`.
   */
  readonly surface: string;
  /**
   * El monograma del disco de la barra — «LE» —, o `undefined` para componerlo
   * con las iniciales del nombre.
   *
   * Se puede declarar porque las iniciales no siempre son la marca. Una o dos
   * letras y no más: en un disco de 32 píxeles, cinco letras no se leen y lo que
   * queda es una mancha.
   */
  readonly monogram: string | undefined;
}

/** La aplicación OIDC del portal de clientes: *traditional web*, con secreto. */
export interface PortalAppConfig {
  readonly clientId: string;
  /** Sólo servidor. El canje del código va con `client_secret_basic`. */
  readonly clientSecret: string;
  /**
   * El `type` que el portal declara al vincular (`cliente`, `customer`, …).
   *
   * Opcional en te-api y opcional aquí: el vínculo nace del login, no de la
   * credencial, y exigirlo obligaría a emitir antes de poder vincular. Se pone
   * cuando el portal sirve a un solo tipo de titular —el caso de un portal de
   * clientes— porque entonces es lo que la cartera enseña en la lista de
   * vínculos, y «Banco Demo · cliente» se lee mejor que «Banco Demo».
   *
   * Tiene que ser un `type_key` del padrón de **esta** organización en te-api, o
   * la llamada sale con `400 invalid_request` y el vínculo no se crea.
   */
  readonly linkType: string | undefined;
}

/** Lo que es común a cualquier instalación: hay un solo Logto. */
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

/**
 * Falta una variable o está vacía. El mensaje nombra la variable, nunca el valor.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ESTOS MENSAJES VAN EN INGLÉS Y **NO** PASAN POR EL CATÁLOGO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * No son texto de pantalla de atención al cliente: sólo salen en Diagnóstico y
 * en la respuesta de una ruta de API, y sólo los lee quien despliega. Están en
 * el mismo registro que `relation "customer" does not exist`, que Postgres
 * escribe en inglés y que esa misma pantalla enseña dos filas más abajo — y en
 * el mismo idioma que la variable que nombran.
 */
export class OrganizationConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrganizationConfigError';
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    throw new OrganizationConfigError(`missing environment variable ${name}`);
  }
  return value.trim();
}

function emptyToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? undefined : trimmed;
}

/**
 * Un color de marca: **sólo notación hexadecimal**, y no por gusto.
 *
 * Estos dos valores acaban dentro del atributo `style` del `<body>`, o sea
 * dentro de una hoja de estilo que compone el servidor con algo que viene de
 * fuera del código. React escapa el atributo, así que no se puede salir de él;
 * lo que sí se podría con la sintaxis abierta de CSS es colar un `url(...)` que
 * pida una imagen a un tercero desde la pantalla de un agente, o un valor que
 * rompa la cascada y deje la barra sin fondo.
 *
 * La lista blanca lo cierra de raíz: `#rgb` o `#rrggbb` y nada más.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  LA ALMOHADILLA SE ACEPTA **OPCIONAL**, Y ESO SÍ ES POR ALGO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * En un fichero `.env` la almohadilla abre un comentario. `CRM_BRAND_COLOR=#5b3ea6`
 * sin comillas **no vale la cadena vacía por descuido: vale la cadena vacía por
 * diseño del formato**, porque todo lo que va detrás de la `#` es un comentario.
 * Se descubrió el 2026-08-31 en la primera prueba en el navegador, y el síntoma
 * era el peor posible: la consola salía azul, sin ningún error, y la variable
 * estaba escrita correctamente en el fichero.
 *
 * De ahí las dos defensas, que son distintas y hacen falta las dos:
 *
 *  1. **`5b3ea6` sin almohadilla vale igual**, y se le pone al normalizar. Es la
 *     forma que no puede salir mal en ningún sitio — ni en un `.env`, ni en un
 *     `docker-compose`, ni en la caja de texto de Coolify.
 *  2. **Una variable presente y vacía revienta**, y el mensaje nombra la trampa.
 *     Vacía sólo puede significar dos cosas —o se dejó a medias, o se la comió
 *     la almohadilla— y las dos son un error de configuración que hay que ver al
 *     arrancar, no una instalación sin marca.
 *
 * Ausente y vacía **no** son lo mismo, y esa distinción es toda la defensa 2:
 * ausente es «esta instalación no declara marca», que es legítimo.
 */
const BRAND_COLOR_PATTERN = /^#?(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function readBrandColor(name: string): string | undefined {
  const raw = process.env[name];
  // Ausente: esta instalación no declara marca. Legítimo.
  if (raw === undefined) return undefined;

  const value = raw.trim();
  if (value === '') {
    throw new OrganizationConfigError(
      `${name} is declared but empty. In a .env file a value starting with '#' is a comment: ` +
        `write it without the '#' (5b3ea6) or in quotes ("#5b3ea6")`,
    );
  }
  if (!BRAND_COLOR_PATTERN.test(value)) {
    // El mensaje NO lleva el valor: sale en Diagnóstico y en la respuesta de una
    // ruta, y la regla de esta casa es nombrar la variable y nunca lo que hay
    // dentro.
    throw new OrganizationConfigError(`${name} must be a hex colour (#rgb, #rrggbb or rrggbb)`);
  }
  // Se normaliza CON almohadilla porque es lo que entiende CSS, que es donde
  // acaba: aceptarla opcional es cosa de quien escribe el `.env`, no de la hoja.
  return value.startsWith('#') ? value.toLowerCase() : `#${value.toLowerCase()}`;
}

/**
 * La marca, o `undefined` si no se declara ninguna.
 *
 * Los dos colores **van juntos o no van**, por la misma razón que el par del
 * portal: media marca es peor que ninguna. Una barra violeta con los enlaces
 * azules de la hoja no se lee como «otra empresa», se lee como una pantalla a
 * medio pintar, y encima el que la ve no tiene forma de saber cuál de los dos
 * colores es el que sobra.
 */
function readBrand(): BrandConfig | undefined {
  const accent = readBrandColor('CRM_BRAND_COLOR');
  const surface = readBrandColor('CRM_BRAND_SURFACE');

  if (accent === undefined && surface === undefined) return undefined;
  if (accent === undefined || surface === undefined) {
    throw new OrganizationConfigError('CRM_BRAND_COLOR y CRM_BRAND_SURFACE van juntas o no van');
  }

  const monogram = emptyToUndefined(process.env['CRM_BRAND_MONOGRAM']);
  // Dos caracteres como mucho. Se cuenta con el iterador de cadena y no con
  // `.length`, que cuenta unidades UTF-16: una «Ñ» compuesta o un emoji dan 2 y
  // 4 y quedarían fuera por un motivo que nadie adivina leyendo el `.env`.
  if (monogram !== undefined && [...monogram].length > 2) {
    throw new OrganizationConfigError('CRM_BRAND_MONOGRAM must be one or two characters');
  }

  return { accent, surface, monogram };
}

/**
 * La referencia de sector de esta instalación. **Obligatoria.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  LO QUE NO ENCAJA REVIENTA AL ARRANCAR, Y AUSENTE TAMPOCO VALE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Cuando un despliegue servía a cuatro empresas, ausente significaba «esta no lo
 * declara, se ofrecen todas» y era legítimo porque las tres primeras se habían
 * creado así. Con una instalación por empresa eso ya no significa nada: **una
 * empresa sabe de qué sector es**, y un formulario de alta que ofrece a la vez
 * los cuatro últimos de la cuenta y el punto de suministro sólo puede llevar a
 * que el agente rellene el que no toca — que después sale mal en el listado, en
 * la ficha y dentro de una credencial firmada.
 *
 * El mensaje nombra la variable y **lista los valores válidos**, que es lo que
 * hace falta para arreglarlo sin abrir el código. Lo que no lleva es el valor
 * recibido: la regla de esta casa es nombrar la variable y nunca lo que hay
 * dentro (ver `OrganizationConfigError`).
 */
function readReferenceClaim(): ReferenceClaim {
  const raw = process.env['CRM_REFERENCE_CLAIM'];
  const value = raw?.trim().toLowerCase();

  if (value === undefined || value === '') {
    throw new OrganizationConfigError(
      `missing environment variable CRM_REFERENCE_CLAIM. Set one of: ${REFERENCE_CLAIMS.join(', ')}`,
    );
  }
  if (!isReferenceClaim(value)) {
    throw new OrganizationConfigError(
      `CRM_REFERENCE_CLAIM must be one of: ${REFERENCE_CLAIMS.join(', ')}`,
    );
  }
  return value;
}

/**
 * El dominio reducido a lo que identifica a la instalación.
 *
 * Las normalizaciones son las formas en las que el mismo dominio llega escrito
 * distinto, y cada una acabaría en un `did:web` que no resuelve:
 *
 *  · **Mayúsculas** — `Bank.Demo-TE.com` es el mismo host (RFC 4343), pero
 *    `did:web:Bank.Demo-TE.com` no es el mismo DID.
 *  · **El puerto** — es de la máquina, no de la empresa.
 *  · **El punto final** — `bank.demo-te.com.` es la forma absoluta y válida.
 *  · **Los espacios** — de la variable de entorno, no del protocolo.
 *
 * Lo que **no** se acepta es un dominio con barras o interrogantes: eso no es un
 * host, y un `did:web` compuesto con él no lo resuelve ninguna cartera.
 */
function readDomain(): string {
  const raw = requireEnv('CRM_ORG_DOMAIN');
  const withoutPort = raw.toLowerCase().replace(/:\d+$/, '');
  const domain = withoutPort.replace(/\.$/, '');
  if (domain === '' || /[/\\?#\s]/.test(domain)) {
    throw new OrganizationConfigError(
      'CRM_ORG_DOMAIN must be a bare host name like bank.demo-te.com (no scheme, no path)',
    );
  }
  return domain;
}

/**
 * Los números oficiales, separados por comas.
 *
 * Se separa por **comas y sólo comas** aunque el resto de listas de este
 * proyecto acepten también espacios: un teléfono se escribe con espacios
 * (`+34 918 40 22 47`) y partirlo por ellos convertiría un número en cinco.
 *
 * Lo que sí se hace es normalizar los espacios interiores a uno, porque el valor
 * acaba dentro de una credencial firmada y dos emisiones que el operador
 * escribió igual no pueden diferir en un espacio de más.
 */
function readOfficialNumbers(): readonly string[] {
  return (process.env['CRM_OFFICIAL_NUMBERS'] ?? '')
    .split(',')
    .map((entry) => entry.trim().replace(/\s+/g, ' '))
    .filter((entry) => entry !== '');
}

/**
 * La configuración se lee una vez por proceso.
 *
 * En Next.js el módulo se evalúa en cada trabajador, así que memorizarlo no crea
 * estado compartido: es sólo no releer `process.env` en cada petición. Cambiar
 * una variable exige reiniciar, que es justo lo que se quiere de una credencial.
 */
let organizationCache: OrganizationConfig | undefined;

export function getOrganization(): OrganizationConfig {
  if (organizationCache !== undefined) return organizationCache;

  const orgId = requireEnv('CRM_ORG_ID');

  // La base de te-api es la misma para las dos capacidades en el despliegue de
  // hoy, así que `TE_API_BASE_URL` sirve de respaldo y declararlas por separado
  // sólo hace falta el día que emisor y verificador se separen de verdad.
  const fallbackBase = process.env['TE_API_BASE_URL']?.trim();
  const issuerUrl = emptyToUndefined(process.env['CRM_ISSUER_URL']) ?? fallbackBase;
  const verifierUrl = emptyToUndefined(process.env['CRM_VERIFIER_URL']) ?? fallbackBase;

  if (issuerUrl === undefined || issuerUrl === '') {
    throw new OrganizationConfigError('missing CRM_ISSUER_URL (or TE_API_BASE_URL)');
  }
  if (verifierUrl === undefined || verifierUrl === '') {
    throw new OrganizationConfigError('missing CRM_VERIFIER_URL (or TE_API_BASE_URL)');
  }

  // El portal es opcional, pero **a medias no**: con el `client_id` y sin el
  // secreto, el login llegaría hasta el canje del código y moriría allí, con la
  // persona ya autenticada y un error que parece de Logto. Declarar uno obliga a
  // declarar el otro, y se ve al arrancar.
  const portalClientId = emptyToUndefined(process.env['CRM_PORTAL_CLIENT_ID']);
  const portalClientSecret = emptyToUndefined(process.env['CRM_PORTAL_CLIENT_SECRET']);
  if ((portalClientId === undefined) !== (portalClientSecret === undefined)) {
    throw new OrganizationConfigError(
      'CRM_PORTAL_CLIENT_ID y CRM_PORTAL_CLIENT_SECRET van juntas o no van',
    );
  }

  organizationCache = {
    orgId,
    displayName: emptyToUndefined(process.env['CRM_ORG_NAME']) ?? orgId,
    domain: readDomain(),
    m2mClientId: requireEnv('CRM_M2M_CLIENT_ID'),
    m2mSecret: requireEnv('CRM_M2M_SECRET'),
    // Sin barra final: las URLs se componen con plantillas, y `…/v1/b2b` sobre
    // una base con barra doble es un 404 que cuesta ver.
    issuerUrl: issuerUrl.replace(/\/+$/, ''),
    verifierUrl: verifierUrl.replace(/\/+$/, ''),
    officialNumbers: readOfficialNumbers(),
    brand: readBrand(),
    referenceClaim: readReferenceClaim(),
    portalBaseUrl: emptyToUndefined(process.env['CRM_PORTAL_BASE_URL'])?.replace(/\/+$/, ''),
    portal:
      portalClientId === undefined || portalClientSecret === undefined
        ? undefined
        : {
            clientId: portalClientId,
            clientSecret: portalClientSecret,
            linkType: emptyToUndefined(process.env['CRM_PORTAL_LINK_TYPE']),
          },
    webhookSecret: emptyToUndefined(process.env['CRM_WEBHOOK_SECRET']),
  };
  return organizationCache;
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
    b2bScope: process.env['TE_B2B_SCOPE']?.trim() ?? 'credentials:issue verifications:request',
  };
  return logtoCache;
}
