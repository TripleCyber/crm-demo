import { b2bHeaders, REDACTED_BEARER } from './b2b-http';
import type { CeremonyKind, CeremonySignWith } from './ceremony-catalogue';
import type { CeremonyDraftField } from './ceremony-templates';

/**
 * **El cuerpo de `POST /v1/requests`, compuesto una sola vez.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  LA REGLA ENTERA DE ESTE FICHERO, EN UNA FRASE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **El bloque de código que la pantalla enseña y el cuerpo que sale por el cable
 * son el mismo objeto.** No dos objetos iguales: el mismo. `requestCeremony` lo
 * compone aquí y se lo pasa a `fetch`; el compositor lo compone aquí y lo pinta
 * con `JSON.stringify(…, null, 2)`.
 *
 * Se escribe así porque la alternativa —una pantalla que *describe* la petición
 * con un literal escrito al lado— tiene un fallo que no se ve: **una pantalla
 * que documenta no revienta cuando se queda vieja**. Se sigue pintando, con la
 * forma del mes pasado, y quien la está mirando para integrar copia algo que ya
 * no es verdad. Un campo nuevo en la petición saldría en la pantalla sólo si
 * alguien se acuerda de bajar a tocarla, y nadie se acuerda.
 *
 * Con una sola fuente eso no puede pasar: añadir un campo aquí lo manda **y** lo
 * pinta, y quitarlo lo quita de los dos sitios. Es la misma disciplina con la que
 * te-api compone el enunciado firmable desde la fila y no desde el cuerpo — «no
 * hay una segunda fuente de la que sacar el texto, así que no hay dos textos que
 * puedan separarse».
 *
 * ## Lo único que se separa, y está dicho
 *
 *  · **El sangrado.** Por el cable va compacto (`JSON.stringify(body)`, lo que
 *    hace `fetch`); en pantalla va a dos espacios, porque se lee. Es el mismo
 *    objeto serializado dos veces, no dos cuerpos.
 *  · **El portador.** El bloque lleva `REDACTED_BEARER` en el sitio del token, y
 *    no como una máscara aplicada después: el token de verdad no entra nunca en
 *    lo que se pinta. Ver `./b2b-http.ts`.
 *  · **El `requestUri` antes de mandar.** Sólo lo tienen las ceremonias que
 *    firman con credencial, y **no existe todavía** cuando alguien está mirando
 *    la vista previa: sale de `POST /v1/b2b/presentations`, que se llama un
 *    instante antes. Hasta entonces se pinta un marcador que se lee como lo que
 *    es. Después de mandar, el bloque lo reemplaza el que devuelve el servidor,
 *    que ya lleva la URL de verdad.
 *
 * ## Este módulo es puro
 *
 * Ni `server-only`, ni configuración, ni secretos: el compositor lo llama **en el
 * navegador** para pintar el bloque mientras alguien escribe, y el mismo código
 * lo llama `lib/te-api.ts` en el servidor para mandarlo. Si algún día necesitara
 * leer configuración, deja de poder cumplir su única promesa.
 */

/** El camino de la ruta genérica del marco. Vale para cualquier plantilla. */
export const CEREMONY_REQUEST_PATH = '/v1/requests';

/**
 * Lo que se pinta en el sitio del `requestUri` mientras no existe.
 *
 * Se escribe como una frase y no como una URL de mentira a propósito: una
 * `https://…` inventada en el bloque invita a copiarla, y te-api la aceptaría
 * como destino real de la cartera. Esto no se puede copiar por error.
 */
export const PENDING_REQUEST_URI =
  '<verifier session — POST /v1/b2b/presentations returns it a moment before this call>';

