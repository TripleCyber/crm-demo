# Imagen del CRM de Banco Demo.
#
# Mismas dos decisiones que la de te-api, y por los mismos motivos:
#
# 1. Las dependencias se instalan ANTES de copiar el código, para que la capa
#    pesada sólo se rehaga cuando cambien `package.json` o el lockfile.
#
# 2. La imagen final no lleva ni el compilador, ni el código fuente, ni las
#    dependencias de desarrollo: sólo la salida `standalone` de Next. Lo que no
#    está no se puede ejecutar por accidente.
#
# Lo que NO hace, a diferencia de te-api: migrar al arrancar. La base del CRM es
# suya y las migraciones se aplican a mano (`npm run db:migrate`), porque este
# servicio es una maqueta de un banco y no queremos que una imagen desplegada
# por error toque el esquema de nadie.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next necesita **algo** en las variables de servidor para construir: los
# módulos con `import 'server-only'` se evalúan al prerenderizar. Estos valores
# son de mentira a propósito y NO viajan en la imagen: se resuelven de nuevo en
# tiempo de ejecución. Que sean obviamente falsos es el punto — si alguno se
# colara en la salida, se vería.
#
# Hoy todas las páginas son `force-dynamic`, así que en la práctica no se lee
# ninguna al construir. Se dejan igualmente: la construcción no puede depender de
# que nadie añada nunca una página estática que sí las lea, y el día que pase, el
# fallo sería un valor de mentira horneado en la imagen y no un error.
ENV CRM_ORG_ID=build-time-placeholder \
    CRM_ORG_DOMAIN=build-time-placeholder.invalid \
    CRM_M2M_CLIENT_ID=build-time-placeholder \
    CRM_M2M_SECRET=build-time-placeholder \
    CRM_REFERENCE_CLAIM=account_last4 \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS app
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# `standalone` trae su propio `server.js` y sólo las dependencias que de verdad
# toca. `static` y `public` van aparte porque Next los sirve desde el disco y no
# los mete dentro del bundle.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

# El esquema y su aplicador. **No se ejecutan al arrancar** —ver la cabecera—
# pero tienen que VIAJAR en la imagen: sin ellos, la única forma de migrar la
# base de un despliegue es entrar con un cliente de Postgres desde fuera, y eso
# es justo la operación manual donde se cuela el error que nadie ve.
#
#   node scripts/migrate.mjs      aplica lo pendiente
#   node scripts/seed-customers.mjs   siembra los clientes de prueba
#
# `pg` ya está en `node_modules` porque la aplicación lo usa, así que el
# recorte de `standalone` lo conserva.
COPY --from=build /app/db ./db
COPY --from=build /app/scripts ./scripts

# UNA IMAGEN, UNA INSTALACIÓN POR EMPRESA.
#
# Esta imagen no lleva dentro ninguna organización: toda su identidad sale del
# entorno del contenedor (`CRM_ORG_ID`, `CRM_ORG_DOMAIN`, …). Para servir a dos
# empresas se despliega **la misma imagen dos veces** con dos entornos, dos
# dominios y dos bases. No hay nada que reconstruir entre una y otra.
#
# El documento DID **no es un fichero de `public/`**: lo genera una ruta
# (`src/app/.well-known/did.json/route.ts`) componiéndolo con `CRM_ORG_DOMAIN`,
# así que va dentro del bundle que copia `standalone` y no hay nada que montar.
#
# ⚠ LA ÚNICA VARIABLE OBLIGATORIA ES `DATABASE_URL`.
#
# Todo lo demás —la organización, su dominio, su marca, sus secretos— se escribe
# desde la pantalla `/settings` de la propia instalación y vive en su base. El
# entorno sólo siembra la fila la primera vez. Ver `src/lib/tenant-settings.ts`.

# Sin privilegios. La imagen de node ya trae el usuario `node`.
USER node

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# ─────────────────────────────────────────────────────────────────────────────
#  MIGRA AL ARRANCAR, COMO te-api
#
#  Antes el contenedor arrancaba con la base vacía y la consola enseñaba «no se
#  pudieron leer los ajustes… ejecuta las migraciones». Cierto y bien dicho,
#  pero dejaba una instalación nueva inservible hasta que alguien entrara por
#  una consola de servidor — justo la operación manual que esta pantalla existe
#  para eliminar. Publicar la imagen tiene que bastar.
#
#  Va encadenado con `&&`: si el migrador falla, el proceso NO arranca. Es lo
#  que se quiere. Un CRM sirviendo sobre un esquema a medio aplicar falla más
#  tarde, en una pantalla cualquiera, y con un error que no menciona la base.
#
#  El migrador es idempotente —anota cada `.sql` en `crm_migration` y salta lo
#  aplicado—, así que reiniciar el contenedor cien veces no hace nada la segunda.
# ─────────────────────────────────────────────────────────────────────────────
CMD ["sh", "-c", "node scripts/migrate.mjs && exec node server.js"]
