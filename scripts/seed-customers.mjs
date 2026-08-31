#!/usr/bin/env node
/**
 * Un padrón de prueba por organización, para poder probar sin teclear altas.
 *
 * **No va en ninguna migración y no va a ir.** Una fila sembrada en un fichero
 * versionado es un dato de prueba que se despliega solo, y en la tabla de
 * clientes de un banco eso no tiene ninguna gracia. Se ejecuta a mano, cuando
 * se quiere.
 *
 *   npm run db:seed                    # todas las organizaciones declaradas
 *   CRM_SEED_ORG=SEGUROSAURORA npm run db:seed   # sólo ésa
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  LAS ORGANIZACIONES SE DESCUBREN DEL ENTORNO, IGUAL QUE EN LA APLICACIÓN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Antes pedía `CRM_ACTIVE_ORG_ID` y sembraba ahí. Con tres organizaciones eso
 * son tres ejecuciones con tres identificadores copiados a mano, y copiar el de
 * Logto mal siembra el padrón de una en la otra sin que nada se queje — la
 * tabla no sabe qué identificadores existen.
 *
 * Así que el padrón se declara **por slug** (`BANCODEMO`, `SEGUROSAURORA`, …),
 * el mismo que `CRM_ORG_<SLUG>_ID` de `src/lib/organizations.ts`, y el
 * identificador de Logto sale de esa variable. Un slug sin variable no se
 * siembra y se dice; nunca se inventa un `org_id`.
 *
 * Es idempotente (`on conflict do nothing`), así que ejecutarlo dos veces no
 * duplica nada y sembrar las tres a la vez no molesta a quien sólo quería una.
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
 * Los padrones, por slug de organización.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ESTÁN ESCRITOS COMO PADRONES DE VERDAD, NO COMO PADRONES BONITOS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Son unos cuantos y no tres, y la razón es de pantalla: el listado lleva
 * buscador y columnas de estado, y las dos cosas sobre tres filas son un
 * adorno — no se ve si el buscador acierta, ni si las columnas se leen cuando
 * hay que recorrerlas.
 *
 * Y llevan la variedad que tiene un padrón real: fichas sin correo, fichas sin
 * teléfono, **apellidos repetidos entre fichas distintas** —Whitfield y
 * Sandford en el banco, Fielder y Belton en la aseguradora, Alcott y Merrow en
 * la clínica— y fechas de alta repartidas por veinte años. Los apellidos
 * repetidos no son pereza: son lo que hace que buscar «sandford» devuelva dos
 * filas y se vea que el buscador no está devolviendo la primera que encuentra.
 *
 * Cada sector lleva **su** dato de reconocimiento y no los de los demás: el
 * cliente del banco tiene los cuatro últimos de su cuenta, el asegurado tiene
 * póliza y el paciente tiene número de historia. Un asegurado con
 * `account_last4` relleno haría que la pantalla de emisión de Seguros Aurora
 * ofreciera «últimos cuatro de la cuenta», que es justo el cruce de sectores
 * que esto tiene que demostrar que no pasa.
 *
 * ⚠ Ni una de estas personas existe. Los identificadores llevan el prefijo de
 *   su organización para que se vea de un vistazo de cuál es cada fila.
 *
 * ⚠ **Los identificadores NO se tocan**, aunque los nombres hayan pasado al
 *   inglés. El `external_id` viaja como `sub` dentro de cada credencial ya
 *   emitida y es con lo que te-api ata el titular a su perfil: cambiarlo deja
 *   huérfano el vínculo de quien ya la guardó. El nombre es un campo del
 *   padrón y no ata nada.
 */
