import 'server-only';

/**
 * El documento DID que cada organización publica en `/.well-known/did.json`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  LAS TRES ORGANIZACIONES PUBLICAN LAS MISMAS CLAVES. NO ES UNA ERRATA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Parece mal y es lo correcto. Bajo **custodia gestionada**
 * (`docs/fases/CUSTODIA.md` §1) quien firma es NUESTRO emisor, con NUESTRA
 * clave, en nombre del partner: la credencial sale con
 * `iss = did:web:<el del partner>` y `kid = did:web:<el del partner>#<nuestra
 * clave>`. Para que la cartera pueda resolver ese `kid` tiene que encontrarlo
 * en el documento del partner, así que el documento del partner **publica las
 * nuestras**. El `did:web` dice *quién emite*, no *quién guarda la llave*.
 *
 * O sea: los tres documentos son el mismo con el dominio cambiado, y por eso
 * aquí hay una plantilla y no tres ficheros. Con tres ficheros, rotar una clave
 * son tres ediciones y olvidarse de una no rompe nada visible — hasta que una
 * cartera concreta no puede verificar una credencial concreta.
 *
 * Que la **clave privada** siga siendo nuestra es otra cosa, y está anotada
 * como deuda en `CUSTODIA.md`. El documento DID es el primer paso de
 * separarlas: la identidad ya es del partner aunque la llave todavía no.
 *
 * ## Por qué hay DOS claves
 *
 * Una lista con varias no es un descuido: **es cómo se rota una clave**.
 * Durante la rotación las dos tienen que valer, o toda credencial firmada con
 * la vieja deja de verificar de golpe.
 *
 * | `kid` | Cuál es |
 * |---|---|
 * | `ThFQ5nNq…` | El emisor **desplegado** (`waltid-issuer2` en Coolify). Es la que firma en producción; se contrasta en `https://issuer.idp.tripleenable.com/openid4vci/jwks` |
 * | `_BjP-HuMgg…` | El emisor **local de desarrollo**, para poder probar el recorrido entero contra una máquina sin tocar el despliegue |
 *
 * La segunda se quita el día que el recorrido de desarrollo deje de
 * necesitarla. Mientras esté, quien levante un emisor local con OTRAS claves
 * tiene que añadir la suya aquí, o la cartera rechazará sus credenciales con
 * `CREDENTIAL_ISSUER_UNRESOLVED`.
 *
 * ## Tres avisos que ahorran un ciclo de depuración
 *
 * - **Nunca la parte privada.** Un JWK con `d` publicado aquí regala la
 *   capacidad de emitir en nombre de las tres organizaciones. Sólo van `kty`,
 *   `crv`, `x`, `y`, `kid`, `alg` y `use`.
 * - **El JWK tiene que llevar `y`.** La cartera exige los dos componentes de
 *   una clave EC (`Jwk.kt`) y **descarta en silencio** la que no lo traiga; el
 *   síntoma es `NO_PUBLISHED_KEY`, que no se parece a «te falta un campo». Un
 *   punto comprimido —sólo `x`— no vale.
 * - **El `id` de cada método termina en el mismo `kid`** que lleva la cabecera
 *   del JWT: es por ahí por donde la cartera elige cuál de las claves usar.
 *
 * El contenido se contrastó carácter a carácter con los documentos de
 * `docs/fases/F1-ALTA-MANUAL.md` §8 y con el estático que servía Banco Demo.
 */

/** Un JWK público de firma, tal y como se publica. Nunca lleva `d`. */
interface PublicJwk {
  readonly kty: 'EC';
  readonly crv: 'P-256';
  readonly x: string;
  readonly y: string;
  readonly kid: string;
  readonly alg: 'ES256';
  readonly use: 'sig';
}

/**
 * Las claves públicas de nuestro emisor, que es quien firma por los tres.
 *
 * Están escritas y no leídas de ninguna parte a propósito: son material
 * público, y sacarlas de una variable de entorno pondría el documento DID
 * —lo que hace verificable cada credencial ya emitida— a merced de una consola
 * de despliegue. Rotarlas es un cambio de código que alguien revisa.
 */
const PUBLISHED_KEYS: readonly PublicJwk[] = [
  {
    kty: 'EC',
    crv: 'P-256',
    x: 'ssRLxTmTBJZOVnf3jh3auwkm0zdx-T_pfSdCrDaJxXg',
    y: 'PD3NYSiQuHxuoUhOB3gepbRr9VJ0KIo_XtA0sJRv4eU',
    kid: 'ThFQ5nNqT72Ak8kl7BMjZ_NkpzgYt5wK95TyNSJqZGg',
    alg: 'ES256',
    use: 'sig',
  },
  {
    kty: 'EC',
    crv: 'P-256',
    x: 'mkrc7lSpFaXK-3RUYwGhBJ4rDheZkatgU_QqW3EK4fA',
    y: 'mU1vMjjIkPegviqv771OQRIZ68UvLF6r7hQEbwfofbY',
    kid: '_BjP-HuMggbMxvtbMYrMNqoTfAbMr8ubLZauzwTXzzY',
    alg: 'ES256',
    use: 'sig',
  },
];

/**
 * El documento DID de una organización, a partir de **su dominio declarado**.
 *
 * El dominio entra por parámetro y sale de `CRM_ORG_<SLUG>_DOMAIN`, nunca de la
 * cabecera `Host`: la ruta busca primero qué organización vive en ese host y
 * después compone con lo que esa organización tiene declarado. Si se compusiera
 * con el `Host`, cualquiera que apuntase un DNS a esta máquina se fabricaría un
 * `did:web` en su dominio respaldado por nuestras claves.
 */
export function buildDidDocument(domain: string): Record<string, unknown> {
  const did = `did:web:${domain}`;
  const methodIds = PUBLISHED_KEYS.map((key) => `${did}#${key.kid}`);

  return {
    '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/suites/jws-2020/v1'],
    id: did,
    verificationMethod: PUBLISHED_KEYS.map((key, index) => ({
      id: methodIds[index],
      type: 'JsonWebKey2020',
      controller: did,
      publicKeyJwk: key,
    })),
    // Las dos listas nombran las mismas claves, y las dos hacen falta:
    // `assertionMethod` es con lo que se firma una credencial y
    // `authentication` con lo que el sujeto demuestra control del DID. Un
    // documento con una sola de las dos verifica en unas carteras y no en
    // otras, que es el peor de los fallos posibles aquí.
    assertionMethod: methodIds,
    authentication: methodIds,
  };
}

/** El `did:web` de un dominio. Una sola función para no escribirlo dos veces. */
export function didWebOf(domain: string): string {
  return `did:web:${domain}`;
}
