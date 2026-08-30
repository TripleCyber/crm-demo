import Link from 'next/link';

import { VerificationPill } from '@/components/VerificationPill';
import { deliveryPhrase } from '@/lib/delivery';
import { formatCalendarDate, formatTimestamp } from '@/lib/format';
import { searchCustomers, type CustomerListEntry } from '@/lib/customers';
import { getEmployeeSession } from '@/lib/session';

/**
 * El listado de clientes de la organización de la sesión.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  LAS DOS COLUMNAS DE LA DERECHA SON EL PRODUCTO, Y SALEN DEL DIARIO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Un listado de clientes con nombre, cuenta y fecha de alta lo tiene cualquier
 * banco desde hace treinta años. Lo que esta pantalla añade —y es lo único que
 * añade— son las dos últimas columnas: **si a este cliente se le ha ofrecido su
 * credencial** y **cómo acabó la última vez que se comprobó su identidad**. Ésa
 * es la pregunta que un agente se hace antes de descolgar, y hasta ahora había
 * que entrar en la ficha para responderla.
 *
 * Las dos salen del registro de esta consola (`credential_offer`,
 * `verification`) cruzado con lo que contestó te-api. **Ninguna afirma que el
 * titular tenga la credencial guardada ni que su perfil esté verificado**: eso
 * no lo sabe nadie aquí —te-api no tiene ruta que lo diga— y por eso no hay
 * ninguna insignia que lo insinúe. Lo que hay son hechos con fecha.
 *
 * Componente de servidor: la consulta se hace aquí y al navegador sólo baja el
 * HTML. No hay ningún endpoint que devuelva el padrón entero en JSON, que es lo
 * que habría que proteger aparte si lo hubiera.
 *
 * El buscador es un formulario `GET` y no un filtro en el navegador: filtrar en
 * el navegador obliga a bajar el padrón entero para poder buscar en él, y el
 * padrón de un banco de verdad no cabe en una pestaña. Además así la búsqueda
 * es una dirección —`/customers?q=perez`— que se puede guardar y pasar.
 */

