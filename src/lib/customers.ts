import 'server-only';

import type { MessageKey, Translator } from '@/i18n/translate';

import { query } from './db';
import { REFERENCE_CLAIMS } from './reference-claims';
import type { VerificationStatus } from './verification-status';

/**
 * El padrón de clientes de la organización — lectura y alta.
 *
 * Cada consulta lleva el `org_id` en el `where`, sin excepción, **y eso no
 * cambia porque ahora haya una sola organización por instalación**. Es el
 * requisito de auditoría de F4 —«un empleado de otra organización no ve ni opera
 * los clientes de ésta»— y la forma de que se cumpla es que **no exista** una
 * función que busque un cliente sin organización: `findCustomer` la pide como
 * primer parámetro en vez de buscar por `external_id` a secas, que sería más
 * cómodo y estaría mal.
 *
 * Y sigue haciendo falta de verdad: dos instalaciones pueden compartir base
 * —comparten esquema, y en una demostración comparten servidor— y el día que
 * alguien apunte las dos al mismo Postgres, el `org_id` del `where` es lo único
 * que impide que la consola de una enseñe el padrón de la otra.
 */

export interface Customer {
  readonly id: string;
  readonly orgId: string;
  /** El `sub` de la credencial. Ver `db/001_init.sql`. */
  readonly externalId: string;
  readonly givenName: string;
  readonly familyName: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly accountLast4: string | null;
  /**
   * El punto de suministro, en las comercializadoras de energía. `null` en el
   * resto.
   *
   * Identifica el **contador**, no al cliente: la luz llega a una casa y quien
   * la paga puede cambiar. Es la referencia de su sector — el equivalente de
   * `accountLast4` — y es la que el titular reconoce cuando alguien dice
   * llamarle de su compañía de la luz. Ver `db/006_…`.
   */
  readonly supplyPointNumber: string | null;
  /** `YYYY-MM-DD` ya formateado por Postgres. Ver la nota de abajo. */
  readonly customerSince: string | null;
  /**
   * La fecha de nacimiento, `YYYY-MM-DD`. **No se divulga nunca.**
   *
   * Está en la ficha para poder contestar «¿es mayor de 18?» sin que la fecha
   * salga: lo que entra en la credencial son los tres sí o no que se derivan de
   * ella —`age_over_18`, `age_over_21`, `age_over_65`—, y `birth_date` **no
   * está en el catálogo de atributos**, así que no hay pantalla que la ofrezca
   * ni ruta que la acepte. Ver `db/012_birth_date.sql`.
   */
  readonly birthDate: string | null;
  readonly createdAt: string;
}

interface CustomerRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  external_id: string;
  given_name: string;
  family_name: string;
  email: string | null;
  phone: string | null;
  account_last4: string | null;
  supply_point_number: string | null;
  customer_since: string | null;
  birth_date: string | null;
  created_at: Date;
}

/**
 * `customer_since` y `birth_date` se piden ya como texto.
 *
 * El driver convierte un `date` de Postgres en un `Date` de JavaScript a
 * medianoche **en la zona del servidor**, y al volver a `YYYY-MM-DD` con
 * `toISOString()` en una zona al oeste de UTC sale el día anterior. El cliente
 * dado de alta el día 1 aparecería como del 31, y eso acabaría dentro de una
 * credencial firmada. Formatearlo en Postgres quita el problema de raíz.
 *
 * En `birth_date` el mismo desplazamiento de un día cuesta más caro: no se
 * enseña en ninguna pantalla —de ahí que nadie fuera a notar el error— y lo
 * único que sale de ella son los tres sí o no de la edad, así que el día del
 * cumpleaños de un cliente el banco firmaría «no es mayor de 18» sobre alguien
 * que lo es.
 *
 * Las columnas llevan el alias `c.` porque el listado cruza esta tabla con la
 * última oferta y la última comprobación de cada cliente, y las tres tienen
 * `created_at`: sin prefijo, Postgres rechaza la consulta por ambigua. Todas
 * las consultas declaran el mismo alias para que la lista sea una sola.
 */
const SELECT_COLUMNS = `
  c.id,
  c.org_id,
  c.external_id,
  c.given_name,
  c.family_name,
  c.email,
  c.phone,
  c.account_last4,
  c.supply_point_number,
  to_char(c.customer_since, 'YYYY-MM-DD') as customer_since,
  to_char(c.birth_date, 'YYYY-MM-DD') as birth_date,
  c.created_at
`;

function toCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    orgId: row.org_id,
    externalId: row.external_id,
    givenName: row.given_name,
    familyName: row.family_name,
    email: row.email,
    phone: row.phone,
    accountLast4: row.account_last4,
    supplyPointNumber: row.supply_point_number,
    customerSince: row.customer_since,
    birthDate: row.birth_date,
    createdAt: row.created_at.toISOString(),
  };
}

