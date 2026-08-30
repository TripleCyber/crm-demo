import { NextResponse } from 'next/server';

import { buildDidDocument } from '@/lib/did-document';
import { findOrganizationByHost, OrganizationConfigError } from '@/lib/organizations';

/**
 * `GET /.well-known/did.json` — **la mitad pública de la identidad del emisor**.
 *
 * Cuando la cartera recibe una credencial cuyo `iss` es
 * `did:web:seguros.demo-te.com`, compone
 * `https://seguros.demo-te.com/.well-known/did.json`, se lo descarga, saca de
 * ahí la clave pública y con ella comprueba la firma. Sin este documento **la
 * cartera rechaza la credencial**, y no por un fallo: se comprobó leyendo su
 * código —`IssuerKeys.kt` compone esa URL, un fallo de red se convierte en
 * `ISSUER_UNREACHABLE`, `CredentialTrust` devuelve `Err` y `acceptOffer` corta
 * en el paso 2, antes de guardar nada. «No pude comprobarlo» se trata como
 * «no».
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  POR QUÉ ESTO ES UNA RUTA Y YA NO UN FICHERO DE `public/`
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Hasta el 2026-08-30 era `public/.well-known/did.json`, un estático con el
 * documento de Banco Demo. Funcionaba porque había un dominio. Ahora hay tres
 * apuntando **a este mismo despliegue**, y `public/` se sirve por camino, no
 * por `Host`: el mismo fichero salía en los tres, de modo que
 * `did:web:seguros.demo-te.com` resolvía a un documento que dice
 * `id: did:web:bank.demo-te.com`. La cartera lo rechaza —el `id` no es el DID
 * que pidió— y las credenciales de las otras dos organizaciones no verifican.
 *
 * Se descartaron las dos alternativas:
 *
 *  · **Un fichero por organización.** `public/` no distingue por `Host`, así
 *    que haría falta igualmente un intermediario que reescribiera el camino. Y
 *    deja las claves copiadas tres veces: rotar una son tres ediciones, y
 *    olvidarse de una no rompe nada visible hasta que una cartera concreta no
 *    puede verificar una credencial concreta.
 *  · **Un intermediario (`middleware`) que reescriba por `Host`.** Es la misma
 *    lógica corriendo en cada petición del sitio, para tres ficheros que siguen
 *    triplicando las claves.
 *
 * La ruta deja **una** copia de las claves (`@/lib/did-document.ts`), compone
 * el resto a partir del dominio declarado de cada organización, y convierte el
 * 404 del host desconocido en una línea explícita en vez de en la consecuencia
 * accidental de que falte un fichero.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  UN HOST QUE NO ES DE NADIE DEVUELVE 404. NUNCA EL DOCUMENTO DE OTRO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Es el requisito que gobierna este fichero. Servir el documento de Banco Demo
 * «por defecto» sería publicar su identidad en un dominio que no le
 * corresponde: quien apuntase un DNS a esta máquina tendría un `did:web` en su
 * dominio respaldado por nuestras claves, y una credencial firmada por nosotros
 * verificaría contra él. Un 404 dice la verdad —aquí no vive ninguna
 * organización— y la cartera lo trata como lo que es: no puedo comprobarlo,
 * luego no.
 *
 * Y el `Host` **no compone el documento**: sólo se busca en la lista cerrada de
 * dominios declarados, y lo que se publica es el dominio que esa organización
 * tiene en `CRM_ORG_<SLUG>_DOMAIN`.
 *
 * ## Y tiene que servirse con TLS bueno
 *
 * `https://<dominio>/.well-known/did.json`, **sin `-k`**. La cartera usa la
 * pila TLS del sistema; un certificado que `curl` no acepta tampoco lo acepta
 * el teléfono. El DNS de `demo-te.com` es comodín, pero **Coolify emite el
 * certificado por dominio la primera vez que se declara**: un subdominio sin
 * declarar resuelve y no tiene certificado. Eso es de Coolify, no de aquí.
 */

export const runtime = 'nodejs';
// Sin esto Next lo resolvería en la construcción, con un `Host` que no existe:
// el documento saldría fijado al de una organización —o a un 404— y el mismo
// cuerpo se serviría en los tres dominios. Es exactamente el fallo del que se
// viene.
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  // El `Host` se lee de la petición y no de `headers()` porque aquí ya está
  // delante; el orden es el mismo que en `@/lib/request-organization.ts`:
  // `x-forwarded-host` primero, que es lo que pone el proxy de Coolify.
  const host =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? undefined;

  let organization;
  try {
    organization = findOrganizationByHost(host);
  } catch (error) {
    // Si la configuración de organizaciones no se puede leer, este documento no
    // se puede componer. Se contesta 500 y **no** un 404: son dos cosas
    // distintas para quien opera —«aquí no vive nadie» frente a «esto está
    // roto»— aunque la cartera trate las dos igual.
    if (error instanceof OrganizationConfigError) {
      return notAvailable(500, 'configuration_error');
    }
    throw error;
  }

  // Ni organización en ese host, ni organización sin dominio declarado. Las dos
  // son «aquí no hay ningún DID que publicar», y las dos contestan lo mismo:
  // distinguirlas en la respuesta diría desde fuera qué dominios están
  // declarados en este despliegue.
  if (organization?.domain === undefined) {
    return notAvailable(404, 'not_found');
  }

  return NextResponse.json(buildDidDocument(organization.domain), {
    headers: {
      // `NextResponse.json` ya pone `application/json`, pero se deja escrito:
      // sin este `content-type` el documento no resuelve, y es lo primero que
      // rompería si alguien cambiara la forma de responder.
      'content-type': 'application/json; charset=utf-8',
      // Cinco minutos. Es un documento que casi nunca cambia y que la cartera
      // pide en cada verificación, pero cuando cambia —una rotación de clave—
      // hay credenciales que dejan de verificar mientras dure la caché. Cinco
      // minutos es poco para una rotación y mucho para el tráfico.
      'cache-control': 'public, max-age=300',
    },
  });
}

/**
 * La respuesta cuando no hay documento, en JSON.
 *
 * En JSON y no vacía porque quien se encuentra esto depurando ha pedido un
 * `.json` y merece leer algo; y con el mismo cuerpo para los dos motivos que
 * llevan al 404, para no convertir esta ruta en una forma de enumerar qué
 * dominios sirve este despliegue.
 */
function notAvailable(status: number, error: string): NextResponse {
  return NextResponse.json(
    { error },
    { status, headers: { 'content-type': 'application/json; charset=utf-8' } },
  );
}
