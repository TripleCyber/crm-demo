import type { CeremonyFieldStyle, CeremonyKind, CeremonySignWith } from './ceremony-catalogue';

/**
 * **El catálogo de plantillas de te-api, copiado aquí para poder enseñarlo.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ESTO ES UN ESPEJO, Y HAY QUE DECIRLO EN LA PRIMERA LÍNEA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La tabla de verdad vive en `tripleenable-api/src/requests/catalog.ts` y es la
 * única que decide: te-api valida contra ella, clava su revisión en
 * `te.request.template_version` y compone con ella el texto que la persona firma.
 * Este fichero **no valida nada en producción** — valida lo que se va a mandar
 * *antes* de mandarlo, que es otra cosa.
 *
 * ## Por qué se copia en vez de preguntarla
 *
 * Porque no hay ruta que la publique. `POST /v1/requests` contesta con la
 * revisión **después** de aceptar, y esta pantalla necesita saber qué claves son
 * obligatorias **mientras alguien las escribe**. Las dos salidas eran copiar la
 * tabla o mandar peticiones a ciegas y aprender del 400; la segunda le enseña al
 * cliente un error donde tendría que ver una pantalla.
 *
 * ## Y cómo se sabe que la copia no ha envejecido
 *
 * **Por la respuesta.** `POST /v1/requests` devuelve `template` y
 * `templateVersion` tal y como los fijó el catálogo de te-api, y esta pantalla
 * los enseña al lado de la revisión que creía tener. Si difieren, se ve — que es
 * exactamente el trato: la copia puede quedarse vieja, lo que no puede es
 * quedarse vieja **en silencio**.
 *
 * Lo que además no puede pasar, y por eso este espejo es seguro de tener: que
 * esta copia deje pasar algo que te-api rechaza. Si lo dejara, sale un 400 con
 * su motivo —`missing_required_field:document`, `hero_not_allowed:parties`— y la
 * pantalla lo enseña tal cual. El espejo evita el viaje; no lo sustituye.
 *
 * ## Los textos de aquí no pasan por i18n
 *
 * `statement` es **la frase que la persona firma** y `askerMustShow` es la
 * obligación que te-api le escribe al integrador: las dos nacen en inglés allí
 * (`CLAUDE.md §5`) y traducirlas aquí produciría una segunda versión de un texto
 * de contrato, que es peor que no tenerlo. Se citan, no se traducen. Los rótulos
 * de la consola que las envuelven sí pasan por i18n, como el resto de la
 * pantalla.
 */

/** El tope de campos. El mismo que `MAX_FIELDS` en te-api y el del motor. */
export const MAX_CEREMONY_FIELDS = 12;

/**
 * La forma de una clave, la misma que `FIELD_KEY_SHAPE` en te-api.
 *
 * Minúsculas, dígitos y guiones bajos. No es cosmética: la clave es el nombre
 * con el que la respuesta firmada dice **sobre qué** se firmó, y ahí no cabe un
 * párrafo.
 */
export const CEREMONY_FIELD_KEY_SHAPE = /^[a-z][a-z0-9_]{0,63}$/u;

/** Los topes de `requestField` en el esquema de `POST /v1/requests`. */
export const CEREMONY_LIMITS = {
  key: 64,
  label: 120,
  value: 512,
  /**
   * La segunda línea. **El tope es el del rótulo y no el del valor**, y es a
   * propósito: es una línea de pantalla que califica el valor de encima —«Version
   * 4 · 18 pages»—, no el dato.
   */
  sub: 120,
} as const;

