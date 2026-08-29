/** @type {import('next').NextConfig} */
const nextConfig = {
  // `output: 'standalone'` está a propósito SIN poner. Es lo que quiere la
  // imagen de despliegue —`tenant-admin` lo lleva por eso—, pero aquí todavía
  // no hay Dockerfile, y con él puesto `next start` avisa de que no es la forma
  // de arrancar y hay que llamar a `.next/standalone/server.js`. Un aviso que
  // no aplica todavía sólo enseña a ignorar los avisos. Se pone el día que
  // entre el Dockerfile, en el mismo cambio.

  // Sin `env:` ni `NEXT_PUBLIC_*` para nada de esto. El secreto M2M y el
  // `client_id` se leen SÓLO en código de servidor (`src/lib/organizations.ts`,
  // que además es `import 'server-only'`), y ese fichero no puede entrar en el
  // bundle del navegador ni por accidente.
};

export default nextConfig;
