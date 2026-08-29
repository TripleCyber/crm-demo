import 'server-only';

import { CUSTOMER_ATTRIBUTES, type Customer } from './customers';

/**
 * De `type_key` a pantalla: qué lleva cada tipo de credencial y cómo se rotula.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  POR QUÉ EXISTE ESTE FICHERO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La lista de **tipos** sale del padrón y ya salía: `GET /v1/b2b/organization`
 * devuelve los que esa organización puede emitir, y es la misma fuente contra
 * la que te-api resuelve después el `type` que se le manda.
 *
 * Lo que el padrón **no** devuelve es qué claims lleva cada tipo. Se comprobó
 * el 2026-08-29 leyendo te-api, y no es un olvido de la respuesta: es que ese
 * dato no existe allí. `te.partner_credential` tiene `type_key`,
 * `issuer_profile_id`, `vct` y `max_validity_days`, y ninguna columna de
 * claims; la gramática de `seed:partner` tampoco tiene hueco para ellos; y
 * `src/b2b/claims.ts` valida con una **lista de reservados**, no con una lista
 * blanca por tipo — a propósito, para que el banco no tenga que pedir permiso
 * por cada campo nuevo. te-api no sabe qué lleva la credencial de un banco:
 * los pone él al emitir y te-api nunca la ve.
 *
 * Así que la lista de atributos de cada tipo sale de **configuración**, que es
 * lo que había que quitar de en medio: antes salía de una constante dentro del
 * flujo de comprobación, y añadir un tipo obligaba a tocar código.
 *
 * El día que te-api exponga los claims por tipo, la resolución se queda en este
 * mismo fichero y cambia de dónde lee. Nadie más en el CRM sabe qué lleva un
 * tipo, así que nadie más se entera.
 *
 * ## Cómo se declara un tipo
 *
 *     CRM_TYPE_CLIENTE_LABEL=Cliente del banco
 *     CRM_TYPE_CLIENTE_CLAIMS=given_name family_name account_last4 customer_since
 *     CRM_TYPE_CLIENTE_DEFAULT_CLAIMS=given_name family_name
 *
 * `CLIENTE` es el `type_key` del padrón en mayúsculas, con lo que no sea letra
 * o dígito convertido en `_` (`poliza-hogar` → `CRM_TYPE_POLIZA_HOGAR_…`).
 *
 * **No hace falta declarar nada.** Sin estas variables un tipo lleva todos los
 * atributos del catálogo del padrón y va marcado el mínimo de identidad, que es
 * exactamente lo que este CRM hacía antes con una constante. Declararlas es lo
 * que permite que un segundo tipo lleve otra cosa sin tocar código.
 */

/** Un atributo tal y como se le enseña al agente. */
export interface CredentialClaimView {
  /** El nombre del claim. Es lo que viaja a te-api y lo que vuelve. */
  readonly name: string;
  /** El rótulo humano. `name` se enseña al lado, no en su lugar. */
  readonly label: string;
}

/**
 * Un tipo de credencial resuelto: lo que declara el padrón de te-api más lo que
 * dice la configuración, ya cruzado con lo que **esta ficha** puede rellenar.
 *
 * Es lo único que baja al navegador sobre los tipos. Nada de esto es secreto:
 * son los rótulos y los nombres de claim que el agente ya está mirando.
 */
export interface CredentialTypeView {
  /** El `type_key` del padrón, tal cual. Es lo que se le manda a te-api. */
  readonly type: string;
  readonly label: string;
  readonly maxValidityDays: number;
  /** Los atributos que este tipo lleva **y** que esta ficha rellena. */
  readonly claims: readonly CredentialClaimView[];
  /** Los que van marcados de salida. Ver `identifying` en el catálogo. */
  readonly defaultClaims: readonly string[];
}

/** Lo que `GET /v1/b2b/organization` devuelve por tipo, que es todo lo que hay. */
export interface DeclaredCredentialType {
  readonly type: string;
  readonly maxValidityDays: number;
}

/**
 * El `type_key` convertido en trozo de nombre de variable.
 *
 * te-api acepta `^[a-z0-9][a-z0-9._-]{0,63}$` como `type_key`, y los nombres de
 * entorno no admiten ni puntos ni guiones. Se traduce en vez de rechazarlos
 * porque el `type_key` lo elige el partner y el CRM no puede exigirle que quepa
 * en una variable de entorno.
 */
function environmentKey(type: string): string {
  return type.toUpperCase().replace(/[^A-Z0-9]/g, '_');
}

