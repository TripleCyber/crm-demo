# crm-demo · el CRM de demostración

La consola de agentes de **tres organizaciones de mentira** —un banco, una
aseguradora y una clínica— que emiten credenciales de verdad. Es la pieza de
[`F4`](../docs/fases/F4-crm.md) y **es la única maqueta del proyecto** — pero la
mitad que habla con nosotros no lo es: el token B2B y la emisión son los de
producción.

> **Sus empleados son reales; sus clientes son locales.**
> Los clientes son filas en la base de este proyecto. Ni te-api ni Logto las
> leen nunca, igual que no leemos el núcleo bancario de un banco de verdad.

> **Un despliegue, tres dominios, y el dominio elige.**
> `bank.demo-te.com`, `seguros.demo-te.com` y `clinica.demo-te.com` están
> declarados en Coolify contra **esta misma aplicación**. La organización de
> cada petición sale de su `Host` (`src/lib/request-organization.ts`), y de ahí
> salen las dos cosas que no pueden discrepar: qué padrón se enseña y qué
> `did:web` se publica. `CRM_ACTIVE_ORG_ID` es sólo el respaldo para los hosts
> que no son de nadie — `localhost` en desarrollo.

## Lo que hay hoy y lo que no

| | |
|---|---|
| ✅ | Next.js (App Router, TypeScript) con el patrón de `tenant-admin`: proxy en el servidor, ni un secreto en el navegador |
| ✅ | Base propia Postgres con `customer`, migración reproducible y siembra aparte |
| ✅ | Listado de clientes con **buscador** (nombre, identificador, correo o la referencia del sector —los cuatro de la cuenta, la póliza o el número de historia—, sin acentos) y dos columnas de estado por cliente, y alta de cliente. La columna de referencia la elige **lo que el padrón rellena**, no una variable |
| ✅ | Cliente del token B2B en el servidor: `client_credentials` + `resource` + `organization_id` + `scope`, cacheado y renovado antes de caducar |
| ✅ | Botón «emitir credencial» → `POST /v1/b2b/credentials` de te-api → QR, enlace debajo y PIN aparte. **Probado de punta a punta el 2026-08-29**: la credencial se recogió con el flujo OID4VCI y salió con `iss = did:web:bank.demo-te.com`, `sub` = el `external_id` de la ficha y los cuatro claims como divulgaciones |
| ✅ | Multi-organización **por dominio**: mapa `orgId → {…}` por variables de entorno, y el `Host` de la petición elige. Tres declaradas desde el 2026-08-30. Añadir otra del mismo sector es sólo variables; otro sector necesita además su columna en el padrón (`db/005_…`) |
| ⛔ | **Login de empleado con Logto OIDC.** Es la casilla que queda de F4a. Mientras no esté, esta consola **no está autenticada** y no puede publicarse donde llegue nadie de fuera |
| ✅ | **Portal del cliente en `/portal`** (F4b): login OIDC del titular contra Logto y `POST /v1/b2b/links` desde el servidor. **Probado en el navegador el 2026-08-29**: Teófilo entró con su cuenta de TripleEnable y el vínculo quedó hecho — fila en `te.org_subject` de te-api, y volver a entrar es idempotente |
| ✅ | **El diario del banco**: cada oferta emitida y cada comprobación lanzada quedan anotadas (`credential_offer`, `verification`), y la ficha las enseña con su hora y su autor. Es lo que permite que el listado tenga estado y que una verificación tenga dirección propia |
| ⛔ | Estado real **de la credencial y del vínculo**: si el titular aceptó la oferta o si tiene cartera enrolada. te-api no lo cuenta, así que la ficha dice «ofrecida» —lo que hizo el banco— y **no pinta ninguna insignia** de «credencial activa» ni de «perfil verificado» |
| ✅ | Botón «pedir credencial» → `POST /v1/b2b/presentations` de te-api → QR de la petición OID4VP, y en la misma pantalla lo que el titular enseñó. **Probado de punta a punta el 2026-08-29** con un guion que hace de cartera: `pending` → la cartera presenta → `verified` con `given_name` y `family_name`, y sólo con ésos |
| ✅ | **La vía telefónica**: «está al teléfono · avisar a su móvil» → la misma presentación **más `POST /v1/b2b/wakeups`**, el timbre. Es lo que hace que la comprobación sirva para una llamada, donde el cliente no ve la pantalla del agente. **Probado el 2026-08-29**: la llamada sale con `kind: identity` y el `actor` del empleado, te-api contesta `{ wakeupId, expiresAt }` y anota `b2b.wakeup_created`. **Ningún teléfono ha sonado todavía** — ver «Lo que falta para que suene un teléfono» |
| ✅ | **Consola bilingüe.** El original está en **inglés** y el castellano es una traducción; lo elige quien mira la pantalla y no el dominio, se guarda en una cookie y **no hace falta reconstruir la imagen** para cambiarlo. Ver «El idioma» |
| ⛔ | **Revocación** (la otra mitad de F4c) |
| ✅ | `/.well-known/did.json`, **uno por organización y elegido por el `Host`** (`src/app/.well-known/did.json/route.ts`). Era un estático en `public/`, que se sirve por camino y no por `Host`: con tres dominios devolvía el documento del banco en los tres. Un `Host` que no es de ninguna organización devuelve **404**, nunca el de otra. Lleva **dos** claves, la del emisor desplegado y la del local, porque durante una rotación las dos tienen que valer; el porqué de cada campo está en `src/lib/did-document.ts` |
| ⛔ | Que los documentos de **Seguros Aurora y Clínica San Rafael** se descarguen de sus dominios. El documento ya lo sirve esta aplicación; lo que falta es **declarar los dos dominios en Coolify**, que es lo que dispara el certificado — ver [`DOMINIOS.md`](../docs/fases/DOMINIOS.md) §4 |

## Dos secciones, no una

Este proyecto sirve **dos pantallas que no se parecen en nada**, y la separación
es estructural: dos grupos de rutas, dos disposiciones y dos sesiones distintas.

| | Quién la usa | Qué ve | Qué autentica |
|---|---|---|---|
| `(console)` — `/customers`, `/verifications`, `/diagnostics` | Un **empleado** del banco, desde el mostrador | El padrón entero de clientes | Nada todavía (F4a pendiente). Contra te-api autentica el **token M2M** |
| `portal` — `/portal` | El **titular** | Su ficha y su vínculo, nada más | Login **OIDC contra Logto** con la cuenta de TripleEnable de esa persona |

