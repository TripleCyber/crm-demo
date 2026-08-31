import 'server-only';

import { isReferenceClaim, REFERENCE_CLAIMS, type ReferenceClaim } from './reference-claims';

/**
 * El mapa `orgId → { domain, m2mClientId, m2mSecret, issuerUrl, verifierUrl }`.
 *
 * ## Por qué un mapa y no cuatro variables sueltas
 *
 * Nació como mapa con un solo inquilino —Banco Demo— para que el segundo no
 * obligara a reescribir cada sitio que leyera esas variables. **Desde el
 * 2026-08-31 hay cuatro**: Banco Demo, Seguros Aurora, Clínica San Rafael y
 * Larkfield Energy, y las cuatro las sirve **un solo despliegue** desde cuatro
 * dominios distintos.
 *
 * Larkfield Energy es la prueba de que el alta se hace sin tocar código: entró
 * el 2026-08-31 **como un bloque de variables y nada más** en lo que toca a
 * identidad, encaminamiento y credenciales M2M. Lo único que necesitó código
 * fue lo que un sector nuevo siempre necesita —su columna de referencia en el
 * padrón (`db/006_…`)— y lo que hasta ese día no existía para nadie: la marca
 * por organización, aquí abajo.
 *
 * ## Cómo se declara una organización
 *
 * Por prefijo, con un *slug* en mayúsculas y sin guiones bajos:
 *
 *     CRM_ORG_BANCODEMO_ID=ww51qgtvpc9h
 *     CRM_ORG_BANCODEMO_NAME=Banco Demo, S.A.
 *     CRM_ORG_BANCODEMO_DOMAIN=bank.demo-te.com
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
 * ## El dominio es lo que elige de qué organización es cada petición
 *
 * Un despliegue, cuatro dominios. `CRM_ORG_<SLUG>_DOMAIN` es lo que ata cada
 * uno a su organización, y de él salen dos cosas que no se pueden separar:
 *
 *  · el `did:web:<dominio>` que la organización publica en
 *    `/.well-known/did.json`, y
 *  · qué padrón de clientes enseña la consola cuando la petición llega por ahí.
 *
 * Tienen que salir del mismo sitio: si el documento DID de un dominio y los
 * clientes que se ven en ese mismo dominio pudieran discrepar, la consola de
 * Seguros Aurora estaría emitiendo credenciales firmadas como del banco.
 *
 * La correspondencia es **una lista cerrada y en un solo sentido**: se busca el
 * `Host` recibido dentro de lo declarado. Nunca al revés — el `Host` lo escribe
 * quien llama, y componer un documento DID con él sería dejar que cualquiera
 * que apunte un DNS a esta máquina se fabrique una identidad en su dominio.
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
  /**
   * El dominio de esta organización — `bank.demo-te.com`, sin esquema.
   *
   * Es **su identidad**, no una dirección más: de aquí sale el
   * `did:web:<dominio>` que publica en `/.well-known/did.json`, que es lo que
   * la cartera resuelve para comprobar quién firmó una credencial. Cambiarlo
   * deja huérfana cada credencial ya emitida (`docs/fases/DOMINIOS.md`).
   *
   * `undefined` = esta organización no tiene dominio declarado. Entonces
   * **no publica documento DID** —la ruta devuelve 404, que es la verdad— y
   * sólo se llega a ella fijando `CRM_ACTIVE_ORG_ID`. Se enseña en Diagnóstico
   * para que no haya que adivinarlo.
   */
  readonly domain: string | undefined;
  /**
   * Hosts que además encaminan a esta organización, **sin ser su identidad**.
   *
   * Existe por una sola razón: en local no hay cuatro dominios con TLS, y sin
   * esto probar las cuatro organizaciones obliga a reiniciar el servidor cuatro
   * veces cambiando `CRM_ACTIVE_ORG_ID`. Con `energy.localhost` declarado
   * aquí, un solo `next dev` las sirve todas.
   *
   * **No entra jamás en un documento DID.** Ése se compone siempre con
   * `domain`, así que un alias mal puesto encamina a una consola —lo mismo que
   * ya hace el dominio de verdad, que es público— pero no puede publicar una
   * identidad en un dominio que no le corresponde.
   */
  readonly devHosts: readonly string[];
  /** La aplicación M2M de ESTA organización. Sólo servidor. */
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
   * llama tu banco» no prueba nada. Lo que sí prueba algo es que el número
   * esté **dentro de un documento que el banco firmó y que el titular lleva
   * encima**: eso no lo fabrica un estafador, y además el titular puede
   * consultarlo sin llamada y sin conexión.
   *
   * Por eso se emiten como el claim `official_numbers` de la credencial
   * (`api/credentials/issue`) y por eso la pantalla de emisión los enseña
   * **antes** de emitir, con el rótulo «números oficiales que llevará
   * dentro»: quien firma tiene que ver lo que firma.
   *
   * Su sitio definitivo es el bloque `te_partner` firmado del fork de walt.id
   * —junto al certificado, el `response_uri` y el arte de la tarjeta—, que no
   * existe todavía. Mientras tanto un claim ordinario los mete dentro de la
   * misma firma, que es la propiedad que importa; lo que le falta es ir
   * agrupado con el resto de lo que identifica al partner.
   *
   * Vacío = esta organización no declara ninguno, y entonces no se emite el
   * claim y la pantalla lo dice. **No se inventa un número**: un teléfono
   * equivocado dentro de una credencial firmada es peor que ninguno.
   */
  readonly officialNumbers: readonly string[];
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
  /**
   * La dirección pública del portal **de esta organización**.
   *
   * Con un despliegue por organización bastaba una global
   * (`CRM_PORTAL_BASE_URL`), y sigue sirviendo de respaldo. Con cuatro dominios
   * sobre el mismo despliegue no: de aquí sale el `redirect_uri`, y Logto lo
   * compara carácter a carácter con el declarado en **la aplicación de esa
   * organización**. Una sola global mandaría al titular de Seguros Aurora a
   * `bank.demo-te.com`, donde su cookie de sesión no existe y donde el vínculo
   * se pediría contra el padrón del banco.
   *
   * No se compone a partir de `domain` —que sería `https://<domain>`— porque en
   * local el portal vive en `http://localhost:3000` y el esquema y el puerto no
   * se deducen de un dominio.
   */
  readonly portalBaseUrl: string | undefined;
  /**
   * Su marca: el color con el que se pinta su consola y su portal.
   *
   * `undefined` = esta organización no declara marca y se queda con el azul de
   * la hoja (`globals.css`). Las tres primeras no la declaran, así que **su
   * pantalla no cambia ni un píxel** al entrar esto.
   */
  readonly brand: BrandConfig | undefined;
  /**
   * Cuál de las cuatro referencias de sector es la SUYA.
   *
   * ═══════════════════════════════════════════════════════════════════════
   *  ESTO ARREGLA UN FORMULARIO QUE LE OFRECÍA A UNA ELÉCTRICA UNA CASILLA
   *  DE «NÚMERO DE HISTORIA CLÍNICA»
   * ═══════════════════════════════════════════════════════════════════════
   *
   * La cuenta, la póliza, la historia y el punto de suministro son la misma
   * cosa en cuatro sectores (`./reference-claims.ts`). El alta las enseñaba
   * **las cuatro**, con el argumento de que un formulario de cliente no sabe
   * de qué organización es la pantalla. Es cierto que no lo sabe él; lo sabe
   * su padre, que es un componente de servidor, y le basta con pasárselo.
   *
   * Y no era cosmético: es el dato con el que el titular reconoce de qué
   * relación se le habla, y ofrecer los de otros tres sectores invita a
   * rellenar el que no toca — una ficha de Larkfield Energy con el punto de
   * suministro escrito en `medical_record_number` sale mal en el listado, en
   * la ficha y dentro de la credencial.
   *
   * `undefined` = esta organización no lo declara y se enseñan los cuatro,
   * que es exactamente lo que había antes. Las tres primeras no lo declaran,
   * así que **su alta no cambia ni un píxel** — igual que con `brand`.
   */
  readonly referenceClaim: ReferenceClaim | undefined;
}

