-- **El código del mostrador, guardado para que sobreviva a una recarga.**
--
-- La verificación por mostrador vuelve a tener QR desde que se entrega como
-- petición del marco: el enlace lo construye te-api y viaja en la respuesta de
-- `POST /v1/requests`. Sin guardarlo, el código sólo existía en la respuesta
-- de la llamada que lo creó — recargar la pestaña de seguimiento lo perdía, y
-- ésa es justamente la pantalla que el agente tiene abierta mientras el cliente
-- saca el móvil.
--
-- Se guarda **el enlace y no el SVG**: el dibujo se rehace en cada pintado y
-- guardar imagen sería guardar una representación de un dato que ya está.
--
-- Nulo en dos casos legítimos: la rama del teléfono —donde no hay mostrador— y
-- un te-api con el canal QR apagado, que no devuelve ninguno.
alter table verification
  add column if not exists counter_link text;
