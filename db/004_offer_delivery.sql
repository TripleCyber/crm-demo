-- 004_offer_delivery · la tabla de ofertas deja de ser sólo la del portal.
--
-- ═══════════════════════════════════════════════════════════════════════════
--  POR QUÉ AHORA SE ANOTAN LOS CUATRO CANALES Y ANTES SÓLO UNO
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `002` guardaba únicamente el canal «desde nuestra app», y con razón: era el
-- único que entrega **más tarde**, así que era el único que necesitaba que el
-- CRM se acordara de algo para funcionar.
--
-- Lo que ha cambiado no es la entrega: es que la ficha del cliente ahora tiene
-- que contestar «¿a este señor se le ha ofrecido ya su credencial?». Y esa
-- pregunta **no la puede contestar te-api** —no hay ruta que diga si el titular
-- aceptó una oferta, y por eso la ficha sigue sin pintar ninguna insignia de
-- «credencial activa»—, pero sí la contesta el propio banco sobre sus propios
-- actos: *el 29 de agosto, Pedro le ofreció una credencial de cliente por QR*.
-- Eso no es una insignia sin fuente; es el registro de lo que hizo esta
-- consola, y es exactamente lo que un CRM guarda.
--
-- La columna nueva dice por dónde se entregó. Y el portal, que antes se
-- quedaba con «la última oferta viva», ahora tiene que quedarse con «la última
-- oferta viva **de su canal**»: una oferta que salió por QR ya se la llevó
-- quien estaba delante de la pantalla, y anunciarla en el área de cliente como
-- «te está esperando» sería contarle al titular algo que no ocurrió.

alter table credential_offer
  add column if not exists delivery text;

-- Las filas que ya existían son todas del canal `app`, porque hasta ahora era
-- el único que se guardaba. Se marcan antes de poner el `not null` para que la
-- migración no dependa de que la tabla esté vacía.
update credential_offer set delivery = 'app' where delivery is null;

alter table credential_offer
  alter column delivery set not null;

-- La lista cerrada, igual que en la ruta que la escribe. Un canal que no exista
-- no puede entrar por SQL a mano y aparecer luego en una pantalla sin rótulo.
alter table credential_offer
  drop constraint if exists credential_offer_delivery_check;

alter table credential_offer
  add constraint credential_offer_delivery_check
  check (delivery in ('qr', 'link', 'email', 'app'));
