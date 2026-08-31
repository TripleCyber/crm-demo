import Link from 'next/link';

import { getTranslator } from '@/i18n/server';
import { describeConsoleFailure } from '@/lib/console-failures';
import { formatTimestamp } from '@/lib/format';
import { getEmployeeSession } from '@/lib/session';
import { listWebhookEvents, type WebhookEventRecord } from '@/lib/webhook-events';

/**
 * **Los eventos que ha mandado TripleEnable.** Lo recibido, no lo preguntado.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  POR QUÉ ESTA PANTALLA ES LA MITAD DEL RECEPTOR, Y NO UN EXTRA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Un webhook es la única parte de esta integración que **ocurre sin que nadie
 * esté mirando**. Todo lo demás lo lanza un agente y ve el resultado en la misma
 * pantalla; esto llega a las tres de la mañana, se aplica o no, y sin un sitio
 * donde verlo la única forma de saber si funciona es entrar en la base a mano.
 *
 * Por eso hay cuatro columnas y no una lista de horas:
 *
 *  · **Cuándo** — dos horas, no una. `occurredAt` es cuándo lo registró te-api y
 *    `receivedAt` cuándo llegó aquí, y la distancia entre las dos es el síntoma
 *    de que hubo reintentos. Con una sola no se distingue «te-api tardó» de
 *    «nosotros estuvimos caídos».
 *  · **Qué** — el tipo. Varios entran por la misma ruta.
 *  · **A quién** — el cliente, cruzado contra el diario de comprobaciones. Es lo
 *    que convierte una fila técnica en algo que un agente puede usar.
 *  · **Si la firma cuadró** — y va en su propia columna, en rojo cuando no.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  UNA FILA EN ROJO NO ES UN FALLO DE ESTA PANTALLA: ES LO QUE HAY QUE VER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Un evento con la firma mal es, por definición, algo que no ha mandado te-api, y
 * **no ha tocado nada**: no cierra ninguna comprobación y no cambia ninguna
 * ficha. Se guarda y se enseña porque cuando aparece significa una de dos cosas y
 * las dos hay que verlas:
 *
 *  · alguien está probando a inventar eventos de credenciales en el diario de
 *    esta empresa, o
 *  · **el secreto se rotó en la consola y aquí no se actualizó**, y entonces se
 *    están perdiendo entregas legítimas — que es el fallo caro, porque no tiene
 *    ningún otro síntoma.
 *
 * Sin estas filas la pantalla saldría vacía en los dos casos, y «no ha pasado
 * nada» es la lectura equivocada de los dos.
 *
 * ## Y el cuerpo entero, plegado
 *
 * Porque la forma del evento crece: el 2026-08-31 pasó de llevar sólo el
 * identificador de la sesión a llevar el veredicto, el tipo de credencial y tres
 * marcas de tiempo. Un campo nuevo aparece aquí solo, sin tocar esta pantalla,
 * que es exactamente lo que se quiere de un detalle técnico.
 */

export const dynamic = 'force-dynamic';

/**
 * Si las dos marcas de tiempo son distintas para quien lee la pantalla.
 *
 * Un minuto, que es la precisión con la que se pintan. Menos que eso son dos
 * relojes distintos sellando el mismo instante, no un retraso.
 */
function differByAMinute(a: string, b: string): boolean {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) >= 60_000;
}

