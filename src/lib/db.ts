import 'server-only';

import { Pool } from 'pg';

/**
 * La base propia del CRM. Postgres, y **sólo del CRM**: ni te-api ni Logto la
 * leen nunca. Los clientes de Banco Demo son suyos.
 *
 * El *pool* vive en `globalThis` y no en una constante de módulo por el
 * recargado en caliente de `next dev`: cada recarga vuelve a evaluar el módulo,
 * y con una constante normal se abre un pool nuevo por recarga hasta agotar las
 * conexiones de Postgres. Es el mismo apaño que recomienda cualquier ORM para
 * Next.js.
 */

declare global {
  // eslint-disable-next-line no-var
  var crmPool: Pool | undefined;
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString === undefined || connectionString.trim() === '') {
    throw new Error('falta DATABASE_URL: la base del CRM no está configurada');
  }

  return new Pool({
    connectionString,
    // Diez basta de sobra para una consola de agentes y deja sitio a las
    // conexiones del resto del despliegue.
    max: 10,
    // Que una consulta colgada tumbe la petición y no la deje esperando para
    // siempre: en una consola, un botón que no responde nunca es peor que uno
    // que da error.
    connectionTimeoutMillis: 5_000,
  });
}

export function getPool(): Pool {
  globalThis.crmPool ??= createPool();
  return globalThis.crmPool;
}

/** Consulta parametrizada. `text` nunca se compone con datos: sólo `values`. */
export async function query<T extends Record<string, unknown>>(
  text: string,
  values: readonly unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(text, [...values]);
  return result.rows;
}
