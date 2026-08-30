'use client';

import { useState } from 'react';

/**
 * El enlace que abre la cartera, y el botón que lo abre.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  POR QUÉ ESTO NO ERA UN `<a>` Y AHORA SÍ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La URI estaba pintada en un `<span>`: se leía y se copiaba, pero no se podía
 * TOCAR. En el escritorio da igual —se copia y se pega—; en el teléfono, que es
 * donde vive la cartera, era justo lo que hacía falta y no estaba. Abrir la
 * consola desde el navegador del móvil y tocar el enlace es la única forma de
 * comprobar que el enlace **de verdad** abre la aplicación, sin cámara de por
 * medio y sin depender del aviso push.
 *
 * Funciona porque la cartera declara estos esquemas en su `Info.plist`
 * (`CFBundleURLTypes`): `openid-credential-offer`, `openid4vp`, `openid-vc`,
 * `haip` y `tripleenable`. Safari los entrega al sistema, que abre la app.
 *
 * NO hay enlaces universales (`https://`): el `Info.plist` no declara
 * `associated-domains`. O sea que **un enlace `https://` no abriría la
 * cartera**, y por eso lo que se ofrece aquí es la URI del protocolo tal cual,
 * sin envolverla en una página intermedia que rompería el único mecanismo que
 * hoy funciona.
 *
 * EN EL ESCRITORIO NO PASA NADA AL PULSARLO, y eso hay que decirlo. Un botón
 * que a veces no hace nada y no explica por qué se lee como una avería del
 * sistema; con la línea de debajo se lee como lo que es —esto es para el
 * teléfono—. No se detecta el aparato para esconder el botón: quien prueba
 * desde el escritorio con el simulador delante también lo quiere.
 */
export function WalletLink({
  uri,
  label,
}: {
  readonly uri: string;
  /** Qué se abre. «la oferta» o «la solicitud»: la frase la pone quien llama. */
  readonly label: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    // `navigator.clipboard` no existe fuera de un origen seguro. La consola va
    // por HTTPS, pero en un `localhost` sin TLS esto sería `undefined` y el
    // botón moriría con una excepción en vez de no hacer nada.
    try {
      await navigator.clipboard.writeText(uri);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="wallet-link">
      <p className="wallet-link-uri">
        <span className="mono">{uri}</span>
      </p>
      <div className="wallet-link-actions">
        {/*
          Un `<a>` de verdad y no un `router.push`: el enrutador de Next sólo
          entiende rutas suyas, y esto no es una ruta — es una URI de otro
          protocolo que tiene que salir al sistema operativo.

          Sin `target="_blank"`: en iOS deja una pestaña en blanco detrás
          después de saltar a la aplicación, y quien vuelve al navegador se
          encuentra una página vacía que parece un error.
        */}
        <a className="button-link" href={uri}>
          Abrir en la cartera
        </a>
        <button type="button" className="secondary" onClick={copy}>
          {copied ? 'Enlace copiado' : 'Copiar enlace'}
        </button>
      </div>
      <p className="muted wallet-link-note">
        «Abrir en la cartera» funciona en el aparato donde esté instalada. Desde este
        navegador, si no la tiene, no ocurre nada: copia {label} y ábrela allí.
      </p>
    </div>
  );
}