/** Una entrada del catálogo, tal y como la publica te-api. */
export interface CeremonyTemplate {
  /** `doc.sign.v1`. Es lo que la cartera enruta. */
  readonly id: string;
  /** Qué ejecuta te-api. Eje aparte de `signWith`. */
  readonly kinds: readonly CeremonyKind[];
  /** Qué prueba admite. `credential` no excluye a `identity` en te-api. */
  readonly signWith: readonly CeremonySignWith[];
  /**
   * La única clave que puede llevar `style: 'hero'`, o `null` si la plantilla no
   * tiene héroe.
   *
   * Tres no lo tienen y ninguna por descuido: en `account.change.v1` y
   * `custody.handover.v1` la decisión es **un par** —el valor viejo contra el
   * nuevo, de quién a quién— y coronar un lado esconde el otro; en
   * `agent.identify.v1` lo que sostiene la pantalla no es un dato de la petición
   * sino lo que comprobó el teléfono, y eso no viaja por el cable.
   */
  readonly hero: string | null;
  /**
   * Las claves que **tienen que venir**. Incluyen el héroe si lo hay.
   *
   * Son también las únicas que pueden traer segunda línea (`sub`), porque son
   * las que la plantilla saca del bloque de pares y lee por su nombre.
   */
  readonly required: readonly string[];
  /**
   * Las que la plantilla **conoce**, que no es la lista de las que acepta: el
   * vocabulario es abierto y una clave no declarada entra como par genérico.
   * Declararla sólo añade que la plantilla la coloque en su sitio.
   */
  readonly optional: readonly string[];
  /**
   * Lo que quien pregunta tiene que enseñar **en su propia pantalla**, o `null`.
   *
   * Es documentación y no una verja: te-api no puede comprobar lo que pinta el
   * portal de un socio. Se enseña aquí porque tres de estas plantillas no
   * significan nada sin ello —una huella que sólo se ve en el teléfono es un
   * número bonito—, y lo caro no es leerlo: es descubrir en producción que se
   * implementó media ceremonia.
   */
  readonly askerMustShow: string | null;
  /**
   * Si sólo la puede crear la costura interna de te-api.
   *
   * Una sola: `auth.signin.v1`. Una petición de acceso **abre una sesión**, y eso
   * es un acto del emisor de identidad —Logto con te-api detrás—, no de un socio
   * del padrón. `POST /v1/requests` la rechaza con el mismo `invalid_request` que
   * una plantilla inexistente, así que un caso del catálogo que la nombre **no se
   * puede mandar** y la ficha lo dice antes de que nadie pulse.
   */
  readonly internal: boolean;
  /** La revisión vigente según esta copia. La de verdad la contesta te-api. */
  readonly version: number;
  /**
   * La frase que la persona firma, con sus marcadores sin resolver.
   *
   * `{asker}` es el nombre del socio **copiado del token**, y `{field.<clave>}`
   * el valor de esa clave. Sólo puede nombrar claves obligatorias: un marcador
   * sobre una clave que puede faltar es un agujero en un texto que alguien firma.
   */
  readonly statement: string;
}

/**
 * La tabla. Catorce entradas, las mismas que `SPECS` en te-api y en su orden.
 *
 * Se escribe entera aunque el catálogo de casos use trece: la que falta hoy es
 * la que usa el caso de mañana, y una entrada ausente sale como «plantilla
 * desconocida» en una pantalla que existe para explicar el marco.
 */