/**
 * Una fila del listado: la ficha, más el estado de su identidad digital.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  LAS DOS COLUMNAS DE ESTADO SALEN DEL DIARIO DEL BANCO, NO DE UNA SUPOSICIÓN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `lastOffer*` es lo que ESTA consola ofreció y por dónde. `lastVerification*`
 * es el desenlace que te-api dio de la última comprobación. Ninguna de las dos
 * afirma que el titular tenga la credencial guardada ni que su perfil esté
 * verificado: **eso no lo sabe nadie aquí**, te-api no tiene ruta que lo diga,
 * y por eso no hay ninguna insignia que lo insinúe. Lo que hay son hechos con
 * fecha.
 */
export interface CustomerListEntry extends Customer {
  readonly lastOfferAt: string | null;
  readonly lastOfferDelivery: string | null;
  readonly lastVerificationId: string | null;
  readonly lastVerificationAt: string | null;
  readonly lastVerificationStatus: VerificationStatus | null;
  readonly lastVerificationExpiresAt: string | null;
}

interface CustomerListRow extends CustomerRow {
  last_offer_at: Date | null;
  last_offer_delivery: string | null;
  last_verification_id: string | null;
  last_verification_at: Date | null;
  last_verification_status: VerificationStatus | null;
  last_verification_expires_at: Date | null;
}

/**
 * Quita los acentos para poder buscar sin ellos.
 *
 * Un agente al teléfono teclea «perez», no «Pérez»: pedirle el acento para
 * encontrar a un cliente es pedirle que sepa cómo está escrito lo que está
 * buscando. Se hace con `translate` y no con la extensión `unaccent` porque
 * esta base es la del CRM y no queremos que levantarla dependa de que alguien
 * haya instalado una extensión — el juego de caracteres del castellano y el
 * catalán cabe en una línea.
 */
const UNACCENT = `translate(lower($COLUMN$), 'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc')`;

function unaccented(column: string): string {
  return UNACCENT.replace('$COLUMN$', column);
}

/**
 * El listado con búsqueda, ya cruzado con el estado de cada cliente.
 *
 * El término se compara contra el nombre completo, el identificador, el correo
 * y **la referencia del sector** —los cuatro de la cuenta o el punto de
 * suministro—, que es lo que un agente tiene delante cuando suena el teléfono: o
 * le dicen cómo se llaman, o le cantan un número.
 *
 * Las dos referencias se buscan siempre, sin mirar de qué sector es la
 * instalación. No hace falta distinguir: el `where` ya lleva el `org_id`, y una
 * columna que esta empresa no rellena no puede encontrar nada de nadie — no
 * distinguir es lo que hace que el buscador sea el mismo en las dos sin un `if`
 * por sector.
 *
 * El orden es **alfabético por apellidos**, como un padrón y no como un registro
 * de altas: quien mira esta pantalla busca a una persona, no las últimas cuatro
 * que se dieron de alta.
 *
 * Los dos `left join lateral` traen la última oferta y la última comprobación
 * de cada fila en la misma consulta. Con una consulta por cliente esto serían
 * cien viajes a la base para pintar cincuenta filas.
 */
export async function searchCustomers(
  orgId: string,
  term: string,
): Promise<CustomerListEntry[]> {
  const trimmed = term.trim();
  const pattern = trimmed === '' ? null : `%${trimmed}%`;

  const rows = await query<CustomerListRow>(
    `select ${SELECT_COLUMNS},
            offer.created_at   as last_offer_at,
            offer.delivery     as last_offer_delivery,
            ver.presentation_id as last_verification_id,
            ver.requested_at    as last_verification_at,
            ver.status          as last_verification_status,
            ver.expires_at      as last_verification_expires_at
       from customer c
       left join lateral (
         select o.created_at, o.delivery
           from credential_offer o
          where o.org_id = c.org_id and o.external_id = c.external_id
          order by o.created_at desc
          limit 1
       ) offer on true
       left join lateral (
         select v.presentation_id, v.requested_at, v.status, v.expires_at
           from verification v
          where v.org_id = c.org_id and v.external_id = c.external_id
          order by v.requested_at desc
          limit 1
       ) ver on true
      where c.org_id = $1
        and ($2::text is null
             or ${unaccented("concat(c.given_name, ' ', c.family_name)")} like ${unaccented('$2')}
             or lower(c.external_id) like lower($2)
             or lower(coalesce(c.email, '')) like lower($2)
             or coalesce(c.account_last4, '') like $2
             or lower(coalesce(c.supply_point_number, '')) like lower($2))
      order by c.family_name, c.given_name
      limit 500`,
    [orgId, pattern],
  );

  return rows.map((row) => ({
    ...toCustomer(row),
    lastOfferAt: row.last_offer_at === null ? null : row.last_offer_at.toISOString(),
    lastOfferDelivery: row.last_offer_delivery,
    lastVerificationId: row.last_verification_id,
    lastVerificationAt:
      row.last_verification_at === null ? null : row.last_verification_at.toISOString(),
    lastVerificationStatus: row.last_verification_status,
    lastVerificationExpiresAt:
      row.last_verification_expires_at === null
        ? null
        : row.last_verification_expires_at.toISOString(),
  }));
}