El grupo `(console)` no cambia ninguna URL —los paréntesis son de Next.js— y
existe para que la cabecera del banco viva en un fichero aparte de la del
portal. Un `if` en una cabecera compartida se olvida; un enlace a «Clientes»
pintado en la pantalla de un titular es un enlace que alguien va a pulsar.

## El idioma

**El original es el inglés.** `src/i18n/messages/en.ts` es el catálogo del que
sale el tipo `MessageKey`, así que una clave que no exista allí no compila;
`es.ts` es una **traducción** y todo lo suyo es opcional. Una clave sin traducir
cae al inglés — no revienta y **no pinta nunca el nombre de la clave**.

> ⚠ Este README está escrito en castellano y **cita los textos de pantalla en
> castellano**. Son la traducción, no el original: por defecto la consola se ve
> en inglés, y lo que sale ahí es lo que dice `messages/en.ts`.

**Lo elige quien mira la pantalla, y no el dominio.** El dominio es la identidad
de la organización (`src/lib/request-organization.ts`) y ésa es otra pregunta:
de quién es esta consola, frente a en qué idioma la lee quien la tiene delante.
Atarlas obligaría a un dominio por idioma. Tampoco va en la ruta —nada de
`/en/customers`—: un segmento delante cambiaría el enlace que un agente pega en
un chat para pasar una verificación, el `redirect_uri` declarado en Logto y
`/.well-known/did.json`, que tiene que responder en la raíz del dominio o la
cartera no resuelve el `did:web`.

Así que va en **una cookie**, `crm_locale`, que escribe el selector de la barra
lateral y de la cabecera del portal. Sin cookie se negocia con `Accept-Language`
del navegador, y si tampoco dice nada, inglés. **No hay ninguna variable de
entorno del idioma y no hay que reconstruir nada para cambiarlo.**

| Fichero | Qué es |
|---|---|
| `src/i18n/config.ts` | Los idiomas, la cookie, la negociación de `Accept-Language` |
| `src/i18n/messages/en.ts` · `es.ts` | El catálogo original y su traducción |
| `src/i18n/translate.tsx` | El traductor: `t()`, `t.rich()` y el respaldo al inglés |
| `src/i18n/server.ts` · `client.tsx` | Cómo lo consigue el servidor (cookie) y el navegador (contexto) |
| `src/i18n/actions.ts` | La acción que escribe la cookie |
| `src/components/LocaleSwitch.tsx` | El selector, en las dos secciones |

Lo que **no** se traduce, y a propósito: los comentarios del código
(`AGENTS.md` §0.5), los mensajes de `console.error` —diagnóstico interno, que se
lee junto a esos comentarios— y los errores de configuración que lanza `src/lib`
(«falta esta variable»), que están en inglés fijo porque los lee quien despliega
y van al lado de lo que conteste Postgres, que también viene en inglés.

## Las pantallas de la consola, y por qué son cinco y no una

**Cada acción tiene su dirección.** Es la estructura que dibuja el artifact
«Llamada Verificada» en «Lo que ve Pedro» —C0 en `…/credencial`, C1 en la ficha,
C2 y C3 en `…/verificaciones/<id>`— y no es orden por gusto: emitir es firmar en
nombre del banco, y comprobar abre una ceremonia que hay que seguir hasta que el
titular conteste. Las dos cosas metidas en la ficha convertían la pantalla en un
formulario largo donde lo que se leía era el desplegable.

| Ruta | Qué es | Artifact |
|---|---|---|
| `/customers` | El padrón, con buscador y el estado de identidad de cada cliente | — |
| `/customers/<id>` | La **ficha**: datos del titular, diario de identidad y las tres acciones | C1 |
| `/customers/<id>/credential` | **Emitir**: la oferta a la izquierda, lo que se va a firmar a la derecha | C0 |
| `/customers/<id>/verify` | **Lanzar** la comprobación: los dos niveles, qué se pide y por dónde se avisa | C1 |
| `/verifications/<presentationId>` | **Seguir** una comprobación: el estado en grande —con el titular, su número de cliente y el plazo corriendo—, el QR o el enlace, la línea de tiempo y el recibo | C2 · C3 |
| `/verifications` | El registro de comprobaciones de la organización | — |
| `/customers/new` | Alta de cliente | — |
| `/diagnostics` | La costura con te-api, la configuración de la organización (dominio, `did:web`, números oficiales, portal), cómo se elige la organización, **de dónde sale el idioma**, y una comprobación real de la base. **Es el único sitio donde se dice el nombre de una variable de entorno** | — |

Que el seguimiento tenga dirección propia es lo que arregla tres cosas de golpe:
recargar la pestaña ya no pierde la ceremonia en curso, el enlace se le puede
pasar a un compañero que termine la llamada, y el recibo sigue ahí mañana para
adjuntarlo a un expediente.

## Cómo funciona la emisión

```
Navegador  (listado · alta · botón de emitir)
   │  fetch /api/credentials/issue        ← lo único que manda es el externalId
   ▼
Next.js, en el servidor
   │  1. Host → organización              src/lib/request-organization.ts
   sesión → organización            src/lib/session.ts
   │  2. ficha del cliente                src/lib/customers.ts   (base propia)
   │  3. el tipo, resuelto contra el padrón de te-api
   │  4. claims: los NOMBRES los dice el perfil del tipo,
   │     los VALORES la ficha. Del navegador no viene ninguno
   │  5. token M2M de organización        src/lib/b2b-token.ts   (cacheado 1 h)
   ▼
te-api  POST /v1/b2b/credentials
   ▼
{ offerId, offerUri, expiresAt, pin }  →  QR (SVG hecho en el servidor) + enlace + PIN
```

**El CRM sólo habla con te-api.** No llama a walt.id nunca: el emisor no tiene
autenticación ninguna y publica las claves privadas de sus perfiles, y lo único
que lo protege es no tener dominio. La credencial la construye y la firma
te-api, y la recoge la cartera del titular hablando directamente con el emisor
— por eso te-api no llega a ver nunca la credencial emitida, que es justo lo que
se quería.

### Las tres decisiones que importan

