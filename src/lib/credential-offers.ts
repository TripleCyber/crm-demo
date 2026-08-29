import 'server-only';

import { query } from './db';

/**
 * Las ofertas que esperan a que el titular entre en el portal — el canal
 * «desde nuestra app».
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ES EL ÚNICO CANAL EN EL QUE QUIEN RECOGE LA OFERTA ESTÁ AUTENTICADO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * El QR lo escanea quien esté delante de la pantalla, el enlace lo abre quien
 * lo tenga y el correo lo lee quien tenga el buzón. Aquí, en cambio, la oferta
 * sólo la ve quien haya pasado por el login del portal con su cuenta de
 * TripleEnable. Por eso el artifact lo llama «el cliente ya está dentro y
 * autenticado», y por eso es el canal más fuerte de los cuatro aunque parezca
 * el más aburrido.
 *
 * Lo que **no** cambia es la regla del canal: la confianza no sale de por dónde
 * llegó la oferta, sale de la firma del emisor y del `tx_code` que viaja por
 * otro sitio. Este canal entrega mejor; no entrega con más autoridad.
 *
 * ## Por qué la búsqueda pide siempre `orgId` y `externalId` juntos
 *
 * La misma disciplina que `./customers.ts`: no existe una función que
 * encuentre una oferta sin decir de quién es. El portal resuelve el
 * `externalId` desde el correo verificado del ID token, así que las dos mitades
 * de la clave vienen de sitios que el navegador no elige.
 */

export interface PendingOffer {
  readonly offerId: string;
  /** El `openid-credential-offer://…` que la cartera tiene que abrir. */
  readonly offerUri: string;
  readonly typeKey: string;
  readonly expiresAt: string;
  readonly createdAt: string;
}

interface OfferRow extends Record<string, unknown> {
  offer_id: string;
  offer_uri: string;
  type_key: string;
  expires_at: Date;
  created_at: Date;
}

export interface SaveOfferInput {
  readonly orgId: string;
  readonly externalId: string;
  readonly offerId: string;
  readonly offerUri: string;
  readonly typeKey: string;
  readonly expiresAt: string;
  /** La etiqueta del puesto que la creó. Registro del banco, no autenticación. */
  readonly createdBy: string;
}

/**
 * Deja la oferta esperando en el portal del titular.
 *
 * No borra las anteriores y no es un descuido: una oferta ya entregada por otro
 * canal puede seguir siendo canjeable, y borrar la fila aquí no la mataría en
 * te-api — sólo dejaría al banco sin saber qué ofreció. La lectura se queda con
 * la más reciente que siga viva, que es lo que el titular necesita ver.
 */
export async function saveOfferForPortal(input: SaveOfferInput): Promise<void> {
  await query(
    `insert into credential_offer
       (org_id, external_id, offer_id, offer_uri, type_key, expires_at, created_by)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      input.orgId,
      input.externalId,
      input.offerId,
      input.offerUri,
      input.typeKey,
      input.expiresAt,
      input.createdBy,
    ],
  );
}

/**
 * La oferta viva de este titular, o `null`.
 *
 * El `expires_at > now()` va en el `where` y no en el código de arriba: la hora
 * que decide si una oferta sigue viva tiene que ser una sola, y la del servidor
 * de Next y la de Postgres no tienen por qué coincidir. Con la comparación en
 * la consulta, la pantalla y la fila siempre están de acuerdo.
 */
export async function findPendingOffer(
  orgId: string,
  externalId: string,
): Promise<PendingOffer | null> {
  const rows = await query<OfferRow>(
    `select offer_id, offer_uri, type_key, expires_at, created_at
       from credential_offer
      where org_id = $1 and external_id = $2 and expires_at > now()
      order by created_at desc
      limit 1`,
    [orgId, externalId],
  );

  const row = rows[0];
  if (row === undefined) return null;

  return {
    offerId: row.offer_id,
    offerUri: row.offer_uri,
    typeKey: row.type_key,
    expiresAt: row.expires_at.toISOString(),
    createdAt: row.created_at.toISOString(),
  };
}
