import 'server-only';

import { query } from './db';

/**
 * El padrón de clientes de Banco Demo — lectura y alta.
 *
 * Cada consulta lleva el `org_id` en el `where`, sin excepción. No es
 * defensivo por gusto: es el requisito de auditoría de F4 («un empleado de otra
 * organización no ve ni opera los clientes de ésta»), y la forma de que se
 * cumpla es que **no exista** una función que busque un cliente sin
 * organización. Por eso `findCustomer` la pide como primer parámetro en vez de
 * buscar por `external_id` a secas, que sería más cómodo y estaría mal.
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
  /** `YYYY-MM-DD` ya formateado por Postgres. Ver la nota de abajo. */
  readonly customerSince: string | null;
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
  customer_since: string | null;
  created_at: Date;
}

/**
 * `customer_since` se pide ya como texto.
 *
 * El driver convierte un `date` de Postgres en un `Date` de JavaScript a
 * medianoche **en la zona del servidor**, y al volver a `YYYY-MM-DD` con
 * `toISOString()` en una zona al oeste de UTC sale el día anterior. El cliente
 * dado de alta el día 1 aparecería como del 31, y eso acabaría dentro de una
 * credencial firmada. Formatearlo en Postgres quita el problema de raíz.
 */
const SELECT_COLUMNS = `
  id,
  org_id,
  external_id,
  given_name,
  family_name,
  email,
  phone,
  account_last4,
  to_char(customer_since, 'YYYY-MM-DD') as customer_since,
  created_at
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
    customerSince: row.customer_since,
    createdAt: row.created_at.toISOString(),
  };
}

export async function listCustomers(orgId: string): Promise<Customer[]> {
  const rows = await query<CustomerRow>(
    `select ${SELECT_COLUMNS} from customer where org_id = $1 order by created_at desc limit 500`,
    [orgId],
  );
  return rows.map(toCustomer);
}

/**
 * La ficha de un titular a partir del correo con el que se autenticó.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ES LA DECISIÓN «QUIÉN ERES EN MI BANCO», Y LA TOMA EL BANCO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * El portal del cliente la usa para pasar de «esta persona se ha autenticado
 * con TripleEnable y su correo verificado es X» a «X es mi cliente
 * BD-77310092». Esa traducción es **suya y de nadie más**: te-api no ve el
 * correo, no ve el padrón y no tiene por qué. Lo único que recibe es el
 * `external_id` resultante, ya como huella.
 *
 * El correo llega del ID token verificado, **nunca de un formulario**. Si
 * viniera del navegador, cualquiera escribiría el correo de otro y se ataría al
 * cliente de otro — y te-api no lo podría ver, porque para te-api el `sub` del
 * ID token es el bueno y el `external_id` es cosa del banco.
 *
 * `lower(...)` en los dos lados porque un correo no distingue mayúsculas en la
 * parte del dominio y en la práctica tampoco en la local: `Teofilo@te.com`
 * autenticándose contra una ficha guardada como `teofilo@te.com` tiene que
 * encontrarse, o el portal dice «no te conozco» a un cliente que sí está.
 */
export async function findCustomerByEmail(orgId: string, email: string): Promise<Customer | null> {
  const rows = await query<CustomerRow>(
    `select ${SELECT_COLUMNS} from customer
      where org_id = $1 and lower(email) = lower($2)
      order by created_at asc
      limit 2`,
    [orgId, email],
  );
  // Dos fichas con el mismo correo es un dato sucio del padrón, y elegir una al
  // azar ataría al titular al cliente equivocado — un vínculo mal hecho hace
  // sonar el teléfono de una persona por una operación de otra. Se prefiere no
  // vincular y que alguien lo arregle.
  if (rows.length !== 1) return null;
  const row = rows[0];
  return row === undefined ? null : toCustomer(row);
}

export async function findCustomer(orgId: string, externalId: string): Promise<Customer | null> {
  const rows = await query<CustomerRow>(
    `select ${SELECT_COLUMNS} from customer where org_id = $1 and external_id = $2`,
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
  readonly customerSince: string | null;
}

/** El alta ya existía con ese `external_id` en esta organización. */
export class DuplicateCustomerError extends Error {
  constructor(externalId: string) {
    super(`ya hay un cliente con el identificador ${externalId}`);
    this.name = 'DuplicateCustomerError';
  }
}

export async function createCustomer(orgId: string, input: CustomerInput): Promise<Customer> {
  try {
    const rows = await query<CustomerRow>(
      `insert into customer
         (org_id, external_id, given_name, family_name, email, phone, account_last4, customer_since)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning ${SELECT_COLUMNS}`,
      [
        orgId,
        input.externalId,
        input.givenName,
        input.familyName,
        input.email,
        input.phone,
        input.accountLast4,
        input.customerSince,
      ],
    );
    const row = rows[0];
    if (row === undefined) throw new Error('el alta no devolvió ninguna fila');
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
  readonly message: string;
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
  customerSince?: string;
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
  const customerSince = optional(raw.customerSince);

  // El juego de caracteres es cerrado a propósito: el `external_id` viaja como
  // `sub` en un JWT y aparece en URLs. Dejar espacios o barras dentro es
  // regalarse un problema de codificación dentro de una credencial firmada.
  if (externalId === '') {
    issues.push({ field: 'externalId', message: 'el identificador de cliente es obligatorio' });
  } else if (!/^[A-Za-z0-9._:-]{1,128}$/.test(externalId)) {
    issues.push({
      field: 'externalId',
      message: 'sólo letras, dígitos y . _ : - (hasta 128 caracteres)',
    });
  }

  if (givenName === '') issues.push({ field: 'givenName', message: 'el nombre es obligatorio' });
  if (familyName === '') {
    issues.push({ field: 'familyName', message: 'los apellidos son obligatorios' });
  }

  if (accountLast4 !== null && !/^[0-9]{4}$/.test(accountLast4)) {
    issues.push({ field: 'accountLast4', message: 'son exactamente cuatro dígitos' });
  }

  if (customerSince !== null && !/^\d{4}-\d{2}-\d{2}$/.test(customerSince)) {
    issues.push({ field: 'customerSince', message: 'la fecha va en formato AAAA-MM-DD' });
  }

  return {
    input: {
      externalId,
      givenName,
      familyName,
      email: optional(raw.email),
      phone: optional(raw.phone),
      accountLast4,
      customerSince,
    },
    issues,
  };
}

/**
 * Un atributo del padrón que puede acabar dentro de una credencial.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ESTE CATÁLOGO ES LO ÚNICO DE ESTE BANCO QUE SIGUE SIENDO CÓDIGO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Y tiene que serlo: un atributo sólo se puede poner en una credencial si hay
 * una columna del padrón de donde sacarlo, y las columnas de `customer` son el
 * núcleo bancario de esta maqueta. Declarar `policy_number` en un `.env` no
 * crea la columna, así que ponerlo en configuración sería configuración que
 * miente.
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
   * El rótulo que lee el agente.
   *
   * El nombre técnico se enseña **al lado** y no en su lugar: el agente tiene
   * que poder leer «Apellidos» de un vistazo, y quien depura tiene que poder
   * cruzar `family_name` con lo que devuelve te-api.
   */
  readonly label: string;
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
  /** De dónde sale en la ficha. `null` = esta ficha no lo tiene. */
  readonly read: (customer: Customer) => string | null;
}

/**
 * ─────────────────────────────────────────────────────────────────────────
 * POR QUÉ NO ESTÁN EL CORREO NI EL TELÉFONO
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Porque no son divulgables: el CRM los guarda para su propio uso —avisar al
 * cliente, buscarlo en el listado— y no los mete en algo firmado que el titular
 * va a enseñar por ahí. Meter un dato «ya que estamos» en una credencial es
 * meterlo en todas las presentaciones que se hagan con ella.
 *
 * No estar en este catálogo es la forma de que no puedan pedirse: la pantalla
 * ofrece lo que hay aquí, y el servidor **rechaza** lo que no esté.
 */
export const CUSTOMER_ATTRIBUTES: readonly CustomerAttribute[] = [
  { claim: 'given_name', label: 'Nombre', identifying: true, read: (c) => c.givenName },
  { claim: 'family_name', label: 'Apellidos', identifying: true, read: (c) => c.familyName },
  {
    claim: 'account_last4',
    label: 'Últimos cuatro de la cuenta',
    identifying: false,
    read: (c) => c.accountLast4,
  },
  {
    claim: 'customer_since',
    label: 'Cliente desde',
    identifying: false,
    read: (c) => c.customerSince,
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
 */
export function buildCredentialClaims(
  customer: Customer,
  claimNames: readonly string[],
): Record<string, string> {
  const claims: Record<string, string> = {};
  for (const attribute of CUSTOMER_ATTRIBUTES) {
    if (!claimNames.includes(attribute.claim)) continue;
    const value = attribute.read(customer);
    if (value !== null && value !== '') claims[attribute.claim] = value;
  }
  return claims;
}
