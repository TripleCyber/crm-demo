import 'server-only';

import { getTranslator } from '@/i18n/server';
import type { Translator } from '@/i18n/translate';

import { logConsoleFailure } from './console-failures';
import { resolveCredentialTypes, type CredentialTypeView } from './credential-profiles';
import { findCustomer, type Customer } from './customers';
import { getEmployeeSession, type EmployeeSession } from './session';
import {
  describeTeApiError,
  fetchB2bOrganizationCached,
  hasActiveWalletLink,
  TeApiError,
} from './te-api';

/**
 * Lo que las tres pantallas de un cliente necesitan saber antes de pintar nada.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  LA FICHA, LA EMISIÓN Y LA COMPROBACIÓN CRUZAN LAS MISMAS TRES FUENTES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * El padrón de te-api dice **qué tipos** puede emitir esta organización, la
 * configuración dice **qué lleva** cada tipo, y la fila del cliente dice
 * **cuáles se pueden rellenar**. Las tres pantallas hacen ese mismo cruce, y
 * tenerlo escrito tres veces garantiza que un día la de emisión ofrezca un tipo
 * que la de comprobación no sabe pedir.
 *
 * ## Si te-api no contesta, la pantalla se enseña igual
 *
 * `teApiWarning` es el aviso, y las pantallas lo pintan arriba. Poder consultar
 * la ficha de un cliente no tiene por qué depender de que la emisión esté
 * operativa: un agente que quiere mirar un teléfono no debería encontrarse una
 * pantalla en blanco porque un token de Logto ha caducado.
 *
 * `customer` a `null` significa que no hay ficha con ese identificador **en
 * esta organización** — nunca «no existe en ningún sitio». La consulta lleva el
 * `org_id` de la sesión en el `where`, así que un identificador de otro banco
 * se comporta igual que uno inventado, que es lo correcto: si contestara
 * distinto, esta pantalla serviría para averiguar quién es cliente de quién.
 */
export interface CustomerContext {
  readonly session: EmployeeSession;
  readonly customer: Customer | null;
  /** Los tipos del padrón, ya cruzados con lo que esta ficha rellena. */
  readonly credentialTypes: readonly CredentialTypeView[];
  /** El DID de la organización, tal y como lo devuelve el padrón. */
  readonly issuerDid: string | undefined;
  /**
   * **El nombre legal según el padrón de te-api**, que es el que va a leer el
   * titular.
   *
   * No es el mismo dato que `session.organization.displayName`: aquél es el
   * rótulo de esta consola y lo escribe quien la configura; éste lo copia te-api
   * del token al crear cada petición (`asker_name`) y es el que entra en la
   * frase que se firma. El catálogo de verificaciones lo necesita para ensayar
   * esa frase sin inventarse el nombre.
   *
   * `undefined` = no se pudo preguntar, y entonces la pantalla ya lo está
   * avisando por su cuenta (`teApiWarning`).
   */
  readonly legalName: string | undefined;
  /** Qué falló al preguntarle a te-api, si falló. */
  readonly teApiWarning: string | undefined;
  /**
   * Si este cliente tiene una cartera vinculada con esta organización.
   *
   * `undefined` = no se ha podido averiguar, y entonces la pantalla no afirma
   * nada. Sale de `GET /v1/b2b/links`, que es quien publica este hecho a la
   * organización dueña del vínculo; **no** de la respuesta del timbre, que
   * contesta igual haya cartera o no y tiene que seguir haciéndolo. Ver
   * `hasActiveWalletLink`.
   *
   * Sólo dice eso: hay vínculo o no lo hay. Un titular vinculado puede seguir
   * sin recibir el aviso —suspendido, sin la cartera puesta, bloqueado, sin
   * aparato elegible— y ninguna de esas cuatro cosas se sabe aquí ni se puede
   * saber.
   */
  readonly walletLinked: boolean | undefined;
}

export async function loadCustomerContext(externalId: string): Promise<CustomerContext> {
  const session = await getEmployeeSession();
  const customer = await findCustomer(session.organization.orgId, decodeURIComponent(externalId));

  if (customer === null) {
    return {
      session,
      customer: null,
      credentialTypes: [],
      issuerDid: undefined,
      legalName: undefined,
      teApiWarning: undefined,
      walletLinked: undefined,
    };
  }

  const t = await getTranslator();

  try {
    // Las dos en paralelo: son independientes y encadenarlas sumaría una ida y
    // vuelta a una pantalla que alguien tiene delante. El directorio no puede
    // tumbar la carga —`hasActiveWalletLink` se traga su propio fallo y devuelve
    // `undefined`—, así que no hace falta un `allSettled`.
    const [organization, walletLinked] = await Promise.all([
      fetchB2bOrganizationCached(session.organization),
      hasActiveWalletLink(session.organization, customer.externalId),
    ]);
    return {
      session,
      customer,
      credentialTypes: resolveCredentialTypes(t, organization.credentialTypes, customer),
      issuerDid: organization.did,
      legalName: organization.legalName,
      teApiWarning: undefined,
      walletLinked,
    };
  } catch (error) {
    return {
      session,
      customer,
      credentialTypes: [],
      issuerDid: undefined,
      legalName: undefined,
      walletLinked: undefined,
      // `describeTeApiError` sí traduce lo suyo a algo que un agente entiende.
      // Lo que caía en la otra rama era el mensaje crudo de `B2bTokenError` o
      // de la configuración —«Logto ha rechazado el token M2M de eptrz3ww9y1n
      // (401)»—, que es correcto y es lenguaje de integrador: nombra una pieza
      // nuestra y un identificador de Logto en la pantalla de quien está
      // atendiendo. El detalle sigue entero en el registro y en Diagnóstico.
      teApiWarning:
        error instanceof TeApiError ? describeTeApiError(t, error) : shortFailure(t, error),
    };
  }
}

/**
 * La mitad que va detrás de «No se ha podido consultar TripleEnable: …».
 *
 * Corta a propósito: la pantalla ya ha dicho qué no funciona, así que aquí sólo
 * falta qué hacer. El detalle —«Logto ha rechazado el token M2M de eptrz3ww9y1n
 * (401)», que nombra una pieza nuestra y un identificador de Logto delante de
 * quien está atendiendo— va al registro y a Diagnóstico.
 */
function shortFailure(t: Translator, error: unknown): string {
  logConsoleFailure(error, 'no se pudo consultar el padrón de te-api');
  return t('errors.shortRetry');
}
