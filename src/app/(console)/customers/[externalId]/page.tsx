import Link from 'next/link';
import { notFound } from 'next/navigation';

import { VerificationPill } from '@/components/VerificationPill';
import { getTranslator } from '@/i18n/server';
import type { Translator } from '@/i18n/translate';
import { listOffersForCustomer, type IssuedOffer } from '@/lib/credential-offers';
import { columnLabelOf, referenceOf } from '@/lib/customers';
import { loadCustomerContext } from '@/lib/customer-context';
import { deliveryPhrase } from '@/lib/delivery';
import { formatCalendarDate, formatTimestamp } from '@/lib/format';
import { listVerificationsForCustomer, type VerificationRecord } from '@/lib/verifications';

/**
 * La ficha del cliente — **C1** del artifact «Llamada Verificada».
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  UNA FICHA, NO UN FORMULARIO: AQUÍ NO SE EMITE NI SE COMPROBA NADA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Esta pantalla contesta tres preguntas y ninguna más: **quién es**, **qué ha
 * pasado con su identidad digital** y **qué se puede hacer ahora**. Las dos
 * acciones —emitir una credencial y comprobar quién habla— viven cada una en su
 * propia dirección (`./credential` y `./verify`), y eso no es orden por gusto:
 *
 *  · Emitir es **firmar en nombre del banco** un documento que dura años. Es
 *    una operación con su propia pantalla, sus propias comprobaciones previas
 *    y su propio resultado que hay que leer. Metida en un bloque de la ficha,
 *    se ejecuta mientras se mira otra cosa.
 *  · Comprobar abre una ceremonia que **le suena el teléfono a una persona** y
 *    que hay que seguir hasta que conteste. Su seguimiento necesita una
 *    dirección propia (`/verifications/<id>`) para poder recargarse, pasarse a
 *    un compañero y volver a abrirse mañana.
 *
 * La ficha se queda con lo que sí es de la ficha: los datos del titular y el
 * diario de lo que este banco ha hecho con su identidad.
 *
 * ## Las dos columnas dicen algo
 *
 * A la izquierda, **lo que el banco ya tenía**: el padrón y su historia. A la
 * derecha, con filete azul, **la capa de identidad**: el estado y las acciones.
 * Un directivo que mire esta pantalla tiene que poder ver de un vistazo qué
 * parte de su herramienta es la suya de siempre y qué parte es lo nuevo.
 *
 * ## Y lo que sigue sin haber: insignias verdes
 *
 * No hay ninguna marca de «credencial activa» ni de «perfil verificado», y no
 * es un olvido. **El CRM no conoce ninguno de los dos estados**: te-api no
 * cuenta si el titular aceptó la oferta ni con qué nivel de garantía nació su
 * perfil. Una insignia verde que no pregunta a nadie es peor que ninguna,
 * porque el agente se la cree. Lo que sí se enseña es lo que este banco hizo,
 * con su fecha, y el panel dice en voz alta lo que no puede saber.
 */

