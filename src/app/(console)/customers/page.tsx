import Link from 'next/link';

import { listCustomers, type Customer } from '@/lib/customers';
import { getEmployeeSession } from '@/lib/session';

/**
 * El listado de clientes de la organización de la sesión.
 *
 * Componente de servidor: la consulta se hace aquí y al navegador sólo baja el
 * HTML. No hay ningún endpoint que devuelva el padrón entero en JSON, que es lo
 * que habría que proteger aparte si lo hubiera.
 */

export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
  let customers: Customer[] = [];
  let failure: string | undefined;

  try {
    const session = await getEmployeeSession();
    customers = await listCustomers(session.organization.orgId);
  } catch (error) {
    // Aquí cae la base sin migrar y la configuración incompleta. Se enseña el
    // mensaje tal cual: nombra la variable o la tabla que falta y no lleva
    // ningún secreto.
    failure = error instanceof Error ? error.message : 'fallo desconocido';
  }

  return (
    <>
      <h1>Clientes</h1>
      <p className="muted">
        El padrón vive en la base del CRM. No lo lee ni te-api ni Logto: los clientes de Banco Demo
        son suyos.
      </p>

      {failure !== undefined && <p className="alert">No se ha podido leer el padrón: {failure}</p>}

      <p>
        <Link href="/customers/new">
          <button type="button">Dar de alta un cliente</button>
        </Link>
      </p>

      {failure === undefined && customers.length === 0 && (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            Todavía no hay clientes. El alta crea la fila que luego se convierte en el <code>sub</code>{' '}
            de la credencial.
          </p>
        </div>
      )}

      {customers.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Identificador</th>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Cuenta</th>
              <th>Cliente desde</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td>
                  <Link href={`/customers/${encodeURIComponent(customer.externalId)}`}>
                    <span className="mono">{customer.externalId}</span>
                  </Link>
                </td>
                <td>
                  {customer.givenName} {customer.familyName}
                </td>
                <td>{customer.email ?? '—'}</td>
                <td>{customer.accountLast4 === null ? '—' : `···· ${customer.accountLast4}`}</td>
                <td>{customer.customerSince ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
