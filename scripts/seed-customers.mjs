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

const customers = [
  ['BD-99120447', 'Juan', 'Pérez Molina', 'juan@example.com', '+34600000001', '4471', '2024-03-12'],
  ['BD-99120448', 'Ana', 'Ruiz Vega', 'ana@example.com', '+34600000002', '8820', '2021-11-02'],
  ['BD-99120449', 'Luis', 'Sanz Ortega', null, null, '1043', '2019-06-30'],
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