/**
 * Lo que se pinta en el sitio de la referencia mientras no exista.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  LA REFERENCIA LA EMITE LA ORGANIZACIÓN, NO EL NAVEGADOR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `reference` es **el número de expediente de quien pregunta**: te-api no lo
 * mira, no lo valida contra nada y lo devuelve verbatim en `request.answered`.
 * Su razón de ser es que el socio pueda atar la respuesta a una fila de *su*
 * sistema sin guardar una tabla de equivalencias con los identificadores de
 * te-api. Dos identificadores, dos dueños: el `requestId` nombra la ceremonia y
 * es de te-api; la referencia nombra el caso y es de la organización.
 *
 * Y por eso se acuña **en el servidor**, en el mismo sitio que manda la
 * petición, y no aquí ni en el navegador. Dos motivos y los dos se ven:
 *
 *  · La emite el sistema de la organización. Un número de expediente que elige
 *    la pestaña del agente no es el número de expediente de nadie.
 *  · Tiene que ser distinto en cada envío. El compositor deja mandar la misma
 *    ceremonia otra vez sin desmontarse, así que un valor acuñado al abrir la
 *    ficha volvería a salir en el segundo envío con el mismo número.
 *
 * Se escribe como frase y no como una referencia de mentira por lo mismo que el
 * `requestUri`: un `CASE-…` inventado en el bloque invita a copiarlo, y te-api
 * lo aceptaría tal cual — quedaría un expediente que no es de nadie atado a una
 * firma de verdad. Después de mandar, el bloque enseña el que salió.
 */
export const PENDING_ASKER_REFERENCE =
  '<your own case number — this console mints one per request; see mintAskerReference>';

/**
 * El alfabeto de la cola: **Crockford base32**, sin `I`, `L`, `O` ni `U`.
 *
 * Sin las cuatro porque esto se dicta por teléfono y se teclea en un buscador:
 * el `1` y la `I` son el mismo garabato y el `0` y la `O` también. La `U` se
 * cae en Crockford para no componer palabras que nadie quiere leer en un
 * expediente.
 */
const REFERENCE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * **Acuña una referencia de expediente.** `CASE-20260905-7K3QF2`.
 *
 * Con la forma con la que numera una entidad y no con la de un identificador de
 * máquina, que es el punto: quien mira esta demostración tiene que distinguir de
 * un vistazo cuál de los dos identificadores es suyo y cuál es de TripleEnable.
 * Otro UUID al lado del `requestId` no enseña nada — enseña dos cadenas iguales.
 *
 * La fecha delante porque así se ordena y se busca, y seis caracteres de azar
 * detrás porque una entidad de verdad numeraría por contador y esta consola no
 * tiene ninguno que compartan sus réplicas. Treinta y dos elevado a seis es
 * suficiente para un día de peticiones de una demostración; no es una clave y no
 * se usa para autorizar nada.
 */
export function mintAskerReference(now: Date = new Date()): string {
  const day = now.toISOString().slice(0, 10).replace(/-/gu, '');
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const tail = Array.from(bytes, (byte) => REFERENCE_ALPHABET[byte % 32] ?? '0').join('');
  return `CASE-${day}-${tail}`;
}

/**
 * Lo que hace falta para componer una petición del marco.
 *
 * Vivía en `lib/te-api.ts` y se mudó aquí con el cuerpo: el tipo y el
 * constructor tienen que estar juntos o alguien acabará componiendo el cuerpo en
 * otro sitio a partir del tipo.
 */
export interface CeremonyRequestInput {
  readonly subjectReference: string;
  readonly kind: CeremonyKind;
  readonly signWith: CeremonySignWith;
  /** Obligatorio con `signWith: 'credential'`, y prohibido con `identity`. */
  readonly credentialType?: string;
  /**
   * **El número de expediente de quien pregunta.** te-api no lo mira y lo
   * devuelve verbatim en `request.answered`. Ver `PENDING_ASKER_REFERENCE`.
   *
   * Opcional en el tipo porque el compositor pinta la vista previa sin él —no
   * existe todavía— y porque un socio puede legítimamente no mandar ninguno.
   * En lo que sale de esta consola por el cable **siempre va uno**: lo acuña
   * `requestCeremony` si el llamante no trae el suyo.
   */
  readonly reference?: string;
  /** El nombre con el que la plantilla viaja: `doc.sign.v1`. */
  readonly template: string;
  /** La sesión del verificador, cuando la ceremonia tiene una. */
  readonly requestUri?: string;
  readonly fields: readonly CeremonyDraftField[];
}

/**
 * El cuerpo, tal cual viaja. **El orden de las claves es el orden del bloque**,
 * porque es el mismo objeto: lo que se lee en pantalla es lo que se serializa.
 */
