import { NextResponse } from 'next/server';

import { buildCredentialClaims, findCustomer } from '@/lib/customers';
import { renderQrSvg } from '@/lib/qr';
import { getEmployeeSession } from '@/lib/session';
import { describeTeApiError, issueCredential, TeApiError } from '@/lib/te-api';

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
 * `type` y `validityDays` sí llegan de fuera, y no pasa nada: te-api resuelve
 * el tipo **contra el padrón de la organización del token** y recorta la
 * vigencia al tope de ese tipo. Pedir un tipo ajeno o una vigencia de diez años
 * no cuela allí, que es donde tiene que no colar.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface IssueBody {
  externalId?: unknown;
  type?: unknown;
  validityDays?: unknown;
  withPin?: unknown;
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

  if (externalId === '' || type === '') {
    return NextResponse.json({ error: 'faltan externalId o type' }, { status: 400 });
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

    const offer = await issueCredential(session.organization, {
      type,
      // El `sub` de la credencial. `CONTRATOS.md` §1.2: es el id del cliente en
      // Banco Demo, y es el campo por el que te-api vincula después.
      subjectReference: customer.externalId,
      claims: buildCredentialClaims(customer),
      validityDays,
      withPin,
    });

    // El QR se dibuja aquí, con la URI recién llegada. El navegador recibe el
    // SVG ya hecho y el enlace en texto: las dos formas del mismo dato, que es
    // como lo pidió el dueño.
    const qrSvg = await renderQrSvg(offer.offerUri);

    return NextResponse.json({
      offerId: offer.offerId,
      offerUri: offer.offerUri,
      expiresAt: offer.expiresAt,
      // El PIN vuelve al navegador porque se enseña en ESTA pantalla, delante
      // del titular. Lo que no se hace nunca es mandárselo por el mismo canal
      // que el enlace: si van juntos, el PIN no protege de nada.
      pin: offer.pin,
      qrSvg,
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
        { error: describeTeApiError(error), requestId: error.requestId },
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