/**
 * La marca de una organización: dos colores y un monograma.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  POR QUÉ ESTO EXISTE, Y POR QUÉ SON DOS COLORES Y NO QUINCE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Hasta el 2026-08-31 el CRM tenía **una sola** paleta: el azul del banco, en
 * `globals.css`, con el nombre de la organización como única diferencia entre
 * un inquilino y otro. Con cuatro dominios eso no se sostiene — en una
 * demostración lo que se ve es la misma pantalla cuatro veces, que es
 * exactamente lo contrario de lo que hay que enseñar.
 *
 * Son **dos** colores porque la hoja ya tenía dos oficios separados y no más:
 * una superficie oscura —la barra de la consola, la cabecera del portal— y un
 * acento sobre papel blanco —enlaces, foco, el filo de la tarjeta de oferta—.
 * Los otros tres tonos de la familia (`--navy-line`, `--navy-ink`,
 * `--navy-tint`) se **derivan** de esos dos con `color-mix()` en
 * `src/lib/brand.ts`: son mezclas con blanco, no decisiones, y pedirlas por
 * configuración sería regalar cinco maneras de que una organización quede con
 * un texto ilegible sobre su propia barra.
 *
 * ⚠ **Los colores de estado NO son la marca y no se tocan aquí.** Rojo =
 * fraude, ámbar = ha ido mal, verde = comprobado, azul = en curso. Esa regla
 * (`globals.css`, nota 2) vale para las cuatro organizaciones y para las que
 * vengan: si la marca de una empresa pudiera repintar el rojo, el agente que
 * cambia de consola dejaría de poder leer el color.
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
   * Se puede declarar porque las iniciales no siempre son la marca: «Clínica
   * San Rafael» da «CS», que no es como se llama nadie. Una o dos letras y no
   * más: en un disco de 32 píxeles, cinco letras no se leen y lo que queda es
   * una mancha.
   */
  readonly monogram: string | undefined;
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
 * escribe en inglés y que esta misma pantalla enseña dos filas más abajo — y en
 * el mismo idioma que la variable que nombran.
 *
 * Traducirlos obligaría a arrastrar el traductor hasta funciones síncronas de
 * `lib/` que hoy no saben nada de peticiones, y a cambio se ganaría media
 * pantalla bilingüe: la otra media seguiría siendo lo que conteste Postgres.
 */
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
    throw new OrganizationConfigError(`missing environment variable ${name}`);
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
    throw new OrganizationConfigError(`missing ${prefix}_ISSUER_URL (or TE_API_BASE_URL)`);
  }
  if (verifierUrl === undefined || verifierUrl === '') {
    throw new OrganizationConfigError(`missing ${prefix}_VERIFIER_URL (or TE_API_BASE_URL)`);
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
    domain: normalizeHost(process.env[`${prefix}_DOMAIN`]),
    devHosts: readHostList(`${prefix}_DEV_HOSTS`),
    m2mClientId: requireEnv(`${prefix}_M2M_CLIENT_ID`),
    m2mSecret: requireEnv(`${prefix}_M2M_SECRET`),
    // Sin barra final: las URLs se componen con plantillas, y
    // `…/v1/b2b` sobre una base con barra doble es un 404 que cuesta ver.
    issuerUrl: issuerUrl.replace(/\/+$/, ''),
    verifierUrl: verifierUrl.replace(/\/+$/, ''),
    officialNumbers: readOfficialNumbers(`${prefix}_OFFICIAL_NUMBERS`),
    brand: readBrand(prefix),
    referenceClaim: readReferenceClaim(`${prefix}_REFERENCE_CLAIM`),
    portalBaseUrl: emptyToUndefined(process.env[`${prefix}_PORTAL_BASE_URL`])?.replace(/\/+$/, ''),
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
 * Un color de marca: **sólo notación hexadecimal**, y no por gusto.
 *
 * Estos dos valores acaban dentro del atributo `style` del `<body>`, o sea
 * dentro de una hoja de estilo que compone el servidor con algo que viene de
 * fuera del código. React escapa el atributo, así que no se puede salir de él;
 * lo que sí se podría con la sintaxis abierta de CSS es colar un `url(...)` que
 * pida una imagen a un tercero desde la pantalla de un agente, o un valor que
 * rompa la cascada y deje la barra sin fondo.
 *
 * La lista blanca lo cierra de raíz: `#rgb` o `#rrggbb` y nada más. Ni `rgb()`,
 * ni `hsl()`, ni nombres de color — que además serían tres formas de escribir
 * lo mismo en cuatro despliegues.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  LA ALMOHADILLA SE ACEPTA **OPCIONAL**, Y ESO SÍ ES POR ALGO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * En un fichero `.env` la almohadilla abre un comentario. `BRAND_COLOR=#5b3ea6`
 * sin comillas **no vale la cadena vacía por descuido: vale la cadena vacía por
 * diseño del formato**, porque todo lo que va detrás de la `#` es un
 * comentario. Se descubrió el 2026-08-31 en la primera prueba en el navegador,
 * y el síntoma era el peor posible: la consola salía azul, sin ningún error, y
 * la variable estaba escrita correctamente en el fichero.
 *
 * De ahí las dos defensas, que son distintas y hacen falta las dos:
 *
 *  1. **`5b3ea6` sin almohadilla vale igual**, y se le pone al normalizar. Es
 *     la forma que no puede salir mal en ningún sitio — ni en un `.env`, ni en
 *     un `docker-compose`, ni en la caja de texto de Coolify.
 *  2. **Una variable presente y vacía revienta**, y el mensaje nombra la
 *     trampa. Vacía sólo puede significar dos cosas —o se dejó a medias, o se
 *     la comió la almohadilla— y las dos son un error de configuración que hay
 *     que ver al arrancar, no una organización sin marca.
 *
 * Ausente y vacía **no** son lo mismo, y esa distinción es toda la defensa 2:
 * ausente es «esta organización no declara marca», que es legítimo y es lo que
 * tienen las tres primeras.
 */
const BRAND_COLOR_PATTERN = /^#?(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function readBrandColor(name: string): string | undefined {
  const raw = process.env[name];
  // Ausente: esta organización no declara marca. Legítimo.
  if (raw === undefined) return undefined;

  const value = raw.trim();
  if (value === '') {
    throw new OrganizationConfigError(
      `${name} is declared but empty. In a .env file a value starting with '#' is a comment: ` +
        `write it without the '#' (5b3ea6) or in quotes ("#5b3ea6")`,
    );
  }
  if (!BRAND_COLOR_PATTERN.test(value)) {
    // El mensaje NO lleva el valor: sale en Diagnóstico y en la respuesta de
    // una ruta, y la regla de esta casa es nombrar la variable y nunca lo que
    // hay dentro.
    throw new OrganizationConfigError(`${name} must be a hex colour (#rgb, #rrggbb or rrggbb)`);
  }
  // Se normaliza CON almohadilla porque es lo que entiende CSS, que es donde
  // acaba: aceptarla opcional es cosa de quien escribe el `.env`, no de la hoja.
  return value.startsWith('#') ? value.toLowerCase() : `#${value.toLowerCase()}`;
}

