#!/usr/bin/env node
/**
 * Un padrón de prueba para esta instalación, para poder probar sin teclear altas.
 *
 * **No va en ninguna migración y no va a ir.** Una fila sembrada en un fichero
 * versionado es un dato de prueba que se despliega solo, y en la tabla de
 * clientes de un banco eso no tiene ninguna gracia. Se ejecuta a mano, cuando se
 * quiere.
 *
 *   npm run db:seed
 *   CRM_SEED_ROSTER=LARKFIELDENERGY npm run db:seed   # forzar otro padrón
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  EL `org_id` SALE DE LA MISMA VARIABLE QUE LEE LA APLICACIÓN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `CRM_ORG_ID`, y de ningún otro sitio. Antes se pedía por separado —había
 * cuatro organizaciones en un despliegue y había que elegir— y copiar mal el
 * identificador de Logto sembraba el padrón de una en la otra sin que nada se
 * quejara: la tabla no sabe qué identificadores existen. Con una instalación por
 * empresa esa elección desapareció, y con ella el error.
 *
 * ## Y el PADRÓN se elige por la referencia de sector, no por una variable más
 *
 * Los dos padrones de prueba no son intercambiables: el del banco rellena
 * `account_last4` y el de la comercializadora `supply_point_number`, y sembrar
 * el que no toca deja fichas cuya referencia esta consola no enseña — porque
 * `CRM_REFERENCE_CLAIM` dice cuál ofrece.
 *
 * Así que se deduce de esa misma variable en vez de pedir otra. Es la única
 * deducción que no puede equivocarse: el padrón tiene que rellenar la columna
 * que esta instalación usa, y esa columna ya está declarada. `CRM_SEED_ROSTER`
 * queda para forzarlo a mano, que es lo que hace falta para probar el padrón de
 * la otra contra una base desechable.
 *
 * Es idempotente, así que ejecutarlo dos veces no duplica nada — y desde que hay
 * fecha de nacimiento hace una cosa más, que está argumentada en el `insert` de
 * abajo: **rellena los huecos de las fichas que ya estaban, sin pisar nada.**
 *
 * ⚠ **El orden de cada fila es el del `insert` de abajo, y son diez columnas.**
 * La referencia del sector ocupa DOS huecos —los cuatro de la cuenta y el punto
 * de suministro— y cada padrón rellena el suyo y deja el otro a `null`.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const file of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(join(root, file));
  } catch {
    // No existe: se prueba el siguiente.
  }
}

const connectionString = process.env.DATABASE_URL;
if (connectionString === undefined || connectionString.trim() === '') {
  process.stderr.write('DATABASE_URL is missing (see .env.example)\n');
  process.exit(1);
}

/**
 * Los padrones de prueba, por empresa.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ESTÁN ESCRITOS COMO PADRONES DE VERDAD, NO COMO PADRONES BONITOS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Son unos cuantos y no tres, y la razón es de pantalla: el listado lleva
 * buscador y columnas de estado, y las dos cosas sobre tres filas son un adorno
 * — no se ve si el buscador acierta, ni si las columnas se leen cuando hay que
 * recorrerlas.
 *
 * Y llevan la variedad que tiene un padrón real: fichas sin correo, fichas sin
 * teléfono, **apellidos repetidos entre fichas distintas** —Whitfield y Sandford
 * en el banco, Ashcombe y Thurlow en la comercializadora— y fechas de alta
 * repartidas por veinte años. Los apellidos repetidos no son pereza: son lo que
 * hace que buscar «sandford» devuelva dos filas y se vea que el buscador no está
 * devolviendo la primera que encuentra.
 *
 * Cada sector lleva **su** dato de reconocimiento y no el del otro: el cliente
 * del banco tiene los cuatro últimos de su cuenta y el titular del suministro
 * tiene su punto de suministro. Una ficha de energía con `account_last4` relleno
 * haría que la pantalla de emisión de Larkfield ofreciera «últimos cuatro de la
 * cuenta», que es justo el cruce de sectores que esto tiene que demostrar que no
 * pasa.
 *
 * ## Las fechas de nacimiento están repartidas A PROPÓSITO
 *
 * La fecha de nacimiento sí la llevan los dos padrones —no es de un sector, la
 * tiene todo el mundo—, y las edades no son aleatorias: son los casos que hay
 * que poder enseñar en una demostración sin dar de alta a nadie.
 *
 *   · Un menor, con su cuenta infantil → `age_over_18: false`. Es el caso que
 *     demuestra que un «no» se firma igual que un «sí»: sin él, todo el mundo
 *     contesta que sí y no se ve la diferencia entre «no lo es» y «no consta».
 *   · Alguien entre 18 y 21 → el sí y el no en la misma credencial, que es lo
 *     que hace evidente por qué son dos claims y no uno de «edad».
 *   · Dos por encima de 65, uno de ellos recién cumplidos.
 *   · Un 29 de febrero, que es la fecha con la que se equivoca cualquier cálculo
 *     de edad hecho con prisa.
 *
 * En la comercializadora no hay menores, y tampoco es casualidad: un contrato de
 * suministro lo firma un adulto. El banco sí los tiene, porque las cuentas
 * infantiles existen.
 *
 * ⚠ Ni una de estas personas existe. Los identificadores llevan el prefijo de su
 *   empresa para que se vea de un vistazo de cuál es cada fila.
 *
 * ⚠ **Los identificadores NO se tocan.** El `external_id` viaja como `sub`
 *   dentro de cada credencial ya emitida y es con lo que te-api ata el titular a
 *   su perfil: cambiarlo deja huérfano el vínculo de quien ya la guardó. El
 *   nombre es un campo del padrón y no ata nada.
 */
