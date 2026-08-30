import Link from 'next/link';

import { VerificationPill } from '@/components/VerificationPill';
import { CUSTOMER_ATTRIBUTES } from '@/lib/customers';
import { formatTimestamp } from '@/lib/format';
import { describeConsoleFailure } from '@/lib/console-failures';
import { getEmployeeSession } from '@/lib/session';
import { listRecentVerifications, type VerificationListEntry } from '@/lib/verifications';

/**
 * El registro de comprobaciones de la organización.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ES LA PANTALLA QUE UN BANCO PIDE EN LA SEGUNDA REUNIÓN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La primera pregunta de un director de operaciones no es «¿cómo se verifica a
 * un cliente?» sino «**¿qué está haciendo mi gente?**». A cuántos clientes se
 * ha llamado hoy, cuántos han contestado, y —sobre todo— **si alguno ha dicho
 * que no era él**, que es un aviso de fraude y no una estadística.
 *
 * Todo lo de esta tabla sale del diario del banco (`verification`), que anota lo
 * que hizo esta consola, cruzado con el desenlace que dio te-api. No hay ni una
 * cifra compuesta ni un porcentaje inventado: son las filas, con su hora y su
 * autor.
 *
 * No tiene buscador y no es un olvido: cincuenta filas se recorren con la vista
 * y la búsqueda por cliente ya existe donde tiene sentido —en la ficha, que
 * enseña el historial de esa persona—. Un filtro que nadie ha pedido es una
 * caja de texto más que mantener.
 */

export const dynamic = 'force-dynamic';

export default async function VerificationsPage() {
  let verifications: VerificationListEntry[] = [];
  let failure: string | undefined;

  // El registro se lee con la vista, y un registro se lee mejor en el idioma en
  // el que se habla: «Nombre, Apellidos» y no «given_name, family_name». El
  // nombre técnico sigue estando en la pantalla de la propia verificación,
  // dentro de su detalle plegado, que es donde hace falta.
  const labelFor = Object.fromEntries(
    CUSTOMER_ATTRIBUTES.map((attribute) => [attribute.claim, attribute.label]),
  );

  try {
    const session = await getEmployeeSession();
    verifications = await listRecentVerifications(session.organization.orgId);
  } catch (error) {
    failure = describeConsoleFailure(error, 'el listado de verificaciones no cargó');
  }

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Atención al cliente</p>
          <h1>Verificaciones</h1>
          <p className="page-sub">
            Cada vez que un agente le pide a un cliente que demuestre quién es, queda una línea
            aquí. La escribe esta organización; el desenlace lo dice TripleEnable.
          </p>
        </div>
      </header>

      {failure !== undefined && (
        <p className="alert">No se ha podido leer el registro: {failure}</p>
      )}

      {failure === undefined && verifications.length === 0 && (
        <div className="empty">
          <h2>Todavía no se ha comprobado a nadie</h2>
          <p>
            La comprobación se lanza desde la ficha del cliente. Necesita que el titular tenga ya
            su credencial: sin ella no hay nada que presentar.
          </p>
          <Link className="button-link secondary" href="/customers">
            Ir a los clientes
          </Link>
        </div>
      )}

      {verifications.length > 0 && (
        <div className="table-wrap">
          <table className="data verifications">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Resultado</th>
                <th>Lanzada</th>
                <th>Canal</th>
                <th>Agente</th>
                <th>Se le pidió</th>
              </tr>
            </thead>
            <tbody>
              {verifications.map((verification) => (
                <tr key={verification.presentationId}>
                  <td>
                    <Link
                      className="row-link"
                      href={`/verifications/${encodeURIComponent(verification.presentationId)}`}
                    >
                      {verification.customerName ?? verification.externalId}
                    </Link>
                    <span className="mono sub">{verification.externalId}</span>
                  </td>
                  <td>
                    <VerificationPill
                      status={verification.status}
                      expiresAt={verification.expiresAt}
                    />
                  </td>
                  <td>
                    {formatTimestamp(verification.requestedAt)}
                    {/*
                      «Se supo», no «contestó». Es la hora en la que este banco
                      se enteró del desenlace, y en tres de los cinco finales no
                      contestó nadie: en una caducidad no hay ninguna respuesta
                      que fechar, y escribir que la hubo sería falsear el
                      registro justo en la fila que alguien va a mirar cuando
                      reclame.
                    */}
                    {verification.settledAt !== null && (
                      <span className="sub">
                        se supo a las {formatTimestamp(verification.settledAt)}
                      </span>
                    )}
                  </td>
                  {/*
                    El canal se rotula por la SITUACIÓN, igual que en el botón
                    que lo lanzó: quien lee esta tabla mañana tiene que poder
                    reconstruir dónde estaba el cliente, no qué transporte se usó.
                  */}
                  <td>
                    {verification.channel === 'phone' ? 'Al teléfono' : 'En el mostrador'}
                    <span className="sub">
                      {verification.channel === 'phone' ? 'aviso al móvil' : 'QR en pantalla'}
                    </span>
                  </td>
                  <td>
                    {verification.agentName}
                    <span className="mono sub">{verification.agentId}</span>
                  </td>
                  <td>
                    {verification.typeKey}
                    <span className="sub">
                      {verification.requestedClaims
                        .map((name) => labelFor[name] ?? name)
                        .join(', ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