**1 · La sesión del empleado no autentica nada contra te-api.** Lo único que
autoriza esa llamada es el token M2M de organización. `getB2bToken()` recibe una
`OrganizationConfig` y nada más: si algún día hiciera falta el token del
empleado, no hay por dónde dárselo. Es la regla de [F4 §0](../docs/fases/F4-crm.md),
y se comprueba borrando las cookies y llamando a `/api/organization`.

**2 · Los claims salen de la ficha, no del navegador.** El botón manda un
`externalId`; el resto lo lee el servidor de la base. Si el contenido viniera
del cliente, cualquiera con la consola de red abierta emitiría una credencial
firmada por Banco Demo diciendo lo que quisiera — y la firma sería buena.

**3 · El PIN se enseña en la misma pantalla, nunca se manda.** Va en su propia
tarjeta, separado del enlace, para leerlo en voz alta. Si viaja por el mismo
canal que el enlace, no protege de nada.

## Cómo funciona la verificación

Es el otro medio ciclo: hasta que entró esto, este CRM emitía una credencial y
**nadie la pedía nunca de vuelta**.

Hay **dos canales, porque son dos situaciones**, y la ficha los rotula por la
situación y no por la tecnología:

| Botón | Cuándo | Cómo se entera el titular |
|---|---|---|
| **Está al teléfono · avisar a su móvil** | El agente tiene al titular al aparato. El titular **no ve esta pantalla** | Le suena el móvil: `POST /v1/b2b/wakeups` |
| **Está delante · enseñar QR** | El cliente está en el mostrador mirando la pantalla del agente | Escanea el QR con su cartera |

Los dos abren **la misma sesión de presentación** y se consultan igual. Lo único
que cambia es cómo se entera la persona de que le están preguntando.

```
Navegador  (ficha · casillas de qué se pide · los dos botones)
   │  fetch /api/credentials/present      ← externalId, tipo, atributos y canal
   ▼
Next.js, en el servidor
   │  1. Host → organización              src/lib/request-organization.ts
   sesión → organización y EMPLEADO
   │  2. ficha del cliente (con el org_id en el where)
   │  3. el TIPO, resuelto contra el padrón de te-api
   │  4. qué atributos lleva ese tipo EN ESTA FICHA
   │  5. lo pedido que no esté en esa lista → 400, no recorte
   │  6. token M2M de organización
   ▼
te-api  POST /v1/b2b/presentations        (abre la sesión en SU verificador)
   ▼
{ presentationId, requestUri, authorizationRequestUrl, expiresAt }
   │
   ├─ canal QR ─────► QR + enlace en pantalla; el cliente lo escanea
   │
   └─ canal teléfono ──► te-api  POST /v1/b2b/wakeups
                          { subjectReference, kind: identity,
                            requestUri,               ← el de arriba, tal cual
                            actor: { id, displayName } }
                          ▼
                         { wakeupId, expiresAt }      ← y el móvil suena
   │
   │  la cartera del titular va al requestUri y presenta
   ▼
te-api  GET /v1/b2b/presentations/:id     (se sondea cada 3 s)
   ▼
{ status, claims }  →  lo que el titular enseñó, y sólo lo que se pidió
```

**El verificador es de TripleEnable, no de Banco Demo.** Se ve leyendo este
proyecto: no hay ninguna configuración de verificador, ni clave, ni un `fetch` a
un walt.id. Un banco que verificase en su casa podría dar por buena cualquier
cosa —incluida una credencial que TripleEnable haya revocado— y nadie se
enteraría. El `requestUri` que sale en pantalla apunta a la infraestructura de
TripleEnable a propósito, y es lo que se le manda al timbre: el aviso llega al
móvil apuntando a nuestra infraestructura y no a la de Banco Demo.

### Las tres cosas del timbre que la pantalla dice y hay que respetar

**1 · El 200 de `wakeups` NO dice si esa persona tiene cartera.** te-api
contesta lo mismo, con la misma forma y la misma latencia, exista el cliente o
no: resuelve a quién despertar *después* de contestar, y si no resuelve a nadie
la fila nace señuelo y caduca sola. Es deliberado — si contestara distinto, este
CRM sería un oráculo para averiguar quién tiene cartera de TripleEnable probando
identificadores. Por eso la pantalla dice «no confirma que le haya sonado el
teléfono» en vez de pintar «este cliente no tiene la app», que es una frase que
la respuesta no permite escribir.

**2 · El `actor` es atribución, no autenticación.** te-api no lo verifica y no
decide nada con él. Sirve para que en el móvil del titular ponga el nombre y el
número del empleado que le está llamando —`CRM_ACTIVE_AGENT_NAME` y
`CRM_ACTIVE_AGENT_ID`— y para el diario. La ficha lo pinta debajo de los botones a
propósito: el agente tiene que poder decir en voz alta el mismo nombre que el
cliente está viendo en la pantalla del móvil, que es lo que convierte la
comprobación en algo que sirve contra quien llama diciendo que es del banco.

**3 · Si el timbre no sale, no hay pantalla de espera.** La sesión de
presentación se deja caducar sola y se enseña el error. Dar por buena una
llamada cuyo aviso no ha salido dejaría al agente diciéndole al cliente que mire
un móvil que no va a sonar.

### Qué decide el navegador y qué decide el servidor

Es la pregunta que hay que poder contestar de cada campo que viaja, y la
respuesta no es «el navegador no decide nada»: el operador **sí** elige cosas, y
la disciplina está en que ninguna de sus elecciones se crea tal cual.

| Campo | Quién lo elige | Contra qué se comprueba |
|---|---|---|
| `externalId` | El operador — de qué cliente | El padrón, **con el `org_id` de la organización del dominio en el `where`** |
| `type` | El operador — qué credencial | **`GET /v1/b2b/organization`**, el padrón de te-api |
| `claims` | El operador — qué atributos | Los que ese tipo lleva **en esta ficha** |
| `channel` | El operador — por dónde avisa | Una lista cerrada de dos valores |
| `subjectReference` | **El servidor** | Sale de la fila del padrón. No viaja en el cuerpo |
| `actor` (quién sale en el móvil) | **El servidor** | Sale de la sesión del empleado |
| `kind` del timbre | **El servidor** | Constante: `identity` |

### Las tres decisiones que importan