const ROSTERS = {
  /**
   * Banco Demo.
   *
   * `BD-99120447` es el cliente del ejemplo de `CONTRATOS.md` §1.2 y conserva su
   * identificador, que es lo que aquel documento nombra.
   *
   * El resto van del `BD-99120460` en adelante y **no del 450**: ese tramo está
   * reservado a las fichas que se dan de alta a mano para probar el recorrido
   * completo con la cartera, y sembrar encima habría puesto un nombre inventado
   * donde alguien esperaba encontrar la suya.
   */
  BANCODEMO: [
    ['BD-99120447', 'James', 'Whitfield Moore', 'james@example.com', '+34600000001', '4471', null, '2024-03-12', '1987-04-23'],
    ['BD-99120448', 'Anna', 'Reed Vance', 'anna@example.com', '+34600000002', '8820', null, '2021-11-02', '1993-09-15'],
    // Por encima de 65: la exención de comisiones y los productos de jubilación
    // se contestan con un sí, sin que diga cuántos años tiene.
    ['BD-99120449', 'Lewis', 'Sandford Hale', null, null, '1043', null, '2019-06-30', '1956-01-08'],
    // Menor de edad, con la cuenta infantil que le abrieron a los cinco años.
    ['BD-99120460', 'Charlotte', 'Whitfield Barnes', 'charlotte.wb@example.com', '+34600000003', '2214', null, '2016-02-08', '2011-03-19'],
    // Entre 18 y 21: mayor de edad y no llega al segundo umbral.
    ['BD-99120461', 'Michael', 'Fielding Lowe', 'm.fielding@example.com', '+34600000004', '9375', null, '2020-09-21', '2006-11-12'],
    // Nacida un 29 de febrero. Ver `hasCompletedYears` en `lib/customers.ts`.
    ['BD-99120462', 'Rosie', 'Naylor Stone', 'rosie.naylor@example.com', null, '5108', null, '2023-07-04', '2004-02-29'],
    ['BD-99120463', 'Nathan', 'Bramley Cane', null, '+34600000006', '6642', null, '2014-11-17', '1978-07-19'],
    ['BD-99120464', 'Martha', 'Iverson Ray', 'martha.iverson@example.com', '+34600000007', '3390', null, '2022-01-25', '1949-12-03'],
    ['BD-99120465', 'Samuel', 'Orton Payne', 'samuel.orton@example.com', '+34600000008', '7756', null, '2018-04-30', '1990-06-06'],
    ['BD-99120466', 'Nora', 'Cabot Gill', 'nora.cabot@example.com', '+34600000009', '1287', null, '2025-05-13', '1999-10-27'],
    // Los 65 recién cumplidos, para que se vea que el umbral se cruza solo.
    ['BD-99120467', 'Alvin', 'Sandford Harper', null, null, '4903', null, '2017-10-02', '1961-03-14'],
    ['BD-99120468', 'Pippa', 'Donnelly Vale', 'pippa.dv@example.com', '+34600000011', '8034', null, '2013-06-19', '1983-08-01'],
    ['BD-99120469', 'Thomas', 'Escott Reed', 'thomas.escott@example.com', '+34600000012', '6521', null, '2024-12-01', '2007-09-10'],
  ],

  /**
   * Larkfield Energy — una comercializadora de luz y gas.
   *
   * Nació entera en inglés: nombre, dominio, correos y padrón. Las organizaciones
   * anteriores se crearon en castellano y eso era deuda, no un patrón que se
   * copie (`CLAUDE.md` §5).
   *
   * El punto de suministro identifica el **contador** y no al cliente: la luz
   * llega a una casa, y quien la paga puede cambiar sin que cambie el punto. Por
   * eso hay dos fichas con el mismo apellido y puntos distintos —Ashcombe— y
   * ninguna comparte punto con otra: dos titulares en el mismo suministro es un
   * caso real, pero en una demostración parece un error de siembra.
   *
   * El prefijo `SP-` y los once dígitos no imitan ningún mercado concreto: el
   * CUPS español y el MPAN británico tienen formatos distintos e incompatibles, y
   * elegir uno haría que esta comercializadora pareciera de un país. Lo que
   * importa es que se pueda cantar por teléfono sin equivocarse, que es para lo
   * que sirve una referencia.
   */
  LARKFIELDENERGY: [
    ['LE-70450012', 'Eleanor', 'Ashcombe Hart', 'eleanor.ashcombe@example.com', '+442079460201', null, 'SP-16000412201', '2017-05-09', '1980-02-17'],
    ['LE-70450024', 'Duncan', 'Thurlow Beck', 'duncan.thurlow@example.com', '+442079460244', null, 'SP-16000412244', '2011-09-23', '1953-06-11'],
    ['LE-70450036', 'Priya', 'Loxley Barrow', 'priya.loxley@example.com', null, null, 'SP-16000412318', '2022-03-17', '1991-12-05'],
    ['LE-70450048', 'Cormac', 'Ashcombe Ridley', null, '+442079460402', null, 'SP-16000412402', '2008-12-01', '1968-08-29'],
    ['LE-70450051', 'Bridget', 'Nyholm Carrow', 'bridget.nyholm@example.com', '+442079460475', null, 'SP-16000412475', '2020-07-28', '1986-04-02'],
    ['LE-70450063', 'Idris', 'Thurlow Vance', 'idris.thurlow@example.com', '+442079460539', null, 'SP-16000412539', '2015-11-04', '1977-10-16'],
    ['LE-70450075', 'Maeve', 'Corrigan Pike', null, null, null, 'SP-16000412604', '2006-02-20', '1949-05-24'],
    // El más joven que puede firmar un suministro, y por poco: entre 18 y 21.
    ['LE-70450087', 'Silas', 'Bramber Wren', 'silas.bramber@example.com', '+442079460677', null, 'SP-16000412677', '2024-04-12', '2006-06-30'],
    ['LE-70450099', 'Tamsin', 'Okonkwo Lane', 'tamsin.okonkwo@example.com', '+442079460742', null, 'SP-16000412742', '2019-08-06', '1994-03-08'],
    ['LE-70450106', 'Gareth', 'Melrose Fenn', 'gareth.melrose@example.com', null, null, 'SP-16000412815', '2013-01-30', '1972-11-19'],
  ],
};

