-- 008_tenant_settings · la configuración deja de vivir en el entorno.
--
-- ═══════════════════════════════════════════════════════════════════════════
--  LA REGLA, EN UNA LÍNEA: LA BASE MANDA; EL ENTORNO SÓLO SIEMBRA
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Hasta el 2026-08-31 toda la configuración de esta instalación —quién es en
-- Logto, con qué credencial de máquina habla con te-api, su marca, sus
-- teléfonos, su secreto de webhook— vivía en `process.env`, y la única forma de
-- cambiar una coma era editar la caja de variables de Coolify y volver a
-- desplegar.
--
-- Eso no es lo que hace un producto que se instala. Y para una demostración es
-- peor todavía: el recorrido que se quiere enseñar es **dar de alta las
-- aplicaciones en tenant-admin y pegarlas aquí**, y ese recorrido no se puede
-- enseñar si a mitad hay que irse a la consola del proveedor de hosting.
--
-- Desde esta migración la configuración se escribe **en esta tabla, desde la
-- pantalla de ajustes**. El entorno sigue leyéndose, pero sólo una vez y sólo
-- para sembrar una instalación que todavía no tiene fila: en cuanto la fila
-- existe, el entorno **no se vuelve a mirar**. Está escrito con todas las letras
-- en `src/lib/tenant-settings.ts`, que es el fichero donde alguien va a buscarlo.
--
-- Se demota en vez de quitarse porque un despliegue que ya tenía su `.env`
-- entero tiene que seguir arrancando exactamente igual: la primera petición
-- siembra la fila con lo que había y todo sigue en su sitio. Lo que ya no puede
-- pasar es que haya dos fuentes de verdad sin saber cuál gana.
--
-- ── Por qué UNA fila, y no una fila por organización ──────────────────────
--
-- Porque una instalación es de una empresa (`src/lib/organization.ts`). El mapa
-- `orgId → configuración` se retiró el mismo día y por decisión del dueño; esta
-- tabla no lo reintroduce por la puerta de atrás. La `check (id = 1)` es lo que
-- lo hace imposible y no sólo improbable.
--
-- ── Los secretos se guardan en claro, y hay que decir por qué ─────────────
--
-- El secreto M2M y el del portal **no se pueden guardar cifrados de forma útil**
-- aquí: este proceso tiene que poder presentarlos a Logto en cada renovación de
-- token, así que necesitaría la clave para descifrarlos, y esa clave viviría al
-- lado. Sería ceremonia, no seguridad. El del webhook es igual: es la clave de
-- un HMAC que hay que calcular en cada entrega.
--
-- Lo que sí se hace es que **no vuelvan a salir de aquí**: la pantalla de
-- ajustes los escribe y nunca los relee al navegador — enseña su huella
-- (`src/lib/secret-fingerprint.ts`). Esta base es la del CRM y sólo del CRM, y
-- quien puede leerla ya puede leer el padrón entero de clientes.

create table if not exists tenant_settings (
  -- Una fila. La `check` es la regla, no un comentario: sin ella, un `insert`
  -- descuidado deja dos configuraciones y la aplicación elige una al azar.
  id                    integer primary key default 1 check (id = 1),

  -- ── Quién es esta instalación ───────────────────────────────────────────
  --
  -- ⚠ `org_id` es el discriminador de TODAS las demás tablas (`customer`,
  --   `verification`, `webhook_event`). Cambiarlo no migra nada: deja el padrón
  --   anterior donde está y empieza uno nuevo en blanco. La pantalla lo avisa.
  org_id                text,
  display_name          text,

  -- El dominio, sin esquema. De aquí sale el `did:web` que publica
  -- `/.well-known/did.json` y la URL del webhook que se pega en tenant-admin.
  domain                text,

  -- ── La aplicación de máquina (M2M) de esta organización en Logto ────────
  m2m_client_id         text,
  m2m_secret            text,

  -- ── Marca y sector ──────────────────────────────────────────────────────
  brand_accent          text,
  brand_surface         text,
  brand_monogram        text,
  reference_claim       text,

  -- Los teléfonos oficiales. Array y no una cadena con comas: viajan dentro de
  -- una credencial firmada como una lista, y guardarlos ya partidos evita que
  -- cada lector vuelva a decidir por dónde se corta.
  official_numbers      text[] not null default '{}',

  -- ── El portal de clientes (F2), opcional ────────────────────────────────
  portal_client_id      text,
  portal_client_secret  text,
  portal_link_type      text,
  portal_base_url       text,

  -- La clave con la que se firma la cookie de sesión del portal.
  --
  -- No la escribe nadie: si no viene del entorno se **genera** al sembrar
  -- (`src/lib/tenant-settings.ts`). Pedirle a quien despliega que invente 32
  -- caracteres aleatorios es pedirle que ponga `changeme`, y una cookie de
  -- sesión firmada con `changeme` la escribe cualquiera.
  portal_cookie_secret  text,

  -- ── El webhook que te-api manda a esta instalación ──────────────────────
  --
  -- Lo da tenant-admin al registrar la URL. Sin él, el receptor rechaza toda
  -- entrega: no hay modo «aceptar sin comprobar».
  webhook_secret        text,

  -- ── La plataforma ───────────────────────────────────────────────────────
  --
  -- Es lo mismo en toda instalación del producto, así que tiene valores por
  -- defecto en el código y casi nunca se toca. Está en la tabla igualmente
  -- porque «sólo hace falta DATABASE_URL» tiene que ser verdad también cuando
  -- alguien levanta esto contra un Logto de pruebas.
  logto_endpoint        text,
  te_api_base_url       text,
  b2b_resource          text,
  b2b_scope             text,

  -- ── Procedencia ─────────────────────────────────────────────────────────
  --
  -- `true` = esta fila nació de las variables de entorno de un despliegue que ya
  -- existía, no de que alguien rellenara el formulario. Se guarda para que la
  -- pantalla pueda decirlo: quien vea sus valores ya puestos sin haberlos
  -- escrito tiene que saber de dónde salieron, y sobre todo que **cambiar la
  -- variable ya no hace nada**.
  seeded_from_env       boolean not null default false,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
