import { NextResponse } from 'next/server';

import { buildCredentialClaims, findCustomer } from '@/lib/customers';
import { renderQrSvg } from '@/lib/qr';
import { getEmployeeSession } from '@/lib/session';
import {
  describeTeApiError,
  fetchPresentationStatus,
  requestPresentation,
  sendWakeup,
  TeApiError,
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
 * ## Del navegador sólo llegan el `externalId`, el tipo y los atributos
 *
 * Y los atributos se comprueban contra los que **este CRM emite** en la
 * credencial de este cliente. Es la misma disciplina que en la emisión: si la
 * lista viniera libre del navegador, quien tuviera abierta la consola podría
 * pedirle a la cartera de un cliente atributos que no salen de esta ficha. Que
 * te-api rechace los reservados no quita que la comprobación tenga que estar
 * también aquí, donde se sabe qué lleva la credencial.
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

  try {
    const session = await getEmployeeSession();

    // El cliente se busca SIEMPRE con la organización de la sesión, igual que
    // al emitir: sin eso, un `externalId` de otro banco haría sonar el timbre
    // de un tercero.
    const customer = await findCustomer(session.organization.orgId, externalId);
    if (customer === null) {
      return NextResponse.json({ error: 'ese cliente no está en el padrón' }, { status: 404 });
    }

    // Sólo se puede pedir lo que esta credencial lleva. La lista sale de la
    // ficha, en el servidor, y lo que llegó del navegador es una selección
    // sobre ella — no una lista libre.
    const issuable = new Set(Object.keys(buildCredentialClaims(customer)));
    const claims = requested.filter((name) => issuable.has(name));
    if (claims.length === 0) {
      return NextResponse.json(
        { error: 'hay que pedir al menos un atributo de los que lleva esta credencial' },
        { status: 400 },
      );
    }

    const presentation = await requestPresentation(session.organization, {
      type,
      // El `sub` que te-api exigirá a la credencial presentada. `CONTRATOS.md`
      // §1.2: es el id del cliente en Banco Demo, el mismo que al emitir.
      subjectReference: customer.externalId,
      claims,
    });

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

/** El mismo trato que en la emisión: el `requestId` es lo único accionable. */
function errorResponse(error: unknown, doing: string): NextResponse {
  if (error instanceof TeApiError) {
    console.error(`[crm] ${doing}: te-api rechazó la llamada`, {
      status: error.status,
      code: error.code,
      requestId: error.requestId,
    });
    return NextResponse.json(
      { error: describeTeApiError(error), requestId: error.requestId },
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