/** Qué padrón rellena cada referencia de sector. Ver la nota de cabecera. */
const ROSTER_BY_REFERENCE = {
  account_last4: 'BANCODEMO',
  supply_point_number: 'LARKFIELDENERGY',
};

/**
 * De quién es el padrón que se va a sembrar, y de qué sector.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  PRIMERO LA BASE, DESPUÉS EL ENTORNO — LA MISMA REGLA QUE LA APLICACIÓN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Estos dos valores salían de `CRM_ORG_ID` y `CRM_REFERENCE_CLAIM`, y con la
 * configuración viviendo en el entorno era lo único que había. Desde que vive en
 * la base (`src/lib/tenant-settings.ts`), un despliegue configurado **desde la
 * pantalla** no tiene esas variables en ninguna parte, y este guion se negaba a
 * sembrar el padrón de una instalación perfectamente configurada.
 *
 * Así que se lee la fila de ajustes y el entorno queda de respaldo, en ese
 * orden. Es la misma regla de la aplicación —la base manda— y no una segunda:
 * el entorno sólo entra cuando la base todavía no dice nada.
 *
 * `CRM_SEED_ROSTER` sigue mandando sobre las dos, porque es una anulación
 * explícita de quien ejecuta el guion y no configuración de nadie.
 */
const client = new pg.Client({ connectionString });
await client.connect();

