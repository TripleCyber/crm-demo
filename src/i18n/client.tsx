'use client';

import { createContext, useContext, useMemo } from 'react';

import { DEFAULT_LOCALE, type Locale } from './config';
import { createTranslator, type Translator } from './translate';

/**
 * El idioma, para los componentes que viven en el navegador.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  EL IDIOMA BAJA RESUELTO; LOS TEXTOS VIAJAN EN EL PAQUETE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Lo que cruza la frontera servidor → navegador es **una cadena de dos
 * letras**, no el catálogo: los mensajes son módulos normales y el navegador ya
 * los tiene. Son unos pocos kilobytes por idioma y con dos idiomas eso no da
 * para pensarlo; a cambio, el traductor es literalmente el mismo objeto en los
 * dos lados y no hay una segunda ruta de resolución que pueda discrepar de la
 * primera al hidratar.
 *
 * El idioma **no se vuelve a negociar aquí**. Lo resolvió el servidor con la
 * cookie y la cabecera (`./server.ts`), y volver a mirarlo en el navegador —con
 * `navigator.language`, por ejemplo— produciría el clásico parpadeo: el HTML
 * llega en un idioma y la hidratación lo cambia por otro.
 */
const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/**
 * El traductor del idioma activo.
 *
 * `useMemo` porque el traductor se pasa como dependencia a más de un `useMemo`
 * y a más de un `useEffect` de las pantallas de seguimiento: uno nuevo en cada
 * repintado volvería a montar el sondeo, y ese efecto tiene escrita encima la
 * historia de las 611 llamadas en 52 segundos.
 */
export function useTranslator(): Translator {
  const locale = useLocale();
  return useMemo(() => createTranslator(locale), [locale]);
}