**1 · Sólo se puede pedir lo que esta credencial lleva, y se rechaza, no se
recorta.** Las casillas salen de la misma resolución que construye los claims al
emitir, y el servidor **vuelve a comprobar** lo que llegó del navegador contra
esa lista. Lo que no cuadre es un **400 que nombra los atributos que sobran** —
antes se filtraban en silencio, y eso está mal por el motivo que te-api escribe
en `src/b2b/claims.ts`, que **lanza** en vez de filtrar: recortar por lo bajo
deja al que llama convencido de que pidió lo que no pidió, y el día que ese campo
importe nadie sabrá por qué no está.

**2 · Se marca lo que hace falta, no todo.** Por defecto van nombre y apellido.
Pedirlo todo «ya que estamos» es exactamente lo que la divulgación selectiva
existe para no tener que hacer, y lo que la cartera enseñe de más tampoco llega:
te-api devuelve la intersección con lo que se pidió.

**3 · Se sondea, no hay webhook.** te-api no acepta uno del partner, y no por
falta de soporte en walt.id: el destino lo elegiría quien pide, y el verificador
de TripleEnable —que vive dentro de su red y no tiene autenticación— acabaría
haciendo peticiones salientes a donde le dijeran. El sondeo va a 3 s porque la
consulta pasa por el cubo de tasa por organización de te-api, que comparte con
la emisión.

### Nada de una organización concreta está cableado

`VerificationLauncher.tsx` y `VerificationTracker.tsx` no tienen escrito ni un
`given_name` ni un `cliente`, y `session.ts` ya no compone «Agente de Banco
Demo» a mano. Las tres
fuentes, en orden:

| Qué | De dónde sale |
|---|---|
| La lista de **tipos** | `GET /v1/b2b/organization` de te-api. Ya era así |
| Los **atributos** de cada tipo, y sus rótulos | Configuración: `CRM_TYPE_<CLAVE>_CLAIMS` |
| Qué va **marcado** al abrir | `CRM_TYPE_<CLAVE>_DEFAULT_CLAIMS`, o el mínimo de identidad del catálogo |
| El **rótulo** de un tipo | El catálogo de mensajes (`credentialTypes.<type_key>`), luego `CRM_TYPE_<CLAVE>_LABEL`, y si no, el `type_key` tal cual |
| El nombre del **banco** | `CRM_ORG_<SLUG>_NAME`, vía la organización del dominio de la petición |

Los atributos salen de configuración **y no del padrón porque te-api no los
tiene**. Se comprobó leyendo te-api el 2026-08-29: la respuesta por tipo es
`{ type, maxValidityDays }`, `te.partner_credential` sólo lleva `type_key`,
`issuer_profile_id`, `vct` y `max_validity_days`, y la gramática de
`seed:partner` no tiene hueco para claims. No es un olvido: `src/b2b/claims.ts`
valida con una **lista de reservados** y no con una lista blanca por tipo, a
propósito, para que el banco no tenga que pedir permiso por cada campo nuevo.
te-api no sabe qué lleva la credencial de un banco porque nunca la ve.

El día que la exponga, lo único que cambia es de dónde lee
`src/lib/credential-profiles.ts`. Nadie más en el CRM sabe qué lleva un tipo.

Lo único que sigue siendo código de este banco es el **catálogo de atributos**
(`CUSTOMER_ATTRIBUTES`, en `src/lib/customers.ts`), y tiene que serlo: un
atributo sólo se puede poner en una credencial si hay una columna del padrón de
donde sacarlo. Declarar un atributo en un `.env` no crea la columna — y cuando `policy_number` hizo falta de verdad (2026-08-30) salió en `db/005_sector_reference.sql`, no en una variable.

**Comprobado el 2026-08-29** declarando `CRM_TYPE_CLIENTE_CLAIMS=given_name
family_name account_last4` y `CRM_TYPE_CLIENTE_DEFAULT_CLAIMS=account_last4`:
`customer_since` desapareció de las casillas, la marca por defecto se movió a
`account_last4`, y pedir `customer_since` por la API devolvió un 400 diciendo
que la credencial de este cliente no lo lleva. **Sin tocar una línea de código.**

> El rótulo ya **no** entra en esa comprobación. `cliente`, `asegurado` y
> `paciente` los rotula el catálogo de mensajes, que es lo único que puede estar
> en dos idiomas: `CRM_TYPE_CLIENTE_LABEL` puesto en el entorno hoy no hace
> nada. La variable sigue sirviendo para un `type_key` que el catálogo no
> conozca, que es para lo que se puso.

### El canal sí es un dato del CRM, y por eso se queda

«Está al teléfono · avisar a su móvil» describe un canal concreto, y eso es
correcto **aquí**: un CRM sabe por qué vía está hablando con su cliente, porque
es él quien tiene la llamada. Lo que no puede haber cableado es el **tipo** de
credencial ni los **atributos**, que es cosa de cada organización. (La cartera
es el caso contrario: allí la suposición de llamada sí sobra, porque el que
recibe el aviso no sabe por qué canal se lo mandan.)

### `rejected` y `failed` no son lo mismo, y la pantalla no los junta

te-api devuelve cinco finales y se pintan los cinco por separado, con **el rojo
reservado para uno solo**:

| Estado | Qué es | Qué hace el agente |
|---|---|---|
| `verified` | Es quien dice ser | Verde. Salen los atributos que se pidieron |
| `rejected` | **La persona ha dicho que no ha sido ella**, desde su cartera | **Rojo.** Cortar la llamada y cursar el aviso de fraude: si el agente habla con alguien y el titular dice que no, hay dos personas distintas |
| `failed` | La credencial no ha valido —caducada, revocada, de otro titular— | Ámbar. **Se reintenta desde la propia pantalla** |
| `expired` | Nadie contestó a tiempo | Ámbar. **Se reintenta desde la propia pantalla** |
| `pending` | Se sigue esperando | **Azul**, con el plazo corriendo en un anillo y el latido de cada consulta |

Los cinco viven en **un solo bloque** —`VerificationStage.tsx`—, con su título
corto —«Es quien dice ser», «El titular dice que no ha sido él»— y no un párrafo
que hay que leer entero: el agente está al teléfono con alguien y tiene que saber
cómo ha acabado sin ponerse a leer. Que sea uno y no cinco es lo que hace que el
color **se pida una sola vez** a `verification-status.ts` en vez de estar escrito
a mano cinco veces, y que la identidad del titular esté en los cinco.

El color tampoco va solo: cada desenlace lleva **su propia forma** —visto, aspa,
admiración, reloj—, porque uno de cada doce hombres no distingue el rojo del
verde y porque en una sala se ve el dibujo antes que el texto.