const ROSTERS = {
  /**
   * `BD-99120447` es el cliente del ejemplo de `CONTRATOS.md` §1.2 y conserva
   * su identificador, que es lo que aquel documento nombra. El nombre que lleva
   * ahí escrito es el de antes de que el producto pasara al inglés.
   *
   * El resto van del `BD-99120460` en adelante y **no del 450**: ese tramo está
   * reservado a las fichas que se dan de alta a mano para probar el recorrido
   * completo con la cartera, y sembrar encima habría puesto un nombre inventado
   * donde alguien esperaba encontrar la suya.
   */
  BANCODEMO: [
    ['BD-99120447', 'James', 'Whitfield Moore', 'james@example.com', '+34600000001', '4471', null, null, '2024-03-12'],
    ['BD-99120448', 'Anna', 'Reed Vance', 'anna@example.com', '+34600000002', '8820', null, null, '2021-11-02'],
    ['BD-99120449', 'Lewis', 'Sandford Hale', null, null, '1043', null, null, '2019-06-30'],
    ['BD-99120460', 'Charlotte', 'Whitfield Barnes', 'charlotte.wb@example.com', '+34600000003', '2214', null, null, '2016-02-08'],
    ['BD-99120461', 'Michael', 'Fielding Lowe', 'm.fielding@example.com', '+34600000004', '9375', null, null, '2020-09-21'],
    ['BD-99120462', 'Rosie', 'Naylor Stone', 'rosie.naylor@example.com', null, '5108', null, null, '2023-07-04'],
    ['BD-99120463', 'Nathan', 'Bramley Cane', null, '+34600000006', '6642', null, null, '2014-11-17'],
    ['BD-99120464', 'Martha', 'Iverson Ray', 'martha.iverson@example.com', '+34600000007', '3390', null, null, '2022-01-25'],
    ['BD-99120465', 'Samuel', 'Orton Payne', 'samuel.orton@example.com', '+34600000008', '7756', null, null, '2018-04-30'],
    ['BD-99120466', 'Nora', 'Cabot Gill', 'nora.cabot@example.com', '+34600000009', '1287', null, null, '2025-05-13'],
    ['BD-99120467', 'Alvin', 'Sandford Harper', null, null, '4903', null, null, '2017-10-02'],
    ['BD-99120468', 'Pippa', 'Donnelly Vale', 'pippa.dv@example.com', '+34600000011', '8034', null, null, '2013-06-19'],
    ['BD-99120469', 'Thomas', 'Escott Reed', 'thomas.escott@example.com', '+34600000012', '6521', null, null, '2024-12-01'],
  ],

  /**
   * Seguros Aurora. El número de póliza lleva el año de contratación dentro
   * (`SA-2019-…`), que es como numera media Europa y hace que la fecha de alta
   * y la póliza se puedan contrastar de un vistazo: una póliza de 2019 en una
   * ficha dada de alta en 2023 es el primer síntoma de un dato inventado.
   */
  SEGUROSAURORA: [
    ['SA-40218804', 'Beatrice', 'Colman Page', 'beatrice.colman@example.com', '+34600000021', null, 'SA-2019-0418804', null, '2019-04-08'],
    ['SA-40218811', 'Robin', 'Fielder Mason', 'robin.fielder@example.com', '+34600000022', null, 'SA-2015-0218811', null, '2015-10-19'],
    ['SA-40218823', 'Lucy', 'Belton Casey', 'lucy.belton@example.com', null, null, 'SA-2022-0418823', null, '2022-06-30'],
    ['SA-40218834', 'Frederick', 'Ashgrove Sloane', null, '+34600000024', null, 'SA-2011-0018834', null, '2011-02-14'],
    ['SA-40218840', 'Imogen', 'Fielder Ondell', 'imogen.fielder@example.com', '+34600000025', null, 'SA-2020-0218840', null, '2020-11-27'],
    ['SA-40218852', 'Gordon', 'Prentice Lamb', 'gordon.prentice@example.com', '+34600000026', null, 'SA-2024-0418852', null, '2024-01-15'],
    ['SA-40218863', 'Helen', 'Quinlan Rowden', null, null, null, 'SA-2017-0018863', null, '2017-08-03'],
    ['SA-40218875', 'Jasper', 'Belton Oakley', 'jasper.belton@example.com', '+34600000028', null, 'SA-2013-0218875', null, '2013-05-22'],
    ['SA-40218886', 'Marina', 'Sedgwick Barr', 'marina.sedgwick@example.com', '+34600000029', null, 'SA-2021-0418886', null, '2021-09-09'],
    ['SA-40218897', 'Oscar', 'Wilkes Coombe', 'oscar.wilkes@example.com', null, null, 'SA-2025-0018897', null, '2025-03-04'],
  ],

  /**
   * Clínica San Rafael.
   *
   * ⚠ **Ni un dato clínico.** El número de historia dice que esta persona tiene
   *   expediente en la clínica, y nada más: ni diagnóstico, ni tratamiento, ni
   *   especialidad. La decisión está en `docs/fases/F1-ALTA-MANUAL.md` §7 y
   *   sembrar «cardiología» en un campo de texto la desharía en una línea.
   *
   * `customer_since` es la fecha de apertura del expediente, que es lo que la
   * columna significa en los tres sectores: desde cuándo existe la relación.
   */
  CLINICASANRAFAEL: [
    ['CSR-118204', 'Theresa', 'Alcott Rush', 'theresa.alcott@example.com', '+34600000041', null, null, 'HC-0118204', '2018-01-22'],
    ['CSR-118219', 'Andrew', 'Villiers Sands', 'andrew.villiers@example.com', '+34600000042', null, null, 'HC-0118219', '2012-07-16'],
    ['CSR-118227', 'Paula', 'Merrow Ashby', null, '+34600000043', null, null, 'HC-0118227', '2023-02-28'],
    ['CSR-118235', 'Ralph', 'Comber Bosley', 'ralph.comber@example.com', null, null, null, 'HC-0118235', '2009-11-05'],
    ['CSR-118248', 'Sylvia', 'Merrow Delaney', 'sylvia.merrow@example.com', '+34600000045', null, null, 'HC-0118248', '2021-04-13'],
    ['CSR-118256', 'George', 'Etheridge Lacey', 'george.etheridge@example.com', '+34600000046', null, null, 'HC-0118256', '2016-09-01'],
    ['CSR-118264', 'Amber', 'Ledwell Rowan', null, null, null, null, 'HC-0118264', '2007-03-19'],
    ['CSR-118273', 'Victor', 'Nolan Bridge', 'victor.nolan@example.com', '+34600000048', null, null, 'HC-0118273', '2024-06-11'],
    ['CSR-118281', 'Christina', 'Alcott Vale', 'christina.alcott@example.com', '+34600000049', null, null, 'HC-0118281', '2020-10-30'],
    ['CSR-118290', 'Martin', 'Sedley Ayres', 'martin.sedley@example.com', null, null, null, 'HC-0118290', '2014-12-08'],
  ],
};

