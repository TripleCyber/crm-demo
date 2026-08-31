import Link from 'next/link';

import { VerificationPill } from '@/components/VerificationPill';
import { getTranslator } from '@/i18n/server';
import { attributeLabels } from '@/lib/customers';
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
  const t = await getTranslator();
  let verifications: VerificationListEntry[] = [];
  let failure: string | undefined;

  // El registro se lee con la vista, y un registro se lee mejor en el idioma en
  // el que se habla: «Nombre, Apellidos» y no «given_name, family_name». El
  // nombre técnico sigue estando en la pantalla de la propia verificación,
  // dentro de su detalle plegado, que es donde hace falta.
  const labelFor = attributeLabels(t);

  try {
    const session = await getEmployeeSession();
    verifications = await listRecentVerifications(session.organization.orgId);
  } catch (error) {
    failure = describeConsoleFailure(t, error, 'el listado de verificaciones no cargó');
  }

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">{t('verifications.eyebrow')}</p>
          <h1>{t('verifications.title')}</h1>
          <p className="page-sub">{t('verifications.subtitle')}</p>
        </div>
      </header>

      {failure !== undefined && (
        <p className="alert">{t('verifications.loadFailed', { reason: failure })}</p>
      )}

      {failure === undefined && verifications.length === 0 && (
        <div className="empty">
          <h2>{t('verifications.emptyTitle')}</h2>
          <p>{t('verifications.emptyBody')}</p>
          <Link className="button-link secondary" href="/customers">
            {t('verifications.emptyAction')}
          </Link>
        </div>
      )}

      {verifications.length > 0 && (
        <div className="table-wrap">
          <table className="data verifications">
            <thead>
              <tr>
                <th>{t('verifications.columnCustomer')}</th>
                <th>{t('verifications.columnOutcome')}</th>
                <th>{t('verifications.columnStarted')}</th>
                <th>{t('verifications.columnChannel')}</th>
                <th>{t('verifications.columnAgent')}</th>
                <th>{t('verifications.columnAsked')}</th>
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
                    {formatTimestamp(verification.requestedAt, t.locale)}
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
                        {t('verifications.settledAt', {
                          time: formatTimestamp(verification.settledAt, t.locale),
                        })}
                      </span>
                    )}
                  </td>
                  {/*
                    El canal se rotula por la SITUACIÓN, igual que en el botón
                    que lo lanzó: quien lee esta tabla mañana tiene que poder
                    reconstruir dónde estaba el cliente, no qué transporte se usó.
                  */}
                  <td>
                    {t(
                      verification.channel === 'phone'
                        ? 'verifications.channelPhone'
                        : 'verifications.channelQr',
                    )}
                    <span className="sub">
                      {t(
                        verification.channel === 'phone'
                          ? 'verifications.channelPhoneHint'
                          : 'verifications.channelQrHint',
                      )}
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