export const CEREMONY_TEMPLATES: readonly CeremonyTemplate[] = [
  {
    id: 'auth.signin.v1',
    kinds: ['authenticate'],
    signWith: ['identity'],
    hero: 'destination',
    required: ['destination'],
    optional: ['account', 'browser', 'place', 'network'],
    askerMustShow: null,
    // La única interna. Ver `CeremonyTemplate.internal`.
    internal: true,
    version: 1,
    statement: 'You are signing in to {asker} at {field.destination}.',
  },
  {
    id: 'bank.call.v2',
    kinds: ['verify'],
    signWith: ['identity', 'credential'],
    hero: 'subject',
    required: ['subject'],
    optional: ['agent', 'branch', 'case'],
    askerMustShow: null,
    internal: false,
    version: 1,
    statement: 'You are confirming a verification requested by {asker}.',
  },
  {
    id: 'exchange.transfer.v1',
    kinds: ['authorize'],
    signWith: ['identity'],
    hero: 'amount',
    required: ['amount', 'destination'],
    optional: ['source', 'fee', 'eta'],
    askerMustShow: null,
    internal: false,
    version: 1,
    statement: 'You are authorizing a transfer of {field.amount} to {field.destination}.',
  },
  {
    id: 'age.gate.v1',
    kinds: ['present'],
    signWith: ['credential'],
    hero: 'age_over_18',
    required: ['age_over_18'],
    optional: ['reason'],
    askerMustShow: null,
    internal: false,
    version: 1,
    statement: 'You are sharing one attribute with {asker}: {field.age_over_18}.',
  },
  {
    id: 'doc.sign.v1',
    kinds: ['authorize'],
    signWith: ['identity', 'credential'],
    hero: 'document',
    // La huella es obligatoria y ésa es la plantilla entera: la cartera no tiene
    // visor, así que lo que se puede probar es que se aprobó **esta huella con
    // estos términos**.
    required: ['document', 'fingerprint'],
    optional: ['version', 'pages'],
    askerMustShow:
      'Show the same fingerprint, character for character, next to the document on your own screen. Without it the person has nothing to compare.',
    internal: false,
    version: 1,
    statement: 'You are signing {field.document} for {asker}, fingerprint {field.fingerprint}.',
  },
  {
    id: 'account.change.v1',
    kinds: ['authorize'],
    signWith: ['identity'],
    hero: null,
    required: ['what', 'change_from', 'change_to'],
    optional: ['consequence'],
    askerMustShow: null,
    internal: false,
    version: 1,
    statement:
      'You are approving a change requested by {asker}: your {field.what} changes from {field.change_from} to {field.change_to}.',
  },
  {
    id: 'pro.seal.v1',
    kinds: ['authorize'],
    signWith: ['credential'],
    hero: 'act',
    required: ['act', 'capacity'],
    optional: [],
    askerMustShow: null,
    internal: false,
    version: 1,
    statement: 'You are sealing {field.act} as {field.capacity}, for {asker}.',
  },
  {
    id: 'custody.handover.v1',
    kinds: ['authorize'],
    signWith: ['identity', 'credential'],
    hero: null,
    required: ['item', 'from_party', 'to_party'],
    optional: ['handover_ref'],
    askerMustShow:
      'Put the same shared reference in the handover_ref field of both requests, the one you send to each party. Nothing else links the two signatures.',
    internal: false,
    version: 1,
    statement:
      'You are confirming a handover recorded by {asker}: {field.item} passes from {field.from_party} to {field.to_party}.',
  },
  {
    id: 'data.consent.v1',
    kinds: ['authorize'],
    signWith: ['identity'],
    hero: 'scope',
    // La duración va a la misma altura que el alcance porque «cardiología» y
    // «treinta días» son **una** decisión. Un permiso sin fecha de final es el
    // permiso que nadie retira nunca.
    required: ['scope', 'recipient', 'until'],
    optional: ['purpose', 'withdrawable'],
    askerMustShow: null,
    internal: false,
    version: 1,
    statement:
      'You are letting {field.recipient} read {field.scope} until {field.until}, at the request of {asker}.',
  },
  {
    id: 'access.grant.v1',
    kinds: ['authorize'],
    signWith: ['identity', 'credential'],
    hero: 'place',
    required: ['place', 'valid_until'],
    optional: ['reason'],
    askerMustShow: null,
    internal: false,
    version: 1,
    statement: 'You are opening {field.place} for {asker} until {field.valid_until}.',
  },
  {
    id: 'attr.minimal.v2',
    kinds: ['present'],
    signWith: ['credential'],
    // La palabra de confirmación va encima del propio atributo: antes de
    // compartir nada hay que saber que las dos pantallas son la misma ceremonia.
    hero: 'word',
    required: ['attribute', 'word'],
    optional: ['reason'],
    askerMustShow:
      'Show the same confirmation word on the counter screen, before anything is shared. It is the only thing that ties the two screens together.',
    internal: false,
    version: 1,
    statement:
      'You are sharing one attribute with {asker} in person: {field.attribute}. Both screens show the word {field.word}.',
  },
  {
    id: 'claim.attest.v1',
    kinds: ['authorize'],
    signWith: ['identity', 'credential'],
    hero: 'claim',
    required: ['claim'],
    // Ocho, numeradas. Un campo lleva un valor, así que una lista de
    // declaraciones no cabe en uno; y el número es lo que permite decir «la tres
    // es falsa» dos años después.
    optional: [
      'statement_1',
      'statement_2',
      'statement_3',
      'statement_4',
      'statement_5',
      'statement_6',
      'statement_7',
      'statement_8',
    ],
    askerMustShow: null,
    internal: false,
    version: 1,
    statement:
      'You are declaring to {asker}, under your own responsibility, that the statements shown are true.',
  },
  {
    id: 'agent.identify.v1',
    kinds: ['verify'],
    signWith: ['identity'],
    hero: null,
    required: ['about'],
    optional: ['agent', 'started'],
    askerMustShow: null,
    internal: false,
    version: 1,
    statement: 'You are confirming that this contact really comes from {asker}.',
  },
  {
    id: 'attr.minimal.v1',
    kinds: ['present'],
    signWith: ['credential'],
    hero: 'attribute',
    required: ['attribute'],
    optional: ['reason'],
    askerMustShow: null,
    internal: false,
    version: 1,
    statement: 'You are sharing one attribute with {asker}: {field.attribute}.',
  },
];

