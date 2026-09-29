import { redirect } from 'next/navigation';

import { getOrganization } from '@/lib/organization';

/**
 * Dónde empieza la consola.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  UNA INSTALACIÓN SIN CONFIGURAR EMPIEZA EN AJUSTES, NO EN CLIENTES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Empezaba siempre en el listado de clientes, y eso era lo correcto mientras la
 * configuración viniera del entorno: un despliegue mal configurado ni siquiera
 * arrancaba, así que no había estado intermedio que atender.
 *
 * Ahora sí lo hay, y es el **estado normal de los primeros cinco minutos**: la
 * aplicación se publica, arranca bien, y todavía no sabe de quién es. Mandar a
 * esa persona al padrón de clientes le enseña un aviso de que la consola no está
 * configurada y le deja buscando dónde se arregla. Se la lleva directamente
 * donde se arregla.
 *
 * En cuanto está configurada vuelve a ser lo de siempre. No es un asistente de
 * primera vez con estados que recordar: es una pregunta que se contesta con la
 * configuración de ahora mismo, y que se deja de hacer sola.
 */
export default async function HomePage() {
  try {
    await getOrganization();
  } catch {
    // Cualquier fallo lleva a Ajustes, no sólo el de configuración incompleta:
    // si lo que pasa es que la base no contesta, esa pantalla lo dice con lo que
    // hay que hacer, y el listado de clientes lo diría con «vuelve a intentarlo
    // en un momento», que es el consejo equivocado.
    redirect('/settings');
  }
  redirect('/customers');
}
