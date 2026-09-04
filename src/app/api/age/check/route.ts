import { NextResponse } from 'next/server';

import { getTranslator } from '@/i18n/server';
import { findCustomer } from '@/lib/customers';
import { getEmployeeSession } from '@/lib/session';
import { fetchB2bOrganizationCached, requestAgeCheck } from '@/lib/te-api';
import { recordVerification } from '@/lib/verifications';

/**
 * **Pedirle al titular que demuestre que es mayor de edad.** Fase 6 del marco.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  UNA PREGUNTA, UNA RESPUESTA, Y NADA MÁS QUE VIAJE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `api/credentials/present` pide atributos: el agente marca cuáles y el titular
 * ve «comparte estos datos». Aquí no hay nada que marcar. Se pregunta **una
 * cosa** —¿mayor de edad?— y se recibe **una**: sí. La fecha de nacimiento está
 * en la credencial y **no sale**; eso lo filtra te-api por su lado y está fijado
 * con pruebas en las dos puntas (`presentation-result` y el cuerpo del webhook).
 *
 * Por eso esta ruta no acepta una lista de atributos, y no es una omisión: un
 * parámetro `claims` aquí convertiría una puerta de edad en una divulgación de
 * datos con otro nombre, y el primero que lo usara no se daría cuenta.
 *
 * ## `reason` es texto libre, y lo lee la persona
 *
 * Es lo único que el banco escribe, y aparece en la pantalla de alguien junto a
 * la pregunta. Se trata como el asunto de una llamada: se recorta antes de
 * medir —te-api declara los `value` como `.min(1)`, así que una cadena de
 * espacios pasa su esquema y llega como un renglón en blanco— y se rechazan los
 * saltos de línea, porque lo que se pinta es una línea.
 *
 * Y es **opcional a propósito**. Una puerta de edad se entiende sin explicación;
 * obligar a escribir un motivo produciría motivos de relleno, que es peor que no
 * tener ninguno.
 *
 * ## Los rótulos van en el idioma del titular
 *
 * `getTranslator()` da el de quien tiene la consola delante. Lo que se manda en
 * `label` lo lee la otra persona en su teléfono, así que va en inglés —la base
 * del producto— hasta que haya un idioma por cliente en la ficha.
 */

interface AgeBody {
  externalId?: unknown;
  credentialType?: unknown;
  reason?: unknown;
}

/** Lo que te-api acepta en un `value` de campo: `z.string().min(1).max(512)`. */
const REASON_MAX = 512;

/** Una línea de verdad: sin saltos ni caracteres de control. */
const SINGLE_LINE = /^[^\p{Cc}\p{Cf}]+$/u;

export async function POST(request: Request): Promise<NextResponse> {
  const t = await getTranslator();

  let body: AgeBody;
  try {
    body = (await request.json()) as AgeBody;
  } catch {
    return NextResponse.json({ error: t('errors.bodyNotJson') }, { status: 400 });
  }

  const session = await getEmployeeSession();

  const externalId = typeof body.externalId === 'string' ? body.externalId.trim() : '';
  const customer = externalId === '' ? null : await findCustomer(session.organization.orgId, externalId);
  if (customer === null) {
    return NextResponse.json({ error: t('errors.customerNotFound') }, { status: 404 });
  }

  const credentialType = typeof body.credentialType === 'string' ? body.credentialType.trim() : '';
  if (credentialType === '') {
    return NextResponse.json({ error: t('errors.missingFields') }, { status: 400 });
  }

  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (reason !== '' && reason.length > REASON_MAX) {
    return NextResponse.json(
      { error: t('errors.ageReasonTooLong', { max: REASON_MAX }) },
      { status: 400 },
    );
  }
  if (reason !== '' && !SINGLE_LINE.test(reason)) {
    return NextResponse.json({ error: t('errors.ageReasonOneLine') }, { status: 400 });
  }

  try {
    const checked = await requestAgeCheck(session.organization, {
      subjectReference: customer.externalId,
      credentialType,
      ...(reason === '' ? {} : { reason }),
      // En inglés: es lo que lee el titular. Ver la cabecera.
      labels: { age: 'Over 18', reason: 'Why' },
    });

    // ── El diario del banco ────────────────────────────────────────────────
    //
    // Se anota **después** de que la petición exista, igual que en la hermana
    // y por el mismo motivo: una comprobación «pendiente» que nunca se llegó a
    // pedir aparecería en el historial del cliente y el agente creería que le
    // preguntó.
    //
    // Y no es cosmética. El resultado vuelve por el webhook
    // `presentation.settled`, que **actualiza la fila por `presentationId`**:
    // sin ella el sí o el no de la persona no llega nunca a la consola, y el
    // enlace de seguimiento apunta a una página que no existe. Lo enseñó el
    // recorrido de la 6.3 contra el despliegue.
    //
    // `channel: 'phone'` porque esta pantalla no pinta QR: se le pregunta al
    // teléfono que ya tiene en el bolsillo. Ver la cabecera del lanzador.
    await recordVerification({
      orgId: session.organization.orgId,
      externalId: customer.externalId,
      presentationId: checked.presentationId,
      typeKey: credentialType,
      // Uno, y es el argumento entero de esta pantalla.
      requestedClaims: ['age_over_18'],
      channel: 'phone',
      // El DID sale del **padrón de te-api**, no de la configuración local:
      // es contra quién se comprueba, y el recibo lo enseña.
      issuerDid: (await fetchB2bOrganizationCached(session.organization)).did,
      authorizationRequestUrl: checked.session.authorizationRequestUrl,
      // Rama del teléfono: no hay mostrador y por tanto no hay código.
      counterLink: null,
      requestUri: checked.session.requestUri,
      expiresAt: checked.expiresAt,
      agentId: session.agent.id,
      agentName: session.agent.displayName,
      actor: session.actor,
      requestedAt: new Date().toISOString(),
      // El timbre de esta ceremonia es la petición del marco, no un
      // `wakeup`: no hay identificador de despertador que anotar.
      wakeupId: undefined,
      wakeupAt: undefined,
    });

    return NextResponse.json({
      requestId: checked.requestId,
      // El de la sesión del verificador: es el que el webhook va a nombrar,
      // así que es el que deja seguir esto desde la consola.
      presentationId: checked.presentationId,
      expiresAt: checked.expiresAt,
    });
  } catch (error) {
    console.error('age check failed', error);
    return NextResponse.json({ error: t('errors.ageUpstream') }, { status: 502 });
  }
}
