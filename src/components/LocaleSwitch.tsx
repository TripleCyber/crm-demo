'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { setLocaleAction } from '@/i18n/actions';
import { useLocale, useTranslator } from '@/i18n/client';
import { LOCALES, LOCALE_NAMES } from '@/i18n/config';

/**
 * El selector de idioma: un idioma por botón, y el activo marcado.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ES DE NAVEGADOR POR LO MISMO QUE LA BARRA: HAY QUE SABER DÓNDE ESTÁS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `usePathname` no existe en el servidor, y sin saber en qué pantalla se está
 * no se puede volver a ella después de cambiar. Cambiar de idioma y aparecer en
 * el listado de clientes, con el cliente al teléfono y la verificación a medias
 * abierta, sería peor que no poder cambiar.
 *
 * El campo `next` se rellena al renderizar —también en el servidor, que es
 * cuando se compone el HTML—, así que el formulario funciona sin JavaScript. Su
 * valor lo comprueba la acción antes de redirigir: viene del navegador, ver
 * `safeReturnPath`.
 *
 * Dos botones y no un desplegable: con dos idiomas, un `<select>` obliga a
 * abrirlo para ver qué hay, y encima necesita JavaScript para enviarse al
 * elegir. Cuando haya cinco idiomas esto será otra cosa.
 */
export function LocaleSwitch() {
  return (
    /*
      `useSearchParams` obliga a un límite de suspensión, y no es burocracia de
      Next: en una pantalla que se pudiera prerenderizar, la búsqueda no se
      conoce hasta que llega la petición. El respaldo es el mismo formulario
      apuntando a la portada — se pinta sólo si alguna vez esto cuelga de una
      ruta estática, y entonces cambiar de idioma lleva a `/customers` en vez de
      a la pantalla de ahora, que es correcto aunque no sea lo ideal.
    */
    <Suspense fallback={<LocaleSwitchForm next="/" />}>
      <LocaleSwitchHere />
    </Suspense>
  );
}

function LocaleSwitchHere() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // La búsqueda forma parte de dónde estás: `/customers?q=perez` traducido
  // tiene que seguir enseñando el resultado de «perez». `toString()` da la
  // cadena vacía cuando no hay ninguno.
  const query = searchParams.toString();
  return <LocaleSwitchForm next={query === '' ? pathname : `${pathname}?${query}`} />;
}

function LocaleSwitchForm({ next }: { next: string }) {
  const active = useLocale();
  const t = useTranslator();

  return (
    <form action={setLocaleAction} className="locale-switch">
      <input type="hidden" name="next" value={next} />
      <span className="locale-switch-legend">{t('locale.legend')}</span>
      <div className="locale-switch-options">
        {LOCALES.map((locale) => (
          <button
            key={locale}
            type="submit"
            name="locale"
            value={locale}
            className={locale === active ? 'on' : undefined}
            aria-current={locale === active ? 'true' : undefined}
            // El rótulo visible es el código —`EN`, `ES`—, que cabe en la barra
            // y se reconoce sin leer. El nombre entero va en la etiqueta
            // accesible: un lector de pantalla que cante «e ene» no dice nada.
            title={t('locale.switchTo', { language: LOCALE_NAMES[locale] })}
            aria-label={t('locale.switchTo', { language: LOCALE_NAMES[locale] })}
          >
            {locale.toUpperCase()}
          </button>
        ))}
      </div>
    </form>
  );
}
