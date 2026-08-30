/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ya hay Dockerfile, así que esto entra: `standalone` produce un
  // `.next/standalone/server.js` con **sólo** las dependencias que el servidor
  // toca de verdad, y la imagen pasa de arrastrar `node_modules` entero a
  // llevar unas decenas de megas. Es lo mismo que hace `tenant-admin`.
  //
  // Consecuencia que hay que saber: con esto puesto, `next start` avisa de que
  // no es la forma de arrancar. En desarrollo se usa `next dev`, que no se
  // entera; en la imagen se llama a `server.js` directamente.
  output: 'standalone',

  // Sin `env:` ni `NEXT_PUBLIC_*` para nada de esto. El secreto M2M y el
  // `client_id` se leen SÓLO en código de servidor (`src/lib/organizations.ts`,
  // que además es `import 'server-only'`), y ese fichero no puede entrar en el
  // bundle del navegador ni por accidente.

  // El indicador de desarrollo de Next se pone abajo a la izquierda por
  // defecto, que es justo donde la barra lateral enseña **quién es el agente**:
  // tapaba el nombre y el número que el titular va a ver en su móvil. Sólo se
  // pinta en `next dev`, pero es en `next dev` donde se hacen las capturas que
  // mira alguien de fuera.
  devIndicators: { position: 'bottom-right' },
};

export default nextConfig;