export const dynamic = 'force-dynamic';

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawQuery = params.q;
  const term = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery) ?? '';

  let customers: CustomerListEntry[] = [];
  let failure: string | undefined;

  try {
    const session = await getEmployeeSession();
    customers = await searchCustomers(session.organization.orgId, term);
  } catch (error) {
    // Aquí cae la base sin migrar y la configuración incompleta. Se enseña el
    // mensaje tal cual: nombra la variable o la tabla que falta y no lleva
    // ningún secreto.
    failure = error instanceof Error ? error.message : 'fallo desconocido';
  }

  const searching = term.trim() !== '';

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Atención al cliente</p>
          <h1>Clientes</h1>
          {/*
            La idea —**los datos del banco no salen del banco**— es de las
            mejores que tiene este producto y se queda tal cual. Lo que sobraba
            era nombrar nuestras piezas internas («ni te-api ni Logto lo leen
            nunca») en la consola del cliente: al director al que hay que
            convencer, «te-api» y «Logto» no le dicen nada, y leer dos nombres
            de sistemas ajenos justo debajo de su padrón de clientes le dice lo
            contrario de lo que la frase pretende.
          */}
          <p className="page-sub">
            El padrón es del banco y no sale de aquí. Ningún sistema de TripleEnable lo lee.
          </p>
        </div>
        <div className="page-actions">
          <Link className="button-link secondary" href="/customers/new">
            Dar de alta un cliente
          </Link>
        </div>
      </header>

      {failure !== undefined && <p className="alert">No se ha podido leer el padrón: {failure}</p>}

      {failure === undefined && (
        <>
          {/*
            Formulario `GET`, sin JavaScript por medio. El `defaultValue` deja
            escrito lo que se buscó: volver de una ficha y encontrarse el
            buscador vacío obliga a teclearlo otra vez.
          */}
          <form className="toolbar" method="get" action="/customers">
            <label className="search">
              <span className="visually-hidden">Buscar clientes</span>
              <input
                type="search"
                name="q"
                defaultValue={term}
                placeholder="Nombre, identificador, correo o los cuatro de la cuenta"
                autoComplete="off"
              />
            </label>
            <button type="submit" className="secondary">
              Buscar
            </button>
            {searching && (
              <Link className="toolbar-clear" href="/customers">
                Quitar el filtro
              </Link>
            )}
            <p className="toolbar-count">
              {customers.length} {customers.length === 1 ? 'ficha' : 'fichas'}
              {searching ? ` de «${term.trim()}»` : ''}
            </p>
          </form>

          {customers.length === 0 ? (
            <div className="empty">
              {searching ? (
                <>
                  <h2>Ninguna ficha coincide</h2>
                  <p>
                    La búsqueda mira el nombre completo, el identificador, el correo y los cuatro
                    de la cuenta — y sólo dentro de esta organización. No hay ningún directorio
                    global que consultar.
                  </p>
                  <Link className="button-link secondary" href="/customers">
                    Ver todas las fichas
                  </Link>
                </>
              ) : (
                <>
                  <h2>Todavía no hay clientes</h2>
                  <p>
                    El alta crea la ficha a cuyo nombre se emite después la credencial. Sin ella no
                    hay a quién emitir.
                  </p>
                  <Link className="button-link" href="/customers/new">
                    Dar de alta un cliente
                  </Link>
                </>
              )}
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data customers">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Contacto</th>
                    <th>Cuenta</th>
                    <th>Alta</th>
                    <th>Credencial</th>
                    <th>Última verificación</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr key={customer.id}>
                      <td>
                        <Link
                          className="row-link"
                          href={`/customers/${encodeURIComponent(customer.externalId)}`}
                        >
                          {customer.givenName} {customer.familyName}
                        </Link>
                        <span className="mono sub">{customer.externalId}</span>
                      </td>
                      <td>
                        {customer.email ?? <span className="none">sin correo</span>}
                        {customer.phone !== null && <span className="mono sub">{customer.phone}</span>}
                      </td>
                      <td className="mono">
                        {customer.accountLast4 === null ? (
                          <span className="none">—</span>
                        ) : (
                          `···· ${customer.accountLast4}`
                        )}
                      </td>
                      <td>
                        {customer.customerSince === null ? (
                          <span className="none">—</span>
                        ) : (
                          formatCalendarDate(customer.customerSince)
                        )}
                      </td>
                      {/*
                        «Ofrecida», no «activa». El banco sabe que la ofreció
                        porque la ofreció él; si el titular la aceptó **no lo
                        sabe nadie aquí**, y por eso la palabra es la del acto
                        que sí ocurrió.
                      */}
                      <td>
                        {customer.lastOfferAt === null ? (
                          <span className="none">sin ofrecer</span>
                        ) : (
                          <>
                            Ofrecida
                            <span className="sub">
                              {formatTimestamp(customer.lastOfferAt)}
                              {customer.lastOfferDelivery === null
                                ? ''
                                : ` · ${deliveryPhrase(customer.lastOfferDelivery)}`}
                            </span>
                          </>
                        )}
                      </td>
                      <td>
                        {customer.lastVerificationStatus === null ||
                        customer.lastVerificationExpiresAt === null ? (
                          <span className="none">nunca</span>
                        ) : (
                          <Link
                            className="cell-link"
                            href={`/verifications/${encodeURIComponent(customer.lastVerificationId ?? '')}`}
                          >
                            <VerificationPill
                              status={customer.lastVerificationStatus}
                              expiresAt={customer.lastVerificationExpiresAt}
                            />
                            <span className="sub">
                              {customer.lastVerificationAt === null
                                ? ''
                                : formatTimestamp(customer.lastVerificationAt)}
                            </span>
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