Compartir el rojo entre `rejected` y `failed` volvería a juntarlos en el único
sitio donde alguien los mira de verdad, que es esta pantalla. Por eso hay un
tercer color en `globals.css` y no dos. **La espera tiene el suyo, azul**, y no
comparte el ámbar: una comprobación en curso no es una que haya fallado.

#### T9 · lo que le falta al rojo para llegar hasta aquí

**La pantalla ya está preparada y no hay nada que construir en el CRM.** El
bloque `rejected` existe, pinta rojo y es el único que lo hace; el tipo de
`GET /v1/b2b/presentations/:id` ya declara los cinco estados; y el sondeo sigue
vivo hasta que llegue un final. El día que te-api mueva la sesión a `rejected`,
esta pantalla lo pinta **sin tocar una línea**.

Lo que falta está fuera: `src/routes/requests.ts` de te-api **no toca la sesión
de presentación** al recibir el `not_me`, y `rejected` sólo nace cuando el
verificador walt.id ha visto una respuesta de error OID4VP
(`waltid/verifier.ts`, `failure.type === 'wallet_error_response'`). Por el canal
telefónico esa respuesta no la manda nadie, así que la sesión se queda viva
hasta caducar y el agente ve **el ámbar de «caducó»** donde debería ver el rojo.
Es T9 en `docs/TAREAS.md` §3.2 y no se arregla desde este proyecto.

Lo único que se ha hecho aquí es **dejar de mentir mientras tanto**: el bloque
`expired` avisa de que una denuncia del titular se ve exactamente igual que un
plazo agotado. Sin esa línea, el agente lee «nadie contestó» y da por hecho que
el cliente no miró el móvil, que es justo la conclusión contraria a la verdadera.

### La espera, el momento y la salida

Una pantalla que dice «esperando» durante cinco minutos sin moverse no se
distingue de una colgada. Se mueven **dos cosas, y las dos son hechos**:

- **el anillo**, que es el plazo de te-api (`expiresAt − requestedAt`) vaciándose
  con la cuenta atrás dentro. Se vacía y no se llena: lo que avanza es el tiempo
  que se acaba, no un progreso hacia el sí;
- **el latido**, «Comprobando si ha contestado · hace 2 s», que late **por cada
  consulta contestada** y no con un temporizador. Si la red se cae, se para y el
  «hace…» crece, que es justo lo que hay que ver.

Nada más se mueve, y es la regla: **no se anima lo que el servidor no ha
confirmado**. Que le haya sonado el móvil al titular no lo sabe nadie, y la línea
de tiempo lo sigue diciendo con todas las letras.

Cuando llega el desenlace **con la pantalla delante**, el bloque se asienta, un
barrido del color del resultado lo cruza una vez y el sello se traza; a los 570 ms
ya está quieto. Abrir mañana el recibo de hoy no anima nada: no está ocurriendo
nada. Y quien tenga puesto `prefers-reduced-motion` ve **los mismos estados**
—mismo color, mismo dibujo, misma frase— sin recorrido.

De `failed`, de `expired` y de un plazo agotado **se sale desde aquí**: «volver a
intentarlo» lanza otra petición con los cuatro mismos valores —cliente, tipo,
atributos y canal— leídos del diario, y navega a su identificador nuevo; la
anterior no se reescribe, porque que hubo un primer intento sin contestar es
justo lo que un banco necesita poder demostrar. «Pedir otra cosa» vuelve al
formulario para cambiar qué se pide.

En `rejected` **no hay botón de reintentar**, y es la misma regla que el color: un
botón grande de insistir en el aviso de fraude enseñaría al agente a llamar otra
vez al móvil de alguien que acaba de denunciar que le están suplantando.

### Quién es, y sus dos horas

Debajo del estado, y **fija en los cinco desenlaces**, va la identidad: el nombre
del padrón y **el número de cliente**, en monoespaciada grande y con aire entre
caracteres porque se canta en voz alta por teléfono para que los dos sepan que
miran la misma ficha.

Cuando la comprobación sale bien salen además **dos horas, y no son la misma**:
`proof.signedAt` es cuándo firmó el titular según su propio teléfono, y
`settled_at` es cuándo se enteró esta consola. Entre ellas hay hasta un intervalo
de consulta. La línea de tiempo las pinta como dos hitos seguidos —«Firmó desde
su cartera» y «Ha confirmado desde su cartera»— y hasta que te-api devolvió la
primera, el banco sólo podía archivar la segunda.

### La trampa del `requestUri` en `http`

**`POST /v1/b2b/wakeups` exige `https` y no hace excepción para desarrollo.** El
`requestUri` no lo escribe este CRM: sale tal cual de `POST /v1/b2b/presentations`,
o sea del `urlPrefix` del verificador walt.id. Contra la pila local ese prefijo
es `http://127.0.0.1:7004/…`, así que **el timbre muere en el validador de
te-api** con `400 invalid_request` y la pantalla lo enseña con su `requestId`:

```
te-api ha rechazado los datos de la llamada: invalid_request (requestId …)
```

No es un fallo del CRM y no se arregla aquí: o el verificador local va detrás de
TLS (`docs/ENTORNO-DE-PRUEBAS.md` §5, la misma receta que ya se hizo para el
emisor), o se prueba contra el despliegue, donde el verificador ya publica
`https://verifier.idp.tripleenable.com/verification-session/…`.

### Lo que falta para que suene un teléfono de verdad

El CRM ya hace su parte entera. Lo que queda **no está en este proyecto**:

1. **El `requestUri` en `https`** (arriba). En el despliegue ya lo está; en
   local no.
2. **Una cartera enrolada y vinculada.** El timbre resuelve
   `(organización, cliente) → vínculo → titular → aparatos`. Sin vínculo no
   resuelve a nadie; con vínculo pero sin cartera enrolada (`te.identity` vacía)
   se para en la puerta siguiente. En los dos casos la fila nace **señuelo** y
   te-api contesta exactamente igual, que es el comportamiento correcto y no un
   fallo que haya que perseguir desde aquí.
3. **`TE_PUSH_ENABLED=true` en te-api.** Con el canal apagado la ruta falla en
   voz alta (`400 unauthorized_client`) en vez de devolver un `wakeupId` que no
   va a sonar nunca.

## El portal del cliente (`/portal`) y el vínculo