/**
 * La marca de una organización, o `undefined` si no declara ninguna.
 *
 * Los dos colores **van juntos o no van**, por la misma razón que el par del
 * portal: media marca es peor que ninguna. Una barra violeta con los enlaces
 * azules del banco no se lee como «otra empresa», se lee como una pantalla a
 * medio pintar, y encima el que la ve no tiene forma de saber cuál de los dos
 * colores es el que sobra.
 */
function readBrand(prefix: string): BrandConfig | undefined {
  const accent = readBrandColor(`${prefix}_BRAND_COLOR`);
  const surface = readBrandColor(`${prefix}_BRAND_SURFACE`);

  if (accent === undefined && surface === undefined) return undefined;
  if (accent === undefined || surface === undefined) {
    throw new OrganizationConfigError(
      `${prefix}_BRAND_COLOR y ${prefix}_BRAND_SURFACE van juntas o no van`,
    );
  }

  const monogram = emptyToUndefined(process.env[`${prefix}_BRAND_MONOGRAM`]);
  // Dos caracteres como mucho. Se cuenta con el iterador de cadena y no con
  // `.length`, que cuenta unidades UTF-16: una «Ñ» compuesta o un emoji dan 2 y
  // 4 y quedarían fuera por un motivo que nadie adivina leyendo el `.env`.
  if (monogram !== undefined && [...monogram].length > 2) {
    throw new OrganizationConfigError(`${prefix}_BRAND_MONOGRAM must be one or two characters`);
  }

  return { accent, surface, monogram };
}

