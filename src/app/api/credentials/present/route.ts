import { NextResponse } from 'next/server';

import { getTranslator } from '@/i18n/server';
import type { Translator } from '@/i18n/translate';
import { findDeclaredType, resolveCredentialType } from '@/lib/credential-profiles';
import { findCustomer } from '@/lib/customers';
import { renderQrSvg } from '@/lib/qr';
import { getEmployeeSession } from '@/lib/session';
import {
  describeTeApiError,
  fetchB2bOrganizationCached,
  requestPresentation,
  sendWakeup,
  TeApiError,
  type TeApiOperation,
} from '@/lib/te-api';
import { findVerification, recordVerification } from '@/lib/verifications';

/**
 * `POST /api/credentials/present` — el botón «pedir credencial». **Habla con te-api.**
 * `GET  /api/credentials/present?presentationId=…` — lee el diario. **No habla con te-api.**
 *
 * Esa asimetría es el diseño y no una casualidad: lo que sale hacia te-api lo
 * dispara siempre una persona pulsando un botón, y lo que vuelve —el veredicto—
 * llega solo, por el webhook. Ninguna de las dos mitades tiene un temporizador
 * detrás. Ver la cabecera del `GET`.
 *
 * ## La otra mitad del ciclo
 *
 * Hasta ahora este CRM emitía una credencial y ahí se acababa: nadie la pedía
 * nunca de vuelta. Esto es la vuelta. El agente pulsa «pedir credencial» y la
 * cartera del titular **presenta** lo que se le pide.
 *
 * ## Dos canales, porque son dos situaciones distintas
 *
 * - **`qr`** — el cliente está delante, en la sucursal, y mira la pantalla del
 *   agente. Es lo único que había hasta ahora.
 * - **`phone`** — el cliente está **al teléfono** y no ve ninguna pantalla. El
 *   QR ahí no sirve de nada: hay que hacer sonar su móvil. Se abre la misma
 *   sesión de presentación y con su `requestUri` se llama a
 *   `POST /v1/b2b/wakeups`, que es el timbre.
 *
 * El canal cambia **cómo se avisa**, no qué se pide ni qué se comprueba: las dos
 * ramas abren la misma sesión con los mismos atributos y se consultan con la
 * misma ruta.
 *
 * ## El verificador es de TripleEnable, no nuestro
 *
 * Es la parte que más se nota al leer este fichero: no hay ningún `fetch` a un
 * walt.id, ni configuración de verificador, ni clave. Sólo se llama a te-api,
 * que abre la sesión en **su** verificador y devuelve el enlace. Un banco que
 * verificase en su casa podría dar por buena cualquier cosa —incluida una
 * credencial que TripleEnable haya revocado— y nadie se enteraría.
 *
 * ## Qué decide el navegador y qué decide este servidor
 *
 * Del navegador llegan **cuatro cosas, y las cuatro son elecciones legítimas
 * del operador**: a qué cliente (`externalId`), qué tipo de credencial
 * (`type`), qué atributos de ese tipo (`claims`) y por qué canal se avisa
 * (`channel`). Ninguna de las cuatro se cree tal cual:
 *
 * - `externalId` se busca **con la organización de la sesión** en el `where`.
 * - `type` se resuelve **contra el padrón de te-api** (`GET /v1/b2b/organization`).
 * - `claims` se comprueban **contra los que ese tipo lleva en esta ficha**.
 * - `channel` se compara contra una lista cerrada.
 *
 * Y hay tres cosas que el navegador **no manda y no puede mandar**, porque las
 * sabe el servidor: el `subjectReference` (sale de la ficha del padrón, no del
 * cuerpo), el `actor` que verá el titular en su móvil (sale de la sesión) y el
 * `kind` del timbre (es constante).
 *
 * ## Se rechaza, no se recorta
 *
 * Un atributo que este tipo no lleva es un **400**, no un silencio. Es la misma
 * regla que te-api aplica en `src/b2b/claims.ts`, que **lanza** en vez de
 * filtrar, y por el mismo motivo escrito allí: recortar por lo bajo deja al
 * integrador convencido de que su código funciona, y el día que ese campo
 * importe nadie sabrá por qué no está. Antes esto filtraba en silencio.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Cómo se le avisa al titular. Ver la cabecera. */
type PresentChannel = 'qr' | 'phone';

interface PresentBody {
  externalId?: unknown;
  type?: unknown;
  claims?: unknown;
  channel?: unknown;
}