export async function findCustomer(orgId: string, externalId: string): Promise<Customer | null> {
  const rows = await query<CustomerRow>(
    `select ${SELECT_COLUMNS} from customer c where c.org_id = $1 and c.external_id = $2`,
    [orgId, externalId],
  );
  const row = rows[0];
  return row === undefined ? null : toCustomer(row);
}

export interface CustomerInput {
  readonly externalId: string;
  readonly givenName: string;
  readonly familyName: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly accountLast4: string | null;
  readonly supplyPointNumber: string | null;
  readonly customerSince: string | null;
  readonly birthDate: string | null;
}

/**
 * El alta ya existía con ese `external_id` en esta organización.
 *
 * Lleva el identificador y **no una frase**: el mensaje lo compone quien lo va
 * a enseñar, en el idioma de quien está mirando. Un error que carga con su
 * propio texto acaba enseñando el idioma del servidor a quien eligió otro.
 */
export class DuplicateCustomerError extends Error {
  readonly externalId: string;

  constructor(externalId: string) {
    super(`duplicate customer ${externalId}`);
    this.name = 'DuplicateCustomerError';
    this.externalId = externalId;
  }
}

export async function createCustomer(orgId: string, input: CustomerInput): Promise<Customer> {
  try {
    // `as c` para que el `returning` pueda usar el mismo alias que el resto de
    // consultas y `SELECT_COLUMNS` sirva también aquí.
    const rows = await query<CustomerRow>(
      `insert into customer as c
         (org_id, external_id, given_name, family_name, email, phone, account_last4,
          supply_point_number, customer_since, birth_date)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       returning ${SELECT_COLUMNS}`,
      [
        orgId,
        input.externalId,
        input.givenName,
        input.familyName,
        input.email,
        input.phone,
        input.accountLast4,
        input.supplyPointNumber,
        input.customerSince,
        input.birthDate,
      ],
    );
    const row = rows[0];
    if (row === undefined) throw new Error('the insert returned no row');
    return toCustomer(row);
  } catch (error) {
    // `23505` es la violación de la única `(org_id, external_id)`. Se traduce
    // aquí y no en la interfaz para que el error de duplicado sea el mismo
    // venga de donde venga el alta.
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      throw new DuplicateCustomerError(input.externalId);
    }
    throw error;
  }
}

/** Un campo mal, con el nombre del campo para poder señalarlo en el formulario. */
export interface ValidationIssue {
  readonly field: keyof CustomerInput;
  /** Qué le pasa, como clave. Lo traduce la acción, que sabe qué idioma toca. */
  readonly messageKey: MessageKey;
}

/**
 * Valida el alta.
 *
 * Se valida en el servidor y no sólo con los atributos del formulario porque el
 * `external_id` acaba dentro de una credencial firmada: lo que entre aquí mal
 * sale mal de walt.id, y una credencial no se corrige, se revoca.
 */