export interface CeremonyRequestBody {
  readonly subjectReference: string;
  readonly kind: CeremonyKind;
  readonly signWith: CeremonySignWith;
  readonly credentialType?: string;
  readonly reference?: string;
  readonly requestUri?: string;
  readonly template: string;
  readonly fields: readonly {
    readonly key: string;
    readonly label: string;
    readonly value: string;
    readonly sub?: string;
    readonly type: 'text' | 'mono' | 'numeric';
    readonly style: 'hero' | 'normal' | 'quiet';
  }[];
}

/**
 * Compone el cuerpo. **Es la única función de este repositorio que lo hace.**
 *
 * Los opcionales se **omiten** en vez de mandarse a `null`, que no es un detalle
 * de estilo: te-api rechaza `credentialType` junto a `signWith: 'identity'` por
 * su propio `superRefine`, y un `null` explícito no pasa su `z.string()`. Lo
 * mismo con `sub`, que la mayoría de los campos no llevan.
 *
 * Los campos se vuelven a construir uno a uno en vez de pasarse tal cual: lo que
 * llega puede traer propiedades de más —el catálogo de casos no tiene por qué
 * parecerse al cuerpo de la ruta— y lo que sale tiene que ser exactamente lo que
 * el esquema de te-api declara. Copiar el objeto entero mandaría a la puerta B2B
 * lo que alguien añadiera aquí para pintar la pantalla.
 */
export function buildCeremonyRequestBody(input: CeremonyRequestInput): CeremonyRequestBody {
  return {
    subjectReference: input.subjectReference,
    kind: input.kind,
    signWith: input.signWith,
    ...(input.credentialType === undefined ? {} : { credentialType: input.credentialType }),
    // Justo detrás de a quién se pregunta y de qué se ejecuta, que es donde se
    // lee: las tres primeras claves dicen **de quién es esta petición** —el
    // titular, la ceremonia, y ahora el expediente de quien la manda— antes de
    // que empiecen los detalles del transporte.
    ...(input.reference === undefined ? {} : { reference: input.reference }),
    ...(input.requestUri === undefined ? {} : { requestUri: input.requestUri }),
    template: input.template,
    fields: input.fields.map((field) => ({
      key: field.key,
      label: field.label,
      value: field.value,
      ...(field.sub === undefined || field.sub === '' ? {} : { sub: field.sub }),
      type: field.type,
      style: field.style,
    })),
  };
}

/** Una petición HTTP entera, lista para mandar y lista para pintar. */
export interface CeremonyHttpRequest {
  readonly method: 'POST';
  /** La URL completa, con la base del verificador de esta organización. */
  readonly url: string;
  /** Las cabeceras que compone `callB2b`, con el portador tapado. */
  readonly headers: Readonly<Record<string, string>>;
  /** El cuerpo. Ver la cabecera: es **el objeto que se serializa**. */
  readonly body: CeremonyRequestBody;
}

/**
 * La petición entera. La usan las dos puntas:
 *
 *  · el compositor, en el navegador, para pintar el bloque mientras se escribe;
 *  · la acción de servidor, para enseñar **lo que mandó** después de mandarlo.
 *
 * `baseUrl` es `organization.verifierUrl` y no la de emitir, por lo mismo que en
 * `requestPresentation`: hoy son la misma base y el contrato las declara por
 * separado justo para que un día se puedan separar. No es un secreto —es la
 * dirección pública de te-api— así que baja al navegador sin problema.
 */
export function buildCeremonyHttpRequest(
  baseUrl: string,
  input: CeremonyRequestInput,
): CeremonyHttpRequest {
  return {
    method: 'POST',
    url: `${baseUrl}${CEREMONY_REQUEST_PATH}`,
    // Con el portador tapado desde el principio. Ver `./b2b-http.ts`.
    headers: b2bHeaders(REDACTED_BEARER, true),
    body: buildCeremonyRequestBody(input),
  };
}

/**
 * La petición escrita como se escribe una petición HTTP, para copiarla y pegarla.
 *
 * Sale de la misma estructura y no de un texto compuesto aparte, así que una
 * cabecera nueva aparece aquí sola. El cuerpo va a dos espacios porque esto se
 * lee; por el cable va compacto, que es lo que hace `fetch`.
 */
export function formatCeremonyHttpRequest(request: CeremonyHttpRequest): string {
  const head = `${request.method} ${request.url}`;
  const headers = Object.entries(request.headers).map(([name, value]) => `${name}: ${value}`);
  return [head, ...headers, '', JSON.stringify(request.body, null, 2)].join('\n');
}