export async function POST(request: Request): Promise<NextResponse> {
  // El idioma de quien tiene la consola delante: lo que devuelve esta ruta se
  // pinta tal cual en su pantalla.
  const t = await getTranslator();

  let body: PresentBody;
  try {
    body = (await request.json()) as PresentBody;
  } catch {
    return NextResponse.json({ error: t('errors.bodyNotJson') }, { status: 400 });
  }

  const externalId = typeof body.externalId === 'string' ? body.externalId.trim() : '';
  const type = typeof body.type === 'string' ? body.type.trim() : '';
  const requested = Array.isArray(body.claims)
    ? body.claims.filter((name): name is string => typeof name === 'string')
    : [];
  // El canal se compara contra la lista cerrada en vez de convertirse: un valor
  // raro tiene que ser un 400 aquí y no un `else` que acaba tocando el timbre
  // porque no era `'qr'`.
  const channel: PresentChannel | undefined =
    body.channel === 'qr' || body.channel === 'phone' ? body.channel : undefined;

  if (externalId === '' || type === '') {
    return NextResponse.json({ error: t('errors.missingFields') }, { status: 400 });
  }
  if (channel === undefined) {
    return NextResponse.json({ error: t('errors.badChannel') }, { status: 400 });
  }
  // Antes de tocar la base y te-api: una petición sin atributos no se puede
  // satisfacer mire lo que mire, y te-api tampoco la aceptaría (`claims` es
  // `.min(1)` en su esquema). No hay que gastar una llamada para saberlo.
  if (requested.length === 0) {
    return NextResponse.json({ error: t('errors.noClaimsRequested') }, { status: 400 });
  }

  try {
    const session = await getEmployeeSession();

    // ── El cliente: contra el padrón, y siempre con la organización ────────
    //
    // El `where` lleva el `org_id` de la sesión, así que un `externalId` de
    // otro banco no encuentra fila. Sin eso, el timbre sonaría en el teléfono
    // de un tercero.
    const customer = await findCustomer(session.organization.orgId, externalId);
    if (customer === null) {
      return NextResponse.json({ error: t('errors.customerNotFound') }, { status: 404 });
    }

    // ── El tipo: contra el padrón de te-api ────────────────────────────────
    //
    // `GET /v1/b2b/organization` devuelve los tipos que ESTA organización puede
    // emitir. Un `type` que no esté ahí se rechaza aquí y con su nombre; te-api
    // también lo rechazaría, pero su cuerpo es `{ error, requestId }` y el
    // agente vería «te-api ha rechazado los datos» para algo que este servidor
    // sabe contestar. La respuesta va cacheada un minuto: ver `te-api.ts`.
    const organization = await fetchB2bOrganizationCached(session.organization);
    const declared = findDeclaredType(organization.credentialTypes, type);
    if (declared === undefined) {
      return NextResponse.json(
        { error: t('errors.unknownType', { type }) },
        { status: 400 },
      );
    }

    // ── Los atributos: contra los que ese tipo lleva en ESTA ficha ─────────
    //
    // La lista la construye el servidor cruzando tres cosas —el tipo del
    // padrón, el perfil declarado en configuración y lo que la fila rellena—, y
    // lo que llegó del navegador es una **selección sobre ella**, no una lista
    // libre. Que te-api rechace los reservados no quita que la comprobación
    // tenga que estar también aquí: es aquí donde se sabe qué lleva la
    // credencial de este cliente, porque los claims los puso este CRM al emitir
    // y te-api nunca los ve.
    const profile = resolveCredentialType(t, declared, customer);
    const requestable = new Set(profile.claims.map((claim) => claim.name));

    // Se RECHAZA, no se recorta. La misma decisión que `src/b2b/claims.ts` de
    // te-api, que lanza en vez de filtrar: un recorte silencioso deja al que
    // llama creyendo que pidió lo que no pidió, y el día que ese atributo
    // importe nadie sabrá por qué no salió. La respuesta nombra los que sobran
    // porque el error es de quien llama y tiene que poder arreglarlo.
    const unavailable = requested.filter((name) => !requestable.has(name));
    if (unavailable.length > 0) {
      return NextResponse.json(
        {
          error: t('errors.claimsNotCarried', {
            label: profile.label,
            claims: unavailable.join(', '),
          }),
        },
        { status: 400 },
      );
    }

    // Duplicados aparte y en el orden del catálogo: te-api los colapsa igual,
    // pero así lo que se devuelve al navegador es lo que se pidió de verdad.
    const claims = profile.claims
      .map((claim) => claim.name)
      .filter((name) => requested.includes(name));

    const presentation = await requestPresentation(session.organization, {
      type: declared.type,
      // El `sub` que te-api exigirá a la credencial presentada. Sale de la fila
      // del padrón —no del cuerpo de la petición—, y es el mismo que se usó al
      // emitir. `CONTRATOS.md` §1.2.
      subjectReference: customer.externalId,
      claims,
    });

    // ── Los hitos de la línea de tiempo, con la hora de ESTE servidor ───────
    //
    // La pantalla de espera tiene que avanzar sola, y para eso necesita horas
    // de verdad. Se sellan aquí y no en el navegador por dos razones:
    //
    //  1. El reloj del navegador lo pone quien tenga el puesto delante. Una
    //     línea de tiempo que un agente puede mover cambiando la hora de su
    //     Windows no sirve para reclamar nada.
    //  2. Es el mismo reloj en las dos marcas, así que la diferencia entre
    //     ellas —«el timbre salió 12 s después de crear la solicitud»— es un
    //     dato real y no la resta de dos relojes distintos.
    //
    // te-api **no devuelve la hora de creación** (`POST /v1/b2b/presentations`
    // contesta `{presentationId, requestUri, authorizationRequestUrl,
    // expiresAt}`), así que ésta es la hora en la que su respuesta llegó aquí.
    // Es la que el banco puede defender: la que él vio.
    const requestedAt = new Date().toISOString();
    let wakeupAt: string | undefined;

    // El QR sólo se dibuja para el canal que lo usa. Pintarlo también en una
    // llamada de teléfono sería enseñarle al agente algo que el cliente no
    // puede ver, y el agente acabaría intentando dictarlo.
    const qrSvg =
      channel === 'qr' ? await renderQrSvg(presentation.authorizationRequestUrl) : undefined;

    let wakeupId: string | undefined;
    if (channel === 'phone') {
      try {
        const wakeup = await sendWakeup(session.organization, {
          subjectReference: customer.externalId,
          // «Demuéstrame que eres tú», no «aprueba esta operación». La otra
          // mitad —`transaction`, con importe y destinatario— es F4c nivel 2 y
          // no se manda desde aquí: esta pantalla no tiene ninguna operación
          // que aprobar.
          kind: 'identity',
          // Tal cual salió de te-api. Es el puntero a **su** verificador, y por
          // eso el timbre suena apuntando a la infraestructura de TripleEnable
          // y no a la de Banco Demo.
          requestUri: presentation.requestUri,
          // Atribución, no autenticación: te-api no comprueba nada de esto.
          // Sirve para que en el móvil del titular ponga quién le está llamando.
          actor: session.agent,
        });
        // ── El aviso que no salió ──────────────────────────────────────────
        //
        // te-api contesta `200` toque o no toque el timbre —la fila nace señuelo
        // si no hay a quién despertar—, así que hasta ahora esto seguía adelante
        // y la pantalla prometía «hemos avisado a su móvil» con cinco minutos de
        // cuenta atrás para un aviso inexistente.
        //
        // Ahora lo dice: `delivery.status`. Se para aquí y **por el mismo camino
        // que un timbre que falla**, no con un 200 adornado, porque es la misma
        // situación — no ha salido nada— y la ceremonia no debe quedar anotada
        // como pendiente. La sesión de presentación abierta se deja caducar
        // sola, igual que en el `catch`.
        if (wakeup.delivery?.status === 'not_delivered') {
          console.error('[crm] tocando el timbre: te-api no entregó el aviso', {
            reason: wakeup.delivery.reason,
            wakeupId: wakeup.wakeupId,
          });
          return NextResponse.json(
            {
              error: t('errors.noWalletLink'),
              // El código estable viaja tal cual: quien depure esta integración
              // tiene que poder distinguirlo de un fallo de red sin leer el
              // texto, que además está traducido.
              reason: wakeup.delivery.reason,
            },
            { status: 409 },
          );
        }

        wakeupId = wakeup.wakeupId;
        wakeupAt = new Date().toISOString();
      } catch (error) {
        // La sesión de presentación ya está abierta y **se deja caducar sola**.
        // Se prefiere eso a devolver un 200 con un aviso pequeño: el agente está
        // al teléfono diciéndole al cliente que mire el móvil, y un timbre que
        // no ha salido tiene que parar la ceremonia, no adornarla.
        return errorResponse(t, error, 'tocando el timbre');
      }
    }

    // ── El diario del banco ────────────────────────────────────────────────
    //
    // Se anota **aquí y no antes**: si el timbre falla, la ceremonia no ha
    // empezado y la fila no debe existir. Una comprobación «pendiente» que
    // nunca se llegó a pedir aparecería en el historial del cliente y el agente
    // creería que le avisó.
    //
    // Es lo que convierte esta pantalla en una dirección que se puede volver a
    // abrir: sin la fila, recargar la pestaña perdía la ceremonia en curso y no
    // quedaba rastro de lo que se pidió a quién. Ver `db/003_verification.sql`.
    await recordVerification({
      orgId: session.organization.orgId,
      externalId: customer.externalId,
      presentationId: presentation.presentationId,
      typeKey: declared.type,
      requestedClaims: claims,
      channel,
      issuerDid: organization.did,
      authorizationRequestUrl: presentation.authorizationRequestUrl,
      requestUri: presentation.requestUri,
      expiresAt: presentation.expiresAt,
      agentId: session.agent.id,
      agentName: session.agent.displayName,
      actor: session.actor,
      requestedAt,
      wakeupId,
      wakeupAt,
    });

    return NextResponse.json({
      presentationId: presentation.presentationId,
      authorizationRequestUrl: presentation.authorizationRequestUrl,
      // Se devuelve para poder enseñarlo: es lo que se le manda al timbre y lo
      // que la cartera va a buscar, y enseña de un vistazo que apunta a la
      // infraestructura de TripleEnable.
      requestUri: presentation.requestUri,
      expiresAt: presentation.expiresAt,
      claims,
      channel,
      qrSvg,
      // El identificador del aviso. **No significa que haya sonado ningún
      // teléfono**: te-api contesta lo mismo tenga cartera o no (ver
      // `sendWakeup`). Se enseña para poder cruzarlo con el diario de te-api.
      wakeupId,
      // Los dos hitos que este servidor conoce de primera mano. Ver arriba.
      requestedAt,
      wakeupAt,
      // El `iss` que te-api va a exigirle a la credencial presentada. Es el DID
      // de esta organización y sale del padrón, no del cuerpo: se devuelve para
      // que el recibo pueda enseñar contra qué se comprobó, que es la mitad de
      // lo que hace verificable una verificación.
      issuerDid: organization.did,
      // El tipo, ya resuelto. La pantalla lo tiene por otro lado, pero el
      // recibo se guarda por su cuenta y no puede depender de que el
      // desplegable siga en la misma posición.
      type: declared.type,
    });
  } catch (error) {
    return errorResponse(t, error, 'pidiendo la presentación');
  }
}