export function validateCustomerInput(raw: {
  externalId?: string;
  givenName?: string;
  familyName?: string;
  email?: string;
  phone?: string;
  accountLast4?: string;
  supplyPointNumber?: string;
  customerSince?: string;
  birthDate?: string;
}): { input: CustomerInput; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const trim = (value: string | undefined): string => (value ?? '').trim();
  const optional = (value: string | undefined): string | null => {
    const trimmed = trim(value);
    return trimmed === '' ? null : trimmed;
  };

  const externalId = trim(raw.externalId);
  const givenName = trim(raw.givenName);
  const familyName = trim(raw.familyName);
  const accountLast4 = optional(raw.accountLast4);
  const supplyPointNumber = optional(raw.supplyPointNumber);
  const customerSince = optional(raw.customerSince);
  const birthDate = optional(raw.birthDate);

  // El juego de caracteres es cerrado a propósito: el `external_id` viaja como
  // `sub` en un JWT y aparece en URLs. Dejar espacios o barras dentro es
  // regalarse un problema de codificación dentro de una credencial firmada.
  if (externalId === '') {
    issues.push({ field: 'externalId', messageKey: 'customerForm.errorRequiredExternalId' });
  } else if (!/^[A-Za-z0-9._:-]{1,128}$/.test(externalId)) {
    issues.push({ field: 'externalId', messageKey: 'customerForm.errorExternalIdCharset' });
  }

  if (givenName === '') {
    issues.push({ field: 'givenName', messageKey: 'customerForm.errorRequiredGivenName' });
  }
  if (familyName === '') {
    issues.push({ field: 'familyName', messageKey: 'customerForm.errorRequiredFamilyName' });
  }

  if (accountLast4 !== null && !/^[0-9]{4}$/.test(accountLast4)) {
    issues.push({ field: 'accountLast4', messageKey: 'customerForm.errorAccountLast4' });
  }

  // El punto de suministro se comprueba por LARGO y por juego de caracteres, no
  // por formato: cada mercado eléctrico numera como quiere —el CUPS español
  // tiene 20 o 22 caracteres y el MPAN británico 13 dígitos—, y una expresión
  // regular inventada aquí rechazaría suministros legítimos. Lo que sí se cierra
  // es lo que rompe al viajar dentro de un JWT y por una URL, que es lo mismo
  // que se le exige al `external_id`.
  if (supplyPointNumber !== null && !/^[A-Za-z0-9./_:-]{1,64}$/.test(supplyPointNumber)) {
    issues.push({ field: 'supplyPointNumber', messageKey: 'customerForm.errorReferenceCharset' });
  }

  if (customerSince !== null && !/^\d{4}-\d{2}-\d{2}$/.test(customerSince)) {
    issues.push({ field: 'customerSince', messageKey: 'customerForm.errorCustomerSince' });
  }

  // ── La fecha de nacimiento se comprueba MÁS que las otras dos ────────────
  //
  // Y no por rigor de más: es la única que nadie va a volver a mirar. Las otras
  // se enseñan en el listado y en la ficha, así que una errata se ve; ésta no
  // sale a ninguna pantalla —a propósito— y lo único que se ve de ella son tres
  // sí o no dentro de una credencial firmada. Un año tecleado `1826` en vez de
  // `1926` no da error en ningún sitio: da un «mayor de 65» que nadie pidió.
  //
  // Por eso, además del formato, se rechaza el futuro. Una fecha de mañana
  // convierte los tres atributos en `false` sin decir nada, y «este cliente no
  // es mayor de edad» firmado por el banco es peor que un campo vacío.
  if (birthDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    issues.push({ field: 'birthDate', messageKey: 'customerForm.errorBirthDate' });
  } else if (birthDate !== null && birthDate > today()) {
    issues.push({ field: 'birthDate', messageKey: 'customerForm.errorBirthDateFuture' });
  }

  return {
    input: {
      externalId,
      givenName,
      familyName,
      email: optional(raw.email),
      phone: optional(raw.phone),
      accountLast4,
      supplyPointNumber,
      customerSince,
      birthDate,
    },
    issues,
  };
}

/**
 * Hoy, en `YYYY-MM-DD` y en la zona horaria de este servidor.
 *
 * Se compone a mano en vez de con `toISOString()` porque aquél da UTC: en una
 * zona al este de Greenwich, a las 00:30 devolvería la fecha de ayer, y con
 * ella un cliente cumpliría los 18 un día tarde. La zona del servidor es la
 * aproximación honesta que hay —el padrón no guarda dónde vive nadie— y es la
 * misma con la que el agente lee la pantalla.
 */
