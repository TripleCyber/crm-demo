-- 003_verification · el registro de comprobaciones de identidad del banco.
--
-- ═══════════════════════════════════════════════════════════════════════════
--  ESTO NO ES UNA COPIA DE LOS DATOS DE te-api: ES EL DIARIO DEL BANCO
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Cada fila la escribe ESTE servidor cuando ESTE servidor hace algo: abre una
-- sesión de presentación, toca el timbre, y más tarde se entera de cómo acabó.
-- Ninguna columna es un dato que el CRM se invente ni una insignia sin fuente:
--
--   · lo que se pidió (tipo, atributos, canal, quién lo lanzó) lo decidió el
--     agente en esta consola y no lo sabe nadie más;
--   · las horas las sella este servidor, que es el único reloj que el banco
--     puede defender ante una reclamación;
--   · el desenlace y lo que el titular enseñó vienen tal cual de
--     `GET /v1/b2b/presentations/:id`, y se copian aquí **sin interpretarlos**.
--
-- Por qué hace falta guardarlo, y no basta con la pantalla: una comprobación
-- que sólo vive en la pestaña del agente desaparece al recargar, no se puede
-- pasar a un compañero, no se puede adjuntar a un expediente y no deja
-- historial en la ficha. Un banco que llama a sus clientes necesita poder
-- decir *qué le pidió a quién, cuándo, y qué contestó*. Eso es el diario.
--
-- ## Lo que sigue SIN estar aquí, y no por descuido
--
-- El KB-JWT, la `did:key` del titular y su perfil `te_…`. te-api no los
-- devuelve al partner (`{presentationId, status, claims}` y nada más), así que
-- no hay columna para ellos: una columna vacía para siempre es una promesa que
-- el esquema no puede cumplir. Cuando te-api los sirva, se añaden.

create table if not exists verification (
  id uuid primary key default gen_random_uuid(),

  -- La organización dueña, como en `customer` y `credential_offer`. Toda
  -- consulta filtra por ella desde la primera línea.
  org_id text not null,

  -- A quién se le pidió. Es el `external_id` de `customer`, o sea el `sub` que
  -- te-api exigió a la credencial. Sin clave foránea, por lo mismo que en
  -- `credential_offer`: el padrón puede corregirse y una comprobación ya hecha
  -- no debe impedirlo.
  external_id text not null,

  -- El identificador de la sesión en el verificador de TripleEnable. Es la
  -- clave de la URL de seguimiento (`/verifications/<id>`) y lo que se cruza
  -- con el diario de te-api cuando algo hay que reclamar.
  presentation_id text not null,

  -- Qué se pidió. El `type_key` del padrón y los nombres de los atributos, tal
  -- y como se mandaron. `text[]` y no `jsonb` porque es una lista de nombres,
  -- no un objeto: así se lee de un vistazo en un `select` a mano.
  type_key text not null,
  requested_claims text[] not null,

  -- Por dónde se avisó: `qr` (el titular está delante) o `phone` (suena su
  -- móvil). No cambia qué se comprueba — cambia qué tenía que hacer el agente
  -- a continuación, y por eso hay que poder reconstruirlo después.
  channel text not null,
  check (channel in ('qr', 'phone')),

  -- El `iss` que te-api le exigió a la credencial presentada, y el enlace de
  -- autorización. Se guardan para que la pantalla de seguimiento se pueda
  -- recargar —o abrir en otro puesto— y siga enseñando el mismo QR y el mismo
  -- recibo. Sin esto, refrescar la pestaña perdía la ceremonia en curso.
  issuer_did text not null,
  authorization_request_url text not null,
  request_uri text not null,

  -- El plazo que puso te-api. Es suyo, no nuestro: aquí es una copia para
  -- poder pintar la cuenta atrás sin volver a preguntar.
  expires_at timestamptz not null,

  -- Quién la lanzó. `agent_id`/`agent_name` son lo que le sale al titular en el
  -- móvil —atribución, te-api no lo verifica— y `actor` es la etiqueta del
  -- puesto. Se guardan los tres porque son la respuesta a «¿quién llamó a este
  -- cliente?», que es la primera pregunta de cualquier reclamación.
  agent_id text not null,
  agent_name text not null,
  actor text not null,

  -- Cuándo. `requested_at` es la hora en la que te-api devolvió la sesión;
  -- `wakeup_at`, la hora en la que salió el timbre (sólo en el canal `phone`);
  -- `settled_at`, la hora en la que ESTE servidor supo el desenlace — que no es
  -- la hora en la que el titular firmó, y el rótulo de la pantalla lo dice.
  requested_at timestamptz not null default now(),
  wakeup_id text,
  wakeup_at timestamptz,
  settled_at timestamptz,

  -- Cómo acabó, con los cinco valores de te-api y ninguno más. El `check` es
  -- la garantía de que un sexto estado inventado no entra por la puerta de
  -- atrás: `rejected` es fraude y se pinta en rojo, `failed` y `expired` son
  -- ámbar, y colapsarlos sería perder la única distinción que le importa a
  -- quien está al teléfono.
  status text not null default 'pending',
  check (status in ('pending', 'verified', 'rejected', 'failed', 'expired')),

  -- Lo que el titular decidió enseñar, tal y como lo devolvió te-api. `jsonb`
  -- porque es su objeto y no nuestro esquema: el día que un tipo lleve un valor
  -- que no sea texto, esta columna ya lo aguanta.
  disclosed_claims jsonb,

  created_at timestamptz not null default now(),

  -- La sesión de presentación es única en te-api; aquí también, y por
  -- organización: es lo que permite reconciliar el desenlace con un `update`
  -- idempotente en vez de insertar una fila por sondeo.
  unique (org_id, presentation_id)
);

-- Las dos consultas que existen: el historial de un cliente y el listado de
-- comprobaciones recientes de la organización. Las dos por fecha descendente.
create index if not exists verification_customer_idx
  on verification (org_id, external_id, requested_at desc);

create index if not exists verification_recent_idx
  on verification (org_id, requested_at desc);