/**
 * `GET /api/credentials/present?presentationId=…` — **se lee el diario, no te-api.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ESTA RUTA YA NO HABLA CON te-api, Y ESO ES EL CAMBIO ENTERO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Hasta ahora llamaba a `GET /v1/b2b/presentations/:id` en cada consulta del
 * navegador. La pantalla pregunta cada tres segundos, así que **una ceremonia de
 * cinco minutos eran unas cien llamadas a te-api para averiguar un hecho que
 * ocurre una sola vez**. Y ocurría con el agente mirando: con la pestaña
 * cerrada, nadie preguntaba y la fila se quedaba en `pending` para siempre.
 *
 * Ahora el desenlace entra en el diario **por el webhook y sólo por él**
 * (`api/webhooks/te-api`, que verifica la firma antes de tocar nada). Esta ruta
 * lee la fila que ese receptor ha escrito. Los dos caminos que había —el sondeo
 * y el evento— eran uno de más: te-api liquida toda petición que responde *o*
 * que caduca, así que el evento llega en los dos casos y llega igual con la
 * pestaña cerrada.
 *
 * ## Por qué esto ya no escribe nada
 *
 * Antes este `GET` escribía —reconciliaba la fila con lo que dijera te-api— y
 * hacía falta explicarlo. Ya no: el único que cierra el diario es el receptor de
 * webhooks, que es donde llega el dato firmado. Un `GET` que sólo lee es lo que
 * un `GET` debe ser, y de paso desaparece la duda de quién gana la carrera.
 *
 * ## Lo que el navegador sigue haciendo, y por qué está bien
 *
 * La pantalla sigue preguntando **a este mismo servidor** cada tres segundos.
 * Eso es tráfico interno de la maqueta contra su propia base: no gasta el cubo
 * de tasa de la organización en te-api, que era el coste que importaba, y no
 * cruza ninguna frontera. Lo prohibido era sondear a te-api, y ya no se hace ni
 * desde el navegador ni desde aquí.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const t = await getTranslator();
  const presentationId = new URL(request.url).searchParams.get('presentationId') ?? '';
  if (presentationId === '') {
    return NextResponse.json({ error: t('errors.missingPresentationId') }, { status: 400 });
  }

  try {
    const session = await getEmployeeSession();
    // El `org_id` de la sesión va en el `where`, así que la comprobación de otra
    // organización se comporta igual que una inventada. Antes esta garantía la
    // ponía te-api —buscaba con el `org_id` del token—; al leer de la base hay
    // que ponerla aquí, y `findVerification` no tiene ninguna forma de no
    // ponerla: no existe una función que encuentre una comprobación sin decir de
    // qué organización es.
    const verification = await findVerification(session.organization.orgId, presentationId);
    if (verification === null) {
      return NextResponse.json({ error: t('errors.presentationNotFound') }, { status: 404 });
    }

    // `status` sale del diario, que es donde lo dejó el webhook firmado, y
    // `claims` de la misma fila. Mientras el evento no haya llegado la respuesta
    // es `pending` y la pantalla sigue esperando, que es exactamente lo que
    // significa: todavía no se sabe.
    //
    // `settledAt` es nuevo aquí, y arregla de paso una hora que se inventaba: la
    // pantalla sellaba el desenlace con `new Date()` **del navegador**, o sea con
    // el reloj de quien tuviera el puesto delante. Ahora es la hora que escribió
    // `settleVerification` al llegar el evento — la que este servidor puede
    // defender, que es la regla que el `POST` de aquí arriba ya seguía para los
    // otros dos hitos.
    //
    // ── Y el recibo también, para que la pantalla no tenga que recargarse ──
    //
    // `holderKey`, `holderLinkId` y `proof` salen de la misma fila. Van aquí y
    // no sólo en la página servidor porque la ceremonia ocurre **con la pantalla
    // abierta**: el agente está al teléfono, el titular firma, el webhook
    // aterriza, y la consulta siguiente tiene que poder pintar el recibo entero
    // sin que nadie pulse F5. Sin esto, la mitad de arriba del recibo aparecía
    // sola y las filas de la firma sólo salían al volver a entrar mañana.
    //
    // Sigue sin haber una sola llamada a te-api en esta ruta. Son cuatro
    // columnas más del mismo `select`, no una fuente nueva.
    return NextResponse.json({
      presentationId: verification.presentationId,
      status: verification.status,
      claims: verification.disclosedClaims,
      settledAt: verification.settledAt,
      holderKey: verification.holderKey,
      holderKeyJwk: verification.holderKeyJwk,
      holderLinkId: verification.holderLinkId,
      proof: verification.proof,
    });
  } catch (error) {
    return errorResponse(t, error, 'leyendo la comprobación');
  }
}

/**
 * El mismo trato que en la emisión: el `requestId` es lo único accionable.
 *
 * `operation` va siempre a `'presentation'` en este fichero porque el 403 de
 * te-api significa aquí «ese tipo no tiene `vct` en el padrón» y no lo que
 * significa en el vínculo. Ver `TeApiOperation`.
 */
function errorResponse(
  t: Translator,
  error: unknown,
  doing: string,
  operation: TeApiOperation = 'presentation',
): NextResponse {
  if (error instanceof TeApiError) {
    console.error(`[crm] ${doing}: te-api rechazó la llamada`, {
      status: error.status,
      code: error.code,
      requestId: error.requestId,
    });
    return NextResponse.json(
      { error: describeTeApiError(t, error, operation), requestId: error.requestId },
      { status: error.status === 404 ? 502 : error.status },
    );
  }

  console.error(`[crm] ${doing}`, error);

  // Los fallos de configuración sí enseñan su mensaje: nombran la variable que
  // falta o dicen que Logto rechazó el token, y ninguno lleva el secreto
  // dentro. Ver la nota en `api/credentials/issue/route.ts`.
  const isConfigurationFailure =
    error instanceof Error &&
    (error.name === 'B2bTokenError' || error.name === 'OrganizationConfigError');

  return NextResponse.json(
    {
      error: isConfigurationFailure
        ? (error as Error).message
        : t('errors.presentFailed'),
    },
    { status: 500 },
  );
}
