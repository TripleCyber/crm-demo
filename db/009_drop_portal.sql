-- 009_drop_portal · se retira el portal de clientes. Esta consola es interna.
--
-- ═══════════════════════════════════════════════════════════════════════════
--  POR QUÉ SE QUITA ALGO QUE FUNCIONABA
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `008` guardaba la aplicación OIDC de un **portal de clientes** montado dentro
-- de esta misma aplicación: el titular entraba con Logto, y de ese login nacía
-- el vínculo entre su perfil de TripleEnable y su ficha del banco
-- (`POST /v1/b2b/links`, que exige el ID token como prueba).
--
-- El supuesto era falso. Esto es la consola **interna** del banco, la que usan
-- sus empleados: un cliente no entra aquí, y un banco no registra su CRM como
-- aplicación OIDC para que entren sus clientes — ya tiene su propia banca
-- electrónica. Un portal de cliente dentro de esta aplicación no existe en
-- ningún despliegue real, así que su configuración tampoco tiene por qué
-- ocupar cinco columnas de la tabla de ajustes.
--
-- **Y el vínculo no nacía del login.** Nace cuando el titular acepta una
-- credencial de esta entidad en su cartera, que es un trato entre la cartera y
-- la plataforma en el que esta consola no interviene. Lo que sí sigue haciendo
-- —y es lo único que necesitaba del directorio— es *leerlo*:
-- `GET /v1/b2b/links` contesta si un titular tiene cartera vinculada, y de eso
-- depende que se le pueda avisar al móvil.
--
-- ═══════════════════════════════════════════════════════════════════════════
--  SE BORRAN LAS COLUMNAS, Y NO SÓLO SE DEJAN DE LEER
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Dos de ellas guardan **secretos** —el del cliente OIDC y la clave de firma de
-- la cookie de sesión—. Una columna que ya nadie lee pero que sigue teniendo un
-- secreto dentro es lo peor de las dos opciones: no sirve para nada y sigue
-- estando en cada copia de seguridad. Si algún día vuelve a hacer falta un
-- portal, será otra aplicación y tendrá sus propias credenciales.
--
-- `if exists` en las cinco porque una base sembrada por una versión anterior a
-- `008` puede no tenerlas, y esta migración tiene que poder aplicarse sobre
-- cualquiera de las dos.

alter table tenant_settings
  drop column if exists portal_client_id,
  drop column if exists portal_client_secret,
  drop column if exists portal_link_type,
  drop column if exists portal_base_url,
  drop column if exists portal_cookie_secret;

-- ═══════════════════════════════════════════════════════════════════════════
--  LO QUE NO SE TOCA: `credential_offer.delivery`
-- ═══════════════════════════════════════════════════════════════════════════
--
-- El canal `app` («le espera en el portal, ya autenticado») deja de ofrecerse:
-- sin portal, una oferta creada así no la podría recoger nadie, y una entrega
-- que no entrega es peor que no ofrecer el canal.
--
-- Pero la restricción de `004` se queda **tal cual, con `app` dentro**, y las
-- filas que ya existen no se tocan. Son el registro de lo que esta consola hizo
-- de verdad: el 29 de agosto se ofreció una credencial por ese canal, y eso
-- ocurrió. Reescribir el historial para que cuadre con lo que hoy se puede
-- hacer sería falsificarlo. El historial las sigue rotulando; el formulario ya
-- no las crea (`src/lib/delivery.ts`).
