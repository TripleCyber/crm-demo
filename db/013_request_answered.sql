-- 013_request_answered · la petición del marco deja de ser un viaje de ida.
--
-- ═══════════════════════════════════════════════════════════════════════════
--  QUÉ HA CAMBIADO FUERA, Y POR QUÉ OBLIGA A TOCAR AQUÍ
-- ═══════════════════════════════════════════════════════════════════════════
--
-- te-api publica un evento nuevo, `request.answered`, con el desenlace de una
-- **petición del marco**: qué plantilla, qué se contestó y cuándo. Hasta hoy
-- mandaba dos —`presentation.settled` y `webhook.test`— y ninguno hablaba de
-- peticiones, así que una `doc.sign.v1` firmada con la identidad de la cartera
-- se aprobaba o se rechazaba sin dejar rastro en este lado. El dueño lo dijo
-- así: «el CRM sigue sin reaccionar a las autorizaciones».
--
-- El evento se archiva en `webhook_event` como cualquier otro y **no necesita
-- tabla nueva**: la de webhooks guarda el sobre entero y esa decisión ya está
-- defendida en `db/007_webhook_event.sql`. Lo que sí hacen falta son dos cosas
-- en `verification`, y las dos son para poder **cerrar** la fila con lo que
-- traiga el evento.
--
-- ═══════════════════════════════════════════════════════════════════════════
--  1 · `request_id` — porque el evento no siempre puede nombrar la presentación
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `presentation.settled` se empareja por `presentation_id`, que esta consola ya
-- anotaba: es la sesión del verificador y es única. `request.answered` no puede
-- usar eso, porque **la mayoría del catálogo firma con la identidad de la
-- cartera** y entonces no hay sesión que nombrar: su `presentationId` viene a
-- `null` y el único identificador que trae es el de la petición.
--
-- Y ese identificador esta consola lo tenía en la mano y lo tiraba: lo devuelve
-- `POST /v1/requests` en el mismo intercambio en el que se anota la fila. O sea
-- que no hay nada que descubrir ni que pedir — hay que guardarlo.
--
-- Nulo en un caso legítimo y en uno histórico:
--
--  · **El canal de teléfono con timbre** (`POST /v1/b2b/wakeups`): la petición
--    la compone te-api por dentro y su identificador no vuelve en la respuesta
--    del timbre. Esa fila se sigue cerrando por `presentation_id`, que sí tiene.
--  · **Las filas de antes de esta migración**, que nacieron sin la columna.
--
-- Por eso el receptor empareja por los dos: `request_id` primero, y si el evento
-- trae `presentationId` también vale ése. Ver `settleAnsweredRequest`.
--
-- ── Índice, y por qué NO es único ─────────────────────────────────────────
--
-- El identificador es único en te-api —lo genera él, uuidv7— así que la unicidad
-- sería verdad. No se declara igualmente, y es una decisión y no un descuido:
-- una restricción única aquí convertiría una anomalía suya en **un fallo al
-- crear la ceremonia**, con el agente al teléfono y la petición ya mandada. El
-- `insert` de `recordVerification` sólo sabe esquivar el conflicto de
-- `(org_id, presentation_id)`; cualquier otro lo tumbaría.
--
-- Que el `update` toque una sola fila no depende de esta restricción: depende de
-- que te-api no repita el identificador y de que el `where` exija `pending`. Y
-- si algún día tocara dos, las dos serían de esa petición y cerrarlas es lo
-- correcto.
--
-- Parcial porque las filas del timbre no lo llevan y no tienen por qué ocupar
-- índice, igual que `webhook_event_customer_idx`.

alter table verification
  add column if not exists request_id text;

create index if not exists verification_request_idx
  on verification (org_id, request_id)
  where request_id is not null;

-- ═══════════════════════════════════════════════════════════════════════════
--  1b · `asker_reference` — el expediente, que es de esta entidad y no de te-api
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `POST /v1/requests` acepta un `reference` que te-api no mira y devuelve
-- verbatim en `request.answered`. Es **el número de expediente de quien
-- pregunta**: sirve para atar la respuesta a una fila del sistema del socio sin
-- guardar una tabla de equivalencias con los identificadores de TripleEnable.
--
-- Se guarda porque es el emparejamiento que esta consola controla de punta a
-- punta: lo acuña ella (`mintAskerReference`), lo manda ella y vuelve tal cual.
-- `request_id` depende de que la respuesta de te-api llegara y se anotara; el
-- expediente existe desde antes de que salga la llamada. Por eso el receptor
-- mira éste primero y cae a los otros dos.
--
-- Nulo en lo mismo que `request_id` —la rama del timbre y las filas viejas— y
-- además en cualquier ceremonia que un socio mande sin referencia, que es
-- legítimo: te-api le entrega su evento igual.

alter table verification
  add column if not exists asker_reference text;

create index if not exists verification_asker_reference_idx
  on verification (org_id, asker_reference)
  where asker_reference is not null;

-- ═══════════════════════════════════════════════════════════════════════════
--  2 · `declined` — un sexto estado, porque los cinco no saben decirlo
-- ═══════════════════════════════════════════════════════════════════════════
--
-- La tabla nació con «los cinco valores de te-api y ninguno más», y el `check`
-- estaba ahí justamente «para que un sexto estado inventado no entre por la
-- puerta de atrás». Éste no se inventa: lo trae un evento nuevo con su propio
-- vocabulario de tres —`approved`, `declined`, `not_me`— y hay que meterlo por
-- la puerta de delante.
--
-- Hacía falta porque las equivalencias obvias son las dos mentiras que aquel
-- comentario protegía:
--
--  · `declined` **no es** `rejected`. Ése es el aviso de fraude —«no he sido
--    yo»— y es el único rojo de la consola; con él el agente corta la llamada.
--    Un titular que lee la petición y contesta que no está usando la ceremonia
--    como se espera.
--  · `declined` **no es** `failed`. Ése significa que algo se rompió y se
--    reintenta. Una negativa no se reintenta: es una respuesta.
--
-- `approved` entra como `verified` y `not_me` como `rejected`, que sí son lo
-- mismo palabra por palabra. La conversión entera, en `statusOfOutcome`
-- (`src/lib/request-answered.ts`).
--
-- ── Por qué se busca el `check` en vez de nombrarlo ───────────────────────
--
-- El de 003 se declaró sin nombre, así que quien lo bautizó fue Postgres. El
-- nombre que suele poner es `verification_status_check`, pero «suele» no basta:
-- si en alguna base salió con sufijo, un `drop constraint if exists` con el
-- nombre esperado no encontraría nada, se añadiría el nuevo al lado del viejo, y
-- el viejo seguiría rechazando `declined` — un fallo que no aparece hasta que un
-- titular contesta que no. Se buscan por su definición y se quitan todos.

do $$
declare
  stale text;
begin
  for stale in
    select con.conname
      from pg_constraint con
     where con.conrelid = 'verification'::regclass
       and con.contype = 'c'
       and pg_get_constraintdef(con.oid) like '%status%'
  loop
    execute format('alter table verification drop constraint %I', stale);
  end loop;
end
$$;

alter table verification
  add constraint verification_status_check
  check (status in ('pending', 'verified', 'rejected', 'declined', 'failed', 'expired'));
