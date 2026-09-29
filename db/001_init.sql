-- 001_init · el padrón de clientes de Banco Demo.
--
-- Esta base es SUYA. No la comparte con te-api ni con Logto, y ninguna de las
-- dos la lee nunca: «sus empleados son reales; sus clientes son locales». Es
-- exactamente lo que pasa en un banco de verdad — sus clientes ya viven en su
-- núcleo bancario y nosotros no los tocamos.

create table if not exists customer (
  id           uuid primary key default gen_random_uuid(),

  -- La organización de Logto dueña de la ficha.
  --
  -- Está aquí desde la primera migración aunque hoy sólo haya una: la consulta
  -- que lista clientes tiene que filtrar por organización DESDE EL PRINCIPIO, o
  -- el día que entre el segundo banco hay que revisar cada `select` del
  -- proyecto para ver cuál se dejó el `where`. La auditoría de F4 lo pide como
  -- requisito («un empleado de otra organización no ve ni opera los clientes de
  -- ésta»), y una columna añadida después no lo arregla sola.
  org_id       text not null,

  -- El identificador del cliente EN Banco Demo. Es el `sub` de la credencial
  -- (CONTRATOS.md §1.2: «`sub` es el campo que te-api vincula»), así que no es
  -- un id interno que se pueda renumerar a gusto: una vez emitida una
  -- credencial con este valor, cambiarlo deja huérfano el vínculo.
  external_id  text not null,

  given_name   text not null,
  family_name  text not null,
  email        text,
  phone        text,

  -- Los cuatro últimos dígitos de la cuenta, no la cuenta. Es lo que va en la
  -- credencial y lo único que hace falta para que el titular reconozca de qué
  -- cuenta se habla.
  account_last4 text,
  check (account_last4 is null or account_last4 ~ '^[0-9]{4}$'),

  -- `date` y no `timestamptz`: es una fecha de alta comercial, y la hora exacta
  -- en la que un cliente firmó no le importa a nadie aquí. Además viaja a la
  -- credencial como `YYYY-MM-DD`.
  customer_since date,

  created_at   timestamptz not null default now(),

  -- Único POR ORGANIZACIÓN, no global: dos bancos distintos pueden numerar a
  -- sus clientes igual y no tienen por qué enterarse.
  unique (org_id, external_id)
);

-- El listado siempre va filtrado por organización y ordenado por alta.
create index if not exists customer_org_created_idx
  on customer (org_id, created_at desc);
