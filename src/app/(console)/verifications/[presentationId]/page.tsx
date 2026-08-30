import Link from 'next/link';
import { notFound } from 'next/navigation';

import { VerificationTracker } from '@/components/VerificationTracker';
import { CUSTOMER_ATTRIBUTES, findCustomer } from '@/lib/customers';
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
 * Al cargar, el componente de seguimiento vuelve a preguntar si la petición
 * seguía pendiente, y esa consulta es la que **reconcilia** la fila: una
 * comprobación que caducó sin que nadie mirara se queda en `pending` en la base
 * hasta que alguien abre esta pantalla, y entonces te-api dice `expired` y se
 * anota. Es la razón de que el listado pinte «sin respuesta» en vez de afirmar
 * una caducidad que nadie ha confirmado todavía.
 */

export const dynamic = 'force-dynamic';

export default async function VerificationPage({
  params,
}: {
  params: Promise<{ presentationId: string }>;
}) {
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
  const labelFor = Object.fromEntries(
    CUSTOMER_ATTRIBUTES.map((attribute) => [attribute.claim, attribute.label]),
  );

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">
            <Link href="/verifications">Verificaciones</Link>
            {customer !== null && (
              <>
                {' · '}
                <Link href={`/customers/${encodeURIComponent(verification.externalId)}`}>
                  {holderName}
                </Link>
              </>
            )}
          </p>
          <h1>Verificación de identidad</h1>
          <p className="page-facts">
            <span>
              Petición <span className="mono">{verification.presentationId}</span>
            </span>
            <span>Lanzada el {formatTimestamp(verification.requestedAt)}</span>
            <span>
              Por {verification.agentName}, agente{' '}
              <span className="mono">{verification.agentId}</span>
            </span>
          </p>
        </div>
        <div className="page-actions">
          <Link
            className="button-link secondary"
            href={`/customers/${encodeURIComponent(verification.externalId)}`}
          >
            Volver a la ficha
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
              La petición
              <span className="panel-mark">TripleEnable</span>
            </h2>
            <dl className="facts">
              <dt>Titular</dt>
              <dd>
                {holderName ?? <span className="none">la ficha ya no está en el padrón</span>}
                <br />
                <span className="mono">{verification.externalId}</span>
              </dd>
              <dt>Credencial exigida</dt>
              <dd>{verification.typeKey}</dd>
              <dt>Atributos pedidos</dt>
              <dd>
                {verification.requestedClaims
                  .map((name) => labelFor[name] ?? name)
                  .join(', ')}
              </dd>
              <dt>Cómo se avisó</dt>
              <dd>
                {verification.channel === 'phone'
                  ? 'Aviso a su móvil · estaba al teléfono'
                  : 'QR en pantalla · estaba delante'}
              </dd>
              <dt>Emisor exigido</dt>
              <dd>{session.organization.displayName}</dd>
            </dl>
            {/*
              La ventaja, con la palabra del banco. Era «la cartera va a buscar
              la solicitud a http://127.0.0.1:7004/demo», que le dice a un
              director de operaciones exactamente nada; lo que le importa es que
              su entidad no tiene que montar ni custodiar un verificador. La
              dirección exacta sigue estando, abajo.
            */}
            <p className="panel-note">
              La comprobación la hace TripleEnable. Esta organización no tiene que montar ni custodiar
              ningún verificador: pone la pregunta y lee la respuesta.
            </p>
            <details className="tech">
              <summary>Ver el detalle técnico</summary>
              <dl className="facts">
                <dt>Protocolo</dt>
                <dd className="mono">OID4VP</dd>
                <dt>Tipo exigido</dt>
                <dd className="mono">{verification.typeKey}</dd>
                <dt>Atributos pedidos</dt>
                <dd className="mono">{verification.requestedClaims.join(' ')}</dd>
                <dt>Emisor exigido</dt>
                <dd className="mono">{verification.issuerDid}</dd>
                <dt>La cartera la recoge en</dt>
                <dd className="mono">{verification.requestUri}</dd>
              </dl>
            </details>
          </div>
        </div>
      </div>
    </>
  );
}