/**
 * La referencia de sector de una organización, o `undefined` si no declara una.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  LO QUE NO ENCAJA REVIENTA AL ARRANCAR. NO CAE A «LOS CUATRO»
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Es la misma regla que los colores de marca, y por el mismo motivo: **ausente
 * y mal escrita no son lo mismo**.
 *
 *  · **Ausente** = esta organización no declara referencia, se enseñan las
 *    cuatro, y es legítimo — es lo que tienen las tres primeras.
 *  · **Presente con cualquier otra cosa** = alguien quiso declararla y no lo
 *    consiguió. Descartarla en silencio dejaría al agente de Larkfield con la
 *    casilla de historia clínica delante y a quien desplegó convencido de
 *    haberla quitado: el peor de los dos mundos, porque no hay síntoma que
 *    lleve hasta la variable.
 *
 * El mensaje nombra la variable y **lista los cuatro valores**, que es lo que
 * hace falta para arreglarlo sin abrir el código. Lo que no lleva es el valor
 * recibido: la regla de esta casa es nombrar la variable y nunca lo que hay
 * dentro (ver `OrganizationConfigError`).
 *
 * Aquí no hace falta la defensa de la almohadilla que sí necesitan los colores:
 * los cuatro valores son minúsculas y guiones bajos, y en un `.env` no hay forma
 * de que un comentario se coma ninguno. Aun así una variable presente y vacía
 * revienta igual, porque vacía tampoco es «no declara»: es un descuido.
 */
