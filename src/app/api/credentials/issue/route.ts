import { NextResponse } from 'next/server';

import { recordIssuedOffer } from '@/lib/credential-offers';
import { findDeclaredType, resolveCredentialType } from '@/lib/credential-profiles';
import { buildCredentialClaims, findCustomer, type Customer } from '@/lib/customers';
import { getPortalBaseUrl } from '@/lib/portal-oidc';
import { renderQrSvg } from '@/lib/qr';
import { getEmployeeSession } from '@/lib/session';
import {
  describeTeApiError,
  fetchB2bOrganizationCached,
  issueCredential,
  TeApiError,
} from '@/lib/te-api';

/**
 * `POST /api/credentials/issue` — el botón «emitir credencial».
 *
 * ## Por qué existe esta ruta y no un `fetch` a te-api desde el navegador
 *
 * Porque para llamar a te-api hace falta el token M2M de la organización, y ese
 * token se saca con el secreto de la aplicación M2M. Cualquier diseño en el que
 * el navegador llame a te-api termina con ese secreto —o con un token que vale
 * para emitir— al alcance de la consola de red. El navegador habla con este
 * servidor; este servidor habla con te-api. Es el patrón de `tenant-admin`.
 *
 * ## Lo único que acepta del navegador es el `externalId`
 *
 * Ni los claims, ni el nombre, ni la cuenta. Todo eso se lee de la ficha. Ver
 * la nota larga en `buildCredentialClaims`: si el contenido de la credencial
 * viniera del cliente, la firma de Banco Demo respaldaría lo que escribiese
 * quien tuviera abierta la consola del navegador.
 *
 * `type`, `validityDays`, `withPin` y `delivery` sí llegan de fuera, y son las
 * cuatro elecciones legítimas del operador. te-api resuelve el tipo **contra el
 * padrón de la organización del token** y recorta la vigencia al tope de ese
 * tipo, así que pedir un tipo ajeno o una vigencia de diez años no cuela allí,
 * que es donde tiene que no colar. Aun así el tipo **también se resuelve
 * aquí**: con la lista del padrón ya en la mano hace falta para saber qué
 * claims lleva, y de paso el error deja de ser el `{ error, requestId }` opaco
 * de te-api y pasa a nombrar el tipo.
 *
 * ## Los cuatro canales, y por qué el canal no cambia la credencial
 *
 * `delivery` decide **cómo llega la oferta**, no qué lleva dentro ni con qué
 * autoridad. La oferta es la misma en los cuatro: la misma URI, la misma firma
 * y el mismo `tx_code`. Es la regla del artifact —«el canal nunca es una
 * entrada de confianza»— escrita en código: este `switch` toca la entrega y no
 * puede tocar `issueCredential`, que ya ha ocurrido cuando se lee.
 *
 * - `qr` — el cliente está delante y mira esta pantalla.
 * - `link` — el enlace, para pegarlo donde haga falta.
 * - `email` — se compone un borrador `mailto:` **sin el `tx_code` dentro**, y
 *   lo manda el agente desde su propio correo. El CRM no tiene servidor de
 *   correo y no se le pone uno para esto.
 * - `app` — la oferta se queda esperando en `/portal` y sólo la ve quien entre
 *   con su cuenta. Es el único de los cuatro en el que quien recoge está
 *   autenticado.
 *
 * ## Los números oficiales van DENTRO
 *
 * Se emiten como el claim `official_numbers` con los que declara la
 * organización (`organizations.ts`). No son un adorno de la pantalla de
 * emisión: son lo que después permite que la cartera diga «te llama desde uno
 * de los números que guarda tu credencial» en vez de «te llama tu banco», que
 * no prueba nada porque el identificador de llamada se falsifica.
 *
 * No salen de la ficha y por eso no pasan por `buildCredentialClaims`: no son
 * un dato del cliente, son un dato del emisor. Y **no son personales**: son los
 * teléfonos públicos del banco, así que no les aplica la regla de «el correo y
 * el teléfono del cliente no entran en ninguna credencial».
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Cómo se le hace llegar la oferta al titular. Ver la cabecera. */
type DeliveryChannel = 'qr' | 'link' | 'email' | 'app';

