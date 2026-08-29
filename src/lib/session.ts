import 'server-only';

import { getActiveOrganization, type OrganizationConfig } from './organizations';

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
 * F4a que queda pendiente. Mientras tanto la organización activa sale de
 * `CRM_ACTIVE_ORG_ID`, o de la única declarada si sólo hay una.
 *
 * Cuando entre el login, lo que cambia es el cuerpo de `getEmployeeSession`:
 * el `orgId` saldrá del claim `organizations` del ID token y el `actor` del
 * `sub`. Nada más de este proyecto se entera, porque todo lo que necesita saber
 * de qué organización habla pasa por aquí.
 *
 * Hasta entonces **esta consola no está autenticada** y no puede publicarse en
 * una URL a la que llegue nadie de fuera.
 */

export interface EmployeeSession {
  /** La organización cuyos clientes se ven y en cuyo nombre se emite. */
  readonly organization: OrganizationConfig;
  /**
   * Quién opera, para el diario. Es *atribución*, no autorización: te-api no
   * decide nada con este valor.
   */
  readonly actor: string;
}

export async function getEmployeeSession(): Promise<EmployeeSession> {
  // `async` desde el principio aunque hoy no espere nada: leer la sesión de
  // Logto sí será asíncrono, y cambiar la firma después obliga a tocar cada
  // llamada.
  //
  // La elección de organización la resuelve `getActiveOrganization()`, que es
  // la misma que usa el portal del cliente. Estaba escrita aquí y se movió
  // cuando entró el portal: dos copias del mismo «cuál es mi banco» acaban
  // discrepando, y entonces la consola emite para una organización y el portal
  // vincula contra otra.
  return {
    organization: getActiveOrganization(),
    actor: process.env.CRM_ACTIVE_ACTOR?.trim() ?? 'crm:sin-sesion',
  };
}
