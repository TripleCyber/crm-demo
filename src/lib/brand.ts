import 'server-only';

import type { CSSProperties } from 'react';

import type { OrganizationConfig } from './organization';

/**
 * De la marca de la organización a los tokens CSS de su pantalla.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  UNA INSTALACIÓN, UNA EMPRESA, Y SU COLOR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `globals.css` tiene una familia de azules —`--navy`, `--navy-deep`,
 * `--navy-line`, `--navy-ink`, `--navy-tint`— que se llama «la marca del banco»
 * desde que la escribió alguien que servía a un solo inquilino. Sigue habiendo
 * un solo inquilino por instalación, pero **ya no es siempre un banco**: en una
 * demostración con dos empresas, dos consolas idénticas con dos nombres
 * distintos dan exactamente la impresión contraria a la que hay que dar.
 *
 * Lo que hace este fichero es traducir los dos colores que declara la
 * organización (`CRM_BRAND_COLOR` y `CRM_BRAND_SURFACE`) a **los cinco tokens
 * que la hoja ya usaba**. Ni una regla de CSS cambia de sitio: se redefinen las
 * variables en el `<body>` y la cascada hace el resto.
 *
 * ## Por qué en el `<body>` y no en un fichero por empresa
 *
 * Porque el color sale del entorno del proceso, y una hoja por empresa habría
 * que servirla desde una ruta, con su caché y su parpadeo; un atributo `style`
 * en el documento que ya se está componiendo llega pintado desde el servidor,
 * sin JavaScript y sin un primer fotograma con el color de otro.
 *
 * ## Por qué se derivan tres de los cinco
 *
 * `--navy-line`, `--navy-ink` y `--navy-tint` **no son decisiones de marca**:
 * son la superficie y el acento mezclados con blanco en tres proporciones —una
 * regla sobre fondo oscuro, el texto sobre ese fondo, y la superficie
 * seleccionada sobre papel—. Pedirlas por configuración serían tres maneras más
 * de que una empresa se deje su propia barra con el texto ilegible, a cambio de
 * una libertad que nadie ha pedido. `color-mix()` las calcula en el navegador y
 * salen coherentes con cualquier par de colores.
 *
 * ## Lo que este fichero NO toca, y no es un olvido
 *
 * **Los cuatro colores de estado.** Rojo = fraude, ámbar = ha ido mal, verde =
 * comprobado, azul = en curso (`globals.css`, nota 2). Ésos valen para toda
 * instalación: un agente que ha usado la consola de otra empresa tiene que poder
 * seguir leyendo el color, y una marca corporativa que pudiera repintar el rojo
 * del fraude convertiría la única señal inequívoca de esta pantalla en una
 * cuestión de gusto.
 */

/**
 * Los tokens de marca de la organización, o `undefined` si no declara ninguna.
 *
 * `undefined` es lo correcto y no un caso a evitar: sin marca declarada no se
 * escribe ningún `style`, la hoja manda, y la pantalla sale con el azul de
 * siempre. Es el aspecto por defecto y no una rama muerta — una instalación sin
 * color propio arranca igual.
 */
export function brandStyleOf(organization: OrganizationConfig): CSSProperties | undefined {
  const brand = organization.brand;
  if (brand === undefined) return undefined;

  return {
    // El acento sobre papel: enlaces, foco, el filo de la tarjeta de oferta.
    '--navy': brand.accent,
    // La superficie oscura: la barra de la consola y la cabecera del portal.
    '--navy-deep': brand.surface,
    // La regla dentro de esa superficie. Un 14 % de blanco: se ve la separación
    // y no se convierte en una raya.
    '--navy-line': `color-mix(in srgb, ${brand.surface} 86%, white)`,
    // El texto sobre la superficie. Un 8 % del color de la empresa sobre blanco
    // —no blanco puro— para que el gris de la barra tenga su temperatura y no
    // la del azul de otro.
    '--navy-ink': `color-mix(in srgb, ${brand.surface} 8%, white)`,
    // La superficie seleccionada sobre papel: la fila activa, el fondo de una
    // insignia en curso.
    '--navy-tint': `color-mix(in srgb, ${brand.accent} 8%, white)`,
    // El filo de la sección abierta en la barra. Va SOBRE la superficie oscura,
    // así que tiene que ser un claro del acento y no el acento: el violeta de
    // Larkfield sobre su propio violeta oscuro no se ve a un metro, que es la
    // distancia a la que se mira una barra lateral.
    //
    // La mezcla es `oklab` y no `srgb` —las otras tres sí son `srgb`— porque
    // aquí lo que importa es que el resultado conserve el color de la empresa
    // al aclararse. Mezclar con blanco en sRGB desatura, y un 55 % de blanco
    // sobre un acento saturado sale casi gris; en un espacio perceptual sale
    // más claro y sigue siendo del mismo color.
    '--navy-mark': `color-mix(in oklab, ${brand.accent} 55%, white)`,
    // Las propiedades personalizadas no están en `CSSProperties` —React quitó
    // la firma de índice a propósito, para que un nombre de propiedad mal
    // escrito no compile—, así que este objeto se afirma. Es la conversión que
    // recomienda la propia documentación de los tipos de React, y los cinco
    // valores están validados: los dos colores por `BRAND_COLOR_PATTERN` en
    // `organizations.ts`, y los otros tres se componen aquí con esos dos.
  } as CSSProperties;
}

/**
 * El monograma de una organización: su logotipo cuando no hay logotipo.
 *
 * El día que se despliega no hay ningún fichero de imagen, y hasta que lo haya
 * la consola tiene que enseñar algo, así que la marca gráfica se compone: una o
 * dos letras dentro de un disco del color de la empresa. Es lo mismo que hace
 * cualquier herramienta que da de alta organizaciones, y por la misma razón.
 *
 * Se declara (`CRM_BRAND_MONOGRAM`) o se compone con las iniciales de las dos
 * primeras palabras del nombre. Se puede declarar porque las iniciales no
 * siempre son la marca: «Northgate Building Society» da «NB», y a esa entidad la
 * conoce todo el mundo por «Northgate».
 *
 * Se toman **palabras** y no caracteres para que «Larkfield Energy Ltd.» dé
 * «LE» y no «LA», y como mucho dos: en un disco de 32 píxeles la tercera letra
 * ya no se lee.
 */
export function monogramOf(organization: OrganizationConfig): string {
  const declared = organization.brand?.monogram;
  if (declared !== undefined) return declared.toUpperCase();

  return organization.displayName
    .split(/\s+/)
    .filter((word) => word !== '')
    .slice(0, 2)
    .map((word) => [...word][0]?.toUpperCase() ?? '')
    .join('');
}