Es la mitad de F2 que vive aquí. te-api **no acepta que el banco declare a quién
vincula**: exige el ID token que el banco recibió al autenticar a esa persona.
Este portal existe para producir ese ID token.

```
Navegador del TITULAR                Next.js, en el servidor              te-api / Logto
─────────────────────                ───────────────────────              ──────────────
GET /portal
  «Entrar con TripleEnable»
GET /portal/login  ────────────────► state + nonce + PKCE
                                     cookie `bd_portal_auth`
  ◄── 307 ─────────────────────────────────────────────────────────────►  Logto autentica
GET /portal/callback?code&state
                                     1. compara el `state`
                                     2. canjea el código  ──────────────►  Logto /oidc/token
                                        (client_secret_basic + PKCE)
                                     3. VERIFICA el ID token: firma contra
                                        el JWKS, `iss`, `aud`, `nonce`
                                     4. correo verificado → ficha del padrón
                                     5. POST /v1/b2b/links ─────────────►  te-api
                                                                            { linkId, replaced }
  ◄── 307 a /portal (el resultado, en la cookie de sesión)
```

### Las cuatro decisiones del portal

**1 · El vínculo se pide en el callback, no con un botón después.** te-api sólo
acepta ID tokens de **menos de cinco minutos** (`src/b2b/portal-id-token.ts`), a
propósito: un ID token viejo que sigue vinculando es un ID token filtrado que
sigue vinculando. Guardarlo «para cuando el titular pulse» produce un fallo
intermitente que parece de red y no lo es.

**2 · El ID token no se guarda en ninguna parte.** Ni en cookie, ni en base, ni
en el log. Es la prueba entera del vínculo: quien lo tenga puede atar a esa
persona a un cliente de esta organización. Lo que sobrevive en la cookie de
sesión es el **resultado** (`linkId`), que no es canjeable por nada.

**3 · Quién eres «en el banco» lo decide el banco, con el correo verificado.**
`findCustomerByEmail` cruza el `email` del ID token contra el padrón propio. Ese
correo llega del token verificado y **nunca de un formulario**: si viniera del
navegador, cualquiera escribiría el correo de otro y se ataría al cliente de
otro, y te-api no lo podría ver — para te-api el `sub` es el bueno y el
`external_id` es cosa del banco. Dos fichas con el mismo correo → no se vincula,
en vez de elegir una al azar.

**4 · La aplicación de Logto del portal NO es la aplicación M2M.** La M2M
autentica al servidor contra te-api; ésta autentica a una persona. Y su
`client_id` es además el `aud` que te-api exige del ID token, así que compartirlas
haría que el mismo identificador significara dos cosas.

> ⚠️ **`POST /v1/b2b/links` responde `403 cannot_complete` a cuatro cosas
> distintas**: firma mala, `aud` de otra organización, `iat` fuera de la ventana,
> y **`sub` sin perfil en `te.subject`** — o sea, una persona que todavía no
> tiene cartera de TripleEnable dada de alta. El último es el caso normal en un
> entorno de pruebas y el único accionable, y es el que nombra el mensaje de
> `describeTeApiError`. El motivo real está en `te.request_event` de te-api, con
> el `requestId` que la pantalla enseña.

### Del lado de Logto y de te-api

Para que esto funcione hacen falta **dos cosas que no están en este repositorio**:

1. Una aplicación **Traditional Web** en Logto con
   `redirect_uri = <CRM_PORTAL_BASE_URL>/portal/callback`.
2. Su `client_id` sembrado en el padrón de te-api:
   `TE_PARTNER_PORTAL_CLIENT_ID=<ese client_id> npm run seed:partner`.

Si los dos valores no coinciden carácter a carácter, el vínculo falla con el
`403` de arriba y no dice por qué. La receta entera, con los valores del entorno
de pruebas, está en [`docs/ENTORNO-DE-PRUEBAS.md`](../docs/ENTORNO-DE-PRUEBAS.md)
§3 y §13.

## Levantarlo

Hace falta Node ≥ 20.12 (por `process.loadEnvFile`) y un Postgres.

```bash
npm install
cp .env.example .env.local          # y rellenarlo, ver la tabla de abajo
npm run db:migrate                  # crea la tabla `customer`
npm run db:seed                     # opcional: el padrón de prueba de cada organización
npm run dev                         # http://localhost:3000
```

`db:seed` siembra **todas** las organizaciones declaradas que tengan padrón de
prueba (13 clientes de Banco Demo, 10 de Seguros Aurora, 10 de Clínica San
Rafael). Es idempotente. `CRM_SEED_ORG=<SLUG>` limita a una.

Los nombres y los correos sembrados están **en inglés** desde el 2026-08-30; los
identificadores, los teléfonos y las referencias de sector **no cambiaron**,
porque el `external_id` viaja como `sub` dentro de cada credencial ya emitida.
Como la siembra es `on conflict do nothing`, una base con el padrón viejo no se
actualiza sola: hay que borrar esas filas por su `external_id` y volver a
sembrar.

Dos direcciones, no una:

```
http://localhost:3000/customers     la consola de agentes
http://localhost:3000/portal        el portal del cliente
```

Las dos abren **en inglés** salvo que el navegador pida otra cosa en
`Accept-Language`. El selector de la barra lateral —y el de la cabecera del
portal— cambian al castellano sin recargar nada más que la pantalla.

**En `localhost` a secas la organización sale de `CRM_ACTIVE_ORG_ID`**, porque
`localhost` no es el dominio de nadie. Para probar las tres sin reiniciar,
declara sus alias de desarrollo (`CRM_ORG_<SLUG>_DEV_HOSTS`) — `*.localhost`
resuelve a `127.0.0.1` sin tocar `/etc/hosts`:

```
http://bank.localhost:3000/customers
http://seguros.localhost:3000/customers
http://clinica.localhost:3000/customers
```

Y el documento DID, que **no** tiene ese respaldo — en `localhost` a secas da
404, a propósito:

```bash
curl -s -H "Host: bank.demo-te.com" http://127.0.0.1:3000/.well-known/did.json
```

El portal necesita además la aplicación de Logto y el `portal_client_id` en el
padrón de te-api — ver «El portal del cliente» más arriba. Sin ellos el botón de
entrar se queda deshabilitado y la pantalla lo dice **con las palabras de un
titular**, no con las de quien despliega, en vez de mandar a nadie a un error de
Logto: el nombre de la variable que falta está en `/diagnostics`, que es la
pantalla de quien puede ponerla.

