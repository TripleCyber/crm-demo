import Link from 'next/link';
import { notFound } from 'next/navigation';

import { VerificationTracker } from '@/components/VerificationTracker';
import { getTranslator } from '@/i18n/server';
import { attributeLabels, findCustomer } from '@/lib/customers';
import { formatTimestamp } from '@/lib/format';
import { renderQrSvg } from '@/lib/qr';
import { getEmployeeSession } from '@/lib/session';
import { findVerification } from '@/lib/verifications';

/**
 * **C2 y C3.** Una comprobación de identidad, con su dirección propia.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  POR QUÉ ESTO NO ES UN TROZO DE LA FICHA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Porque una ceremonia dura minutos y tiene que sobrevivir a que alguien
 * recargue, cambie de pestaña o se vaya a comer. Con dirección propia:
 *
 *  · se recarga sin perder nada —el estado sale del diario, no de la memoria
 *    del navegador—;
 *  · se pasa a un compañero pegando el enlace, que es lo que se hace de verdad
 *    en un centro de llamadas cuando una llamada se transfiere;
 *  · se vuelve a abrir mañana y sigue estando el recibo, que es lo que un banco
 *    adjunta a un expediente.
 *
 * El QR se dibuja **aquí, en el servidor**, y no se guarda: se compone del
 * enlace de autorización que se anotó al abrir la sesión. Por eso recargar la
 * pantalla vuelve a enseñar el mismo código y no uno nuevo — es el mismo dato.
 *
 * ## La fila ya no la reconcilia esta pantalla
 *
 * Aquí decía que al cargar el seguimiento volvía a preguntarle a te-api y que
 * **esa** consulta cerraba la fila — o sea que una comprobación que caducara sin
 * nadie mirando se quedaba en `pending` hasta que alguien abriera esta
 * dirección. Ya no: el desenlace lo escribe el receptor de webhooks
 * (`api/webhooks/te-api`) cuando te-api liquida la petición, y te-api liquida
 * **tanto la que responde como la que caduca**. Con la pestaña cerrada, con
 * nadie delante y de madrugada.
 *
 * Lo que el seguimiento hace al cargar es leer esa fila, no rehacerla. El
 * listado sigue pintando «sin respuesta» para una fila `pending` con el plazo
 * vencido, y eso también sigue siendo lo correcto: es lo que el diario dice
 * mientras el evento no haya llegado, y afirmar una caducidad que nadie ha
 * confirmado sería inventarla.
 */

export const dynamic = 'force-dynamic';

