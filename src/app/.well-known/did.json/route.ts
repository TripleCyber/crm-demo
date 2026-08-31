import { NextResponse } from 'next/server';

import { resolveDidDocument } from '@/lib/did-document';
import { getOrganization, OrganizationConfigError } from '@/lib/organization';

/**
 * `GET /.well-known/did.json` — **la mitad pública de la identidad del emisor**.
 *
 * Cuando la cartera recibe una credencial cuyo `iss` es
 * `did:web:bank.demo-te.com`, compone
 * `https://bank.demo-te.com/.well-known/did.json`, se lo descarga, saca de ahí
 * la clave pública y con ella comprueba la firma. Sin este documento **la
 * cartera rechaza la credencial**, y no por un fallo: se comprobó leyendo su
 * código —`IssuerKeys.kt` compone esa URL, un fallo de red se convierte en
 * `ISSUER_UNREACHABLE`, `CredentialTrust` devuelve `Err` y `acceptOffer` corta
 * en el paso 2, antes de guardar nada. «No pude comprobarlo» se trata como «no».
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  EL `Host` YA NO PINTA NADA AQUÍ, Y ÉSA ES LA SIMPLIFICACIÓN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Esta ruta existe porque `public/` se sirve por camino y no por `Host`: con
 * cuatro dominios apuntando al mismo despliegue, un fichero estático salía igual
 * en los cuatro y `did:web:seguros.demo-te.com` resolvía a un documento que
 * decía `id: did:web:bank.demo-te.com`. La ruta buscaba entonces la organización
 * del `Host` y devolvía 404 para un host que no era de nadie, porque servir el
 * documento del banco «por defecto» habría publicado su identidad en el dominio
 * de cualquiera que apuntase un DNS aquí.
 *
 * **Con una instalación por empresa ese peligro no existe**, y conviene decir
 * por qué en vez de dejarlo a la fe: el documento se compone SIEMPRE con
 * `CRM_ORG_DOMAIN`, así que su `id` es el mismo DID diga lo que diga la
 * petición. Alguien que apunte `evil.com` a esta máquina y publique
 * `did:web:evil.com` consigue que la cartera se descargue un documento cuyo `id`
 * es `did:web:bank.demo-te.com` — y la cartera lo rechaza, porque no es el DID
 * que resolvió. No hay nada que un `Host` pueda hacer aquí.
 *
 * Lo que se gana a cambio de quitar esa comprobación es que **el documento se
 * puede pedir desde cualquier sitio**: `curl` contra la IP del contenedor, la
 * comprobación de salud, `localhost:3000` en desarrollo. Antes todo eso daba 404
 * y parecía un fallo de configuración.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  LAS CLAVES SALEN DE te-api, Y ESTA RUTA NO PUEDE FALLAR POR ELLO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * El contenido lo resuelve `resolveDidDocument`, que pregunta a te-api
 * (`GET /v1/trust/did-documents/:host`) y cachea lo que diga. El porqué largo
 * está en `@/lib/did-document.ts`; lo que hay que saber aquí es que esa función
 * **no lanza nunca**. Un 500 en esta ruta rompería la verificación de todas las
 * credenciales ya emitidas de este dominio, así que no hay ningún camino que
 * dependa de que te-api esté en pie.
 *
 * **Y si te-api no tiene claves para esta organización, 404.** No es un error
 * que haya que tapar: significa que esta empresa todavía no ha encendido su
 * emisión y por tanto no tiene identidad de emisor que publicar. Un documento
 * con la lista vacía la cartera lo daría por bueno y diría «no publica claves»,
 * que suena a error suyo; el 404 dice lo que pasa.
 *
 * ## Y tiene que servirse con TLS bueno
 *
 * `https://<dominio>/.well-known/did.json`, **sin `-k`**. La cartera usa la pila
 * TLS del sistema; un certificado que `curl` no acepta tampoco lo acepta el
 * teléfono. El DNS de `demo-te.com` es comodín, pero **Coolify emite el
 * certificado por dominio la primera vez que se declara**: un subdominio sin
 * declarar resuelve y no tiene certificado. Eso es de Coolify, no de aquí.
 */

export const runtime = 'nodejs';
// Sin esto Next lo resolvería en la construcción, cuando `CRM_ORG_DOMAIN` puede
// no estar puesta todavía: el documento saldría fijado —o el arranque fallaría—
// en lugar de componerse con el entorno del proceso que sirve.
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  let organization;
  try {
    organization = getOrganization();
  } catch (error) {
    // Si la configuración no se puede leer, este documento no se puede componer.
    // Se contesta 500 y **no** un 404: son dos cosas distintas para quien opera
    // —«aquí no hay identidad todavía» frente a «esto está roto»— aunque la
    // cartera trate las dos igual.
    if (error instanceof OrganizationConfigError) {
      return notAvailable(500, 'configuration_error');
    }
    throw error;
  }

  const resolved = await resolveDidDocument(organization);

  if (resolved === null) {
    return notAvailable(404, 'not_found');
  }

  return NextResponse.json(resolved.document, {
    headers: {
      // `NextResponse.json` ya pone `application/json`, pero se deja escrito: sin
      // este `content-type` el documento no resuelve, y es lo primero que
      // rompería si alguien cambiara la forma de responder.
      'content-type': 'application/json; charset=utf-8',
      // Cinco minutos cuando las claves vienen de te-api. Es un documento que
      // casi nunca cambia y que la cartera pide en cada verificación, pero
      // cuando cambia —una rotación— hay credenciales que dejan de verificar
      // mientras dure la caché: cinco minutos es poco para una rotación y mucho
      // para el tráfico.
      //
      // Un minuto cuando NO vienen de te-api, y ése es el motivo de que haya dos
      // números. Un documento servido de la caché puede estar **de menos**: le
      // faltaría una clave nueva si te-api la tuviera y no hubiera podido
      // decirlo. Fijar eso cinco minutos en cada caché intermedia alarga el hueco
      // justo en el caso en el que ya vamos ciegos.
      'cache-control': resolved.source === 'te-api' ? 'public, max-age=300' : 'public, max-age=60',
      // ── De dónde salió esto ────────────────────────────────────────────
      //
      // Los dos casos producen un 200 con un documento de aspecto impecable, y lo
      // único que los distingue es qué claves lleva dentro. Sin estas tres
      // cabeceras, «¿por qué no verifica esta credencial?» se contesta
      // adivinando; con ellas, un `curl -I` lo dice.
      //
      // Van en cabecera y NO dentro del documento a propósito: el cuerpo es un
      // documento DID y su forma la fija la especificación. Un campo nuestro ahí
      // dentro es un campo que algún resolvedor estricto puede rechazar, y el
      // precio de equivocarse es que la cartera no verifique nada.
      'x-te-did-source': resolved.source,
      'x-te-did-keys': String(resolved.keyCount),
      'x-te-did-age': String(resolved.ageSeconds),
    },
  });
}

/**
 * La respuesta cuando no hay documento, en JSON.
 *
 * En JSON y no vacía porque quien se encuentra esto depurando ha pedido un
 * `.json` y merece leer algo.
 */
function notAvailable(status: number, error: string): NextResponse {
  return NextResponse.json(
    { error },
    { status, headers: { 'content-type': 'application/json; charset=utf-8' } },
  );
}