const onlySlug = process.env.CRM_SEED_ORG?.trim().toUpperCase();
const slugs = onlySlug === undefined || onlySlug === '' ? Object.keys(ROSTERS) : [onlySlug];

if (onlySlug !== undefined && onlySlug !== '' && ROSTERS[onlySlug] === undefined) {
  process.stderr.write(
    `there is no test roster for ${onlySlug}. The ones there are: ${Object.keys(ROSTERS).join(', ')}\n`,
  );
  process.exit(1);
}

const client = new pg.Client({ connectionString });
await client.connect();

try {
  let seeded = 0;

  for (const slug of slugs) {
    // El `org_id` sale de la MISMA variable que lee la aplicación. Si no está
    // declarada, no se siembra: inventarse un identificador aquí crearía filas
    // que ninguna pantalla puede enseñar y que nadie sabría de quién son.
    const orgId = process.env[`CRM_ORG_${slug}_ID`]?.trim();
    if (orgId === undefined || orgId === '') {
      process.stdout.write(`· ${slug} is not declared (CRM_ORG_${slug}_ID is missing), not seeding it\n`);
      continue;
    }

    const rows = ROSTERS[slug];
    for (const row of rows) {
      await client.query(
        `insert into customer
           (org_id, external_id, given_name, family_name, email, phone, account_last4,
            policy_number, medical_record_number, customer_since)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         on conflict (org_id, external_id) do nothing`,
        [orgId, ...row],
      );
    }

    seeded += rows.length;
    process.stdout.write(`✓ ${slug} (${orgId}): ${rows.length} customers\n`);
  }

  process.stdout.write(`${seeded} customers seeded in total\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  await client.end();
}
