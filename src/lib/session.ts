import 'server-only';

import { getTranslator } from '@/i18n/server';
import type { Translator } from '@/i18n/translate';

import { getOrganization, type OrganizationConfig } from './organization';

/**
 * La organización activa de la consola de empleados.
 *
 * ## Lo que ESTO no es
 *
 * No es autenticación de servidor a servidor. Lo que autoriza la llamada a
 * te-api es el token M2M de organización (`./b2b-token.ts`) y nada más. Esta
 * sesión sirve para dos cosas: **qué clientes se enseñan** y **a quién se
 * atribuye la operación**. Si algún día una llamada a te-api necesitara algo de
 * aquí, el diseño estaría mal (F4 §0).
 *
 * ## El estado de hoy, dicho sin adornos
 *
 * **El login de empleado con Logto OIDC todavía no está.** Es la casilla de F4a
 * que queda pendiente. Mientras tanto la organización es **la de esta
 * instalación** (`./organization.ts`), leída del entorno del proceso: una
 * instalación sirve a una empresa, así que no hay nada que elegir por petición.
 *
 * Eso ya no es un apaño con forma de agujero, y conviene decir por qué cambió:
 * hasta el 2026-08-31 la organización salía de la cabecera `Host`, o sea de algo
 * que escribe quien llama. Servía —lo único que decidía era qué padrón se
 * pintaba, nunca qué se autoriza— pero era el único sitio del proyecto donde la
 * respuesta a «¿de quién es esta pantalla?» podía cambiar entre dos peticiones.
 * Ahora no puede.
 *
 * Cuando entre el login, lo que cambia es el cuerpo de `getEmployeeSession`: el
 * `actor` saldrá del `sub` del ID token y habrá que comprobar que el empleado
 * pertenece a `CRM_ORG_ID`. Nada más de este proyecto se entera, porque todo lo
 * que necesita saber de qué organización habla pasa por aquí.
 *
 * Hasta entonces **esta consola no está autenticada** y no puede publicarse en
 * una URL a la que llegue nadie de fuera.
 */

/**
 * Cómo se presenta el empleado **en el móvil del titular**.
 *
 * Es lo que viaja en el `actor` de `POST /v1/b2b/wakeups`, y es la diferencia
 * entre que a Juan le salga «Banco Demo quiere verificar tu identidad» y que le
 * salga «Pedro Ramírez, agente 4471». Cuando alguien te llama diciendo que es de
 * tu banco, poder contrastar el nombre que oyes con el que sale en la pantalla
 * es la mitad de la ceremonia.
 *
 * **te-api no lo verifica** (`src/b2b/wakeups.ts`): no elige destinatario, no
 * entra en ningún límite y no abre ninguna puerta. Es atribución, y se manda
 * sabiendo lo que es.
 */
export interface AgentIdentity {
  /** El número de agente. Lo que el titular puede repetir al reclamar. */
  readonly id: string;
  /** El nombre que ve el titular en su teléfono. */
  readonly displayName: string;
}

export interface EmployeeSession {
  /** La organización cuyos clientes se ven y en cuyo nombre se emite. */
  readonly organization: OrganizationConfig;
  /**
   * Quién opera, para el diario. Es *atribución*, no autorización: te-api no
   * decide nada con este valor.
   */
  readonly actor: string;
  /**
   * El empleado, tal y como se le enseña al titular. Separado de `actor` porque
   * no son lo mismo: `actor` es la etiqueta del puesto —«mostrador-1»— y sirve
   * para nuestro propio registro; esto es una persona con nombre, y lo lee un
   * cliente en su teléfono mientras habla por él.
   */
  readonly agent: AgentIdentity;
}

/**
 * El empleado cuando el entorno no dice quién es.
 *
 * No hay login de empleado todavía (ver arriba), así que estos dos valores salen
 * de `CRM_AGENT_ID` y `CRM_AGENT_NAME`. Cuando faltan **no se inventa un nombre
 * de persona**: al titular le sale «Agente de <la organización>», que es verdad,
 * en vez de un «Pedro Ramírez» que no lo es. Un nombre falso en la pantalla de
 * quien está comprobando si le están timando es exactamente lo que no puede
 * pasar.
 *
 * El nombre de la organización se compone, no se escribe: estaba puesto a «Banco
 * Demo» a mano, y la segunda instalación enseñaría en el móvil del titular el
 * nombre de la empresa de otro.
 */
const UNIDENTIFIED_AGENT_ID = 'unidentified';

/**
 * El idioma que se usa es el de **la consola**, o sea el del agente, y no el
 * del titular: el del titular no lo sabe nadie aquí — te-api no lo devuelve y
 * el padrón no lo guarda. Es la mejor aproximación que hay, y es la misma que
 * ya se usaba cuando sólo había un idioma.
 */
function unidentifiedAgent(t: Translator, organization: OrganizationConfig): AgentIdentity {
  return {
    id: UNIDENTIFIED_AGENT_ID,
    displayName: t('session.unidentifiedAgentName', { organization: organization.displayName }),
  };
}

export async function getEmployeeSession(): Promise<EmployeeSession> {
  // `async` aunque la organización ya no se espere: leer la sesión de Logto sí
  // será asíncrono, y `getTranslator()` de aquí abajo ya lo es. Cambiar la firma
  // el día del login obligaría a tocar cada llamada de este proyecto.
  //
  // La configuración la lee `getOrganization()`, que es la misma que usa el
  // portal del cliente: dos copias del mismo «cuál es mi empresa» acaban
  // discrepando, y entonces la consola emite para una organización y el portal
  // vincula contra otra.
  const organization = await getOrganization();
  const fallback = unidentifiedAgent(await getTranslator(), organization);

  return {
    organization,
    actor: nonEmpty(process.env['CRM_AGENT_ACTOR']) ?? 'crm:no-session',
    agent: {
      id: nonEmpty(process.env['CRM_AGENT_ID']) ?? fallback.id,
      displayName: nonEmpty(process.env['CRM_AGENT_NAME']) ?? fallback.displayName,
    },
  };
}

/** Una variable puesta a cadena vacía es una variable sin poner. */
function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? undefined : trimmed;
}