function readText(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value === undefined || value === '' ? undefined : value;
}

/**
 * Una lista de nombres de claim separados por espacios o comas.
 *
 * `undefined` —la variable no está— y lista vacía no son lo mismo: sin variable
 * se aplica el valor por defecto; con una variable puesta a vacío el tipo se
 * queda sin atributos y la pantalla lo dice. Una variable en blanco es casi
 * siempre una equivocación, y verla en pantalla es mejor que verla ignorada.
 */
function readClaimList(name: string): readonly string[] | undefined {
  const raw = process.env[name];
  if (raw === undefined) return undefined;
  return raw
    .trim()
    .split(/[\s,]+/)
    .filter((entry) => entry !== '');
}

/**
 * Cruza lo que declara el padrón con la configuración y con la ficha.
 *
 * Los tres filtros, en orden, y ninguno es prescindible:
 *
 * 1. **El tipo lo declara el padrón** (`declared`), o no está aquí.
 * 2. **Los atributos los declara la configuración**, o van todos los del
 *    catálogo.
 * 3. **El valor lo tiene que tener esta ficha.** Pedir `account_last4` de un
 *    cliente sin cuenta sería una petición que ninguna cartera puede
 *    satisfacer: ese claim no llegó a entrar en su credencial, porque
 *    `buildCredentialClaims` omite los vacíos.
 */
export function resolveCredentialType(
  declared: DeclaredCredentialType,
  customer: Customer,
): CredentialTypeView {
  const key = environmentKey(declared.type);
  const declaredClaims = readClaimList(`CRM_TYPE_${key}_CLAIMS`);

  // Se recorre el catálogo y no la variable: el orden en pantalla queda siempre
  // el mismo, y quien edite el `.env` no mueve las casillas de sitio.
  const carried = CUSTOMER_ATTRIBUTES.filter(
    (attribute) => declaredClaims === undefined || declaredClaims.includes(attribute.claim),
  );

  const available = carried.filter((attribute) => {
    const value = attribute.read(customer);
    return value !== null && value !== '';
  });

  const declaredDefaults = readClaimList(`CRM_TYPE_${key}_DEFAULT_CLAIMS`);
  let defaults = available.filter((attribute) =>
    declaredDefaults === undefined
      ? attribute.identifying
      : declaredDefaults.includes(attribute.claim),
  );

  // Si la cuenta no sale —un catálogo sin ningún atributo de identidad, o una
  // lista declarada que no cuadra con lo que esta ficha rellena— se marca el
  // primero disponible. Dejarlo vacío deja los dos botones deshabilitados sin
  // decir por qué, y el agente no tiene forma de adivinar que le falta una
  // variable de entorno.
  if (defaults.length === 0 && available.length > 0) defaults = available.slice(0, 1);

  return {
    type: declared.type,
    // Sin rótulo declarado se enseña el `type_key` tal cual, y es deliberado:
    // fabricar «Cliente» a partir de `cliente` acertaría en castellano y
    // produciría basura con `poliza-hogar` o con un padrón en otro idioma.
    label: readText(`CRM_TYPE_${key}_LABEL`) ?? declared.type,
    maxValidityDays: declared.maxValidityDays,
    claims: available.map((attribute) => ({ name: attribute.claim, label: attribute.label })),
    defaultClaims: defaults.map((attribute) => attribute.claim),
  };
}

export function resolveCredentialTypes(
  declared: readonly DeclaredCredentialType[],
  customer: Customer,
): readonly CredentialTypeView[] {
  return declared.map((entry) => resolveCredentialType(entry, customer));
}

/**
 * El tipo que pidió el navegador, **resuelto contra el padrón de te-api**.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  AQUÍ ES DONDE SE COMPRUEBA QUE EL `type` ES DE ESTA ORGANIZACIÓN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `undefined` = ese `type_key` no está en el padrón de esta organización, y la
 * ruta tiene que devolver un 400 con el nombre del tipo. te-api también lo
 * rechaza —`src/routes/b2b.ts`, `findCredentialType` devuelve `null` y sale un
 * `400 invalid_request`—, pero su cuerpo es `{ error, requestId }` y no nombra
 * el tipo, así que el agente vería «te-api ha rechazado los datos» para algo
 * que este servidor sabe contestar.
 */
export function findDeclaredType(
  declared: readonly DeclaredCredentialType[],
  type: string,
): DeclaredCredentialType | undefined {
  return declared.find((entry) => entry.type === type);
}