const BY_ID = new Map(CEREMONY_TEMPLATES.map((entry) => [entry.id, entry]));

/** Una plantilla por su nombre, o `undefined` si esta copia no la conoce. */
export function findCeremonyTemplate(id: string): CeremonyTemplate | undefined {
  return BY_ID.get(id);
}

/**
 * **Qué papel juega una clave en su plantilla.** Es lo que pinta la insignia de
 * cada campo del editor, y lo que decide si se puede quitar.
 *
 * `generic` no es un error: el vocabulario de te-api es abierto y una clave que
 * la plantilla no declara entra como par. Lo que **no** puede es ser héroe ni
 * aparecer en la frase que se firma, y eso lo impone te-api solo.
 */
export type CeremonyFieldRole = 'hero' | 'required' | 'optional' | 'generic';

export function roleOfKey(template: CeremonyTemplate | undefined, key: string): CeremonyFieldRole {
  if (template === undefined) return 'generic';
  if (template.hero === key) return 'hero';
  if (template.required.includes(key)) return 'required';
  if (template.optional.includes(key)) return 'optional';
  return 'generic';
}

/** Un campo tal y como lo va a mandar el compositor. `sub` es opcional. */
export interface CeremonyDraftField {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  /** La segunda línea. Sólo sobre una clave obligatoria; lo impone te-api. */
  readonly sub?: string;
  readonly type: 'text' | 'mono' | 'numeric';
  readonly style: CeremonyFieldStyle;
}

/**
 * El resultado de comprobar un borrador. **El motivo es el código de te-api**,
 * no una frase.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  SE DEVUELVE `missing_required_field:document` Y NO «FALTA EL DOCUMENTO»
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Porque es exactamente lo que va a contestar te-api si el borrador llega hasta
 * allí, y quien mira esta pantalla está probando el marco contra un despliegue:
 * ver aquí la misma palabra que va a leer en el 400 —y en el registro de
 * te-api— es lo que hace que las dos pantallas se puedan comparar. La frase
 * traducida la pone la interfaz **al lado**, no en vez de.
 */
export type CeremonyDraftCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

function refuse(reason: string, about?: string): CeremonyDraftCheck {
  return { ok: false, reason: about === undefined ? reason : `${reason}:${about}` };
}

/**
 * **¿Aceptaría te-api este borrador?** El mismo orden de comprobaciones que
 * `validateAgainstCatalog`, y por la misma razón: un motivo que cambia según el
 * orden en que llegan los campos no sirve para comparar dos pantallas.
 *
 * Lo general primero —plantilla, `kind`, `signWith`—, después los campos en el
 * orden en que vienen, y al final las claves obligatorias que no han venido.
 *
 * Lo que aquí se comprueba **de más** que en te-api son los topes de longitud del
 * esquema de la ruta (`label`, `value`, `sub`): allí los rechaza Zod antes de
 * llegar al catálogo, con un 400 sin motivo del catálogo. Aquí se nombran para
 * que quien escribe sepa cuál se pasó, en vez de recibir «cuerpo inválido».
 */
