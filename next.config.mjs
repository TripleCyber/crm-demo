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
};

export default nextConfig;