export default async function EventsPage() {
  const t = await getTranslator();
  let events: WebhookEventRecord[] = [];
  let failure: string | undefined;
  let webhookUrl: string | undefined;
  let secretDeclared = false;

  try {
    const session = await getEmployeeSession();
    // La dirección se compone del dominio declarado y no del `Host`: es lo que
    // hay que pegar en la consola, y tiene que ser la misma que te-api va a
    // llamar. Componerla con la petición enseñaría `localhost` a quien abra esto
    // por un túnel.
    webhookUrl = `https://${session.organization.domain}/api/webhooks/te-api`;
    secretDeclared = session.organization.webhookSecret !== undefined;
    events = await listWebhookEvents(session.organization.orgId);
  } catch (error) {
    failure = describeConsoleFailure(t, error, 'el registro de eventos no cargó');
  }

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">{t('events.eyebrow')}</p>
          <h1>{t('events.title')}</h1>
          <p className="page-sub">{t('events.subtitle')}</p>
        </div>
      </header>

      {failure !== undefined && (
        <p className="alert">{t('events.loadFailed', { reason: failure })}</p>
      )}

      {webhookUrl !== undefined && (
        <div className="card">
          <h2>{t('events.endpointTitle')}</h2>
          <dl className="facts">
            <dt>{t('events.endpointUrl')}</dt>
            <dd className="mono">{webhookUrl}</dd>
            <dt>{t('events.endpointSecret')}</dt>
            <dd>
              {secretDeclared ? (
                // Se dice QUE hay secreto, nunca cuál. Esta pantalla la abre
                // quien opera, pero un secreto pintado acaba en una captura.
                t('events.endpointSecretSet')
              ) : (
                <span className="warn">
                  {t('events.endpointSecretMissing')}{' '}
                  <span className="mono">CRM_WEBHOOK_SECRET</span>
                </span>
              )}
            </dd>
          </dl>
          <p className="muted" style={{ marginBottom: 0 }}>
            {t('events.endpointNote')}
          </p>
        </div>
      )}

      {failure === undefined && events.length === 0 && (
        <div className="empty">
          <h2>{t('events.emptyTitle')}</h2>
          <p>{t('events.emptyBody')}</p>
          <Link className="button-link secondary" href="/diagnostics">
            {t('events.emptyAction')}
          </Link>
        </div>
      )}

      {events.length > 0 && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>{t('events.columnReceived')}</th>
                <th>{t('events.columnType')}</th>
                <th>{t('events.columnCustomer')}</th>
                <th>{t('events.columnSignature')}</th>
                <th>{t('events.columnPayload')}</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.eventId}>
                  <td>
                    {formatTimestamp(event.receivedAt, t.locale)}
                    {/*
                      La hora de te-api sólo cuando es OTRA **de verdad**. La
                      comparación es por minuto y no por igualdad exacta: las dos
                      marcas difieren siempre en milisegundos —una la pone te-api
                      y otra esta base—, así que comparar las cadenas enteras
                      pintaba la segunda hora en TODAS las filas diciendo lo mismo
                      que la primera. Cuando de verdad difieren, la diferencia es
                      el dato: hubo reintentos.
                    */}
                    {event.occurredAt !== null && differByAMinute(event.occurredAt, event.receivedAt) && (
                      <span className="sub">
                        {t('events.occurredAt', {
                          time: formatTimestamp(event.occurredAt, t.locale),
                        })}
                      </span>
                    )}
                  </td>
                  <td>
                    <span className="mono">{event.type}</span>
                    {event.status !== null && (
                      <span className="sub">{t('events.outcome', { status: event.status })}</span>
                    )}
                  </td>
                  <td>
                    {event.externalId === null ? (
                      // Un guion y no «desconocido»: `webhook.test` no afecta a
                      // ningún cliente y decir que no se sabe quién es sugiere un
                      // fallo donde no lo hay.
                      <span className="none">{t('common.dash')}</span>
                    ) : (
                      <Link
                        className="row-link"
                        href={`/customers/${encodeURIComponent(event.externalId)}`}
                      >
                        {event.externalId}
                      </Link>
                    )}
                    {event.presentationId !== null && (
                      <span className="mono sub">{event.presentationId}</span>
                    )}
                  </td>
                  <td>
                    {event.signatureOk ? (
                      <span className="pill ok">{t('events.signatureOk')}</span>
                    ) : (
                      <>
                        <span className="pill alarm">{t('events.signatureBad')}</span>
                        {/*
                          El código crudo —`bad_signature`, `stale_timestamp`— y
                          no una frase traducida. Lo lee quien opera, es lo que
                          hay que buscar en el registro de te-api, y traducirlo
                          obligaría a mantener un catálogo por cada motivo que
                          añada la comprobación.
                        */}
                        {event.signatureError !== null && (
                          <span className="mono sub">{event.signatureError}</span>
                        )}
                      </>
                    )}
                  </td>
                  <td>
                    <details className="tech">
                      <summary>{t('common.technicalDetail')}</summary>
                      <dl className="facts">
                        <dt>{t('events.eventId')}</dt>
                        <dd className="mono">{event.eventId}</dd>
                        {event.deliveryId !== null && (
                          <>
                            <dt>{t('events.deliveryId')}</dt>
                            <dd className="mono">{event.deliveryId}</dd>
                          </>
                        )}
                        {event.apiVersion !== null && (
                          <>
                            <dt>apiVersion</dt>
                            <dd className="mono">{event.apiVersion}</dd>
                          </>
                        )}
                      </dl>
                      {/*
                        El cuerpo entero, tal y como llegó. No se recorta ni se
                        reordena: es lo que se firmó, y quien depura tiene que
                        poder compararlo carácter a carácter con lo que enseñe el
                        registro de entregas de te-api.
                      */}
                      <pre>{JSON.stringify(event.payload, null, 2)}</pre>
                    </details>
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