export default async function VerificationPage({
  params,
}: {
  params: Promise<{ presentationId: string }>;
}) {
  const t = await getTranslator();
  const { presentationId } = await params;
  const session = await getEmployeeSession();
  const verification = await findVerification(
    session.organization.orgId,
    decodeURIComponent(presentationId),
  );

  // Con el `org_id` en el `where`, la comprobación de otra organización se
  // comporta igual que una inventada. Es lo correcto: si contestara distinto,
  // esta dirección serviría para averiguar qué bancos usan el producto.
  if (verification === null) notFound();

  const customer = await findCustomer(session.organization.orgId, verification.externalId);
  const holderName =
    customer === null ? null : `${customer.givenName} ${customer.familyName}`;

  const qrSvg =
    verification.channel === 'qr' && verification.status === 'pending'
      ? await renderQrSvg(verification.authorizationRequestUrl)
      : undefined;

  // Los rótulos salen del catálogo del padrón, que es de donde salieron al
  // pedirlos. Un atributo que ya no esté en el catálogo se enseña por su nombre
  // técnico: es un recibo, y un recibo no puede dejar de enseñar un campo
  // porque la configuración haya cambiado después.
  const labelFor = attributeLabels(t);

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">
            <Link href="/verifications">{t('nav.verifications')}</Link>
            {customer !== null && (
              <>
                {' · '}
                <Link href={`/customers/${encodeURIComponent(verification.externalId)}`}>
                  {holderName}
                </Link>
              </>
            )}
          </p>
          <h1>{t('verification.title')}</h1>
          <p className="page-facts">
            <span className="mono">
              {t('verification.request', { id: verification.presentationId })}
            </span>
            <span>
              {t('verification.startedOn', {
                date: formatTimestamp(verification.requestedAt, t.locale),
              })}
            </span>
            <span>
              {t('verification.startedBy', {
                name: verification.agentName,
                id: verification.agentId,
              })}
            </span>
          </p>
        </div>
        <div className="page-actions">
          <Link
            className="button-link secondary"
            href={`/customers/${encodeURIComponent(verification.externalId)}`}
          >
            {t('verification.backToCustomer')}
          </Link>
        </div>
      </header>

      <div className="split wide-side">
        <div className="col-main">
          {/*
            El nombre baja hasta el seguimiento porque el escenario lo enseña
            **al lado del número de cliente**, en los cinco desenlaces: quien
            está al teléfono tiene que poder decir en voz alta con quién cree
            que está hablando y qué ficha está mirando, y eso son dos datos
            juntos y no un nombre en la miga de pan.

            Puede ser `null` —la ficha pudo corregirse después de la
            comprobación, y una comprobación hecha no se borra por eso—, y
            entonces se enseña el número solo, que sigue siendo verdad.
          */}
          <VerificationTracker
            verification={verification}
            qrSvg={qrSvg}
            labelFor={labelFor}
            organizationName={session.organization.displayName}
            holderName={holderName}
          />
        </div>

        <div className="col-side">
          <div className="panel">
            <h2>
              {t('verification.panelTitle')}
              <span className="panel-mark">TripleEnable</span>
            </h2>
            <dl className="facts">
              <dt>{t('verification.holder')}</dt>
              <dd>
                {holderName ?? <span className="none">{t('verification.holderGone')}</span>}
                <br />
                <span className="mono">{verification.externalId}</span>
              </dd>
              <dt>{t('verification.requiredCredential')}</dt>
              <dd>{verification.typeKey}</dd>
              <dt>{t('verification.requestedClaims')}</dt>
              <dd>
                {verification.requestedClaims
                  .map((name) => labelFor[name] ?? name)
                  .join(', ')}
              </dd>
              <dt>{t('verification.howAlerted')}</dt>
              <dd>
                {t(
                  verification.channel === 'phone'
                    ? 'verification.alertedPhone'
                    : 'verification.alertedQr',
                )}
              </dd>
              <dt>{t('verification.requiredIssuer')}</dt>
              <dd>{session.organization.displayName}</dd>
            </dl>
            {/*
              La ventaja, con la palabra del banco. Era «la cartera va a buscar
              la solicitud a http://127.0.0.1:7004/demo», que le dice a un
              director de operaciones exactamente nada; lo que le importa es que
              su entidad no tiene que montar ni custodiar un verificador. La
              dirección exacta sigue estando, abajo.
            */}
            <p className="panel-note">{t('verification.panelNote')}</p>
            <details className="tech">
              <summary>{t('common.technicalDetail')}</summary>
              <dl className="facts">
                <dt>{t('verification.protocol')}</dt>
                <dd className="mono">OID4VP</dd>
                <dt>{t('verification.requiredType')}</dt>
                <dd className="mono">{verification.typeKey}</dd>
                <dt>{t('verification.requestedClaims')}</dt>
                <dd className="mono">{verification.requestedClaims.join(' ')}</dd>
                <dt>{t('verification.requiredIssuer')}</dt>
                <dd className="mono">{verification.issuerDid}</dd>
                <dt>{t('verification.walletCollectsAt')}</dt>
                <dd className="mono">{verification.requestUri}</dd>
              </dl>
            </details>
          </div>
        </div>
      </div>
    </>
  );
}
