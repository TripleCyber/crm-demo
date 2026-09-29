'use client';

import { useState } from 'react';

import { useTranslator } from '@/i18n/client';

/**
 * Un valor que hay que **llevarse a otra pantalla**, con su botón de copiar.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  EXISTE POR LA DIRECCIÓN DEL WEBHOOK, Y ESO EXPLICA CADA DECISIÓN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `https://bank.demo-te.com/api/webhooks/te-api` se teclea a mano en tenant-admin
 * si no se puede copiar, y un carácter de diferencia produce el fallo más caro
 * que tiene esta integración: te-api entrega en una dirección que no existe, el
 * destino acumula fallos y acaba suspendido, y en esta consola **no se ve nada**
 * — la bandeja de eventos sale vacía, que es indistinguible de «todavía no ha
 * pasado nada».
 *
 * Por eso el valor se pinta entero y no recortado con puntos suspensivos: quien
 * no pueda copiar tiene que poder leerlo, y un `text-overflow: ellipsis` sobre
 * una URL esconde justo la cola, que es donde está la ruta.
 */
export function CopyValue({ value }: { readonly value: string }) {
  return (
    <span className="copy-value">
      <span className="mono">{value}</span>
      <CopyButton value={value} />
    </span>
  );
}

/**
 * **El botón solo**, sin el valor al lado.
 *
 * Sale de aquí y no de una copia porque el catálogo de verificaciones necesita
 * copiar **una petición HTTP entera** —cuatro líneas y un cuerpo con sangrado—,
 * y eso no cabe en el `<span>` de arriba: allí el valor se pinta entero y en
 * línea porque es una URL que hay que poder leer si no se puede copiar. Un
 * bloque de código ya se lee solo; lo único que le falta es el botón.
 *
 * Lo que no se duplica es el cuidado del portapapeles: `navigator.clipboard` no
 * existe fuera de un origen seguro —en un `localhost` sin TLS es `undefined`— y
 * sin el `try` el botón moriría con una excepción en vez de no hacer nada. El
 * texto sigue a la vista para seleccionarlo a mano, que es el respaldo de verdad.
 */
export function CopyButton({ value }: { readonly value: string }) {
  const [copied, setCopied] = useState(false);
  const t = useTranslator();

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" className="copy-value-button" onClick={() => void copy()}>
      {t(copied ? 'settings.copied' : 'settings.copy')}
    </button>
  );
}
