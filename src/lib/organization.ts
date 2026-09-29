import 'server-only';

import { isReferenceClaim, REFERENCE_CLAIMS, type ReferenceClaim } from './reference-claims';
import { loadTenantSettings, type TenantSettings } from './tenant-settings';

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
 * Lo que hay ahora es plano: **cada valor declara una cosa y no hay que elegir
 * nada en tiempo de petición**. Para servir a dos empresas se publica la
 * aplicación dos veces con dos bases, que es lo que un cliente entiende, lo que
 * se factura por separado y lo que se puede apagar por separado.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  DE DÓNDE SALE ESTO: DE LA BASE, NO DEL ENTORNO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * El 2026-08-31, y ésta es la segunda mitad del mismo cambio: la configuración
 * dejó de vivir en `process.env` y pasó a vivir en `tenant_settings`, que se
 * escribe desde la pantalla de ajustes de la propia consola.
 *
 * **La regla entera está escrita en `./tenant-settings.ts`** y es una sola: la
 * base manda, el entorno siembra la primera vez y nunca más, y `DATABASE_URL` es
 * la única variable que sigue siendo obligatoria. Si estás leyendo esto porque
 * cambiaste una variable y no pasó nada, es eso: ya no se lee.
 *
 * ── Lo que cambió de comportamiento, dicho claro ──────────────────────────
 *
 * Este fichero decía «lo que falte **revienta al arrancar** nombrando la
 * variable». Ya no, y no es un descuido: una instalación recién publicada **no
 * tiene configuración todavía**, porque el recorrido que se quiere es levantarla
 * y configurarla desde su propia pantalla. Un proceso que se niega a arrancar no
 * puede enseñar el formulario que lo arreglaría.
 *
 * Lo que se conserva es lo que de verdad importaba de aquella regla: **nada
 * funciona a medias en silencio**. Lo que falte sigue lanzando
 * `OrganizationConfigError`, con la lista de campos que faltan; la diferencia es
 * que ahora lo recoge la consola y lleva a la pantalla de ajustes en vez de
 * dejar el contenedor en un bucle de reinicio.
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
 * el mismo valor.
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
   * cartera resuelve para comprobar quién firmó una credencial, y de aquí sale
   * también la dirección de su webhook. Cambiarlo deja huérfana cada credencial
   * ya emitida.
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
   * **La dirección de su webhook, entera y lista para pegar.**
   *
   * Se compone aquí y no en cada pantalla porque tiene que ser **el mismo texto**
   * en tres sitios —la pantalla de ajustes, la de eventos y Diagnóstico— y sobre
   * todo porque tiene que ser exactamente lo que se registra en tenant-admin. Se
   * compone del dominio declarado y **nunca de la cabecera `Host`**: componerla
   * con la petición le enseñaría `localhost` a quien abra la consola por un túnel
   * y registraría una dirección que te-api no puede llamar.
   */
  readonly webhookUrl: string;
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
   * Su marca: el color con el que se pinta su consola.
   *
   * `undefined` = no declara marca y se queda con el azul de la hoja
   * (`globals.css`). Sigue siendo legítimo y no es una rama muerta: es el
   * aspecto por defecto, y una instalación que no tenga color propio todavía
   * funciona igual.
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
   * Una empresa sabe de qué sector es, y dejarlo sin declarar sólo puede
   * producir un formulario que ofrece la casilla de otro negocio.
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
 * superficie oscura —la barra lateral de la consola— y un acento sobre papel
 * blanco —enlaces, foco, el filo de la tarjeta de oferta—. Los otros
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
   * luminancia—, pero el que se elija se mira antes: el violeta de Larkfield da
   * 7,9:1 sobre blanco.
   */
  readonly accent: string;
  /** La superficie oscura: la barra lateral de la consola. Hoy es `--navy-deep`. */
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
 * Los campos de la configuración que pueden faltar, con el nombre que llevan en
 * la pantalla de ajustes.
 *
 * Se nombran **como en el formulario** y no como la vieja variable de entorno,
 * porque el sitio donde se arreglan es el formulario. Quien tenga un despliegue
 * antiguo y busque `CRM_M2M_SECRET` lo encuentra en `.env.example`, que explica
 * la equivalencia y la regla.
 */
export type MissingSetting =
  | 'orgId'
  | 'displayName'
  | 'domain'
  | 'm2mClientId'
  | 'm2mSecret'
  | 'referenceClaim'
  | 'issuerUrl';

