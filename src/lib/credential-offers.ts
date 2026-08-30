import 'server-only';

import { query } from './db';
import type { DeliveryChannel } from './delivery';

/**
 * El registro de credenciales ofrecidas — los cuatro canales.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  DOS COSAS DISTINTAS VIVEN EN ESTA TABLA, Y LA COLUMNA `delivery` LAS SEPARA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 1. **El canal «desde nuestra app»**, que necesita memoria para funcionar: el
 *    agente crea la oferta ahora y el titular la recoge cuando entra en el
 *    portal. Es el único de los cuatro en el que **quien recoge está
 *    autenticado** — el QR lo escanea quien esté delante de la pantalla, el
 *    enlace lo abre quien lo tenga y el correo lo lee quien tenga el buzón.
 *    Eso no le da más autoridad a la oferta: la confianza sale de la firma del
 *    emisor y del `tx_code`, nunca del canal. Entrega mejor; no entrega con
 *    más autoridad.
 *
 * 2. **El historial de emisión de la ficha**, que es registro y no entrega. La
 *    ficha del cliente tiene que poder contestar «¿ya se le ofreció su
 *    credencial, cuándo y por dónde?», y eso lo sabe el banco de sus propios
 *    actos. Lo que **sigue sin poder contestar nadie** es si el titular la
 *    aceptó: te-api no tiene ruta que lo diga, y por eso la ficha no pinta
 *    ninguna insignia de «credencial activa».
 *
 * `findPendingOffer` —la del portal— filtra por `delivery = 'app'`. Una oferta
 * que salió por QR ya se la llevó quien estaba delante; anunciarla en el área
 * de cliente como «te está esperando» sería contarle al titular algo que no
 * ocurrió.
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

/**
 * Una oferta del historial de la ficha.
 *
 * **No lleva la `offer_uri` dentro** y no es un olvido: el historial se pinta
 * para saber qué se ofreció y cuándo, no para volver a entregarlo. Quien tenga
 * esa URI y el `tx_code` se lleva la credencial, así que no se reparte por una
 * pantalla que sólo tenía que decir una fecha.
 */
export interface IssuedOffer {
  readonly offerId: string;
  readonly typeKey: string;
  readonly delivery: DeliveryChannel;
  readonly expiresAt: string;
  readonly createdAt: string;
  readonly createdBy: string;
}

interface OfferRow extends Record<string, unknown> {
  offer_id: string;
  offer_uri: string;
  type_key: string;
  expires_at: Date;
  created_at: Date;
}

interface IssuedOfferRow extends Record<string, unknown> {
  offer_id: string;
  type_key: string;
  delivery: DeliveryChannel;
  expires_at: Date;
  created_at: Date;
  created_by: string;
}

export interface SaveOfferInput {
  readonly orgId: string;
  readonly externalId: string;
  readonly offerId: string;
  readonly offerUri: string;
  readonly typeKey: string;
  readonly delivery: DeliveryChannel;
  readonly expiresAt: string;
  /** La etiqueta del puesto que la creó. Registro del banco, no autenticación. */
  readonly createdBy: string;
}

/**
 * Anota la oferta que se acaba de crear.
 *
 * No borra las anteriores y no es un descuido: una oferta ya entregada por otro
 * canal puede seguir siendo canjeable, y borrar la fila aquí no la mataría en
 * te-api — sólo dejaría al banco sin saber qué ofreció. El portal se queda con
 * la más reciente de su canal que siga viva, y la ficha las enseña todas.
 */
export async function recordIssuedOffer(input: SaveOfferInput): Promise<void> {
  await query(
    `insert into credential_offer
       (org_id, external_id, offer_id, offer_uri, type_key, delivery, expires_at, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      input.orgId,
      input.externalId,
      input.offerId,
      input.offerUri,
      input.typeKey,
      input.delivery,
      input.expiresAt,
      input.createdBy,
    ],
  );
}

/**
 * La oferta viva que espera a este titular **en el portal**, o `null`.
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
      where org_id = $1 and external_id = $2 and delivery = 'app' and expires_at > now()
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

/** Lo que se le ha ofrecido a este cliente, de lo más reciente a lo más viejo. */
export async function listOffersForCustomer(
  orgId: string,
  externalId: string,
  limit = 20,
): Promise<IssuedOffer[]> {
  const rows = await query<IssuedOfferRow>(
    `select offer_id, type_key, delivery, expires_at, created_at, created_by
       from credential_offer
      where org_id = $1 and external_id = $2
      order by created_at desc
      limit $3`,
    [orgId, externalId, limit],
  );

  return rows.map((row) => ({
    offerId: row.offer_id,
    typeKey: row.type_key,
    delivery: row.delivery,
    expiresAt: row.expires_at.toISOString(),
    createdAt: row.created_at.toISOString(),
    createdBy: row.created_by,
  }));
}
