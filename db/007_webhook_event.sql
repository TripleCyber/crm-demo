-- 007_webhook_event · el CRM deja de preguntar y empieza a enterarse.
--
-- ═══════════════════════════════════════════════════════════════════════════
--  QUÉ ES ESTO Y POR QUÉ NO EXISTÍA
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Hasta el 2026-08-31 este CRM se enteraba de los resultados **preguntando**:
-- la pantalla de comprobación sondea `GET /v1/b2b/presentations/:id` cada pocos
-- segundos, y fuera de esa pantalla no se entera de nada. Un titular que
-- contesta desde su cartera media hora después, con el agente ya en otra
-- llamada, no producía ninguna huella en este lado.
--
-- te-api sí manda webhooks —tiene cola, reintentos y firma— y lo que faltaba era
-- **el receptor**. Tanto que la organización de demostración tenía el suyo
-- apuntando a `webhook.site`, una dirección de prueba que no es de nadie.
--
-- Esta tabla es la mitad duradera de ese receptor: lo que llegó, cuándo, si la
-- firma cuadró y qué decía. Vive en la base del CRM porque es **su** diario —ni
-- te-api ni Logto la leen nunca, igual que el padrón de clientes.
--
-- ── Por qué se guarda TAMBIÉN lo que no verifica ──────────────────────────
--
-- Es la decisión menos obvia de este fichero. Un `POST` con la firma mal es, por
-- definición, algo que no ha mandado te-api: podría no guardarse.
--
-- Se guarda, y por lo que significa cuando aparece. Un webhook cuya firma no
-- cuadra es **una de dos cosas y las dos hay que verlas**: o alguien está
-- probando a inventar eventos de credenciales en el diario de esta empresa, o el
-- secreto se rotó en la consola y aquí no se actualizó — y entonces se están
-- perdiendo entregas legítimas en silencio, que es el fallo caro. Sin fila no
-- hay síntoma: la pantalla de eventos saldría vacía en los dos casos, y «no ha
-- pasado nada» es la lectura equivocada de los dos.
--
-- Lo que **no** hace una fila rechazada es tocar nada: no cierra ninguna
-- comprobación, no cambia ninguna ficha y sale marcada en rojo en la pantalla.
-- Es un registro de seguridad, no un evento.
--
-- ── Por qué el cuerpo va como `jsonb` y entero ────────────────────────────
--
-- Porque la forma del evento **va a crecer**. El 2026-08-31 pasó de llevar sólo
-- `{presentationId}` a llevar el veredicto, el tipo de credencial y tres marcas
-- de tiempo, y te-api lo versiona (`apiVersion`) justo porque cuenta con volver
-- a crecer. Desmontar el cuerpo en columnas aquí significaría perder callando
-- cada campo que añadan hasta que alguien toque este esquema.
--
-- Guardado entero, un campo nuevo aparece solo en el detalle de la pantalla, y
-- lo que se promociona a columna es únicamente lo que esta base necesita para
-- **buscar**: el tipo, a qué presentación afecta y a qué cliente.

create table if not exists webhook_event (
  -- El `te-event-id` de te-api, que es un UUIDv7. **Es la clave primaria y no
  -- una columna más**, y ahí está toda la idempotencia: la entrega es «al menos
  -- una vez» y un reintento llega con el mismo id, así que la propia clave lo
  -- descarta sin necesidad de mirar nada. Ver `on conflict do nothing` en
  -- `src/lib/webhook-events.ts`.
  event_id     text primary key,

  -- La organización a la que te-api dice que pertenece el evento.
  --
  -- Se guarda **lo que venía en el cuerpo**, no lo que dice nuestra
  -- configuración, y luego se comparan: son dos afirmaciones distintas y verlas
  -- discrepar es el síntoma de que este webhook está registrado en la consola de
  -- otra empresa. Con la firma buena no debería pasar nunca; si pasa, hay que
  -- verlo y no taparlo.
  org_id       text not null,

  -- `presentation.settled`, `webhook.test`, o lo que venga.
  --
  -- Texto libre a propósito: un tipo que esta versión del CRM no conozca tiene
  -- que poder guardarse y verse en la pantalla. Un `check` con la lista de hoy
  -- convertiría un evento nuevo en un `500` en el receptor, y entonces te-api
  -- reintentaría ocho veces algo que nunca va a entrar.
  type         text not null,

  -- La versión del cuerpo que declara te-api (`apiVersion`). `null` para un
  -- evento anterior a que existiera. Es lo primero que se mira cuando un campo
  -- que se esperaba no está.
  api_version  text,

  -- Cuándo lo registró **te-api**, del cuerpo. No es cuándo llegó aquí: entre
  -- las dos puede haber horas si hubo reintentos, y esa distancia es justo lo
  -- que hay que poder ver.
  occurred_at  timestamptz,

  -- Cuándo llegó a este servidor. Lo pone esta base.
  received_at  timestamptz not null default now(),

  -- ── Lo que se promociona a columna, y sólo esto ─────────────────────────
  --
  -- La presentación a la que afecta, si la hay. `webhook.test` la trae a `null`
  -- a propósito y siempre.
  presentation_id text,

  -- El cliente al que afecta, **resuelto aquí**.
  --
  -- No viene en el cuerpo y no tiene por qué: te-api no conoce el padrón de esta
  -- empresa. Sale de cruzar `presentation_id` con la tabla `verification`, que
  -- es donde esta consola apuntó a quién le estaba pidiendo qué. `null` = no se
  -- pudo cruzar, que es lo normal en `webhook.test` y en una presentación que
  -- no abrió esta consola.
  external_id  text,

  -- El veredicto, cuando el evento lo lleva. Puede ser `null` de dos maneras
  -- distintas: porque el evento no es de los que lo llevan, o porque te-api no
  -- pudo determinarlo al liquidar y mandó `status: null` a propósito. Las dos se
  -- leen igual en la pantalla —un guion— y el detalle está en el cuerpo.
  status       text,

  -- ── La firma ────────────────────────────────────────────────────────────
  --
  -- `true` = comprobada y correcta. Es lo único que autoriza a creerse el
  -- contenido.
  signature_ok boolean not null,

  -- Por qué no cuadró, como código y no como frase: `bad_signature`,
  -- `stale_timestamp`, `not_configured`… Una frase guardada quedaría escrita en
  -- el idioma que estuviera activo el día que llegó, y esta pantalla se ve en
  -- dos (`src/lib/webhook-signature.ts`).
  signature_error text,

  -- El identificador del INTENTO de entrega (`te-delivery-id`). Cambia en cada
  -- reintento, al contrario que `event_id`. Sirve para cruzar con el registro de
  -- entregas de te-api cuando algo no cuadra.
  delivery_id  text,

  -- El cuerpo entero, tal y como llegó. Ver la nota de arriba.
  payload      jsonb not null,

  check (signature_ok or signature_error is not null)
);

-- La pantalla lista lo último primero, que es como se lee un diario.
create index if not exists webhook_event_received_idx
  on webhook_event (org_id, received_at desc);

-- Y la ficha de un cliente puede querer los suyos. Parcial porque la mayoría de
-- las filas no cruzan con ningún cliente y no tienen por qué ocupar índice.
create index if not exists webhook_event_customer_idx
  on webhook_event (org_id, external_id, received_at desc)
  where external_id is not null;
