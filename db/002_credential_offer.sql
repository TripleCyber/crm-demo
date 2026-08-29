-- 002_credential_offer · el cuarto canal de entrega: «desde nuestra app».
--
-- ═══════════════════════════════════════════════════════════════════════════
--  POR QUÉ HACE FALTA UNA TABLA PARA ESTO Y NO PARA LOS OTROS TRES
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Los otros tres canales entregan la oferta **en el momento**: el QR se pinta
-- en la pantalla que el cliente está mirando, el enlace se copia y se pega, y
-- el correo sale del cliente de correo del propio agente. Ninguno necesita que
-- el CRM se acuerde de nada.
--
-- «Desde nuestra app» es el único que entrega **más tarde y a otra persona**:
-- el agente crea la oferta ahora y el titular la recoge cuando entra en el
-- portal, que puede ser dentro de un minuto o mañana. Entre esos dos momentos
-- la oferta tiene que estar en algún sitio, y ese sitio es la base del banco —
-- la misma que ya guarda a sus clientes.
--
-- Y es el canal más fuerte de los cuatro, no el más cómodo: es el único en el
-- que quien recoge la oferta **está autenticado** cuando la recoge. Un correo
-- lo lee quien tenga el buzón; esto lo ve quien haya pasado por el login del
-- portal.
--
-- ## Lo que NO se guarda: el `tx_code`
--
-- El código de un solo uso no está en esta tabla y no puede estarlo. Todo el
-- sentido del `tx_code` de OID4VCI es que viaje por **otro** canal que la
-- oferta; guardarlo al lado de la URI sería juntar los dos en la misma fila y
-- dejar el código sin proteger de nada. Se dice en voz alta por la línea en la
-- que se está hablando, y se acabó.

create table if not exists credential_offer (
  id           uuid primary key default gen_random_uuid(),

  -- La organización dueña, como en `customer` y por lo mismo: la consulta del
  -- portal filtra por ella desde el principio.
  org_id       text not null,

  -- A qué cliente se le ofreció. Es el `external_id` de `customer`, o sea el
  -- `sub` que va dentro de la credencial. Sin clave foránea a propósito: el
  -- padrón puede corregirse y una oferta ya emitida no debe impedirlo.
  external_id  text not null,

  -- El identificador que devolvió te-api. Sirve para cruzar esta fila con su
  -- diario cuando alguien pregunte por qué una oferta no se pudo aceptar.
  offer_id     text not null,

  -- El `openid-credential-offer://…` tal y como lo devolvió te-api. Es la
  -- oferta entera: quien la tenga puede canjearla si además sabe el `tx_code`.
  offer_uri    text not null,

  -- El `type_key` del padrón, para poder rotularla en el portal sin volver a
  -- preguntar a te-api.
  type_key     text not null,

  -- La caduca te-api, no nosotros: esta columna es una copia para poder
  -- **dejar de enseñarla** sin tener que preguntar. La verdad sigue estando
  -- allí — una oferta que aquí parezca viva y allí esté muerta falla al
  -- canjearse, que es el comportamiento correcto.
  expires_at   timestamptz not null,

  -- Quién la creó, para el registro del banco. Es la etiqueta del puesto de
  -- `CRM_ACTIVE_ACTOR`, no una persona verificada.
  created_by   text not null,

  created_at   timestamptz not null default now()
);

-- La consulta del portal: la oferta viva más reciente de este cliente en esta
-- organización. Es la única que existe, así que el índice es exactamente ella.
create index if not exists credential_offer_lookup_idx
  on credential_offer (org_id, external_id, created_at desc);