Un Postgres de usar y tirar, si no hay otro a mano:

```bash
docker run -d --name crm-demo-pg \
  -e POSTGRES_USER=crm -e POSTGRES_PASSWORD=crm -e POSTGRES_DB=crm_demo \
  -p 55432:5432 postgres:16-alpine
# DATABASE_URL=postgres://crm:crm@localhost:55432/crm_demo
```

O, si ya está corriendo el `logto-pg` del entorno de pruebas, **una base aparte
dentro de él** — que es lo que se hizo el 2026-08-29 y ahorra un contenedor:

```bash
docker exec logto-pg psql -U postgres -c 'create database crm_demo'
# DATABASE_URL=postgres://postgres:p0stgr3s@127.0.0.1:5459/crm_demo
```

Compartir contenedor no es compartir base: `crm_demo` es suya, y ni te-api ni
Logto tienen su cadena de conexión en ninguna parte.

### La trampa de las dos variables que parecen la misma

Contra la te-api **local** el `.env.local` queda así, y la asimetría es
deliberada:

```bash
TE_API_BASE_URL=http://127.0.0.1:3011                          # DÓNDE está te-api
TE_B2B_RESOURCE=https://te-api.idp.tripleenable.com/v1/b2b     # QUIÉN es el recurso
```

`TE_B2B_RESOURCE` **no cambia** aunque te-api corra en `localhost`: es el
indicador del recurso de API en Logto, o sea el `aud` que Logto firma y que
te-api compara. Cambiarlo por la dirección local hace que Logto emita un token
**opaco** —no existe ese recurso— y te-api conteste el 404 de la puerta, que es
el mismo para ocho motivos. Se pierde media tarde. La dirección va en
`TE_API_BASE_URL`, y sólo ahí.

Lo primero que hay que mirar es **`/diagnostics`**: llama a
`GET /v1/b2b/organization` y enseña quién dice te-api que eres, con qué DID
emites y qué tipos tienes en el padrón. Si eso responde, la integración está
bien y no ha hecho falta emitirle una credencial a nadie para saberlo.

## Variables de entorno

Ninguna es `NEXT_PUBLIC_*`. Los módulos que las leen son `server-only`, así que
importarlos desde un componente de cliente **no compila**.

| Variable | Qué es |
|---|---|
| `DATABASE_URL` | La base del CRM. Sólo del CRM |
| `LOGTO_ENDPOINT` | `https://auth.idp.tripleenable.com` — de donde sale el token M2M |
| `TE_B2B_RESOURCE` | El indicador del recurso B2B. **Idéntico** al `TE_B2B_RESOURCE` de te-api, carácter a carácter |
| `TE_B2B_SCOPE` | `credentials:issue` por defecto |
| `TE_API_BASE_URL` | Base de te-api; respaldo del `ISSUER_URL`/`VERIFIER_URL` de cada organización |
| `CRM_ORG_<SLUG>_ID` | El `organization_id` de Logto |
| `CRM_ORG_<SLUG>_NAME` | Rótulo para la interfaz |
| `CRM_ORG_<SLUG>_DOMAIN` | **Su dominio, que es su identidad.** De aquí salen el `did:web:<dominio>` que publica y qué padrón enseña la consola en ese dominio. Sin él no publica documento DID (la ruta da 404) y sólo se llega por `CRM_ACTIVE_ORG_ID` |
| `CRM_ORG_<SLUG>_DEV_HOSTS` | Hosts que **además** encaminan aquí, sin ser su identidad. Sólo desarrollo (`seguros.localhost`). **No entra en ningún documento DID** |
| `CRM_ORG_<SLUG>_OFFICIAL_NUMBERS` | Los teléfonos desde los que llama de verdad, separados **por comas**. No son adorno: van firmados dentro de la credencial como `official_numbers` |
| `CRM_ORG_<SLUG>_M2M_CLIENT_ID` | La aplicación M2M de esa organización |
| `CRM_ORG_<SLUG>_M2M_SECRET` | Su secreto. **Sólo en el servidor** |
| `CRM_ORG_<SLUG>_ISSUER_URL` | Base de te-api para emitir. Opcional |
| `CRM_ORG_<SLUG>_VERIFIER_URL` | Base de te-api para verificar. Opcional |
| `CRM_TYPE_<CLAVE>_LABEL` | Cómo se rotula un tipo de credencial **que el catálogo de mensajes no conozca**. Para `cliente`, `asegurado` y `paciente` no hace nada: los rotula el catálogo, que es lo único que puede estar en dos idiomas. Sin ninguno de los dos, el `type_key` tal cual. `<CLAVE>` es el `type_key` en mayúsculas con `[^A-Z0-9]` → `_` |
| `CRM_TYPE_<CLAVE>_CLAIMS` | Qué atributos lleva ese tipo, separados por espacios o comas. Sin él, todos los del catálogo del padrón |
| `CRM_TYPE_<CLAVE>_DEFAULT_CLAIMS` | Cuáles van marcados al abrir la comprobación. Sin él, el mínimo de identidad del catálogo |
| `CRM_SEED_ORG` | Sólo para `npm run db:seed`: limita la siembra a un slug. Sin él siembra todas las declaradas |
| `CRM_ACTIVE_ORG_ID` | **El respaldo**, no el selector: la organización para las peticiones cuyo `Host` no es de ninguna. **En producción no se pone** — sin ella, un dominio ajeno lo dice en vez de enseñar el padrón de la primera. Se puede omitir si sólo hay una declarada |
| `CRM_ACTIVE_ACTOR` | Etiqueta del operador para el diario, mientras no haya login de empleado |
| `CRM_ACTIVE_AGENT_ID` | El número de agente que ve el **titular** en su móvil cuando suena el timbre. te-api **no lo verifica**: es atribución |
| `CRM_ACTIVE_AGENT_NAME` | El nombre del agente, igual. Sin estas dos al titular le sale «Agente de \<la organización\>», compuesto con su nombre — no se inventa un nombre de persona |
| `CRM_ORG_<SLUG>_PORTAL_CLIENT_ID` | La aplicación **Traditional Web** del portal de esa organización. Es además el `portal_client_id` que te-api tiene en su padrón |
| `CRM_ORG_<SLUG>_PORTAL_CLIENT_SECRET` | Su secreto. **Sólo en el servidor.** Va junta con la de arriba: una sin la otra es un error de configuración y se ve al arrancar |

