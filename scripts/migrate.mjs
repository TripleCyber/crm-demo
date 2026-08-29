#!/usr/bin/env node
/**
 * Migrador de la base del CRM.
 *
 * Aplica en orden los `.sql` de `db/` y anota cada uno en `crm_migration`. Es
 * todo lo que hace, y a propósito: no hay marcha atrás, no hay generación
 * automática y no hay ORM. Un CRM de maqueta con una tabla no necesita un
 * framework de migraciones — necesita que levantar el entorno dos veces dé
 * exactamente la misma base, y eso sí lo garantiza.
 *
 *   npm run db:migrate
 *
 * Toma `DATABASE_URL` del entorno; si no está, la busca en `.env.local` y luego
 * en `.env`, que es donde la deja quien sigue el README.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

if (process.env.DATABASE_URL === undefined) {
  for (const file of ['.env.local', '.env']) {
    try {
      process.loadEnvFile(join(root, file));
    } catch {
      // No existe: es normal, se prueba el siguiente.
    }
  }
}

const connectionString = process.env.DATABASE_URL;
if (connectionString === undefined || connectionString.trim() === '') {
  process.stderr.write('falta DATABASE_URL (ver .env.example)\n');
  process.exit(1);
}

const migrationsDir = join(root, 'db');
// Orden lexicográfico, que con el prefijo `001_`, `002_`… es el cronológico.
const files = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort();

const client = new pg.Client({ connectionString });
await client.connect();

try {
  await client.query(`
    create table if not exists crm_migration (
      name       text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const { rows } = await client.query('select name from crm_migration');
  const applied = new Set(rows.map((row) => row.name));

  for (const file of files) {
    if (applied.has(file)) {
      process.stdout.write(`· ${file} ya estaba aplicada\n`);
      continue;
    }

    const sql = readFileSync(join(migrationsDir, file), 'utf8');

    // El SQL y su anotación en la misma transacción: si el `.sql` falla a
    // medias, no puede quedar anotado como aplicado. Ese estado —anotada pero
    // a medio aplicar— es el único del que no se sale sin SQL a mano.
    await client.query('begin');
    try {
      await client.query(sql);
      await client.query('insert into crm_migration (name) values ($1)', [file]);
      await client.query('commit');
      process.stdout.write(`✓ ${file}\n`);
    } catch (error) {
      await client.query('rollback');
      throw new Error(`${file}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  await client.end();
}
