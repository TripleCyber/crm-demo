import 'server-only';

import type { OrganizationConfig } from './organizations';
import { getRequestOrganization } from './request-organization';

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
 * **El login de empleado con Logto OIDC todavía no está.** Es la casilla de
 * F4a que queda pendiente. Mientras tanto la organización sale del **dominio**
 * por el que entró la petición (`./request-organization.ts`): un despliegue
 * sirve `bank.`, `seguros.` y `clinica.demo-te.com`, y cada uno es la consola
 * de su organización. Un host que no es de nadie cae en `CRM_ACTIVE_ORG_ID`,
 * que es lo que hace que `localhost` siga funcionando en desarrollo.
 *
 * Cuando entre el login, lo que cambia es el cuerpo de `getEmployeeSession`:
 * el `orgId` saldrá del claim `organizations` del ID token y el `actor` del
 * `sub`. Nada más de este proyecto se entera, porque todo lo que necesita saber
 * de qué organización habla pasa por aquí.
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
 * de `CRM_ACTIVE_AGENT_ID` y `CRM_ACTIVE_AGENT_NAME`, igual que la organización
 * sale de `CRM_ACTIVE_ORG_ID`. Cuando faltan **no se inventa un nombre de
 * persona**: al titular le sale «Agente de <la organización>», que es verdad, en
 * vez de un «Pedro Ramírez» que no lo es. Un nombre falso en la pantalla de
 * quien está comprobando si le están timando es exactamente lo que no puede
 * pasar.
 *
 * El nombre de la organización se compone, no se escribe: estaba puesto a
 * «Banco Demo» a mano, y con el segundo partner el titular vería en su móvil el
 * nombre del banco de otro.
 */
const UNIDENTIFIED_AGENT_ID = 'sin-identificar';

function unidentifiedAgent(organization: OrganizationConfig): AgentIdentity {
  return {
    id: UNIDENTIFIED_AGENT_ID,
    displayName: `Agente de ${organization.displayName}`,
  };
}

export async function getEmployeeSession(): Promise<EmployeeSession> {
  // `async` desde el principio aunque hoy no espere nada: leer la sesión de
  // Logto sí será asíncrono, y cambiar la firma después obliga a tocar cada
  // llamada. Con la resolución por `Host` ya espera de verdad —`headers()` lo
  // es en Next 15—, así que la previsión sirvió para lo que se puso.
  //
  // La elección la resuelve `getRequestOrganization()`, que es la misma que usa
  // el portal del cliente. Estaba escrita aquí y se movió cuando entró el
  // portal: dos copias del mismo «cuál es mi banco» acaban discrepando, y
  // entonces la consola emite para una organización y el portal vincula contra
  // otra.
  const organization = await getRequestOrganization();
  const fallback = unidentifiedAgent(organization);

  return {
    organization,
    actor: process.env.CRM_ACTIVE_ACTOR?.trim() ?? 'crm:sin-sesion',
    agent: {
      id: nonEmpty(process.env.CRM_ACTIVE_AGENT_ID) ?? fallback.id,
      displayName: nonEmpty(process.env.CRM_ACTIVE_AGENT_NAME) ?? fallback.displayName,
    },
  };
}

/** Una variable puesta a cadena vacía es una variable sin poner. */
function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? undefined : trimmed;
}
