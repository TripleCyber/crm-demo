'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment } from 'react';

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
  readonly label: string;
  /** El rótulo del grupo al que abre. Sólo lo lleva el primero de cada grupo. */
  readonly group?: string;
}

const LINKS: readonly RailLink[] = [
  { href: '/customers', label: 'Clientes', group: 'Atención al cliente' },
  { href: '/verifications', label: 'Verificaciones' },
  { href: '/diagnostics', label: 'Diagnóstico', group: 'Integración' },
];

export function RailNav() {
  const pathname = usePathname();

  return (
    <nav className="rail-nav">
      {/*
        Fragmento y no un `<span>` envolviendo cada par: la barra se convierte
        en una fila horizontal por debajo de 900 px, y un contenedor de más por
        enlace rompe esa disposición sin que nadie sepa por qué.
      */}
      {LINKS.map((link) => (
        <Fragment key={link.href}>
          {link.group !== undefined && <p className="rail-group">{link.group}</p>}
          <Link
            href={link.href}
            className={isInSection(pathname, link.href) ? 'on' : undefined}
            aria-current={isInSection(pathname, link.href) ? 'page' : undefined}
          >
            {link.label}
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