function readReferenceClaim(name: string): ReferenceClaim | undefined {
  const raw = process.env[name];
  // Ausente: esta organización no declara referencia. Legítimo.
  if (raw === undefined) return undefined;

  // Se normaliza a minúsculas porque las variables de entorno se teclean en
  // cajas de texto y `SUPPLY_POINT_NUMBER` es la misma intención escrita en
  // mayúsculas, no otro valor.
  const value = raw.trim().toLowerCase();
  if (value === '') {
    throw new OrganizationConfigError(
      `${name} is declared but empty. Remove it to offer every sector reference, ` +
        `or set one of: ${REFERENCE_CLAIMS.join(', ')}`,
    );
  }
  if (!isReferenceClaim(value)) {
    throw new OrganizationConfigError(`${name} must be one of: ${REFERENCE_CLAIMS.join(', ')}`);
  }
  return value;
}

/**
 * Un `Host` reducido a lo que identifica al inquilino, o `undefined`.
 *
 * Las cuatro normalizaciones son las cuatro formas en las que el mismo dominio
 * llega escrito distinto, y cada una es un fallo de encaminamiento silencioso:
 *
 *  · **Mayúsculas** — `Bank.Demo-TE.com` es el mismo host (RFC 4343). Un
 *    navegador no lo escribe así, pero `curl` sí y la cartera va detrás de lo
 *    que ponga el `did:web`.
 *  · **El puerto** — `seguros.localhost:3000` en desarrollo. Es de la máquina,
 *    no de la organización: el mismo servidor en otro puerto sigue siendo suyo.
 *  · **El punto final** — `bank.demo-te.com.` es la forma absoluta y válida.
 *  · **Los espacios** — de la variable de entorno, no del protocolo.
 *
 * Lo que **no** se hace es aceptar un `Host` vacío o con barras: eso no es un
 * host, es alguien probando. Devuelve `undefined` y la búsqueda no encuentra
 * nada, que es lo correcto.
 */
function normalizeHost(value: string | undefined): string | undefined {
  const trimmed = value?.trim().toLowerCase();
  if (trimmed === undefined || trimmed === '') return undefined;
  // El puerto se quita por el ÚLTIMO `:` y sólo si lo que sigue son dígitos:
  // una IPv6 literal (`[::1]:3000`) tiene dos puntos dentro del corchete.
  const withoutPort = trimmed.replace(/:\d+$/, '');
  const withoutTrailingDot = withoutPort.replace(/\.$/, '');
  if (withoutTrailingDot === '' || /[/\\?#\s]/.test(withoutTrailingDot)) return undefined;
  return withoutTrailingDot;
}

/** Una lista de hosts separados por comas o espacios, ya normalizados. */
function readHostList(name: string): readonly string[] {
  return (process.env[name] ?? '')
    .split(/[\s,]+/)
    .map((entry) => normalizeHost(entry))
    .filter((entry): entry is string => entry !== undefined);
}

/**
 * Los números oficiales, separados por comas.
 *
 * Se separa por **comas y sólo comas** aunque el resto de listas de este
 * proyecto acepten también espacios: un teléfono se escribe con espacios
 * (`+34 918 40 22 47`) y partirlo por ellos convertiría un número en cinco.
 *
 * Lo que sí se hace es normalizar los espacios interiores a uno, porque el
 * valor acaba dentro de una credencial firmada y dos emisiones que el operador
 * escribió igual no pueden diferir en un espacio de más.
 */
function readOfficialNumbers(name: string): readonly string[] {
  return (process.env[name] ?? '')
    .split(',')
    .map((entry) => entry.trim().replace(/\s+/g, ' '))
    .filter((entry) => entry !== '');
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
      'no organisation is declared: CRM_ORG_<SLUG>_ID is missing (see .env.example)',
    );
  }

  // Dos organizaciones sobre el mismo host es la misma errata de copiar y pegar
  // que dos con el mismo `organization_id`, pero peor: no rompe nada al
  // arrancar y lo que hace es servir el padrón —y el documento DID— de una en
  // el dominio de la otra. Se comprueba aquí, una vez, y revienta al arrancar.
  const seen = new Map<string, string>();
  for (const organization of organizations.values()) {
    for (const host of hostsOf(organization)) {
      const owner = seen.get(host);
      if (owner !== undefined) {
        throw new OrganizationConfigError(
          `host ${host} is declared by two organisations (${owner} and ${organization.orgId})`,
        );
      }
      seen.set(host, organization.orgId);
    }
  }

  organizationsCache = organizations;
  return organizations;
}