function today(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * ¿Han pasado ya `years` años desde esa fecha? `null` si no hay fecha.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  SE COMPARAN CADENAS, Y ES LO CORRECTO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `YYYY-MM-DD` ordena igual alfabéticamente que cronológicamente, así que la
 * pregunta «¿nació antes del día equivalente de hace 18 años?» es una
 * comparación de texto. Hacerlo con `Date` obligaría a construir dos y a
 * elegirles hora, que es de donde salen los errores de un día — el mismo motivo
 * por el que estas dos columnas se leen ya formateadas por Postgres.
 *
 * El límite se fabrica restándole los años **al texto del año**, sin pasar por
 * `Date`, y eso arregla solo el 29 de febrero: `new Date(2026, 1, 29)` se
 * normaliza al 1 de marzo, mientras que la cadena `2008-02-29` se queda quieta
 * y se compara bien contra cualquier límite. Quien nació un 29 de febrero
 * cumple años el 1 de marzo en los años que no son bisiestos, que es la
 * convención de siempre y la que menos sorprende.
 */
function hasCompletedYears(date: string | null, years: number): boolean | null {
  if (date === null || date === '') return null;
  const now = today();
  const limit = `${Number(now.slice(0, 4)) - years}${now.slice(4)}`;
  return date <= limit;
}

/**
 * El valor de un atributo, tal y como entra en la credencial.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  UN SÍ O UN NO ENTRA COMO `boolean`, NO COMO LA CADENA `"false"`
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Y es una decisión de seguridad, no de estilo. `"false"` es una cadena no
 * vacía, o sea **verdadera** en JavaScript, en Python y en la plantilla de
 * cualquier verificador que escriba `if (claims.age_over_18)`. Una credencial
 * que dice «no es mayor de edad» de una forma que casi todo el mundo lee como
 * un sí no es un dato: es una trampa con la firma del banco encima.
 *
 * te-api los acepta sin tocarlos —`claims` es `Record<string, unknown>` y su
 * `checkClaims` sólo mira los nombres—, así que el `true` llega hasta el JWT
 * como `true`.
 */
export type AttributeValue = string | boolean;

/**
 * Un atributo del padrón que puede acabar dentro de una credencial.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ESTE CATÁLOGO ES LO ÚNICO DE ESTE BANCO QUE SIGUE SIENDO CÓDIGO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Y tiene que serlo: un atributo sólo se puede poner en una credencial si el
 * padrón sabe contestarlo, y las columnas de `customer` son el núcleo bancario
 * de esta maqueta. Declarar `supply_point_number` en un `.env` no crea la
 * columna, así que ponerlo en configuración sería configuración que miente.
 *
 * **Saberlo no es siempre tenerlo en una columna.** Los tres atributos de edad
 * no son columnas: son la respuesta a una pregunta sobre `birth_date`, que se
 * calcula aquí y no se guarda —guardar «mayor de 18» sería guardar un dato que
 * caduca solo el día del cumpleaños—. La regla sigue en pie: lo que el padrón
 * no sabe no se firma; lo que sabe puede salir **derivado**, y salir derivado
 * es lo que permite contestar sin divulgar.
 *
 * Lo que **sí** es configuración es qué atributos de éstos lleva cada tipo de
 * credencial y cómo se rotula cada tipo. Eso vive en `credential-profiles.ts`
 * y sale del entorno, que es lo que permite que un segundo tipo en el padrón
 * de te-api funcione sin tocar código.
 */
export interface CustomerAttribute {
  /** El nombre del claim en la credencial. Es lo que viaja y lo que se pide. */
  readonly claim: string;
  /**
   * El rótulo que lee el agente, **como clave del catálogo**.
   *
   * Es una clave y no un texto porque el mismo atributo lo rotulan cinco
   * pantallas y todas tienen que decirlo igual en el idioma que sea. El nombre
   * técnico se enseña **al lado** y no en su lugar: el agente tiene que poder
   * leer «Apellidos» de un vistazo, y quien depura tiene que poder cruzar
   * `family_name` con lo que devuelve te-api.
   */
  readonly labelKey: MessageKey;
  /**
   * Si forma parte del mínimo con el que este banco confirma «quién eres».
   *
   * Es lo que va marcado por defecto en la pantalla de comprobación. Se declara
   * aquí, junto a la columna, y no en el componente: el componente no puede
   * saber cuál de los atributos de un banco cualquiera identifica a una
   * persona, y cuando creía saberlo era porque comparaba con `given_name` —que
   * es exactamente lo que se rompe con el segundo partner.
   */
  readonly identifying: boolean;
  /**
   * De dónde sale en la ficha. `null` = esta ficha no lo tiene.
   *
   * `null` y `false` no son lo mismo y ninguna de las dos cosas se puede
   * confundir con la otra: `null` es «este banco no lo sabe» —y entonces el
   * atributo ni se ofrece ni se firma—, mientras que `false` es una respuesta,
   * y una respuesta se firma como cualquier otra. Un «no es mayor de 18» que se
   * cayera por el mismo agujero que un dato que falta dejaría al verificador
   * sin poder distinguir al menor del cliente sin fecha de nacimiento.
   */
  readonly read: (customer: Customer) => AttributeValue | null;
  /**
   * Cómo se escribe el valor en pantalla, si no es tal cual.
   *
   * Sólo lo usa `account_last4`, y para algo que no es adorno: el valor
   * guardado es `4471` y lo que hay que leer es `···· 4471`, porque son los
   * cuatro ÚLTIMOS de un número más largo. Enseñar `4471` a secas invita a
   * leerlo como el número de cuenta entero.
   *
   * Lo que viaja a la credencial es siempre `read`, nunca esto: dentro de algo
   * firmado van los cuatro dígitos, no los puntos.
   */
  readonly display?: (value: string) => string;
  /**
   * El rótulo corto, para la cabecera de una columna.
   *
   * «Últimos cuatro de la cuenta» es lo correcto junto a una casilla que decide
   * qué se firma —ahí el agente tiene que leer exactamente qué está pidiendo—,
   * y es demasiado largo encima de una columna de cinco caracteres. Se declara
   * aparte en vez de recortar el largo en pantalla: recortar produce «Últimos
   * cuatro de la…», que no es un rótulo.
   */
  readonly shortLabelKey?: MessageKey;
}

/**
 * ─────────────────────────────────────────────────────────────────────────
 * POR QUÉ NO ESTÁN EL CORREO, EL TELÉFONO NI LA FECHA DE NACIMIENTO
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Porque no son divulgables: el CRM los guarda para su propio uso —avisar al
 * cliente, buscarlo en el listado, calcular la edad— y no los mete en algo
 * firmado que el titular va a enseñar por ahí. Meter un dato «ya que estamos»
 * en una credencial es meterlo en todas las presentaciones que se hagan con
 * ella.
 *
 * `birth_date` es el caso más claro de los tres y el que explica los atributos
 * de edad de abajo: la fecha de nacimiento identifica —con el nombre, es de los
 * campos que más ayudan a cruzar a una persona entre dos bases— y encima dice
 * mucho más de lo que nadie preguntó. La tienda quiere saber si puede vender
 * alcohol, no cuándo es tu cumpleaños. Por eso el padrón la guarda y el
 * catálogo ofrece la RESPUESTA en su lugar.
 *
 * No estar en este catálogo es la forma de que no puedan pedirse: la pantalla
 * ofrece lo que hay aquí, y el servidor **rechaza** lo que no esté.
 */
export const CUSTOMER_ATTRIBUTES: readonly CustomerAttribute[] = [
  {
    claim: 'given_name',
    labelKey: 'attributes.givenName',
    identifying: true,
    read: (c) => c.givenName,
  },
  {
    claim: 'family_name',
    labelKey: 'attributes.familyName',
    identifying: true,
    read: (c) => c.familyName,
  },
  {
    claim: 'account_last4',
    labelKey: 'attributes.accountLast4',
    identifying: false,
    read: (c) => c.accountLast4,
    display: (value) => `···· ${value}`,
    shortLabelKey: 'attributes.accountLast4Short',
  },
  /*
    ─────────────────────────────────────────────────────────────────────────
    EL DEL OTRO SECTOR
    ─────────────────────────────────────────────────────────────────────────

    Entra en el catálogo GENERAL y no en uno por organización, y no es pereza:
    el catálogo dice qué columnas del padrón son divulgables, y una instalación
    concreta rellena unas y deja otras a `null`. Lo que decide qué ve cada
    agente es el filtro que ya existía —`resolveCredentialType` descarta lo que
    la ficha no rellena—, así que a quien atiende en el banco no le aparece
    «Punto de suministro» sin que nadie haya escrito un `if` por sector.

    Va `identifying: false`, igual que `account_last4`: no es con lo que se
    confirma «quién eres» —eso son el nombre y los apellidos—, es con lo que el
    titular reconoce de qué relación se le está hablando. Marcarlo por defecto
    en la pantalla de comprobación sería pedir de más en cada comprobación, que
    es justo lo que la divulgación selectiva existe para no tener que hacer.
  */
  {
    claim: 'supply_point_number',
    labelKey: 'attributes.supplyPointNumber',
    identifying: false,
    read: (c) => c.supplyPointNumber,
    shortLabelKey: 'attributes.supplyPointNumberShort',
  },
  {
    claim: 'customer_since',
    labelKey: 'attributes.customerSince',
    identifying: false,
    read: (c) => c.customerSince,
  },
  /*
    ═══════════════════════════════════════════════════════════════════════════
     LOS DERIVADOS: LA RESPUESTA EN VEZ DEL DATO
    ═══════════════════════════════════════════════════════════════════════════

    Los cuatro de aquí abajo contestan una pregunta cerrada sobre una columna que
    NO sale de la ficha. Es el argumento entero de una credencial y hasta ahora
    esta maqueta no lo enseñaba: un carné de conducir en la mano dice la fecha de
    nacimiento, la dirección y el número de documento aunque el portero sólo
    quisiera saber una cosa. Aquí sólo viaja esa cosa.

    Y son atributos normales, no una ceremonia aparte. La puerta de edad de la
    fase 6 (`api/age/check`) es otra cosa y sigue estando: allí se pregunta a la
    cartera —que responde desde su credencial de identidad— y no se marca nada.
    Éstos los EMITE el banco dentro de la credencial de cliente, así que el
    agente puede pedirlos sueltos o junto al nombre, en la misma comprobación y
    con las mismas casillas. Uno no sustituye al otro: quien no tenga fecha en el
    padrón sigue teniendo la puerta de edad, y quien la tenga puede contestar sin
    sacar el documento.

    Los tres umbrales de edad no son un capricho de la maqueta:

      · 18 — la mayoría de edad. Contratar, firmar, comprar lo que la ley acota.
      · 21 — el umbral de varios mercados y productos, y el que demuestra que
             añadir uno nuevo no es una pantalla nueva: es una fila más aquí.
      · 65 — las condiciones de mayores, que un banco aplica de verdad
             (exenciones de comisiones, productos de jubilación). Se contesta
             sin que el cliente enseñe la edad exacta, que es lo que hoy le pide
             cualquier oficina.

    El cuarto no es de edad y va a propósito: la ANTIGÜEDAD como relación es el
    otro dato con el que un banco decide cosas —preaprobados, exenciones,
    atención preferente—, y `customer_since` ya está en la credencial con la
    fecha exacta. Que convivan es el punto: el agente que sólo necesita saber si
    hace más de cinco años que es cliente marca la casilla del sí o el no, y la
    fecha se queda en casa. Se elige un solo umbral y no cuatro porque cada uno
    es un claim más en una credencial que dura años.

    Van todos `identifying: false`. Ninguno confirma «quién eres» —de hecho
    están para lo contrario, para contestar sin identificar— y marcarlos por
    defecto sería pedir de más en cada comprobación.

    Una ficha sin `birth_date` devuelve `null` en los tres primeros y entonces no
    se ofrecen ni se firman: `resolveCredentialType` descarta lo que la ficha no
    rellena, así que las credenciales ya emitidas y las organizaciones que no
    guardan la fecha se quedan exactamente como estaban.
  */
  {
    claim: 'age_over_18',
    labelKey: 'attributes.ageOver18',
    identifying: false,
    read: (c) => hasCompletedYears(c.birthDate, 18),
  },
  {
    claim: 'age_over_21',
    labelKey: 'attributes.ageOver21',
    identifying: false,
    read: (c) => hasCompletedYears(c.birthDate, 21),
  },
  {
    claim: 'age_over_65',
    labelKey: 'attributes.ageOver65',
    identifying: false,
    read: (c) => hasCompletedYears(c.birthDate, 65),
  },
  {
    claim: 'customer_over_5_years',
    labelKey: 'attributes.customerOver5Years',
    identifying: false,
    read: (c) => hasCompletedYears(c.customerSince, 5),
  },
];

/** El atributo del catálogo con ese nombre de claim, si existe. */
export function findCustomerAttribute(claim: string): CustomerAttribute | undefined {
  return CUSTOMER_ATTRIBUTES.find((attribute) => attribute.claim === claim);
}

/**
 * Los claims que van a la credencial, construidos **desde la ficha**.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ESTA FUNCIÓN NO RECIBE NINGÚN VALOR DEL NAVEGADOR, Y ESO ES EL PUNTO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * El botón de emitir manda un `externalId` y ya está. El contenido de la
 * credencial sale de la fila de la base. Si los claims llegaran del navegador,
 * cualquiera con la consola de red abierta emitiría una credencial firmada por
 * este banco diciendo lo que le apeteciera — y la firma sería buena.
 *
 * `claimNames` dice **qué atributos lleva este tipo de credencial**, y sale del
 * perfil del tipo (`credential-profiles.ts`), no de la petición. Los valores
 * siguen saliendo de la fila y de ningún otro sitio.
 *
 * Se recorre el catálogo y no `claimNames` por dos razones: el orden en
 * pantalla queda siempre el mismo aunque la variable de entorno esté
 * desordenada, y un nombre que no esté en el catálogo no puede colarse.
 *
 * Los campos vacíos se omiten en vez de ir como `null`: un claim presente y
 * vacío es un claim que el verificador tiene que interpretar.
 *
 * ⚠ **Un `false` no está vacío y por eso entra.** Es la única comparación de
 * esta función que hay que leer despacio: `value !== null && value !== ''` deja
 * pasar el `false` a propósito, porque «no es mayor de 18» es una respuesta y no
 * la ausencia de una. Omitirlo dejaría al menor de edad y al cliente sin fecha
 * de nacimiento con exactamente la misma credencial.
 */
export function buildCredentialClaims(
  customer: Customer,
  claimNames: readonly string[],
): Record<string, AttributeValue> {
  const claims: Record<string, AttributeValue> = {};
  for (const attribute of CUSTOMER_ATTRIBUTES) {
    if (!claimNames.includes(attribute.claim)) continue;
    const value = attribute.read(customer);
    if (value !== null && value !== '') claims[attribute.claim] = value;
  }
  return claims;
}


/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  LA «REFERENCIA»: LA CUENTA Y EL PUNTO DE SUMINISTRO SON LA MISMA COSA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * En cada sector hay un dato con el que el titular reconoce **de qué relación se
 * le está hablando**: los cuatro últimos de su cuenta en el banco, su punto de
 * suministro en la comercializadora. Hace el mismo trabajo en los dos y por eso
 * ocupa el mismo sitio en pantalla.
 *
 * Estaba escrito «Cuenta» a mano en tres pantallas, que era correcto mientras el
 * producto fuera de un banco y sólo de un banco. Una consola de energía con una
 * columna «Cuenta» vacía en las diez filas es una columna muerta que además le
 * dice al cliente, si mira por encima del hombro del agente, que esto es
 * software de otro sector.
 *
 * Aquí —en lo que se LEE de una ficha— la resolución es **por los datos y no
 * por configuración**, y sigue siendo deliberado: la instalación que rellena
 * puntos de suministro es la que tiene puntos de suministro, y una variable más
 * sería una variable que se puede poner mal para decir algo que el padrón ya
 * dice.
 *
 * ⚠ **En el ALTA no hay datos de los que resolver, y por eso allí sí hay una
 * variable.** Un formulario vacío no ha rellenado ninguna columna, así que no
 * puede deducir el sector de nadie: ofrecía las dos, y a un agente de una
 * eléctrica le aparecía una casilla de otro negocio. Eso lo decide
 * `CRM_REFERENCE_CLAIM` (`./reference-claims.ts`), que es de dónde sale el juego
 * cerrado de abajo. Las dos preguntas son distintas y por eso tienen respuestas
 * distintas: «cuál rellenó esta ficha» la contestan los datos, «cuál va a
 * rellenar esta consola» sólo la puede contestar quien despliega.
 */
const REFERENCE_ATTRIBUTES: readonly CustomerAttribute[] = CUSTOMER_ATTRIBUTES.filter(
  (attribute) => (REFERENCE_CLAIMS as readonly string[]).includes(attribute.claim),
);

/**
 * La referencia de UNA ficha: la primera de las cuatro que rellena.
 *
 * El `typeof` no es una formalidad del compilador: una referencia es un número
 * que el titular canta por teléfono, así que es texto por definición. Si alguien
 * declarase una referencia derivada —un sí o un no— esto la ignoraría en vez de
 * enseñar «true» donde va un número de cuenta.
 */
export function referenceOf(
  customer: Customer,
): { attribute: CustomerAttribute; value: string } | undefined {
  for (const attribute of REFERENCE_ATTRIBUTES) {
    const value = attribute.read(customer);
    if (typeof value === 'string' && value !== '') return { attribute, value };
  }
  return undefined;
}

/**
 * La referencia que rotula la COLUMNA de un listado.
 *
 * Se elige la que más fichas rellenan y no la primera que aparece: un padrón
 * migrado a medias puede tener una ficha suelta con la columna del sector
 * equivocado, y esa ficha no puede decidir el rótulo de las otras cien.
 *
 * `undefined` = ninguna ficha rellena ninguna, y entonces la columna **no se
 * pinta**. Una columna entera de guiones no informa de nada; que no esté dice
 * lo mismo y ocupa menos.
 */
export function listReferenceAttribute(
  customers: readonly Customer[],
): CustomerAttribute | undefined {
  let best: { attribute: CustomerAttribute; count: number } | undefined;
  for (const attribute of REFERENCE_ATTRIBUTES) {
    const count = customers.filter((customer) => {
      const value = attribute.read(customer);
      return value !== null && value !== '';
    }).length;
    if (count > 0 && (best === undefined || count > best.count)) best = { attribute, count };
  }
  return best?.attribute;
}

/**
 * El valor ya escrito como se lee en pantalla, en el idioma de quien mira.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  UN SÍ O UN NO SE PINTA COMO PALABRA, AUNQUE SE FIRME COMO `boolean`
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Por eso esta función pide el traductor, que antes no necesitaba. En la
 * credencial va `true` —un verificador tiene que poder leerlo sin adivinar el
 * idioma de nadie—, y en la pantalla del agente tiene que poner «Sí»: enseñarle
 * `true` en la vista previa de lo que está a punto de firmar le obliga a
 * traducir de cabeza justo en el momento en el que hay que leer despacio.
 *
 * `display` sigue siendo cosa del texto —`···· 4471`— y por eso sólo se aplica
 * a lo que es texto.
 */
export function displayAttribute(
  t: Translator,
  attribute: CustomerAttribute,
  customer: Customer,
): string | null {
  const value = attribute.read(customer);
  if (value === null || value === '') return null;
  if (typeof value === 'boolean') return t(value ? 'common.yes' : 'common.no');
  return attribute.display === undefined ? value : attribute.display(value);
}

/** El rótulo largo, ya traducido. */
export function attributeLabel(t: Translator, attribute: CustomerAttribute): string {
  return t(attribute.labelKey);
}

/** El rótulo corto si lo hay, y el largo si no. */
export function columnLabelOf(t: Translator, attribute: CustomerAttribute): string {
  return t(attribute.shortLabelKey ?? attribute.labelKey);
}

/**
 * De nombre de claim a rótulo, para los sitios que reciben claims sueltos.
 *
 * Lo pintan el registro de verificaciones y el recibo, que leen nombres
 * técnicos guardados en el diario y tienen que enseñarlos como palabras. Un
 * claim que ya no esté en el catálogo se queda con su nombre técnico: es un
 * recibo, y un recibo no puede dejar de enseñar un campo porque la
 * configuración haya cambiado después.
 */
export function attributeLabels(t: Translator): Record<string, string> {
  return Object.fromEntries(
    CUSTOMER_ATTRIBUTES.map((attribute) => [attribute.claim, t(attribute.labelKey)]),
  );
}