const DELIVERY_CHANNELS: readonly DeliveryChannel[] = ['qr', 'link', 'email', 'app'];

function isDeliveryChannel(value: unknown): value is DeliveryChannel {
  return typeof value === 'string' && (DELIVERY_CHANNELS as readonly string[]).includes(value);
}

interface IssueBody {
  externalId?: unknown;
  type?: unknown;
  validityDays?: unknown;
  withPin?: unknown;
  delivery?: unknown;
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: IssueBody;
  try {
    body = (await request.json()) as IssueBody;
  } catch {
    return NextResponse.json({ error: 'el cuerpo no es JSON' }, { status: 400 });
  }

  const externalId = typeof body.externalId === 'string' ? body.externalId.trim() : '';
  const type = typeof body.type === 'string' ? body.type.trim() : '';
  const withPin = body.withPin === true;
  const validityDays =
    typeof body.validityDays === 'number' && Number.isInteger(body.validityDays)
      ? body.validityDays
      : undefined;
  // Lista cerrada, igual que el `channel` de la comprobación: un valor raro
  // tiene que ser un 400 y no un `else` que acaba entregando por otro sitio.
  const delivery = isDeliveryChannel(body.delivery) ? body.delivery : undefined;

  if (externalId === '' || type === '') {
    return NextResponse.json({ error: 'faltan externalId o type' }, { status: 400 });
  }
  if (delivery === undefined) {
    return NextResponse.json(
      { error: `delivery tiene que ser uno de: ${DELIVERY_CHANNELS.join(', ')}` },
      { status: 400 },
    );
  }