const MISSING_LABELS: Record<MissingSetting, string> = {
  orgId: 'Logto organization ID',
  displayName: 'organization name',
  domain: 'domain',
  m2mClientId: 'machine-to-machine client ID',
  m2mSecret: 'machine-to-machine client secret',
  referenceClaim: `sector reference (one of: ${REFERENCE_CLAIMS.join(', ')})`,
  issuerUrl: 'te-api base URL',
};

/**
 * Falta configuración, o algo de lo que hay no encaja.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ESTOS MENSAJES VAN EN INGLÉS Y **NO** PASAN POR EL CATÁLOGO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * No son texto de pantalla de atención al cliente: salen en Diagnóstico y en la
 * respuesta de una ruta de API, y sólo los lee quien despliega. Están en el
 * mismo registro que `relation "customer" does not exist`, que Postgres escribe
 * en inglés y que esa misma pantalla enseña dos filas más abajo.
 *
 * `missing` va aparte del mensaje para que la pantalla de ajustes pueda señalar
 * las casillas concretas **en el idioma del catálogo**, sin partir la frase.
 */
export class OrganizationConfigError extends Error {
  constructor(
    message: string,
    /** Los campos que faltan, cuando el fallo es que faltan. */
    readonly missing: readonly MissingSetting[] = [],
  ) {
    super(message);
    this.name = 'OrganizationConfigError';
  }
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
 * Sigue valiendo `5b3ea6` sin almohadilla, y se le pone al normalizar: es la
 * forma que no puede salir mal en ningún sitio — ni en un `.env`, ni en un
 * `docker-compose`, ni en la caja de texto de Coolify.
 *
 * Lo que ya no hace falta es la segunda defensa de entonces —reventar cuando la
 * variable está presente y vacía—, y conviene decir por qué se retiró: **la
 * trampa vive en el formato `.env`, y el `.env` ya sólo siembra**. Un color que
 * se coma la almohadilla no llega a la base, y entonces la pantalla de ajustes
 * enseña la casilla del color vacía, que es exactamente el síntoma que hacía
 * falta y en la pantalla que existe para verlo. La siembra además lo avisa por
 * el registro (`tenant-settings.ts`).
 */
const BRAND_COLOR_PATTERN = /^#?(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Normaliza un color de marca, o `null` si no encaja.
 *
 * Devuelve `null` en vez de lanzar porque lo usan dos sitios con necesidades
 * distintas: la lectura de la configuración —que no puede tumbar una pantalla
 * por un color— y la validación del formulario, que sí tiene que decir «esto no
 * es un color» junto a la casilla.
 */
export function normalizeBrandColor(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (value === undefined || value === '') return null;
  if (!BRAND_COLOR_PATTERN.test(value)) return null;
  // Se normaliza CON almohadilla porque es lo que entiende CSS, que es donde
  // acaba: aceptarla opcional es cosa de quien escribe el valor, no de la hoja.
  return value.startsWith('#') ? value.toLowerCase() : `#${value.toLowerCase()}`;
}

/**
 * La marca, o `undefined` si no se declara ninguna.
 *
 * Los dos colores **van juntos o no van**: media marca es peor que ninguna. Una
 * barra violeta con los enlaces azules de la hoja no se lee como «otra
 * empresa», se lee como una pantalla a medio pintar, y encima el que la ve no
 * tiene forma de saber cuál de los dos colores es el que sobra.
 *
 * Media marca guardada **no tumba la consola**: se ignora entera y la pantalla
 * de ajustes lo dice. Es la diferencia con la versión de entorno, y es
 * deliberada — el formulario ya impide guardarla a medias, así que llegar aquí
 * a medias sólo puede venir de una siembra vieja, y por eso no vale la pena
 * dejar sin consola a quien podría arreglarlo desde la consola.
 */
function readBrand(settings: TenantSettings): BrandConfig | undefined {
  const accent = normalizeBrandColor(settings.brandAccent);
  const surface = normalizeBrandColor(settings.brandSurface);
  if (accent === null || surface === null) return undefined;

  const monogram = settings.brandMonogram;
  // Dos caracteres como mucho. Se cuenta con el iterador de cadena y no con
  // `.length`, que cuenta unidades UTF-16: una «Ñ» compuesta o un emoji dan 2 y
  // 4 y quedarían fuera por un motivo que nadie adivina.
  const trimmed = monogram !== undefined && [...monogram].length > 2 ? undefined : monogram;

  return { accent, surface, monogram: trimmed };
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
 *  · **Los espacios** — de quien lo escribió, no del protocolo.
 *
 * Lo que **no** se acepta es un dominio con barras o interrogantes: eso no es un
 * host, y un `did:web` compuesto con él no lo resuelve ninguna cartera. Se
 * acepta pegar `https://bank.demo-te.com` —es lo que copia cualquiera de la
 * barra del navegador— y se le quita el esquema.
 *
 * `null` = no encaja. El formulario lo dice junto a la casilla y la lectura de
 * la configuración lo cuenta como «falta el dominio».
 */
export function normalizeDomain(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (value === undefined || value === '') return null;

  const withoutScheme = value.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const withoutTrailingSlash = withoutScheme.replace(/\/+$/, '');
  const withoutPort = withoutTrailingSlash.toLowerCase().replace(/:\d+$/, '');
  const domain = withoutPort.replace(/\.$/, '');

  if (domain === '' || /[/\\?#\s]/.test(domain)) return null;
  return domain;
}

/** Sin barra final: las URLs se componen con plantillas y `…//v1/b2b` es un 404. */
function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

/**
 * La configuración de esta instalación, ya validada.
 *
 * Lanza `OrganizationConfigError` con la lista de lo que falta. Quien la recoge
 * —la consola, el receptor de webhooks, el `did.json`— decide qué hacer con
 * ella; lo que ninguno hace es continuar a medias.
 */
export async function getOrganization(): Promise<OrganizationConfig> {
  const settings = await loadTenantSettings();
  const missing: MissingSetting[] = [];

  const domain = normalizeDomain(settings.domain);
  const referenceClaim = settings.referenceClaim?.toLowerCase();
  const issuerBase = trimTrailingSlash(settings.teApiBaseUrl);

  if (settings.orgId === undefined) missing.push('orgId');
  if (domain === null) missing.push('domain');
  if (settings.m2mClientId === undefined) missing.push('m2mClientId');
  if (settings.m2mSecret === undefined) missing.push('m2mSecret');
  if (referenceClaim === undefined || !isReferenceClaim(referenceClaim)) {
    missing.push('referenceClaim');
  }
  if (issuerBase === '') missing.push('issuerUrl');

  if (missing.length > 0) {
    throw new OrganizationConfigError(
      `this installation is not configured yet: ${missing
        .map((field) => MISSING_LABELS[field])
        .join(', ')}. Set it on the Settings screen.`,
      missing,
    );
  }

  // Las cuatro aserciones son las cinco comprobaciones de arriba: si alguna
  // hubiera fallado no se llega aquí. TypeScript no puede seguir el rastro a
  // través del array, y repetir los `if` con `throw` dentro haría el mensaje
  // peor —diría sólo el primero que falta, cuando lo útil es la lista entera.
  const orgId = settings.orgId as string;
  const m2mClientId = settings.m2mClientId as string;
  const m2mSecret = settings.m2mSecret as string;
  const resolvedDomain = domain as string;
  const resolvedReference = referenceClaim as ReferenceClaim;

  return {
    orgId,
    displayName: settings.displayName ?? orgId,
    domain: resolvedDomain,
    m2mClientId,
    m2mSecret,
    issuerUrl: issuerBase,
    verifierUrl: issuerBase,
    webhookUrl: webhookUrlFor(resolvedDomain),
    officialNumbers: settings.officialNumbers,
    brand: readBrand(settings),
    referenceClaim: resolvedReference,
    webhookSecret: settings.webhookSecret,
  };
}

/**
 * La ruta del receptor. Está en una constante porque la escriben dos ficheros
 * —esto y la propia ruta— y tienen que decir lo mismo: una barra de diferencia
 * entre lo que se registra en tenant-admin y lo que sirve este proceso es un 404
 * que sólo se ve en el registro de entregas de te-api.
 */
export const WEBHOOK_PATH = '/api/webhooks/te-api';

/** La dirección entera del webhook de un dominio. Sin componer nada más. */
export function webhookUrlFor(domain: string): string {
  return `https://${domain}${WEBHOOK_PATH}`;
}

export async function getLogtoConfig(): Promise<LogtoConfig> {
  const settings = await loadTenantSettings();
  return {
    endpoint: trimTrailingSlash(settings.logtoEndpoint),
    b2bResource: settings.b2bResource,
    b2bScope: settings.b2bScope,
  };
}
