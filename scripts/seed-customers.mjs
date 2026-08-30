#!/usr/bin/env node
/**
 * Un puñado de clientes para poder probar la emisión sin teclear el alta.
 *
 * **No va en ninguna migración y no va a ir.** Una fila sembrada en un fichero
 * versionado es un dato de prueba que se despliega solo, y en la tabla de
 * clientes de un banco eso no tiene ninguna gracia. Se ejecuta a mano, cuando
 * se quiere.
 *
 *   CRM_ACTIVE_ORG_ID=<org de Logto> npm run db:seed
 *
 * Juan Pérez Molina es el cliente del ejemplo de `CONTRATOS.md` §1.2, con su
 * mismo identificador, para que lo que se emita aquí se parezca a lo que está
 * documentado.
 *
 * El resto van del `BD-99120460` en adelante y **no del 450**: ese tramo está
 * reservado a las fichas que se dan de alta a mano para probar el recorrido
 * completo con la cartera, y sembrar encima habría puesto un nombre inventado
 * donde alguien esperaba encontrar la suya.
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
const orgId = process.env.CRM_ACTIVE_ORG_ID?.trim();

if (connectionString === undefined || connectionString.trim() === '') {
  process.stderr.write('falta DATABASE_URL (ver .env.example)\n');
  process.exit(1);
}
if (orgId === undefined || orgId === '') {
  process.stderr.write('falta CRM_ACTIVE_ORG_ID: hay que decir de qué organización son\n');
  process.exit(1);
}

/**
 * El padrón de la maqueta.
 *
 * Son unos cuantos y no tres, y la razón es de pantalla: el listado lleva
 * buscador y columnas de estado, y las dos cosas sobre tres filas son un
 * adorno — no se ve si el buscador acierta, ni si las columnas se leen cuando
 * hay que recorrerlas. Con un padrón de este tamaño la pantalla se comporta
 * como la que va a mirar un agente.
 *
 * Están escritos con la variedad que tiene un padrón de verdad y no con la que
 * queda bonita: fichas sin correo, fichas sin teléfono, apellidos que empiezan
 * igual, y fechas de alta repartidas por veinte años. Es lo que hace que se vea
 * si una columna vacía se lee o se cae.
 */
const customers = [
  ['BD-99120447', 'Juan', 'Pérez Molina', 'juan@example.com', '+34600000001', '4471', '2024-03-12'],
  ['BD-99120448', 'Ana', 'Ruiz Vega', 'ana@example.com', '+34600000002', '8820', '2021-11-02'],
  ['BD-99120449', 'Luis', 'Sanz Ortega', null, null, '1043', '2019-06-30'],
  ['BD-99120460', 'Carmen', 'Pérez Aguilar', 'carmen.pa@example.com', '+34600000003', '2214', '2016-02-08'],
  ['BD-99120461', 'Miguel Ángel', 'Ferrer Lozano', 'ma.ferrer@example.com', '+34600000004', '9375', '2020-09-21'],
  ['BD-99120462', 'Rocío', 'Nieto Salas', 'rocio.nieto@example.com', null, '5108', '2023-07-04'],
  ['BD-99120463', 'Ignacio', 'Bermúdez Cano', null, '+34600000006', '6642', '2014-11-17'],
  ['BD-99120464', 'Marta', 'Iglesias Rey', 'marta.iglesias@example.com', '+34600000007', '3390', '2022-01-25'],
  ['BD-99120465', 'Salvador', 'Ortiz Peña', 'salvador.ortiz@example.com', '+34600000008', '7756', '2018-04-30'],
  ['BD-99120466', 'Nuria', 'Cabrera Gil', 'nuria.cabrera@example.com', '+34600000009', '1287', '2025-05-13'],
  ['BD-99120467', 'Álvaro', 'Sanz Herrero', null, null, '4903', '2017-10-02'],
  ['BD-99120468', 'Pilar', 'Domínguez Vidal', 'pilar.dv@example.com', '+34600000011', '8034', '2013-06-19'],
  ['BD-99120469', 'Tomás', 'Escobar Ruiz', 'tomas.escobar@example.com', '+34600000012', '6521', '2024-12-01'],
];

const client = new pg.Client({ connectionString });
await client.connect();

try {
  for (const row of customers) {
    await client.query(
      `insert into customer
         (org_id, external_id, given_name, family_name, email, phone, account_last4, customer_since)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (org_id, external_id) do nothing`,
      [orgId, ...row],
    );
  }
  process.stdout.write(`sembrados ${customers.length} clientes en ${orgId}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  await client.end();
}