  try {
    const session = await getEmployeeSession();

    // El cliente se busca SIEMPRE con la organización de la sesión. Sin eso, un
    // `externalId` de otro banco emitiría una credencial de Banco Demo con los
    // datos de un tercero.
    const customer = await findCustomer(session.organization.orgId, externalId);
    if (customer === null) {
      return NextResponse.json({ error: 'ese cliente no está en el padrón' }, { status: 404 });
    }

    // Se comprueba ANTES de emitir. Una oferta emitida que no se puede entregar
    // no es peligrosa —caduca sola— pero deja al agente con una credencial
    // creada, un `tx_code` en pantalla y ninguna forma de mandarla, que es la
    // peor manera de descubrir que la ficha no tiene correo.
    if (delivery === 'email' && customer.email === null) {
      return NextResponse.json(
        { error: 'esta ficha no tiene correo: elige otro canal o añádelo al padrón' },
        { status: 400 },
      );
    }

    // El tipo, resuelto contra el padrón de te-api. Además de rechazar uno
    // ajeno con su nombre, es lo que dice **qué atributos lleva** este tipo:
    // sin esto los claims serían la lista fija de un solo banco.
    const organization = await fetchB2bOrganizationCached(session.organization);
    const declared = findDeclaredType(organization.credentialTypes, type);
    if (declared === undefined) {
      return NextResponse.json(
        { error: `«${type}» no es un tipo de credencial de esta organización` },
        { status: 400 },
      );
    }
    const profile = resolveCredentialType(declared, customer);

    const officialNumbers = session.organization.officialNumbers;

    const offer = await issueCredential(session.organization, {
      type: declared.type,
      // El `sub` de la credencial. `CONTRATOS.md` §1.2: es el id del cliente en
      // el padrón del banco, y es el campo por el que te-api vincula después.
      subjectReference: customer.externalId,
      // Los nombres los dice el perfil del tipo; los valores, la fila. Del
      // navegador no viene ni uno.
      claims: {
        ...buildCredentialClaims(
          customer,
          profile.claims.map((claim) => claim.name),
        ),
        // Los teléfonos del emisor, dentro de la firma. Ver la cabecera: es lo
        // que convierte «te llama tu banco» en algo comprobable sin llamada y
        // sin conexión. Se omite entero cuando la organización no declara
        // ninguno — un `official_numbers: []` firmado diría «este banco no
        // llama por teléfono», que es una afirmación distinta de «no lo hemos
        // configurado».
        ...(officialNumbers.length === 0 ? {} : { official_numbers: [...officialNumbers] }),
      },
      validityDays,
      withPin,
    });

    // El QR se dibuja **sólo para el canal que lo usa**. Pintarlo también en
    // una entrega por correo sería trabajo de servidor para un SVG que nadie
    // mira. El enlace, en cambio, vuelve siempre: es la misma URI en los cuatro
    // canales y el agente tiene que poder leerla para depurar.
    const qrSvg = delivery === 'qr' ? await renderQrSvg(offer.offerUri) : undefined;

    // ── El registro, para los cuatro canales ───────────────────────────────
    //
    // Antes sólo se anotaba el canal `app`, porque era el único que lo
    // necesitaba **para funcionar**: la oferta tiene que estar en algún sitio
    // hasta que el titular entre en el portal.
    //
    // Ahora se anotan los cuatro, por una razón distinta: la ficha del cliente
    // tiene que poder contestar «¿ya se le ofreció su credencial, cuándo y por
    // dónde?». Eso el banco lo sabe de sus propios actos, y es lo más que se
    // puede decir con verdad — **si el titular la aceptó no lo sabe nadie**,
    // te-api no tiene ruta que lo diga, y por eso la ficha sigue sin pintar
    // ninguna insignia de «credencial activa».
    //
    // El `delivery` va en la fila porque el portal se queda sólo con las suyas:
    // una oferta que salió por QR ya se la llevó quien estaba delante de la
    // pantalla. Ver `credential-offers.ts`.
    await recordIssuedOffer({
      orgId: session.organization.orgId,
      externalId: customer.externalId,
      offerId: offer.offerId,
      offerUri: offer.offerUri,
      typeKey: declared.type,
      delivery,
      expiresAt: offer.expiresAt,
      createdBy: session.actor,
    });

    return NextResponse.json({
      offerId: offer.offerId,
      offerUri: offer.offerUri,
      expiresAt: offer.expiresAt,
      // El PIN vuelve al navegador porque se enseña en ESTA pantalla, delante
      // del titular. Lo que no se hace nunca es mandárselo por el mismo canal
      // que el enlace: si van juntos, el PIN no protege de nada.
      pin: offer.pin,
      qrSvg,
      delivery,
      // Los que han entrado de verdad en la credencial, devueltos para que la
      // pantalla enseñe lo que se firmó y no lo que se pensaba firmar.
      officialNumbers,
      // El borrador de correo, sólo en su canal. Lo compone el servidor porque
      // la regla de qué NO puede ir dentro —el `tx_code`— es una regla de
      // seguridad, y esas no se dejan en el navegador.
      mail: delivery === 'email' ? composeMailDraft(customer, offer.offerUri) : undefined,
      // Dónde va el titular a recogerla. Sólo en su canal, y es una dirección
      // pública: no lleva la oferta dentro.
      portalUrl: delivery === 'app' ? `${getPortalBaseUrl()}/portal` : undefined,
    });
  } catch (error) {
    if (error instanceof TeApiError) {
      // El motivo real de te-api no se puede saber desde aquí (el 404 de la
      // puerta es el mismo para ocho cosas), así que lo que se devuelve es el
      // `requestId` para poder buscarlo en su registro.
      console.error('[crm] emisión rechazada por te-api', {
        status: error.status,
        code: error.code,
        requestId: error.requestId,
      });
      return NextResponse.json(
        { error: describeTeApiError(error, 'issue'), requestId: error.requestId },
        { status: error.status === 404 ? 502 : error.status },
      );
    }

    console.error('[crm] fallo emitiendo', error);

    // Los fallos de configuración (`OrganizationConfigError`) y los de Logto
    // (`B2bTokenError`) SÍ enseñan su mensaje: nombran la variable que falta o
    // dicen que Logto rechazó el token, y ninguno lleva el secreto ni el cuerpo
    // crudo de Logto dentro —eso se queda en el log del servidor, ver
    // `src/lib/b2b-token.ts`. Sin esto, un despliegue mal configurado se ve
    // exactamente igual que un fallo de te-api, y son dos cosas que se
    // arreglan en sitios distintos.
    const isConfigurationFailure =
      error instanceof Error &&
      (error.name === 'B2bTokenError' || error.name === 'OrganizationConfigError');

    return NextResponse.json(
      {
        error: isConfigurationFailure
          ? (error as Error).message
          : 'no se ha podido emitir la credencial; mira el log del servidor',
      },
      { status: 500 },
    );
  }
}

