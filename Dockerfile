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
ENV CRM_ACTIVE_ORG_ID=build-time-placeholder \
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

# `public/.well-known/did.json` viaja aquí dentro: es el documento DID de
# `did:web:bank.demo-te.com`, y sin él la cartera rechaza las credenciales que
# emite este banco. Va con la imagen y no montado aparte para que desplegar y el
# contenido sean la misma operación.

# Sin privilegios. La imagen de node ya trae el usuario `node`.
USER node

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/organization').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