**El idioma no está en esta tabla, y no falta:** no es una variable de entorno.
Lo elige quien mira la pantalla, se guarda en la cookie `crm_locale` y por
defecto se negocia con `Accept-Language`. Ver «El idioma».
| `CRM_ORG_<SLUG>_PORTAL_LINK_TYPE` | El `type` que el portal declara al vincular (`cliente`). Opcional |
| `CRM_ORG_<SLUG>_PORTAL_BASE_URL` | La dirección pública del portal **de esa organización**. De aquí sale su `redirect_uri`, que Logto compara carácter a carácter con el declarado en **su** aplicación. Con tres dominios hace falta por organización |
| `CRM_PORTAL_BASE_URL` | El respaldo de la anterior, y lo que se usa en local (las tres viven en `localhost:3000`). **Nunca sale de la cabecera `Host`** |
| `CRM_PORTAL_COOKIE_SECRET` | Firma la cookie de sesión del portal (HS256). 32 caracteres o más |

### Añadir una organización

Copiar el bloque `CRM_ORG_…` con otro slug y reiniciar. No se toca código: la
configuración se descubre recorriendo el entorno. El slug va en **mayúsculas y
sin guiones bajos** — el descubrimiento busca las claves que acaban en `_ID`, y
con guiones bajos permitidos `CRM_ORG_X_M2M_CLIENT_ID` se leería como una
organización llamada `X_M2M_CLIENT`.

Lo que no se puede olvidar es **`CRM_ORG_<SLUG>_DOMAIN`**: sin él la
organización existe pero no publica su documento DID —`/.well-known/did.json`
devuelve 404 en su dominio— y la cartera no puede verificar sus credenciales. El
síntoma en el teléfono es «no podemos verificar quién emite esto», que no se
parece a «te falta una variable», y por eso Diagnóstico lo dice en una fila. Si
además tiene portal, su `CRM_ORG_<SLUG>_PORTAL_BASE_URL`.

Y en Coolify hay que **declarar el dominio contra esta misma aplicación**, que
es lo que hace que Traefik lo enrute aquí y lo que dispara el certificado.

Si emite **otro tipo de credencial**, tampoco es código: los tipos ya salen de
su padrón en te-api, y lo que lleva cada uno se declara con las tres variables
`CRM_TYPE_<CLAVE>_…` de arriba. Lo único que sí es código es añadir una **columna
nueva al padrón** del CRM y su entrada en `CUSTOMER_ATTRIBUTES` — porque un
atributo que no tiene columna no tiene de dónde salir.

**Y eso pasó de verdad el 2026-08-30**, así que el ejemplo ya no es hipotético:
Seguros Aurora necesitaba `policy_number` y Clínica San Rafael
`medical_record_number`, y salieron en `db/005_sector_reference.sql` con sus dos
entradas en el catálogo. Son dos columnas y no una genérica porque **el nombre
de la columna es el nombre del claim**, y un verificador que recibe
`sector_reference` no sabe qué tiene delante.

## Lo que se puede demostrar

- **Ni un secreto en el navegador.** `npm run build` y luego
  `grep -ril "M2M_SECRET\|client_secret\|m2mSecret\|PORTAL_CLIENT_SECRET" .next/static`
  — vacío. Comprobado el 2026-08-29 con los secretos del portal ya puestos; ni
  siquiera sale el `client_id` del portal, que no es secreto pero tampoco pinta
  nada ahí.
- **te-api responde sin ninguna sesión de empleado.** `curl` a
  `/api/organization` sin cookies: contesta igual.
- **El `tx_code` no viaja por el mismo canal que el enlace.** El PIN se pinta en
  su propia tarjeta y no se manda a ningún sitio.
- **El portal no puede vincular con un ID token que no sea suyo.** Se mandó a
  `POST /v1/b2b/links` un ID token con `iss` y `aud` correctos y firma
  inventada: `403 cannot_complete`, y en el diario de te-api
  `b2b.link_denied` con `no applicable key found in the JSON Web Key Set`. No se
  creó ninguna fila de vínculo.
- **Vincular dos veces no duplica nada.** Segundo login del mismo titular:
  `alreadyLinked: true`, una sola fila en `te.org_subject`, mismo `linkId`.
- **De la verificación sólo vuelve lo que se pidió.** Se hizo presentar a la
  cartera **las cuatro** divulgaciones habiendo pedido sólo `given_name`, y la
  respuesta de te-api trajo un solo claim, `given_name`, y nada más. (El valor
  concreto era el del padrón de entonces: los nombres sembrados pasaron al
  inglés el 2026-08-30 y los identificadores no, que es lo que ata la
  credencial.)
- **Un identificador de cliente con una expresión regular dentro no cuela.** Se
  pidió una presentación con `subjectReference = ".*"`: te-api construyó la
  política del verificador con el valor escapado (`\.\*`), la credencial real
  no cuadró y la sesión acabó en `failed`.
- **«Volver a intentarlo» abre una petición nueva y no toca la vieja.** Probado
  en el navegador el 2026-08-30 sobre una comprobación con el plazo agotado: el
  botón lanzó `POST /api/credentials/present` con los cuatro mismos valores del
  diario, te-api devolvió otro `presentationId` con su propio plazo, y la pantalla
  navegó a él con su QR y su cuenta atrás. La fila anterior se quedó como estaba.
  En el canal de teléfono, cuando el timbre falla, el error sale **en el propio
  bloque de estado** y no se anota ninguna fila — que es lo que ya hacía lanzar
  la comprobación por primera vez.

## Del lado de te-api

Para que esto funcione, la organización tiene que estar dada de alta en el
padrón de te-api (`npm run seed:partner` en `tripleenable-api`), y su aplicación
M2M tiene que ser miembro de la organización en Logto con el rol que lleva
`credentials:issue`.

Si falta algo de eso, **te-api contesta `404` a todo por igual**: token ausente,
firma mala, `aud` de otro recurso, caducado, sin `organization_id`, organización
que no está en el padrón, partner suspendido y scope que falta salen todos
iguales, con el mismo cuerpo y la misma latencia. Es deliberado. Lo único
accionable desde fuera es el `requestId`, que por eso se enseña en pantalla
cuando la emisión falla: con él, el motivo real está en `te.request_event`.
