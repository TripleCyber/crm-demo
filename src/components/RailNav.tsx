'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment } from 'react';

import { useTranslator } from '@/i18n/client';
import type { MessageKey } from '@/i18n/translate';

/**
 * La navegación de la barra, con la sección abierta marcada.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ES DE NAVEGADOR SÓLO POR ESTO: HAY QUE SABER EN QUÉ PANTALLA SE ESTÁ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `usePathname` no existe en el servidor, y una consola de cinco pantallas sin
 * marca de dónde estás obliga a leer la cabecera para saberlo. Es la única
 * razón de que este trozo baje al navegador; no toca datos, no toca sesión y
 * no sabe nada de la organización.
 *
 * La marca se pone por **prefijo** y no por igualdad: la ficha de un cliente
 * (`/customers/BD-99120447`) y su pantalla de emisión son la sección
 * «Clientes», y la sección no puede apagarse al entrar en una ficha — es justo
 * cuando más falta hace saber de dónde vienes.
 */

interface RailLink {
  readonly href: string;
  readonly labelKey: MessageKey;
  /** El rótulo del grupo al que abre. Sólo lo lleva el primero de cada grupo. */
  readonly groupKey?: MessageKey;
}

const LINKS: readonly RailLink[] = [
  { href: '/customers', labelKey: 'nav.customers', groupKey: 'nav.groupService' },
  { href: '/verifications', labelKey: 'nav.verifications' },
  { href: '/diagnostics', labelKey: 'nav.diagnostics', groupKey: 'nav.groupIntegration' },
  // Los eventos van DEBAJO de Diagnóstico y en el mismo grupo. El orden no es
  // alfabético: Diagnóstico contesta «¿está bien montado?» y esto contesta «¿qué
  // ha llegado?», y la segunda pregunta sólo tiene sentido después de la primera.
  { href: '/events', labelKey: 'nav.events' },
  // Ajustes va el ÚLTIMO del grupo y no el primero, aunque sea lo primero que se
  // toca al desplegar. El orden de una barra lateral es el del uso diario, no el
  // del primer día: quien la mira ocho horas busca clientes y verificaciones, y
  // los ajustes se abren dos veces en la vida de una instalación. Quien acaba de
  // publicarla llega igual, porque la consola sin configurar lleva aquí sola.
  { href: '/settings', labelKey: 'nav.settings' },
];

export function RailNav() {
  const pathname = usePathname();
  const t = useTranslator();

  return (
    <nav className="rail-nav">
      {/*
        Fragmento y no un `<span>` envolviendo cada par: la barra se convierte
        en una fila horizontal por debajo de 900 px, y un contenedor de más por
        enlace rompe esa disposición sin que nadie sepa por qué.
      */}
      {LINKS.map((link) => (
        <Fragment key={link.href}>
          {link.groupKey !== undefined && <p className="rail-group">{t(link.groupKey)}</p>}
          <Link
            href={link.href}
            className={isInSection(pathname, link.href) ? 'on' : undefined}
            aria-current={isInSection(pathname, link.href) ? 'page' : undefined}
          >
            {t(link.labelKey)}
          </Link>
        </Fragment>
      ))}
    </nav>
  );
}

/**
 * Si la dirección de ahora cae dentro de esta sección.
 *
 * La barra `/` del final importa: sin ella, `/customers` marcaría también una
 * hipotética `/customers-archivados`, que es otra sección.
 */
function isInSection(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