/**
 * El borrador de correo del canal `email`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  EL `tx_code` NO ENTRA AQUÍ, Y ESO ES TODO EL MOTIVO DE QUE ESTO SEA
 *  CÓDIGO DE SERVIDOR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * El código de un solo uso existe para atar la oferta a la persona, y sólo lo
 * consigue si viaja por **otro** canal. Metido en el mismo correo que el
 * enlace, quien lea el buzón se lleva las dos mitades y el código no protege
 * de nada — el artifact lo dice literalmente: «dáselo por teléfono o en la
 * oficina, nunca en el mismo correo».
 *
 * Componer el cuerpo en el navegador dejaría esa regla a un `.tsx` que
 * cualquiera puede editar sin darse cuenta de lo que sostiene. Se compone
 * aquí, donde `pin` está a la vista y aun así no se usa.
 *
 * ## Por qué `mailto:` y no un servidor de correo
 *
 * Porque este CRM no tiene servidor de correo y ponerle uno para la maqueta
 * sería infraestructura nueva que no demuestra nada del protocolo. Con
 * `mailto:` lo manda el agente desde su propia cuenta, que además es lo que
 * pasa de verdad en un mostrador: el correo sale a nombre de una persona del
 * banco y no de un `noreply@`.
 */
function composeMailDraft(
  customer: Customer,
  offerUri: string,
): { readonly to: string; readonly subject: string; readonly body: string; readonly href: string } {
  // `customer.email` ya se comprobó arriba; el `?? ''` es para el tipo y no
  // debería alcanzarse nunca.
  const to = customer.email ?? '';
  const subject = 'Tu credencial de cliente';
  const body = [
    `${customer.givenName}, aquí tienes tu credencial de cliente.`,
    '',
    'Ábrela desde el móvil en el que tengas la cartera de TripleEnable:',
    offerUri,
    '',
    // **Sin decir cuántas cifras tiene.** El largo lo decide te-api al crear la
    // oferta —hoy son seis— y este texto no lo recibe. Un correo que dijera
    // «cuatro» cuando son seis convierte a quien lo lee en alguien que cree que
    // se ha equivocado de código y deja de intentarlo.
    'Al guardarla te pedirá un código numérico. Ese código NO va en este',
    'correo: te lo decimos por teléfono o te lo damos en la oficina.',
    '',
    'Si no has pedido esta credencial, no abras el enlace y avísanos.',
  ].join('\n');

  // `encodeURIComponent` y no `URLSearchParams`: éste codifica el espacio como
  // `+`, y un `+` en el cuerpo de un `mailto:` llega al cliente de correo como
  // un signo más literal. El texto acabaría lleno de cruces.
  const href =
    `mailto:${encodeURIComponent(to)}` +
    `?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return { to, subject, body, href };
}