export const dynamic = 'force-dynamic';

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ externalId: string }>;
}) {
  const t = await getTranslator();
  const { externalId } = await params;
  const { session, customer, teApiWarning } = await loadCustomerContext(externalId);

  if (customer === null) notFound();

  const [offers, verifications] = await Promise.all([
    listOffersForCustomer(session.organization.orgId, customer.externalId),
    listVerificationsForCustomer(session.organization.orgId, customer.externalId),
  ]);

  const lastOffer = offers[0];
  const lastVerification = verifications[0];
  const href = `/customers/${encodeURIComponent(customer.externalId)}`;

  // La referencia del sector de ESTA ficha. Ver `referenceOf` en `lib/customers.ts`.
  const reference = referenceOf(customer);

  /**
   * La comprobación que sigue viva, si la hay.
   *
   * «Viva» es pendiente **y dentro de plazo**: una fila que se quedó en
   * `pending` con la hora vencida no es una ceremonia en curso, es una que
   * nadie miró cuando caducó. Es la misma condición que decide el color de la
   * insignia, y por eso el plazo se compara aquí igual que en
   * `describeVerification`.
   */
  const liveVerification =
    lastVerification !== undefined &&
    lastVerification.status === 'pending' &&
    new Date(lastVerification.expiresAt).getTime() > Date.now()
      ? lastVerification
      : undefined;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">
            <Link href="/customers">{t('nav.customers')}</Link>
          </p>
          <h1>
            {customer.givenName} {customer.familyName}
          </h1>
          <p className="page-facts">
            <span className="mono">{customer.externalId}</span>
            {/*
              La referencia del sector, no «Cuenta» escrito a mano: en el banco
              son los cuatro últimos de la cuenta, en la aseguradora la póliza y
              en la clínica el número de historia. Las tres hacen el mismo
              trabajo —que el titular reconozca de qué relación se habla— y por
              eso ocupan el mismo sitio. Ver `referenceOf` en `lib/customers.ts`.
            */}
            {reference !== undefined && (
              <span>
                {columnLabelOf(t, reference.attribute)}{' '}
                <span className="mono">
                  {reference.attribute.display === undefined
                    ? reference.value
                    : reference.attribute.display(reference.value)}
                </span>
              </span>
            )}
            {customer.customerSince !== null && (
              <span>
                {t('customer.customerSince', {
                  date: formatCalendarDate(customer.customerSince, t.locale),
                })}
              </span>
            )}
          </p>
        </div>
      </header>

      {teApiWarning !== undefined && (
        <p className="alert">{t('customer.teApiWarning', { reason: teApiWarning })}</p>
      )}

      <div className="split side-first">
        <div className="col-main">
          <div className="card">
            <h2>{t('customer.holderData')}</h2>
            <dl className="facts">
              <dt>{t('customer.identifier')}</dt>
              <dd className="mono">{customer.externalId}</dd>
              <dt>{t('customer.email')}</dt>
              <dd>{customer.email ?? <span className="none">{t('common.none')}</span>}</dd>
              <dt>{t('customer.phone')}</dt>
              <dd>{customer.phone ?? <span className="none">{t('common.none')}</span>}</dd>
              {/*
                La fila lleva el rótulo LARGO —«Últimos cuatro de la cuenta»—
                porque aquí hay sitio y porque es la ficha: quien la lee está
                comprobando un dato concreto, no recorriendo una columna.
                Cuando la ficha no rellena ninguna de las tres, la fila no se
                pinta: «no consta» debajo de un rótulo que no es de su sector
                («Cuenta» en una clínica) informa peor que no estar.
              */}
              {reference !== undefined && (
                <>
                  <dt>{t(reference.attribute.labelKey)}</dt>
                  <dd className="mono">
                    {reference.attribute.display === undefined
                      ? reference.value
                      : reference.attribute.display(reference.value)}
                  </dd>
                </>
              )}
              <dt>{t('attributes.customerSince')}</dt>
              <dd>
                {customer.customerSince === null ? (
                  <span className="none">{t('common.none')}</span>
                ) : (
                  formatCalendarDate(customer.customerSince, t.locale)
                )}
              </dd>
            </dl>
          </div>

          <div className="card">
            <h2>{t('customer.activityTitle')}</h2>
            <p className="muted">{t('customer.activityIntro')}</p>
            <CustomerActivity t={t} offers={offers} verifications={verifications} />
          </div>
        </div>

        <div className="col-side">
          <div className="panel">
            <h2>
              {t('customer.digitalIdentity')}
              <span className="panel-mark">TripleEnable</span>
            </h2>

            <dl className="facts">
              <dt>{t('customer.credential')}</dt>
              <dd>
                {lastOffer === undefined ? (
                  <span className="none">{t('customer.credentialNeverOffered')}</span>
                ) : (
                  <>
                    {t('customer.credentialOfferedOn', {
                      date: formatTimestamp(lastOffer.createdAt, t.locale),
                    })}
                    <br />
                    {lastOffer.typeKey} · {deliveryPhrase(t, lastOffer.delivery)}
                  </>
                )}
              </dd>

              <dt>{t('customer.lastVerification')}</dt>
              <dd>
                {lastVerification === undefined ? (
                  <span className="none">{t('customer.neverVerified')}</span>
                ) : (
                  <>
                    <VerificationPill
                      status={lastVerification.status}
                      expiresAt={lastVerification.expiresAt}
                    />
                    <br />
                    <Link href={`/verifications/${encodeURIComponent(lastVerification.presentationId)}`}>
                      {formatTimestamp(lastVerification.requestedAt, t.locale)}
                    </Link>
                  </>
                )}
              </dd>
            </dl>

            {/*
              La frase que sostiene toda la honradez de esta pantalla. Va aquí,
              debajo del estado, y no escondida en un pie: quien lea «ofrecida»
              tiene que leer a continuación que ofrecida no es aceptada.

              Se ha acortado, no ablandado. Lo que sobraba era el porqué
              técnico —qué ruta de te-api falta—: al director que decide le
              basta con que no lo sabemos, y a nadie le tranquiliza leer un
              inventario de nuestras carencias en la ficha de su cliente.
            */}
            <p className="panel-note">{t.rich('customer.honestyNote')}</p>
          </div>

          <div className="panel">
            <h2>{t('customer.actionsTitle')}</h2>
            <div className="actions">
              {/*
                Si hay una ceremonia viva, volver a ella es lo primero y no una
                acción más: el agente que ha ido a mirar otra cosa mientras el
                cliente busca el móvil tiene que poder regresar sin recordar la
                dirección. Lanzar otra comprobación mientras la anterior sigue
                abierta le hace sonar el teléfono dos veces a la misma persona.
              */}
              {liveVerification !== undefined && (
                <Link
                  className="action primary"
                  href={`/verifications/${encodeURIComponent(liveVerification.presentationId)}`}
                >
                  <strong>{t('customer.resumeVerification')}</strong>
                  <span>
                    {t('customer.resumeVerificationHint', {
                      time: formatTimestamp(liveVerification.requestedAt, t.locale),
                    })}
                  </span>
                </Link>
              )}
              <Link
                className={liveVerification === undefined ? 'action primary' : 'action'}
                href={`${href}/credential`}
              >
                <strong>{t('customer.issueCredential')}</strong>
                <span>{t('customer.issueCredentialHint')}</span>
              </Link>
              {/*
                Los dos niveles del artifact, cada uno abriendo la misma
                pantalla en el nivel que le toca. Siguen siendo dos ceremonias
                distintas —una se aprueba deslizando y la otra tecleando cuatro
                cifras— y por eso son dos entradas y no un desplegable.
              */}
              <Link className="action" href={`${href}/verify`}>
                <strong>{t('customer.verifyCaller')}</strong>
                <span>{t('customer.verifyCallerHint')}</span>
              </Link>
              <Link className="action" href={`${href}/verify?level=transaction`}>
                <strong>{t('customer.authoriseTransaction')}</strong>
                <span>{t('customer.authoriseTransactionHint')}</span>
              </Link>
              {/*
                **Entrada propia, no un tercer nivel.** Lo que se pide aquí no
                es «estos atributos» sino una sola pregunta, y la pantalla del
                titular es otra. Meterlo en `?level=` habría obligado a un `if`
                por campo en el lanzador de verificación, que es lo que se
                evitó al separar la transferencia.
              */}
              <Link className="action" href={`${href}/age`}>
                <strong>{t('customer.checkAge')}</strong>
                <span>{t('customer.checkAgeHint')}</span>
              </Link>
              {/*
                **El catálogo va el último, y es otra cosa.** Las cuatro
                entradas de arriba son lo que este banco hace con sus clientes.
                Ésta abre las treinta y seis formas de ceremonia que el marco
                sabe pintar, escritas para trece industrias: es una
                demostración, y va detrás de lo que sí es del día a día para que
                no se confunda con ello.
              */}
              <Link className="action" href={`${href}/ceremonies`}>
                <strong>{t('customer.ceremonies')}</strong>
                <span>{t('customer.ceremoniesHint')}</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * El diario del cliente: ofertas y comprobaciones en una sola columna.
 *
 * Se mezclan a propósito. Para el agente son la misma historia —lo que este
 * banco ha hecho con la identidad de esta persona— y separarlas en dos listas
 * obliga a leer dos veces y a cruzar fechas a ojo para saber qué pasó antes.
 */
function CustomerActivity({
  t,
  offers,
  verifications,
}: {
  // El traductor baja por parámetro y no se vuelve a pedir: dos resoluciones
  // del mismo idioma en la misma pantalla es una de más.
  t: Translator;
  offers: readonly IssuedOffer[];
  verifications: readonly VerificationRecord[];
}) {
  const entries = [
    ...offers.map((offer) => ({ at: offer.createdAt, offer, verification: undefined })),
    ...verifications.map((verification) => ({
      at: verification.requestedAt,
      offer: undefined,
      verification,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  if (entries.length === 0) {
    return (
      <p className="none" style={{ margin: 0 }}>
        {t('customer.activityEmpty')}
      </p>
    );
  }

  return (
    <ul className="activity">
      {entries.map((entry) => (
        <li key={entry.offer?.offerId ?? entry.verification?.presentationId}>
          <span className="activity-when">{formatTimestamp(entry.at, t.locale)}</span>
          <div className="activity-what">
            {entry.offer !== undefined && (
              <>
                <strong>{t('customer.activityOffer')}</strong>
                <span className="activity-sub">
                  {entry.offer.typeKey} · {deliveryPhrase(t, entry.offer.delivery)} ·{' '}
                  {t('customer.activityOfferFrom')}{' '}
                  <span className="mono">{entry.offer.createdBy}</span>
                </span>
              </>
            )}
            {entry.verification !== undefined && (
              <>
                <strong>
                  {t('customer.activityVerification')}{' '}
                  <VerificationPill
                    status={entry.verification.status}
                    expiresAt={entry.verification.expiresAt}
                  />
                </strong>
                <span className="activity-sub">
                  {t(
                    entry.verification.channel === 'phone'
                      ? 'customer.channelPhone'
                      : 'customer.channelQr',
                  )}{' '}
                  · {t('customer.onBehalfOf', { agent: entry.verification.agentName })} ·{' '}
                  <Link href={`/verifications/${encodeURIComponent(entry.verification.presentationId)}`}>
                    {t('customer.activityVerificationLink')}
                  </Link>
                </span>
              </>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
