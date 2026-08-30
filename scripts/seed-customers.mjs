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
  process.stderr.write('falta DATABASE_URL (ver .env.example)\n');
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
 * teléfono, apellidos que empiezan igual, y fechas de alta repartidas por
 * veinte años. Es lo que hace que se vea si una columna vacía se lee o se cae.
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
 */
const PADRONES = {
  /**
   * Juan Pérez Molina es el cliente del ejemplo de `CONTRATOS.md` §1.2, con su
   * mismo identificador, para que lo que se emita aquí se parezca a lo que está
   * documentado.
   *
   * El resto van del `BD-99120460` en adelante y **no del 450**: ese tramo está
   * reservado a las fichas que se dan de alta a mano para probar el recorrido
   * completo con la cartera, y sembrar encima habría puesto un nombre inventado
   * donde alguien esperaba encontrar la suya.
   */
  BANCODEMO: [
    ['BD-99120447', 'Juan', 'Pérez Molina', 'juan@example.com', '+34600000001', '4471', null, null, '2024-03-12'],
    ['BD-99120448', 'Ana', 'Ruiz Vega', 'ana@example.com', '+34600000002', '8820', null, null, '2021-11-02'],
    ['BD-99120449', 'Luis', 'Sanz Ortega', null, null, '1043', null, null, '2019-06-30'],
    ['BD-99120460', 'Carmen', 'Pérez Aguilar', 'carmen.pa@example.com', '+34600000003', '2214', null, null, '2016-02-08'],
    ['BD-99120461', 'Miguel Ángel', 'Ferrer Lozano', 'ma.ferrer@example.com', '+34600000004', '9375', null, null, '2020-09-21'],
    ['BD-99120462', 'Rocío', 'Nieto Salas', 'rocio.nieto@example.com', null, '5108', null, null, '2023-07-04'],
    ['BD-99120463', 'Ignacio', 'Bermúdez Cano', null, '+34600000006', '6642', null, null, '2014-11-17'],
    ['BD-99120464', 'Marta', 'Iglesias Rey', 'marta.iglesias@example.com', '+34600000007', '3390', null, null, '2022-01-25'],
    ['BD-99120465', 'Salvador', 'Ortiz Peña', 'salvador.ortiz@example.com', '+34600000008', '7756', null, null, '2018-04-30'],
    ['BD-99120466', 'Nuria', 'Cabrera Gil', 'nuria.cabrera@example.com', '+34600000009', '1287', null, null, '2025-05-13'],
    ['BD-99120467', 'Álvaro', 'Sanz Herrero', null, null, '4903', null, null, '2017-10-02'],
    ['BD-99120468', 'Pilar', 'Domínguez Vidal', 'pilar.dv@example.com', '+34600000011', '8034', null, null, '2013-06-19'],
    ['BD-99120469', 'Tomás', 'Escobar Ruiz', 'tomas.escobar@example.com', '+34600000012', '6521', null, null, '2024-12-01'],
  ],

  /**
   * Seguros Aurora. El número de póliza lleva el año de contratación dentro
   * (`SA-2019-…`), que es como numera media España y hace que la fecha de alta
   * y la póliza se puedan contrastar de un vistazo: una póliza de 2019 en una
   * ficha dada de alta en 2023 es el primer síntoma de un dato inventado.
   */
  SEGUROSAURORA: [
    ['SA-40218804', 'Beatriz', 'Colomer Puig', 'beatriz.colomer@example.com', '+34600000021', null, 'SA-2019-0418804', null, '2019-04-08'],
    ['SA-40218811', 'Rubén', 'Ferrer Mateo', 'ruben.ferrer@example.com', '+34600000022', null, 'SA-2015-0218811', null, '2015-10-19'],
    ['SA-40218823', 'Lucía', 'Beltrán Casas', 'lucia.beltran@example.com', null, null, 'SA-2022-0418823', null, '2022-06-30'],
    ['SA-40218834', 'Fernando', 'Aguirre Solana', null, '+34600000024', null, 'SA-2011-0018834', null, '2011-02-14'],
    ['SA-40218840', 'Inmaculada', 'Ferrer Ondiviela', 'inma.ferrer@example.com', '+34600000025', null, 'SA-2020-0218840', null, '2020-11-27'],
    ['SA-40218852', 'Gonzalo', 'Prieto Lamas', 'gonzalo.prieto@example.com', '+34600000026', null, 'SA-2024-0418852', null, '2024-01-15'],
    ['SA-40218863', 'Elena', 'Quintana Roldán', null, null, null, 'SA-2017-0018863', null, '2017-08-03'],
    ['SA-40218875', 'Javier', 'Beltrán Ochoa', 'javier.beltran@example.com', '+34600000028', null, 'SA-2013-0218875', null, '2013-05-22'],
    ['SA-40218886', 'Marina', 'Sedano Ibarra', 'marina.sedano@example.com', '+34600000029', null, 'SA-2021-0418886', null, '2021-09-09'],
    ['SA-40218897', 'Óscar', 'Vilches Cuenca', 'oscar.vilches@example.com', null, null, 'SA-2025-0018897', null, '2025-03-04'],
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
    ['CSR-118204', 'Teresa', 'Alcántara Ruiz', 'teresa.alcantara@example.com', '+34600000041', null, null, 'HC-0118204', '2018-01-22'],
    ['CSR-118219', 'Andrés', 'Villalba Sanz', 'andres.villalba@example.com', '+34600000042', null, null, 'HC-0118219', '2012-07-16'],
    ['CSR-118227', 'Paula', 'Moreno Iriarte', null, '+34600000043', null, null, 'HC-0118227', '2023-02-28'],
    ['CSR-118235', 'Rafael', 'Company Bosch', 'rafael.company@example.com', null, null, null, 'HC-0118235', '2009-11-05'],
    ['CSR-118248', 'Silvia', 'Moreno Delgado', 'silvia.moreno@example.com', '+34600000045', null, null, 'HC-0118248', '2021-04-13'],
    ['CSR-118256', 'Jorge', 'Etxeberria Lasa', 'jorge.etxeberria@example.com', '+34600000046', null, null, 'HC-0118256', '2016-09-01'],
    ['CSR-118264', 'Amparo', 'Ledesma Ruano', null, null, null, null, 'HC-0118264', '2007-03-19'],
    ['CSR-118273', 'Víctor', 'Nogales Puente', 'victor.nogales@example.com', '+34600000048', null, null, 'HC-0118273', '2024-06-11'],
    ['CSR-118281', 'Cristina', 'Alcántara Vidal', 'cristina.alcantara@example.com', '+34600000049', null, null, 'HC-0118281', '2020-10-30'],
    ['CSR-118290', 'Manuel', 'Sepúlveda Arias', 'manuel.sepulveda@example.com', null, null, null, 'HC-0118290', '2014-12-08'],
  ],
};

const onlySlug = process.env.CRM_SEED_ORG?.trim().toUpperCase();
const slugs = onlySlug === undefined || onlySlug === '' ? Object.keys(PADRONES) : [onlySlug];

if (onlySlug !== undefined && onlySlug !== '' && PADRONES[onlySlug] === undefined) {
  process.stderr.write(
    `no hay padrón de prueba para ${onlySlug}. Los que hay: ${Object.keys(PADRONES).join(', ')}\n`,
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
      process.stdout.write(`· ${slug} no está declarada (falta CRM_ORG_${slug}_ID), no se siembra\n`);
      continue;
    }

    const rows = PADRONES[slug];
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
    process.stdout.write(`✓ ${slug} (${orgId}): ${rows.length} clientes\n`);
  }

  process.stdout.write(`sembrados ${seeded} clientes en total\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  await client.end();
}
