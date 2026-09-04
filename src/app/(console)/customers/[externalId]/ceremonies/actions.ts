'use server';

import { getTranslator } from '@/i18n/server';
import { findCeremonyCase } from '@/lib/ceremony-catalogue';
import { logConsoleFailure } from '@/lib/console-failures';
import { findCustomer } from '@/lib/customers';
import { getEmployeeSession } from '@/lib/session';
import {
  describeTeApiError,
  fetchB2bOrganizationCached,
  requestCeremony,
  requestPresentation,
  TeApiError,
} from '@/lib/te-api';
import { recordVerification } from '@/lib/verifications';

/**
 * **Mandar un caso del catálogo.** Fase de las diez plantillas nuevas.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ACCIÓN DE SERVIDOR, Y POR ESO NO HAY RUTA NUEVA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Las otras tres ceremonias de esta consola —transferencia, edad, verificación—
 * entran por `app/api/…`, y allí es correcto: el navegador manda **valores que
 * alguien acaba de escribir**, así que hace falta una ruta que los reciba y los
 * mida.
 *
 * Aquí no se escribe nada. El navegador manda **un identificador de caso**, y
 * los valores salen del catálogo, que vive en el servidor. Con eso, una ruta de
 * API sería una dirección pública de más para no ganar nada: la acción de
 * servidor hace el mismo trabajo, el token de la organización no baja al
 * navegador y no se añade superficie.
 *
 * Y por eso mismo **no se valida longitud ni forma de los valores**: no vienen
 * de fuera. Lo que se comprueba es lo único que sí llega del navegador —que el
 * `caseId` existe en el catálogo— y que el cliente es de esta organización.
 *
 * ## Firmar con credencial son dos llamadas, como en la puerta de edad
 *
 * Una credencial la comprueba **el verificador de TripleEnable**, no este CRM.
 * Así que un caso que se firma con credencial abre antes su sesión de
 * verificador (`POST /v1/b2b/presentations`) y pasa el `requestUri` dentro de la
 * petición, exactamente como `requestAgeCheck`. Sin eso la petición se crea y
 * **no la puede aprobar nadie**, que es peor que no mandarla.
 *
 * La sesión además se anota en el diario del banco: el desenlace vuelve por el
 * webhook `presentation.settled`, que actualiza la fila **por
 * `presentationId`**. Sin fila, el sí o el no del titular no llega nunca a la
 * consola.
 */

/** Lo que la pantalla pinta después de pulsar. */
export interface SendCeremonyResult {
  readonly requestId?: string;
  readonly expiresAt?: string;
  /** La sesión del verificador, cuando el caso se firma con credencial. */
  readonly presentationId?: string;
  readonly error?: string;
}

export async function sendCeremonyAction(
  externalId: string,
  caseId: string,
): Promise<SendCeremonyResult> {
  const t = await getTranslator();

  const ceremony = findCeremonyCase(caseId);
  if (ceremony === undefined) return { error: t('errors.ceremonyUnknownCase') };

  const session = await getEmployeeSession();

  // La ficha se busca **dentro de la organización de la sesión**: sin el
  // `orgId`, un identificador de cliente de otro banco encontraría su ficha.
  const customer = await findCustomer(session.organization.orgId, externalId.trim());
  if (customer === null) return { error: t('errors.customerNotFound') };

  try {
    if (ceremony.signWith === 'identity') {
      const asked = await requestCeremony(session.organization, {
        subjectReference: customer.externalId,
        kind: ceremony.kind,
        signWith: 'identity',
        template: ceremony.template,
        fields: ceremony.fields,
      });
      return { requestId: asked.requestId, expiresAt: asked.expiresAt };
    }

    // ── Firmar con credencial: la sesión primero ────────────────────────
    //
    // El tipo sale del **padrón de te-api**, no de una constante: es el que esa
    // organización puede pedir de vuelta, y el catálogo de casos no puede
    // saberlo porque el mismo caso lo enseña un banco, una aseguradora o una
    // clínica con tipos distintos.
    const organization = await fetchB2bOrganizationCached(session.organization);
    const credentialType = organization.credentialTypes[0]?.type;
    if (credentialType === undefined) return { error: t('errors.ceremonyNoCredentialType') };

    const claims = ceremony.claims ?? [];
    if (claims.length === 0) return { error: t('errors.ceremonyNoClaims') };

    const presentation = await requestPresentation(session.organization, {
      type: credentialType,
      subjectReference: customer.externalId,
      claims,
    });

    const asked = await requestCeremony(session.organization, {
      subjectReference: customer.externalId,
      kind: ceremony.kind,
      signWith: 'credential',
      credentialType,
      template: ceremony.template,
      requestUri: presentation.requestUri,
      fields: ceremony.fields,
    });

    // El diario del banco. Se anota **después** de que la petición exista, por
    // lo mismo que en la puerta de edad: una comprobación «pendiente» que nunca
    // se llegó a pedir aparecería en el historial del cliente y el agente
    // creería que le preguntó.
    await recordVerification({
      orgId: session.organization.orgId,
      externalId: customer.externalId,
      presentationId: presentation.presentationId,
      typeKey: credentialType,
      requestedClaims: claims,
      // No se pinta QR: se le pregunta al teléfono que ya tiene en el bolsillo.
      channel: 'phone',
      issuerDid: organization.did,
      authorizationRequestUrl: presentation.authorizationRequestUrl,
      // Rama del teléfono: no hay mostrador y por tanto no hay código.
      counterLink: null,
      requestUri: presentation.requestUri,
      expiresAt: asked.expiresAt,
      agentId: session.agent.id,
      agentName: session.agent.displayName,
      actor: session.actor,
      requestedAt: new Date().toISOString(),
      // El timbre de esta ceremonia es la petición del marco, no un `wakeup`.
      wakeupId: undefined,
      wakeupAt: undefined,
    });

    return {
      requestId: asked.requestId,
      expiresAt: asked.expiresAt,
      presentationId: presentation.presentationId,
    };
  } catch (error) {
    logConsoleFailure(error, `el caso ${caseId} del catálogo falló`);
    // El error de te-api **sí se enseña traducido y con su `requestId`**, al
    // revés que en la transferencia. Aquí es lo correcto: quien mira esta
    // pantalla está probando el catálogo contra un despliegue, no atendiendo a
    // un cliente, y `unknown_template` es exactamente lo que necesita leer
    // cuando la plantilla todavía no está en te-api.
    return {
      error:
        error instanceof TeApiError
          ? describeTeApiError(t, error)
          : t('errors.ceremonyUpstream'),
    };
  }
}
