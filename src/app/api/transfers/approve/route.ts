import { NextResponse } from 'next/server';

import { getTranslator } from '@/i18n/server';
import { findCustomer } from '@/lib/customers';
import { getEmployeeSession } from '@/lib/session';
import { requestTransferApproval } from '@/lib/te-api';

/**
 * **Pedirle al titular que autorice una transferencia.** Fase 5 del marco.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ESTO NO ES UNA VERIFICACIÓN, Y POR ESO NO PASA POR EL TIMBRE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `api/credentials/present` abre una sesión de verificador y toca el timbre:
 * dice «avisa a esta persona de que quiero comprobar algo». Aquí no se comprueba
 * nada. Se pide **autorizar una operación concreta**, y lo que el titular firma
 * es el importe y el destino — no «soy yo», sino «sí, manda esos 1.240 € a esa
 * cuenta».
 *
 * Son dos ceremonias distintas del mismo marco (`kind: verify` y
 * `kind: authorize`) y por eso esta ruta no reusa aquélla: compartir el camino
 * habría obligado a un `if` sobre el nivel en cada paso, y el primero que se
 * olvidara mandaría una transferencia por la tubería de una verificación.
 *
 * ## No hay sesión de verificador, y por eso no hay `requestUri`
 *
 * Una autorización se firma con **la identidad de la cartera**: te-api compone
 * el texto, la cartera lo firma con su clave y ahí acaba. No hay objeto de
 * solicitud que ir a buscar a ningún sitio, así que tampoco hay las cuatro
 * comprobaciones de la pantalla de llamada — y eso es correcto: aquí no se está
 * afirmando quién llama, se está autorizando un movimiento.
 *
 * ## Los rótulos van en el idioma del TITULAR
 *
 * Y no en el de la consola, que es la trampa fácil: `getTranslator()` da el
 * idioma de quien tiene el ratón, y lo que se manda en `label` lo lee la persona
 * en su teléfono. Se mandan en inglés, que es la base del producto, hasta que
 * haya un idioma guardado por cliente en la ficha — cuando lo haya, sale de ahí
 * y no de aquí.
 */

interface ApproveBody {
  externalId?: unknown;
  amount?: unknown;
  destination?: unknown;
}

/** Lo que te-api acepta en un `value` de campo: `z.string().min(1).max(512)`. */
const VALUE_MAX = 512;

export async function POST(request: Request): Promise<NextResponse> {
  const t = await getTranslator();

  let body: ApproveBody;
  try {
    body = (await request.json()) as ApproveBody;
  } catch {
    return NextResponse.json({ error: t('errors.bodyNotJson') }, { status: 400 });
  }

  // `getEmployeeSession` no devuelve nulo: esta consola todavía no está
  // autenticada y la organización sale de la configuración. Cuando entre el
  // login, el cambio es dentro de esa función y no aquí.
  const session = await getEmployeeSession();

  // La ficha se busca **dentro de la organización de la sesión**: sin el
  // `orgId`, un identificador de cliente de otro banco encontraría su ficha.
  const externalId = typeof body.externalId === 'string' ? body.externalId.trim() : '';
  const customer = externalId === '' ? null : await findCustomer(session.organization.orgId, externalId);
  if (customer === null) {
    return NextResponse.json({ error: t('errors.customerNotFound') }, { status: 404 });
  }

  // **Se recorta antes de medir**, como el asunto de la llamada y por lo mismo:
  // te-api declara los `value` como `.min(1)`, así que una cadena de espacios
  // pasa su esquema y llega a la pantalla del titular como un héroe en blanco.
  const amount = typeof body.amount === 'string' ? body.amount.trim() : '';
  const destination = typeof body.destination === 'string' ? body.destination.trim() : '';

  if (amount === '') {
    return NextResponse.json({ error: t('errors.transferAmountMissing') }, { status: 400 });
  }
  if (amount.length > VALUE_MAX) {
    return NextResponse.json({ error: t('errors.transferAmountTooLong', { max: VALUE_MAX }) }, { status: 400 });
  }
  if (destination === '') {
    return NextResponse.json({ error: t('errors.transferDestinationMissing') }, { status: 400 });
  }
  if (destination.length > VALUE_MAX) {
    return NextResponse.json({ error: t('errors.transferDestinationTooLong', { max: VALUE_MAX }) }, { status: 400 });
  }

  try {
    const approval = await requestTransferApproval(session.organization, {
      subjectReference: customer.externalId,
      amount,
      destination,
      // En inglés: es lo que lee el titular, no quien tiene la consola. Ver la
      // cabecera.
      labels: { amount: 'Amount', destination: 'To' },
    });

    return NextResponse.json({
      requestId: approval.requestId,
      expiresAt: approval.expiresAt,
      // **Se pasa tal cual y no se interpreta.** `false` no es un fallo de esta
      // ruta: es que el titular no tiene ningún aparato al que avisar, o que su
      // presupuesto de avisos está agotado. Quien lo pinta decide qué decirle al
      // agente; convertirlo aquí en un error borraría la diferencia entre «no se
      // pudo pedir» y «se pidió y no hay a quién avisar».
    });
  } catch (error) {
    // El mensaje de te-api no se enseña tal cual: viene en su idioma y con su
    // `requestId`, que no le dice nada a quien está al teléfono. Se registra y
    // se contesta con la frase de la consola.
    console.error('transfer approval failed', error);
    return NextResponse.json({ error: t('errors.transferUpstream') }, { status: 502 });
  }
}
