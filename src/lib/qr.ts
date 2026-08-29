import 'server-only';

import QRCode from 'qrcode';

/**
 * El QR de la oferta, dibujado **en el servidor** como SVG.
 *
 * Se genera aquí y no en el navegador por lo mismo que todo lo demás de este
 * proyecto: el navegador recibe una imagen ya hecha y no necesita ninguna
 * librería ni ningún dato más. Y SVG y no PNG porque el enlace de una oferta
 * OID4VCI es largo —lleva el `credential_offer` entero— y a esa densidad de
 * módulos un mapa de bits escalado se vuelve ilegible en la cámara justo cuando
 * el titular está delante del agente.
 *
 * `errorCorrectionLevel: 'M'` es el término medio: 'L' aguanta mal una pantalla
 * sucia o con reflejo, y 'H' añade tanta redundancia que los módulos se hacen
 * más pequeños con una URI ya larga, que es peor remedio que enfermedad.
 */
export async function renderQrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    // Sin margen de la librería: el hueco lo pone el CSS de la tarjeta, y así
    // el SVG escala al ancho del contenedor sin bordes de sobra.
    margin: 0,
    width: 320,
  });
}
