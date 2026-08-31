import { LocaleSwitch } from '@/components/LocaleSwitch';
import { getTranslator } from '@/i18n/server';
import { monogramOf } from '@/lib/brand';
import { getOrganization } from '@/lib/organization';

/**
 * El portal del cliente. **Otra cabecera, otra sesión, otra persona.**
 *
 * Aquí no se pinta ni un enlace a la consola de agentes: quien mira esta
 * pantalla es un titular, y el padrón de clientes del banco no es asunto suyo.
 * La separación es de estructura (dos grupos de rutas, dos disposiciones) y no
 * un `if` en una cabecera compartida — un `if` se olvida, un fichero aparte no.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslator();
  let bankName: string;
  // Vacío mientras no se sepa de quién es la pantalla. Ver la nota del disco
  // más abajo: una inicial inventada es peor que ninguna.
  let monogram = '';
  try {
    // El nombre sale del dominio por el que entró la petición: los cuatro
    // portales —banco, aseguradora, clínica y comercializadora— son el mismo
    // despliegue, y la cabecera es lo primero que el titular lee para saber que
    // está en el sitio correcto.
    const organization = await getOrganization();
    bankName = organization.displayName;
    monogram = monogramOf(organization);
  } catch {
    // El rótulo no puede tumbar la pantalla que explica que falta configuración.
    // Genérico y no el nombre de un banco concreto: si la configuración está
    // rota no se sabe de qué organización es este despliegue, y ponerle el
    // nombre del primero que hubo sería afirmarlo sin saberlo.
    bankName = t('portal.fallbackName');
  }

  return (
    <>
      <header className="topbar portal">
        {/*
          El mismo disco que la barra de la consola, y aquí importa más: el
          titular llega a esta pantalla desde un enlace y lo primero que tiene
          que reconocer es de quién es. Decorativo —el nombre va al lado—, así
          que fuera del árbol de accesibilidad.
        */}
        {monogram !== '' && (
          <span className="brand-mark" aria-hidden="true">
            {monogram}
          </span>
        )}
        <strong>{bankName}</strong>
        <span className="org">{t('portal.header')}</span>
        {/*
          El selector también aquí, y no sólo en la consola: quien lee esta
          pantalla es un CLIENTE, y es justamente quien puede no hablar el
          idioma en el que le ha llegado.
        */}
        <LocaleSwitch />
      </header>
      <main className="narrow">{children}</main>
    </>
  );
}
