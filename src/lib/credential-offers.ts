import 'server-only';

import { query } from './db';
import type { DeliveryChannel } from './delivery';

/**
 * El registro de credenciales ofrecidas.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ESTA TABLA ES UN DIARIO, NO UNA BANDEJA DE ENTREGA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La ficha del cliente tiene que poder contestar «¿ya se le ofreció su
 * credencial, cuándo y por dónde?», y eso lo sabe el banco de sus propios
 * actos. Lo que **sigue sin poder contestar nadie** es si el titular la aceptó:
 * te-api no tiene ruta que lo diga, y por eso la ficha no pinta ninguna
 * insignia de «credencial activa».
 *
 * Aquí vivía además una segunda cosa: el canal `app` dejaba la oferta esperando
 * a que el titular entrara en el portal de clientes, y `findPendingOffer` se la
 * servía. El portal se retiró —esta consola es interna del banco— y con él ese
 * canal y esa consulta. Las filas que se crearon así **se quedan**: son
 * registro de algo que ocurrió, y el historial las sigue rotulando
 * (`./delivery.ts`).
 *
 * ## Por qué la búsqueda pide siempre `orgId` y `externalId` juntos
 *
 * La misma disciplina que `./customers.ts`: no existe una función que encuentre
 * una oferta sin decir de quién es.
 */

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
  /**
   * El canal, **como cadena y no como `DeliveryChannel`**.
   *
   * Se lee de la base, y la base guarda también canales que ya no se ofrecen
   * —`app`, del portal retirado—. Tiparlo con el juego de hoy diría que esas
   * filas no existen, y existen. Quien lo pinta es `deliveryPhrase`, que sabe
   * leer los retirados; quien lo escribe es `SaveOfferInput`, que sí está
   * tipado con los canales vigentes. Ancho al leer, estrecho al escribir.
   */
  readonly delivery: string;
  readonly expiresAt: string;
  readonly createdAt: string;
  readonly createdBy: string;
}

interface IssuedOfferRow extends Record<string, unknown> {
  offer_id: string;
  type_key: string;
  delivery: string;
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
 * te-api — sólo dejaría al banco sin saber qué ofreció. La ficha las enseña
 * todas.
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