/** Todos los hosts que encaminan a esta organización: el suyo y sus alias. */
function hostsOf(organization: OrganizationConfig): readonly string[] {
  return organization.domain === undefined
    ? organization.devHosts
    : [organization.domain, ...organization.devHosts];
}

/**
 * La organización que vive en ese `Host`, o `undefined`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  NO TIENE RESPALDO, Y ÉSA ES SU RAZÓN DE SER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Un host que no encaja con nada devuelve `undefined` y **nunca la primera
 * organización declarada**. Quien la llama decide qué hacer con eso, y las dos
 * decisiones son distintas a propósito:
 *
 *  · `/.well-known/did.json` responde **404**. Devolver el documento del banco
 *    «por defecto» sería publicar la identidad de Banco Demo en un dominio que
 *    no es suyo, y cualquiera que apuntase un DNS aquí tendría un `did:web`
 *    respaldado por nuestras claves.
 *  · La consola cae en `CRM_ACTIVE_ORG_ID`, que es una decisión escrita por
 *    quien despliega —no una suposición— y es lo que hace que `localhost`
 *    siga funcionando.
 */
export function findOrganizationByHost(
  host: string | null | undefined,
): OrganizationConfig | undefined {
  const normalized = normalizeHost(host ?? undefined);
  if (normalized === undefined) return undefined;
  for (const organization of getOrganizations().values()) {
    if (hostsOf(organization).includes(normalized)) return organization;
  }
  return undefined;
}

/** La configuración de una organización, o error si no está declarada. */
export function getOrganization(orgId: string): OrganizationConfig {
  const organization = getOrganizations().get(orgId);
  if (organization === undefined) {
    throw new OrganizationConfigError(`organisation ${orgId} is not declared in the environment`);
  }
  return organization;
}

/**
 * La organización de este despliegue **cuando el `Host` no dice cuál es**.
 *
 * Ya no es la forma normal de elegir: desde que un despliegue sirve cuatro
 * dominios, quien elige es el dominio de la petición
 * (`./request-organization.ts`). Esto es lo que queda para las peticiones que
 * llegan por un host que no encaja con nada —`localhost:3000` en desarrollo— y
 * para el código que no tiene petición delante.
 *
 * `CRM_ACTIVE_ORG_ID` la elige; si sólo hay una declarada, ésa. Con varias
 * declaradas y sin variable **falla**, y eso es lo que se quiere: en producción
 * la variable NO se pone, así que un host desconocido no acaba enseñando el
 * padrón de la primera organización que hubiera en el mapa.
 */
export function getActiveOrganization(): OrganizationConfig {
  const requested = process.env.CRM_ACTIVE_ORG_ID?.trim();
  if (requested !== undefined && requested !== '') return getOrganization(requested);

  const organizations = getOrganizations();
  const [only] = [...organizations.values()];
  if (organizations.size !== 1 || only === undefined) {
    throw new OrganizationConfigError(
      'this address matches no declared organisation, and there is more than one: ' +
        'come in through the organisation domain (CRM_ORG_<SLUG>_DOMAIN) or set CRM_ACTIVE_ORG_ID',
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