export function checkCeremonyDraft(input: {
  readonly template: string;
  readonly kind: CeremonyKind;
  readonly signWith: CeremonySignWith;
  readonly fields: readonly CeremonyDraftField[];
}): CeremonyDraftCheck {
  const entry = BY_ID.get(input.template);
  if (entry === undefined) return refuse('unknown_template', input.template);
  /*
   * **Una plantilla interna NO se rechaza aquí, y es deliberado.**
   *
   * `auth.signin.v1` la va a rechazar te-api con `invalid_request`, y ése es el
   * error que hay que ver: el que contesta el servidor de verdad, con su
   * `requestId` para buscarlo en su diario. Rechazarla en el navegador cambiaría
   * un caso que hoy se puede pulsar —y falla contando por qué— por uno que no se
   * puede pulsar, y esta consola existe para enseñar qué contesta te-api.
   *
   * Lo que sí hace la ficha es **avisar antes de pulsar** (`internal` en la
   * pestaña del contrato), que es la mitad útil sin quitar la otra.
   */
  if (!entry.kinds.includes(input.kind)) return refuse('kind_not_allowed', input.kind);
  if (!entry.signWith.includes(input.signWith)) {
    return refuse('sign_with_not_allowed', input.signWith);
  }
  if (input.fields.length === 0) return refuse('missing_required_field');
  if (input.fields.length > MAX_CEREMONY_FIELDS) return refuse('too_many_fields');

  const seen = new Set<string>();
  for (const field of input.fields) {
    if (seen.has(field.key)) return refuse('duplicate_field', field.key);
    seen.add(field.key);

    if (!CEREMONY_FIELD_KEY_SHAPE.test(field.key)) {
      return refuse('malformed_field_key', field.key);
    }
    // El rótulo y el valor **vacíos no son un descuido de la pantalla**: son un
    // `400` en te-api (`z.string().min(1)`), y sobre todo son un hueco en lo que
    // alguien va a firmar.
    if (field.label.length === 0 || field.label.length > CEREMONY_LIMITS.label) {
      return refuse('label_out_of_range', field.key);
    }
    if (field.value.length === 0 || field.value.length > CEREMONY_LIMITS.value) {
      return refuse('value_out_of_range', field.key);
    }
    if (field.sub !== undefined) {
      if (field.sub.length === 0 || field.sub.length > CEREMONY_LIMITS.sub) {
        return refuse('sub_out_of_range', field.key);
      }
      // La segunda línea, sólo sobre una clave obligatoria. Aceptarla en un par
      // genérico sería aceptar texto que se firma y no se enseña, que es peor
      // que texto que no viaja.
      if (!entry.required.includes(field.key)) return refuse('sub_not_allowed', field.key);
    }
    if (field.style === 'hero' && field.key !== entry.hero) {
      return refuse('hero_not_allowed', field.key);
    }
  }

  for (const key of entry.required) {
    if (!seen.has(key)) return refuse('missing_required_field', key);
  }

  // Llegar aquí sin héroe significa que la clave vino con otro estilo: está,
  // pero no en el escalón donde se lee. Una plantilla sin héroe no pasa por
  // aquí — no hay clave que exigir.
  if (
    entry.hero !== null
    && !input.fields.some((field) => field.key === entry.hero && field.style === 'hero')
  ) {
    return refuse('hero_missing', entry.hero);
  }

  return { ok: true };
}

/** Sólo `{asker}` y `{field.<clave>}`, como en te-api. Nada más se resuelve. */
const MARKER = /\{([a-z][a-z0-9_.]*)\}/gu;

export type RenderedStatement =
  | { readonly ok: true; readonly statement: string }
  | { readonly ok: false; readonly reason: string };

/**
 * **El ensayo de la frase que la persona firma**, compuesta desde el borrador.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ESTA FRASE NO ES LA QUE SE FIRMA. ES LA MISMA FRASE, COMPUESTA AQUÍ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La de verdad la compone te-api **desde la fila** —`renderStatement` en su
 * catálogo—, con `asker_name` congelado al crearla y los valores de
 * `te.request.fields`. Aquí se compone con los mismos ingredientes antes de que
 * la fila exista, que es el único momento en el que alguien puede leerla y
 * cambiar de idea.
 *
 * Por eso `askerName` **tiene que ser el nombre legal que te-api va a copiar del
 * token**, y no el rótulo de esta consola: si se pasara el nombre bonito, la
 * frase de ensayo diría «Bank Demo» y la firmada diría «Banco Demo, S.A.». Quien
 * llama lo saca del padrón (`GET /v1/b2b/organization`) y cae al nombre de la
 * consola sólo cuando te-api no contestó, que es cuando esta pantalla ya está
 * avisando de que no pudo preguntar.
 */
export function renderCeremonyStatement(input: {
  readonly template: string;
  readonly askerName: string;
  readonly fields: readonly { readonly key: string; readonly value: string }[];
}): RenderedStatement {
  const entry = BY_ID.get(input.template);
  if (entry === undefined) return { ok: false, reason: 'unknown_template' };
  if (input.askerName === '') return { ok: false, reason: 'missing_asker_name' };

  // `replace` con función no puede cortar por lo sano, así que el primer fallo
  // se anota y se mira después: nunca se enseña un texto a medio resolver, que
  // es justo el fallo que mordió en producción con `{address}`.
  let failure: string | undefined;
  const output = entry.statement.replace(MARKER, (whole, name: string) => {
    if (name === 'asker') return input.askerName;
    if (!name.startsWith('field.')) {
      failure ??= `unknown_marker:${name}`;
      return whole;
    }
    const key = name.slice('field.'.length);
    const field = input.fields.find((entry_) => entry_.key === key);
    if (field === undefined || field.value === '') {
      failure ??= `missing_required_field:${key}`;
      return whole;
    }
    return field.value;
  });

  if (failure !== undefined) return { ok: false, reason: failure };
  return { ok: true, statement: output };
}
