import { NextResponse } from 'next/server';

import { findDeclaredType, resolveCredentialType } from '@/lib/credential-profiles';
import { findCustomer } from '@/lib/customers';
import { renderQrSvg } from '@/lib/qr';
import { getEmployeeSession } from '@/lib/session';
import {
  describeTeApiError,
  fetchB2bOrganizationCached,
  fetchPresentationStatus,
  requestPresentation,
  sendWakeup,
  TeApiError,
  type TeApiOperation,
} from '@/lib/te-api';

/**
 * `POST /api/credentials/present` — el botón «pedir credencial».
 * `GET  /api/credentials/present?presentationId=…` — «¿ya ha contestado?».
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
  let body: PresentBody;
  try {
    body = (await request.json()) as PresentBody;
  } catch {
    return NextResponse.json({ error: 'el cuerpo no es JSON' }, { status: 400 });
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
    return NextResponse.json({ error: 'faltan externalId o type' }, { status: 400 });
  }
  if (channel === undefined) {
    return NextResponse.json({ error: 'channel tiene que ser qr o phone' }, { status: 400 });
  }
  // Antes de tocar la base y te-api: una petición sin atributos no se puede
  // satisfacer mire lo que mire, y te-api tampoco la aceptaría (`claims` es
  // `.min(1)` en su esquema). No hay que gastar una llamada para saberlo.
  if (requested.length === 0) {
    return NextResponse.json({ error: 'hay que pedir al menos un atributo' }, { status: 400 });
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
      return NextResponse.json({ error: 'ese cliente no está en el padrón' }, { status: 404 });
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
        { error: `«${type}» no es un tipo de credencial de esta organización` },
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
    const profile = resolveCredentialType(declared, customer);
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
          error:
            `la credencial «${profile.label}» de este cliente no lleva ` +
            `${unavailable.join(', ')}, así que no se puede pedir`,
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
        wakeupId = wakeup.wakeupId;
        wakeupAt = new Date().toISOString();
      } catch (error) {
        // La sesión de presentación ya está abierta y **se deja caducar sola**.
        // Se prefiere eso a devolver un 200 con un aviso pequeño: el agente está
        // al teléfono diciéndole al cliente que mire el móvil, y un timbre que
        // no ha salido tiene que parar la ceremonia, no adornarla.
        return errorResponse(error, 'tocando el timbre');
      }
    }

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
    return errorResponse(error, 'pidiendo la presentación');
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  const presentationId = new URL(request.url).searchParams.get('presentationId') ?? '';
  if (presentationId === '') {
    return NextResponse.json({ error: 'falta presentationId' }, { status: 400 });
  }

  try {
    const session = await getEmployeeSession();
    // No hace falta comprobar de quién es: te-api busca la petición con el
    // `org_id` del token en el `where`, así que la de otra organización
    // responde igual que una inventada.
    const status = await fetchPresentationStatus(session.organization, presentationId);
    return NextResponse.json(status);
  } catch (error) {
    return errorResponse(error, 'consultando la presentación');
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
      { error: describeTeApiError(error, operation), requestId: error.requestId },
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
        : 'no se ha podido completar; mira el log del servidor',
    },
    { status: 500 },
  );
}