let stored = {};
try {
  const { rows: settingsRows } = await client.query(
    'select org_id, reference_claim from tenant_settings where id = 1',
  );
  stored = settingsRows[0] ?? {};
} catch {
  // La tabla no existe todavía: una base sin la migración 008. Se sigue con el
  // entorno, que es exactamente lo que había antes de que existiera.
}

const orgId = nonEmpty(stored.org_id) ?? nonEmpty(process.env.CRM_ORG_ID);
if (orgId === undefined) {
  await client.end();
  process.stderr.write(
    'no organization to seed for: configure this installation on the Settings screen, ' +
      'or set CRM_ORG_ID (see .env.example)\n',
  );
  process.exit(1);
}

const forced = nonEmpty(process.env.CRM_SEED_ROSTER)?.toUpperCase();
const reference = (
  nonEmpty(stored.reference_claim) ?? nonEmpty(process.env.CRM_REFERENCE_CLAIM)
)?.toLowerCase();
const rosterName = forced !== undefined ? forced : ROSTER_BY_REFERENCE[reference];

if (rosterName === undefined) {
  await client.end();
  process.stderr.write(
    'cannot tell which roster to seed: set the sector reference on the Settings screen to one of ' +
      `${Object.keys(ROSTER_BY_REFERENCE).join(', ')}, or force it with CRM_SEED_ROSTER ` +
      `(${Object.keys(ROSTERS).join(', ')})\n`,
  );
  process.exit(1);
}

/** Un valor vacío es un valor sin poner. Vale para el entorno y para la fila. */
function nonEmpty(value) {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? undefined : trimmed;
}

const rows = ROSTERS[rosterName];
if (rows === undefined) {
  await client.end();
  process.stderr.write(
    `there is no test roster called ${rosterName}. The ones there are: ${Object.keys(ROSTERS).join(', ')}\n`,
  );
  process.exit(1);
}

try {
  for (const row of rows) {
    // ── El `do update` sólo rellena huecos, y por eso no rompe la idempotencia ──
    //
    // Era `do nothing`, y con eso las fichas ya sembradas se habrían quedado sin
    // fecha de nacimiento para siempre: la columna llegó después que ellas
    // (`db/012_…`), así que quien tuviera el padrón puesto no vería ni una sola
    // casilla de edad sin borrar la tabla.
    //
    // El `where` es lo que hace que esto siga siendo seguro de ejecutar dos
    // veces: sólo escribe donde no hay nada. Una fecha corregida a mano en la
    // consola no se pisa, y no se toca ninguna otra columna — un `do update`
    // entero devolvería a su valor sembrado el nombre o el correo que alguien
    // hubiera cambiado, que es exactamente el susto que un guion de siembra no
    // puede dar.
    await client.query(
      `insert into customer
         (org_id, external_id, given_name, family_name, email, phone, account_last4,
          supply_point_number, customer_since, birth_date)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       on conflict (org_id, external_id) do update
          set birth_date = excluded.birth_date
        where customer.birth_date is null`,
      [orgId, ...row],
    );
  }

  process.stdout.write(`✓ ${rosterName} (${orgId}): ${rows.length} customers seeded\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  await client.end();
}
