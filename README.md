# crm-demo · el CRM de demostración

La consola de agentes de **una empresa de mentira** que emite credenciales de
verdad. Es la pieza de [`F4`](../docs/fases/F4-crm.md) y **es la única maqueta
del proyecto** — pero la mitad que habla con nosotros no lo es: el token B2B y la
emisión son los de producción.

> **Sus empleados son reales; sus clientes son locales.**
> Los clientes son filas en la base de este proyecto. Ni te-api ni Logto las leen
> nunca, igual que no leemos el núcleo bancario de un banco de verdad.

> **UNA INSTALACIÓN, UN INQUILINO.**
> Toda la identidad de la empresa sale de **su propia base** —de la fila de
> `tenant_settings`, escrita desde la pantalla de ajustes— y **la cabecera `Host`
> no decide nada**. Para servir a una segunda empresa se publica la misma imagen
> otra vez con otro dominio y otra base.
>
> Hasta el 2026-08-31 esto era al revés: un despliegue servía a cuatro empresas y
> el `Host` de la petición elegía de cuál era cada pantalla. Se retiró entero por
> decisión del dueño, con el argumento de que **el CRM de una empresa es de esa
> empresa**: un despliegue que multiplexa cuatro clientes por una cabecera no se
> parece a nada que uno de ellos vaya a instalar. Con él se fueron el mapa de
> organizaciones, los prefijos `CRM_ORG_<SLUG>_`, los alias de desarrollo y
> `CRM_ACTIVE_ORG_ID`.

> **Las dos instalaciones de la demostración** son **Banco Demo**
> (`bank.demo-te.com`) y **Larkfield Energy** (`energy.demo-te.com`). Los dos
> bloques de variables, completos y listos para pegar en Coolify, están en
> [`.env.example`](.env.example).

> **LA CONFIGURACIÓN SE ESCRIBE DESDE LA CONSOLA, NO DESDE EL ENTORNO.**
> Desde el 2026-08-31 una instalación se levanta con **`DATABASE_URL` y nada
> más**, y se configura desde `/settings`: su organización de Logto, su
> aplicación de máquina y su secreto, su marca, sus teléfonos y el secreto de
> firma del webhook. Esa pantalla enseña además, arriba del todo y con botón de
> copiar, **su propia dirección de webhook**, que es el único dato que hay que
> llevarse a tenant-admin.
>
> La regla, que es una sola y está escrita en
> [`src/lib/tenant-settings.ts`](src/lib/tenant-settings.ts): **la base manda; el
> entorno siembra la fila la primera vez y después no se vuelve a leer.** Un
> despliegue que ya tenía su `.env` entero sigue arrancando igual —la primera
> petición siembra con lo que había— y desde entonces se cambia en la pantalla.
> `DATABASE_URL` es la única variable que sigue siendo obligatoria.

## Lo que hay hoy y lo que no

| | |
|---|---|
| ✅ | Next.js (App Router, TypeScript) con el patrón de `tenant-admin`: proxy en el servidor, ni un secreto en el navegador |
| ✅ | Base propia Postgres con `customer`, migración reproducible y siembra aparte |
| ✅ | Listado de clientes con **buscador** (nombre, identificador, correo o la referencia del sector —los cuatro de la cuenta o el punto de suministro—, sin acentos) y dos columnas de estado por cliente, y alta de cliente. La columna de referencia la elige **lo que el padrón rellena**, no una variable |
| ✅ | Cliente del token B2B en el servidor: `client_credentials` + `resource` + `organization_id` + `scope`, cacheado y renovado antes de caducar |
| ✅ | Botón «emitir credencial» → `POST /v1/b2b/credentials` de te-api → QR, enlace debajo y PIN aparte. **Probado de punta a punta el 2026-08-29**: la credencial se recogió con el flujo OID4VCI y salió con `iss = did:web:bank.demo-te.com`, `sub` = el `external_id` de la ficha y los cuatro claims como divulgaciones |
| ✅ | **Una instalación, un inquilino**, con la configuración plana en el entorno (`src/lib/organization.ts`). Servir a otra empresa es publicar la imagen otra vez; un sector nuevo necesita además su columna en el padrón (`db/005_…`, `db/006_…`) |
| ✅ | **Marca por instalación**: dos colores y un monograma por variables de entorno (`src/lib/brand.ts`), aplicados como tokens CSS en el `<body>` desde el servidor. Sin declarar marca se queda la paleta de la hoja. Los colores de **estado** —rojo/ámbar/verde/azul— no se repintan nunca |
| ✅ | **Receptor de webhooks** en `POST /api/webhooks/te-api`, con la firma comprobada (`te-signature-sha-256`, HMAC-SHA256 sobre `t.cuerpo`, hex, dos firmas durante una rotación) y **rechazo si no cuadra**. Lo recibido se guarda en `webhook_event` y se ve en `/events`, con la firma en su propia columna. Ver «El webhook» |
| ⛔ | **Login de empleado con Logto OIDC.** Es la casilla que queda de F4a. Mientras no esté, esta consola **no está autenticada** y no puede publicarse donde llegue nadie de fuera |
| ↩ | **El portal del cliente en `/portal` (F4b) se retiró el 2026-08-31.** Lo hubo, funcionaba y se probó en el navegador el 2026-08-29: el titular entraba con su cuenta de TripleEnable y de ese login nacía el vínculo (`POST /v1/b2b/links`). Se quitó entero —rutas, sesión, columnas y variables— porque el supuesto de partida era falso, y **el vínculo no nace de un login: nace cuando el titular acepta una credencial de esa entidad en su cartera**. El porqué entero está en «El vínculo con la cartera, y por qué esta consola no lo crea» |
| ✅ | **El diario del banco**: cada oferta emitida y cada comprobación lanzada quedan anotadas (`credential_offer`, `verification`), y la ficha las enseña con su hora y su autor. Es lo que permite que el listado tenga estado y que una verificación tenga dirección propia |
| ⛔ | Estado real **de la credencial y del vínculo**: si el titular aceptó la oferta o si tiene cartera enrolada. te-api no lo cuenta, así que la ficha dice «ofrecida» —lo que hizo el banco— y **no pinta ninguna insignia** de «credencial activa» ni de «perfil verificado» |
| ✅ | Botón «pedir credencial» → `POST /v1/b2b/presentations` de te-api → QR de la petición OID4VP, y en la misma pantalla lo que el titular enseñó. **Probado de punta a punta el 2026-08-29** con un guion que hace de cartera: `pending` → la cartera presenta → `verified` con `given_name` y `family_name`, y sólo con ésos |
| ✅ | **La vía telefónica**: «está al teléfono · avisar a su móvil» → la misma presentación **más `POST /v1/b2b/wakeups`**, el timbre. Es lo que hace que la comprobación sirva para una llamada, donde el cliente no ve la pantalla del agente. **Probado el 2026-08-29**: la llamada sale con `kind: identity` y el `actor` del empleado, te-api contesta `{ wakeupId, expiresAt }` y anota `b2b.wakeup_created`. **Ningún teléfono ha sonado todavía** — ver «Lo que falta para que suene un teléfono» |
| ✅ | **Consola bilingüe.** El original está en **inglés** y el castellano es una traducción; lo elige quien mira la pantalla y no el dominio, se guarda en una cookie y **no hace falta reconstruir la imagen** para cambiarlo. Ver «El idioma» |
| ⛔ | **Revocación** (la otra mitad de F4c) |
| ✅ | `/.well-known/did.json`, compuesto **siempre con `CRM_ORG_DOMAIN`** (`src/app/.well-known/did.json/route.ts`). Las claves las da te-api y esta ruta no puede caerse por ello; si te-api no tiene ninguna, devuelve **404**, que es la verdad — esa empresa todavía no ha encendido su emisión. El `Host` ya no participa: el `id` del documento es el mismo diga lo que diga la petición, así que apuntar un DNS aquí no fabrica una identidad |
| ⛔ | Que el documento de **Larkfield Energy** se descargue de su dominio. Faltan dos cosas: **declarar el dominio en Coolify**, que es lo que dispara el certificado (ver [`DOMINIOS.md`](../docs/fases/DOMINIOS.md) §4), y que encienda su emisión — sin claves suyas en te-api la ruta devuelve 404 |

## Una sección, no dos

Este proyecto sirve **una sola pantalla**, y es de dentro: la consola que usan
los empleados de la entidad. **A ninguna ruta de esta aplicación entra un
cliente.**

| | Quién la usa | Qué ve | Qué autentica |
|---|---|---|---|
| `(console)` — `/customers`, `/verifications`, `/diagnostics` | Un **empleado** de la entidad, desde el mostrador | El padrón entero de clientes | Nada todavía (F4a pendiente). Contra te-api autentica el **token M2M** |

Hubo una segunda, `portal` —la del titular—, y se retiró el 2026-08-31: ver «El
vínculo con la cartera, y por qué esta consola no lo crea».

El grupo `(console)` no cambia ninguna URL —los paréntesis son de Next.js— y **se
queda aunque hoy sea el único**. La raíz no pone cabecera, y que cada grupo de
rutas ponga la suya es lo que hace que un enlace a «Clientes» **no exista** fuera
de la consola, en vez de existir escondido tras un `if`. Un `if` en una cabecera
compartida se olvida; el día que haya una segunda sección, compartir cabecera
sería compartir navegación.

## El idioma

**El original es el inglés.** `src/i18n/messages/en.ts` es el catálogo del que
sale el tipo `MessageKey`, así que una clave que no exista allí no compila;
`es.ts` es una **traducción** y todo lo suyo es opcional. Una clave sin traducir
cae al inglés — no revienta y **no pinta nunca el nombre de la clave**.

> ⚠ Este README está escrito en castellano y **cita los textos de pantalla en
> castellano**. Son la traducción, no el original: por defecto la consola se ve
> en inglés, y lo que sale ahí es lo que dice `messages/en.ts`.

**Lo elige quien mira la pantalla, y no el dominio ni el entorno.** El dominio es
la identidad de la organización (`src/lib/organization.ts`) y ésa es otra
pregunta: de quién es esta consola, frente a en qué idioma la lee quien la tiene
delante. Atarlas obligaría a un dominio por idioma, y ponerlo en el entorno
—fácil ahora que hay una instalación por empresa— ataría el idioma de un empleado
a la entidad para la que trabaja, cuando en un mostrador se sientan personas
distintas. Tampoco va en la ruta —nada de
`/en/customers`—: un segmento delante cambiaría el enlace que un agente pega en
un chat para pasar una verificación, el `redirect_uri` declarado en Logto y
`/.well-known/did.json`, que tiene que responder en la raíz del dominio o la
cartera no resuelve el `did:web`.

Así que va en **una cookie**, `crm_locale`, que escribe el selector de la barra
lateral. Sin cookie se negocia con `Accept-Language` del navegador, y si tampoco
dice nada, inglés. **No hay ninguna variable de entorno del idioma y no hay que
reconstruir nada para cambiarlo.**

| Fichero | Qué es |
|---|---|
| `src/i18n/config.ts` | Los idiomas, la cookie, la negociación de `Accept-Language` |
| `src/i18n/messages/en.ts` · `es.ts` | El catálogo original y su traducción |
| `src/i18n/translate.tsx` | El traductor: `t()`, `t.rich()` y el respaldo al inglés |
| `src/i18n/server.ts` · `client.tsx` | Cómo lo consigue el servidor (cookie) y el navegador (contexto) |
| `src/i18n/actions.ts` | La acción que escribe la cookie |
| `src/components/LocaleSwitch.tsx` | El selector, en la barra lateral de la consola |

Lo que **no** se traduce, y a propósito: los comentarios del código
(`AGENTS.md` §0.5), los mensajes de `console.error` —diagnóstico interno, que se
lee junto a esos comentarios— y los errores de configuración que lanza `src/lib`
(«falta esta variable»), que están en inglés fijo porque los lee quien despliega
y van al lado de lo que conteste Postgres, que también viene en inglés.

## Las pantallas de la consola, y por qué son varias y no una

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
| `/settings` | **La configuración de esta instalación**, guardada en su propia base: su organización de Logto, su aplicación de máquina y su secreto, su marca, su referencia de sector, sus teléfonos y el secreto de firma del webhook. Arriba del todo enseña **su propia dirección de webhook**, entera y con botón de copiar, que es el único dato que hay que llevarse a tenant-admin. Abajo, dos botones que prueban la integración **en los dos sentidos**: pedir un token a Logto y llamar a `GET /v1/b2b/organization`, y pedirle a te-api que mande un `webhook.test` a esta instalación. Los **dos** secretos —el de la aplicación de máquina y el del webhook— **se escriben y no se releen**: sólo se enseña su huella | — |
| `/diagnostics` | La costura con te-api, la configuración de la organización (dominio, `did:web`, números oficiales, marca, **webhook**), de dónde sale el idioma, y una comprobación real de la base. **Ajustes escribe; Diagnóstico mira** — lo que enseña aquí y no allí es lo que contesta te-api y el recuento de entregas | — |
| `/events` | Los **eventos recibidos por webhook**: cuándo, de qué tipo, a qué cliente afectan y si la firma cuadró. Es la única parte de la integración que ocurre sin que nadie esté mirando, y por eso tiene pantalla | — |

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
   │  1. entorno → organización           src/lib/organization.ts
   │     sesión → organización            src/lib/session.ts
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
   │  1. entorno → organización           src/lib/organization.ts
   │     sesión → organización y EMPLEADO
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
número del empleado que le está llamando —`CRM_AGENT_NAME` y `CRM_AGENT_ID`— y
para el diario. La ficha lo pinta debajo de los botones a
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

**3 · Se sondea Y se recibe, y las dos cosas hacen falta.** Aquí ponía «se
sondea, no hay webhook», y era verdad hasta el 2026-08-31: lo que faltaba no era
soporte en te-api —que tiene cola, reintentos y firma— sino **el receptor**.
Tanto que el webhook de Banco Demo apuntaba a `webhook.site`, una dirección de
prueba que no es de nadie.

Ahora hay las dos, y no compiten:

| | Para qué | Cuándo gana |
|---|---|---|
| **El sondeo** (`GET /v1/b2b/presentations/:id`, cada 3 s) | El agente está mirando la pantalla con el cliente al teléfono | Siempre que la pestaña esté abierta |
| **El webhook** (`POST /api/webhooks/te-api`) | El titular contesta media hora después y no hay nadie mirando | Siempre que no la esté |

El primero en llegar cierra el diario (`settleVerification` sólo escribe si la
fila sigue en `pending`). El sondeo va a 3 s porque la consulta pasa por el cubo
de tasa por organización de te-api, que comparte con la emisión.

Y **el barrido no se quita al añadir el receptor**: es el camino cuando la
entrega se perdió, y es el único que trae los claims — el evento lleva el
veredicto pero no el dato personal, a propósito. Ver «El webhook».

### Nada de una empresa concreta está cableado

`VerificationLauncher.tsx` y `VerificationTracker.tsx` no tienen escrito ni un
`given_name` ni un `cliente`, `session.ts` ya no compone «Agente de Banco Demo» a
mano, y el ejemplo del identificador en el alta salió del código al catálogo el
2026-08-31 — era `BD-99120447`, que en la consola de una eléctrica es el mismo
error que ofrecerle la casilla de otro sector. Las tres
fuentes, en orden:

| Qué | De dónde sale |
|---|---|
| La lista de **tipos** | `GET /v1/b2b/organization` de te-api. Ya era así |
| Los **atributos** de cada tipo, y sus rótulos | Configuración: `CRM_TYPE_<CLAVE>_CLAIMS` |
| Qué va **marcado** al abrir | `CRM_TYPE_<CLAVE>_DEFAULT_CLAIMS`, o el mínimo de identidad del catálogo |
| El **rótulo** de un tipo | El catálogo de mensajes (`credentialTypes.<type_key>`), luego `CRM_TYPE_<CLAVE>_LABEL`, y si no, el `type_key` tal cual |
| El nombre de la **empresa** | `CRM_ORG_NAME`, del entorno del proceso |

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
   se para en la puerta siguiente. El vínculo **no se crea desde aquí**: nace
   cuando el titular acepta una credencial de esta entidad en su cartera — ver
   «El vínculo con la cartera». En los dos casos la fila nace **señuelo** y
   te-api contesta exactamente igual, que es el comportamiento correcto y no un
   fallo que haya que perseguir desde aquí.
3. **`TE_PUSH_ENABLED=true` en te-api.** Con el canal apagado la ruta falla en
   voz alta (`400 unauthorized_client`) en vez de devolver un `wakeupId` que no
   va a sonar nunca.

## El vínculo con la cartera, y por qué esta consola no lo crea

**Aquí hubo un portal del cliente en `/portal`, y se retiró entero el
2026-08-31.** Estaba escrito, funcionaba y estaba probado: el titular entraba con
su cuenta de TripleEnable, esta aplicación verificaba el ID token y llamaba a
`POST /v1/b2b/links`. Se fueron con él las rutas (`/portal`, `/portal/login`,
`/portal/callback`, `/portal/logout`), los tres módulos que las sostenían
(`portal-oidc.ts`, `portal-session.ts`, `portal-guard.ts`), sus casillas de
`/settings`, su fila de `/diagnostics`, sus cinco variables `CRM_PORTAL_*` y sus
cinco columnas de `tenant_settings`, que borra
[`db/009_drop_portal.sql`](db/009_drop_portal.sql) — dos de ellas guardaban
secretos, y una columna que ya nadie lee pero que sigue teniendo un secreto
dentro es lo peor de las dos opciones.

Se quitó por **dos razones, y ninguna es que estuviera mal escrito**:

**1 · Esta instalación es la consola de dentro.** La usan los empleados de la
entidad. **Un cliente no entra en la consola interna de su banco**, y un banco no
registra esa consola como aplicación OIDC para que entren sus clientes — ya tiene
su banca electrónica, que es otra aplicación, de otro equipo y con otra puerta.
Un portal del titular metido aquí dentro no existe en ningún despliegue real, así
que su configuración tampoco tenía por qué ocupar cinco columnas de la tabla de
ajustes.

**2 · El vínculo no nacía de ese login.** **Un perfil de TripleEnable queda
vinculado cuando el titular acepta una credencial de esa entidad en su cartera.**
Es un trato entre la cartera y la plataforma, y esta consola **no participa en
crearlo**. El portal producía el ID token que `POST /v1/b2b/links` exige, sí, pero
estaba fabricando por la puerta de atrás un hecho que ocurre solo por la de
delante, en cuanto la credencial que esta pantalla ya sabe emitir llega a su
destino.

### Lo que sí se conserva: **leer** el vínculo

`GET /v1/b2b/links` sigue llamándose, desde `hasActiveWalletLink`
([`src/lib/te-api.ts`](src/lib/te-api.ts)), y es lo que decide si el botón de
avisar al móvil sirve para algo. **Se fue la escritura, no la lectura**: esta
integración ya no crea vínculos, pero pregunta si los hay.

| | Quién lo hace | Estado |
|---|---|---|
| `POST /v1/b2b/links` — **crear** el vínculo | La cartera y la plataforma, cuando el titular acepta una credencial | **Retirado de aquí** el 2026-08-31 |
| `GET /v1/b2b/links?subjectReference=…` — **preguntar** si lo hay | Esta consola, con su token M2M | **Vivo.** Es lo que sabe la pantalla de comprobación |

Y hay una razón para preguntarlo por ahí y no en la respuesta del timbre, además
de la privacidad: **el scope no es el mismo**. El timbre acepta
`verifications:request` a secas y el directorio exige `credentials:issue`, así
que meter el hecho en la respuesta del timbre se lo enseñaría a una credencial
más débil de la que hoy hace falta para leerlo. Y llegaría tarde: la pantalla
necesita saberlo **antes** de disparar, para no prometer un aviso que no va a
salir.

Cuando no hay vínculo, el botón del teléfono se queda **deshabilitado con «No
wallet to alert»** y la pantalla dice el hecho —esta persona no tiene cartera
vinculada con esta entidad— y la salida: enseñarle el QR si está delante, o
emitirle una credencial, que es lo que crea el vínculo al aceptarla. Eso **no ha
cambiado** y sigue siendo correcto.

⚠️ `hasActiveWalletLink` contesta por **el vínculo y nada más**. No dice si el
titular está suspendido, si retiró la cartera, si está en el escalón de bloqueo o
si tiene algún aparato elegible: esas cuatro razones también hacen que el timbre
no suene, y ninguna se publica en ningún sitio. Si el directorio no contesta,
devuelve `undefined` y la pantalla **no afirma nada** — es mejor no decir que
decir de más.

### Lo que se queda del portal en el historial, y no es un olvido

El canal de entrega **`app`** —«le espera en el portal, ya autenticado»— **dejó
de ofrecerse**: sin portal, esa oferta no la recogería nadie, y una entrega que
no entrega es peor que no ofrecer el canal. Al emitir quedan tres canales: `qr`,
`link` y `email` ([`src/lib/delivery.ts`](src/lib/delivery.ts)).

Pero las filas de `credential_offer` que se crearon con él **se quedan**, la
restricción de `db/004_offer_delivery.sql` sigue aceptando `app`, y el historial
de la ficha las sigue rotulando con su frase. Son el registro de lo que esta
consola hizo de verdad —el 29 de agosto se ofreció una credencial por ese
canal—, y reescribir el historial para que cuadre con lo que hoy se puede hacer
sería falsificarlo. Quitar su rótulo no borraría la fila: la dejaría escrita en
jerga (`app`) en la pantalla que un empleado lee meses después.

## Levantarlo

Hace falta Node ≥ 20.12 (por `process.loadEnvFile`) y un Postgres.

```bash
npm install
echo 'DATABASE_URL=postgres://…' > .env.local   # la ÚNICA obligatoria
npm run db:migrate                              # crea las tablas
npm run dev                                     # http://localhost:3000
```

Y después **se configura en el navegador**, en `/settings`. Una instalación sin
configurar no falla ni sale en blanco: la consola lleva sola a esa pantalla y
lista qué falta. El recorrido completo —dar de alta las aplicaciones en
tenant-admin y pegarlas aquí— es exactamente el que se quiere poder enseñar.

Si prefieres sembrarla desde un `.env` —o ya tenías uno—, `cp .env.example
.env.local` y rellenarlo sigue funcionando: la primera petición copia esos
valores a la fila de configuración. **A partir de ahí el entorno ya no se lee**,
y la pantalla de ajustes lo dice con esas palabras.

`npm run db:seed` (opcional) siembra el padrón de prueba de **esta** instalación,
con el `org_id` que diga la fila de configuración —y con `CRM_ORG_ID` de respaldo
si todavía no hay ninguna. Cuál de los dos padrones toca lo deduce de la
referencia de sector —`account_last4` trae los
13 clientes de Banco Demo, `supply_point_number` los 10 de Larkfield Energy— y no
de un ajuste más: el padrón tiene que rellenar la columna que esta instalación
usa, y esa columna ya está declarada. `CRM_SEED_ROSTER=<NOMBRE>` lo fuerza a mano.
Es idempotente.

Los nombres y los correos sembrados están **en inglés**; los identificadores, los
teléfonos y las referencias **no se tocan**, porque el `external_id` viaja como
`sub` dentro de cada credencial ya emitida. Como la siembra es `on conflict do
nothing`, una base con el padrón viejo no se actualiza sola: hay que borrar esas
filas por su `external_id` y volver a sembrar.

Una sola dirección, y es la de dentro:

```
http://localhost:3000/customers     la consola de agentes
```

Abre **en inglés** salvo que el navegador pida otra cosa en `Accept-Language`. El
selector de la barra lateral cambia al castellano sin recargar nada más que la
pantalla.

### Probar las DOS instalaciones en local

No conviven en un proceso, y ésa es exactamente la propiedad que se buscaba: un
proceso es de una empresa. Se levantan dos, en dos puertos, con dos entornos —el
segundo por delante de la orden, que gana sobre `.env.local`:

```bash
npm run dev                                    # Banco Demo, con .env.local

env CRM_ORG_ID=bcl2seovm54p \
    "CRM_ORG_NAME=Larkfield Energy Ltd." \
    CRM_ORG_DOMAIN=energy.demo-te.com \
    CRM_M2M_CLIENT_ID=… CRM_M2M_SECRET=… \
    CRM_REFERENCE_CLAIM=supply_point_number \
    CRM_BRAND_COLOR=5b3ea6 CRM_BRAND_SURFACE=2e1f4a CRM_BRAND_MONOGRAM=LE \
    npx next dev -p 3200                       # Larkfield Energy
```

Es el sitio para comprobar la marca de un vistazo: el banco sale azul y Larkfield
violeta, con su monograma en el disco de la barra. Si sale azul cuando no
debería, la que falta es una de las dos `CRM_BRAND_…`, y **`/diagnostics` lo
dice** en la fila «Marca», con las muestras de color al lado — un `#5b3ea6`
escrito no le dice a nadie qué color es.

Y el documento DID, que ya **no** depende del `Host` — se compone siempre con
`CRM_ORG_DOMAIN`, así que en `localhost` sale igual:

```bash
curl -s http://127.0.0.1:3000/.well-known/did.json
```

Un **404** aquí no es un fallo de configuración: significa que te-api todavía no
tiene claves de esta organización, o sea que no ha encendido su emisión.

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

## Variables de entorno · **hoy son la semilla, no la configuración**

⚠ **La lista de abajo describe lo que se puede SEMBRAR, no dónde se configura.**
Desde el 2026-08-31 la configuración vive en la fila de `tenant_settings` y se
escribe en `/settings`. El entorno sólo crea esa fila la primera vez, y después
**no se vuelve a leer**: cambiar una variable y volver a desplegar no hace nada.
La regla entera está en [`src/lib/tenant-settings.ts`](src/lib/tenant-settings.ts).

Ninguna es `NEXT_PUBLIC_*`. Los módulos que las leen son `server-only`, así que
importarlos desde un componente de cliente **no compila**.

Los dos bloques completos, listos para pegar en Coolify —Banco Demo y Larkfield
Energy—, están en [`.env.example`](.env.example).

### La única de verdad obligatoria

| Variable | Qué es |
|---|---|
| `DATABASE_URL` | La base del CRM. Sólo del CRM, y **una por instalación**. Es donde se guarda todo lo demás, así que no puede guardarse dentro de ella |

### Las de plataforma · **ya tienen valor por defecto en el código**

`PLATFORM_DEFAULTS` en `src/lib/tenant-settings.ts` apunta a los dos backends del
producto, así que sólo se declaran para un Logto de pruebas — y para eso está
también la sección plegada de la pantalla de ajustes.

| Variable | Qué es |
|---|---|
| `LOGTO_ENDPOINT` | `https://auth.idp.tripleenable.com` — de donde sale el token M2M |
| `TE_B2B_RESOURCE` | El indicador del recurso B2B. **Idéntico** al `TE_B2B_RESOURCE` de te-api, carácter a carácter |
| `TE_B2B_SCOPE` | `credentials:issue verifications:request webhooks:manage` por defecto |
| `TE_API_BASE_URL` | Base de te-api; respaldo de `CRM_ISSUER_URL` y `CRM_VERIFIER_URL` |

### La organización de esta instalación · **hoy se rellena en `/settings`**

Cada una de las de esta tabla tiene su casilla en la pantalla de ajustes. Lo que
sigue diciendo la tabla es **qué significa cada valor**, que no ha cambiado; lo
que ya no es cierto es que se declaren aquí. «Obligatoria» quiere decir que sin
ella la instalación no está configurada, y la pantalla la nombra.

| Variable | Qué es |
|---|---|
| `CRM_ORG_ID` | El `organization_id` de Logto. **Obligatoria** |
| `CRM_ORG_NAME` | Rótulo para la interfaz. Sin ella se enseña el `CRM_ORG_ID` |
| `CRM_ORG_DOMAIN` | **Su dominio, que es su identidad.** De aquí sale el `did:web:<dominio>` que publica. **Obligatoria**: una instalación que emite credenciales sin saber su propio dominio publicaría un DID que no resuelve, así que se prefiere no arrancar. Va pelado — sin esquema, sin barra y sin puerto |
| `CRM_M2M_CLIENT_ID` | La aplicación M2M de esta organización. **Obligatoria** |
| `CRM_M2M_SECRET` | Su secreto. **Sólo en el servidor.** **Obligatoria** |
| `CRM_ISSUER_URL` | Base de te-api para emitir. Opcional; cae en `TE_API_BASE_URL` |
| `CRM_VERIFIER_URL` | Base de te-api para verificar. Opcional; cae en `TE_API_BASE_URL` |
| `CRM_OFFICIAL_NUMBERS` | Los teléfonos desde los que llama de verdad, separados **por comas**. No son adorno: van firmados dentro de la credencial como `official_numbers` |
| `CRM_REFERENCE_CLAIM` | Qué dato de relación ofrece su **alta de cliente**: `account_last4` o `supply_point_number`. **Obligatoria** desde el 2026-08-31 — antes, sin ella se ofrecían todas las casillas a la vez, y a un agente de una eléctrica le aparecía una de «número de historia clínica» |
| `CRM_BRAND_COLOR` | El acento de su marca sobre papel blanco: enlaces, foco, el filo de la tarjeta de oferta. Sólo hexadecimal (`#rgb`/`#rrggbb`, o **sin almohadilla**, que es lo obligado en un `.env` — la almohadilla abre un comentario y el valor se pierde entero). Desde la pantalla, un valor que no encaje se rechaza junto a la casilla |
| `CRM_BRAND_SURFACE` | La superficie oscura de su marca: la barra lateral de la consola. Va **junta** con la anterior — media marca se lee como una pantalla a medio pintar |
| `CRM_BRAND_MONOGRAM` | Una o dos letras para el disco. Sin él, las iniciales de las dos primeras palabras del nombre |

### Los tipos de credencial

La **lista** de tipos no está aquí: sale de `GET /v1/b2b/organization` de te-api,
y conceder uno se hace en la consola. Lo que se declara aquí es qué lleva cada
uno, porque te-api no lo sabe (ver más arriba).

| Variable | Qué es |
|---|---|
| `CRM_TYPE_<CLAVE>_CLAIMS` | Qué atributos lleva ese tipo, separados por espacios o comas. Sin él, todos los del catálogo que la ficha rellene. **Es lo que hace que emitir dos tipos se note** |
| `CRM_TYPE_<CLAVE>_DEFAULT_CLAIMS` | Cuáles van marcados al abrir la comprobación. Sin él, el mínimo de identidad del catálogo |
| `CRM_TYPE_<CLAVE>_LABEL` | Cómo se rotula un tipo **que el catálogo de mensajes no conozca**. Para `cliente`, `kyc` y `customer` no hace nada: los rotula el catálogo, que es lo único que puede estar en dos idiomas. Sin ninguno de los dos, el `type_key` tal cual |

`<CLAVE>` es el `type_key` en mayúsculas con `[^A-Z0-9]` → `_`
(`poliza-hogar` → `CRM_TYPE_POLIZA_HOGAR_…`).

### El webhook

| Variable | Qué es |
|---|---|
| `CRM_WEBHOOK_SECRET` | El secreto de firma que devuelve la consola al registrar el endpoint. Se pega **tal cual, con el `whsec_` incluido**: es una cadena opaca, no material codificado. Sin él el receptor **rechaza toda entrega**. Su casilla está en `/settings`, justo debajo de la dirección que hay que registrar |

### El empleado

Las tres de `CRM_AGENT_*` **se siguen leyendo del entorno siempre**, y no son una
excepción a la regla: no están en la pantalla de ajustes ni deben estarlo. Son el
sustituto provisional del login de empleado (F4a) — son de la persona, no de la
empresa, y desaparecerán cuando ese login exista.

| Variable | Qué es |
|---|---|
| `CRM_AGENT_ACTOR` | Etiqueta del puesto para el diario, mientras no haya login de empleado |
| `CRM_AGENT_ID` | El número de agente que ve el **titular** en su móvil cuando suena el timbre. te-api **no lo verifica**: es atribución |
| `CRM_AGENT_NAME` | El nombre del agente, igual. Sin estas dos al titular le sale «Agente de \<la organización\>», compuesto con su nombre — no se inventa un nombre de persona |

> **Aquí había cinco `CRM_PORTAL_*`** —`_CLIENT_ID`, `_CLIENT_SECRET`,
> `_LINK_TYPE`, `_BASE_URL` y `_COOKIE_SECRET`— y **ya no las lee nadie**. Se
> fueron con el portal el 2026-08-31, junto con sus cinco columnas de
> `tenant_settings` (`db/009_drop_portal.sql`). Dejarlas puestas en un `.env` no
> hace nada; el porqué está en «El vínculo con la cartera».

### Sólo para la siembra

| Variable | Qué es |
|---|---|
| `CRM_SEED_ROSTER` | Fuerza qué padrón de prueba se siembra (`BANCODEMO`, `LARKFIELDENERGY`). Sin él se deduce de `CRM_REFERENCE_CLAIM` |

**El idioma no está en estas tablas, y no falta:** no es una variable de entorno.
Lo elige quien mira la pantalla, se guarda en la cookie `crm_locale` y por defecto
se negocia con `Accept-Language`. Ver «El idioma».

## El webhook · por donde el CRM se entera sin preguntar

**La dirección que se pega en la consola** (tenant-admin → Credentials → Webhook):

```
https://<CRM_ORG_DOMAIN>/api/webhooks/te-api
```

Al registrarla, la consola devuelve **el secreto de firma** —`whsec_` y 43
caracteres— y ésa es la única vez que se enseña entero. Ese valor va en
`CRM_WEBHOOK_SECRET`.

### La firma se comprueba, y lo que no cuadra se rechaza

Está leída del código que firma (`tripleenable-api/src/b2b/webhook-signature.ts`)
y de la prueba que la reconstruye, no deducida de un nombre de variable:

```
te-signature-sha-256: t=<segundos>,v1=<hex>[,v1=<hex>]
te-event-id:          <uuidv7>     ← la clave de idempotencia
te-delivery-id:       <uuidv7>     ← cambia en cada reintento
```

HMAC-SHA256 sobre el UTF-8 de `` `${t}.${cuerpo_crudo}` ``, en hexadecimal. Tres
cosas que cuestan una tarde si se ignoran:

1. **El cuerpo tiene que ser los bytes crudos.** te-api serializa una vez y firma
   esa misma cadena; reserializar lo que devuelva `JSON.parse` cambia espacios y
   orden de claves y la firma deja de cuadrar sin decir por qué.
2. **Puede haber DOS `v1=`.** Durante la ventana de gracia de una rotación te-api
   firma con el nuevo secreto y con el anterior. Vale cualquiera de los dos; un
   receptor que sólo mire el primero rechaza entregas legítimas durante un día.
3. **El secreto NO se descodifica.** La clave del HMAC son los bytes UTF-8 de la
   cadena entera, `whsec_` incluido. Quitar el prefijo o descodificar la cola como
   base64 produce un MAC distinto y **todas** las entregas se rechazan.

La ventana de tolerancia del sello de tiempo —cinco minutos— **la elegimos
nosotros**: te-api no impone ninguna, sólo la recomienda en un comentario.

### Qué llega dentro

El cuerpo lleva **el veredicto**, así que el receptor cierra el caso sin volver a
llamar. Dos tipos hoy, y el despacho es por `type`:

| Tipo | Qué trae | Qué hace el CRM |
|---|---|---|
| `presentation.settled` | `presentationId`, `status`, `credentialType`, `requestedAt`, `expiresAt`, `settledAt` | Cierra la comprobación en su diario |
| `webhook.test` | `presentationId: null` | Se archiva y se ve en `/events` |

Un tipo que este CRM no conozca **se archiva y contesta 200**: un `500` haría que
te-api reintentara ocho veces algo que nunca va a entrar, y a los veinte fallos
suspendería el endpoint.

Lo que el evento **no** lleva son los claims, el recibo firmado y la clave del
titular — te-api minimiza el dato personal que sale por un canal saliente. Eso se
lee por `GET /v1/b2b/presentations/:id`, que **no cambia**: es el barrido, y sigue
siendo el camino cuando la entrega se perdió.

### Y se ve en `/events`

Cuándo llegó, qué tipo, a qué cliente afecta —cruzado contra el diario de
comprobaciones— y **si la firma cuadró**, con el cuerpo entero plegado debajo.

Lo que **no** cuadra también se guarda, y a propósito: una entrega mal firmada es
o alguien inventando eventos, o **el secreto rotado sin actualizar aquí** —y
entonces se están perdiendo entregas legítimas, que es el fallo caro porque no
tiene ningún otro síntoma—. Sin esas filas la pantalla saldría vacía en los dos
casos.

## Publicar una segunda instalación

Ya no se «da de alta una organización» dentro de este proyecto: **se publica la
aplicación otra vez**. Es la misma imagen; lo que cambia es el entorno, el
dominio y la base. No se comparte nada, así que un secreto mal puesto en una no
puede tumbar a la otra — que es exactamente lo que pasaba cuando un despliegue
servía a cuatro.

Lo que no se puede olvidar:

- **Su dominio** — sin él la instalación no está configurada, y la pantalla de
  ajustes lo nombra. Es mejor que lo de antes, que era arrancar y no publicar
  documento DID: aquel síntoma llegaba al teléfono del titular como «no podemos
  verificar quién emite esto», que no se parece a «falta un ajuste».
- **Su referencia de sector** — igual, por lo mismo: antes se degradaba a
  «ofrecerlas todas» y una comercializadora de luz acababa enseñando la casilla
  de otro sector.
- **Su propia `DATABASE_URL`.** Compartirla ata dos empresas al mismo Postgres
  para siempre — y desde que la configuración vive dentro, compartirla es además
  compartir la configuración: **dos instalaciones sobre la misma base son la
  misma instalación**.
- **Su propio secreto de webhook**, que le da su propia consola al registrar su
  endpoint. Se pega en `/settings`, no en el entorno.

### Lo que hay que crear FUERA de este repositorio, en orden

**Nada de esta lista lo hace `crm-demo`, y sin ella el bloque de variables no
sirve de nada.** Está escrita con los valores de **Larkfield Energy**, que es la
segunda instalación; para otra empresa se cambian el nombre y el subdominio.

| # | Dónde | Qué | Quién |
|---|---|---|---|
| 1 | **tenant-admin** | La organización **Larkfield Energy** en Logto, su **rol de organización** con los scopes `credentials:issue` y `verifications:request` sobre el recurso B2B, y su **aplicación M2M** miembro de esa organización con ese rol | **Su propio administrador**, al darse de alta. No nosotros |
| 2 | **Logto** | Copiar el `organization_id` y el `client_id`/`client_secret` de esa M2M (Applications → … → App secrets → el ojo) | Quien despliega |
| 3 | **te-api** | La organización en su padrón: `npm run seed:partner` | Quien despliega |
| 4 | **DNS** | `energy.demo-te.com` apuntando al servidor | Quien despliega |
| 5 | **Coolify** | **Una aplicación NUEVA** a partir de la misma imagen, con `https://energy.demo-te.com` como su dominio. Esto cambió el 2026-08-31: antes era añadir un dominio más a la aplicación que ya existía, porque un despliegue servía a las cuatro | Quien despliega |
| 6 | **Coolify** | Poner **`DATABASE_URL`** en las variables de esa nueva aplicación —**suya, no la del banco**— y desplegar. El resto ya no va aquí | Quien despliega |
| 7 | **La base** | `npm run db:migrate` desde dentro del contenedor | Quien despliega |
| 7b | **`/settings` de la nueva instalación** | Pegar los valores del paso 2, elegir su referencia de sector y su marca, y guardar. Después `npm run db:seed`, que ya sabe de quién es el padrón | Quien despliega |
| 8 | **La consola de la organización** | Elegir sus **tipos de credencial** del catálogo compartido y **encender su emisión**, que es lo que crea sus claves en te-api | **Su administrador** |
| 9 | **La consola de la organización** | Registrar su webhook. **La dirección exacta la enseña `/settings` con botón de copiar** — es `https://energy.demo-te.com/api/webhooks/te-api`. Devuelve el secreto de firma, que se pega en esa misma pantalla; **no hay que redesplegar**. El botón «mandar un evento de prueba» comprueba las dos mitades de una vez | **Su administrador** |

> **Esta lista tenía dos pasos más, y se fueron el 2026-08-31.** Uno era crear en
> Logto una aplicación **Traditional Web** para el portal del titular; el otro,
> sembrar su `client_id` en te-api como `portal_client_id`. Ninguno de los dos
> hace falta ya: no hay portal, esta integración no crea vínculos y a te-api se
> le siembra la organización a secas. Ver «El vínculo con la cartera».

Los pasos 1, 8 y 9 son de la organización y no nuestros, y ésa es la prueba que
esto viene a hacer: **el alta es autoservicio**. Nosotros no creamos su
aplicación M2M, ni elegimos qué credenciales emite, ni registramos su webhook.

> ⚠ **Hasta el paso 8 no hay documento DID, y eso NO es un fallo.** Las claves
> salen de `GET /v1/trust/did-documents/:host` de te-api, y si te-api no tiene
> ninguna para esa organización, `/.well-known/did.json` devuelve **404**
> (`src/lib/did-document.ts`). Es la respuesta honesta a «este dominio todavía no
> publica ninguna identidad de emisor»: un documento con la lista de claves vacía
> la cartera lo tomaría por bueno y diría «esta organización no publica claves»,
> que suena a error suyo.

> ⚠ **Hasta el paso 9, `/events` sale vacía y el receptor rechaza todo.** Sin
> `CRM_WEBHOOK_SECRET` no hay con qué comprobar la firma, y aceptar sin comprobar
> no es una opción: el cuerpo del evento lleva el veredicto dentro, así que un
> `POST` sin firma comprobada podría afirmar un `verified` que no ocurrió.
> Diagnóstico dice qué variable falta.

### Si emite otro tipo de credencial

Tampoco es código: los tipos ya salen de su padrón en te-api, y lo que lleva
cada uno se declara con las tres variables `CRM_TYPE_<CLAVE>_…` de arriba. Lo
único que sí es código es añadir una **columna nueva al padrón** del CRM y su
entrada en `CUSTOMER_ATTRIBUTES` — porque un atributo que no tiene columna no
tiene de dónde salir.

**Y eso pasó de verdad el 2026-08-30**, así que el ejemplo ya no es hipotético:
dos organizaciones de otros sectores necesitaron `policy_number` y
`medical_record_number`, y salieron en `db/005_sector_reference.sql` con sus
entradas en el catálogo. Son columnas separadas y no una genérica porque **el
nombre de la columna es el nombre del claim**, y un verificador que recibe
`sector_reference` no sabe qué tiene delante. (Las dos organizaciones se
retiraron el 2026-08-31 y su código se fue con ellas; las columnas se quedan, y
el porqué está en la cabecera de esa migración.)

**Y volvió a pasar el 2026-08-31**: Larkfield Energy necesitaba
`supply_point_number` —el identificador del contador, que es lo que el titular
reconoce cuando alguien dice llamarle de su compañía de la luz— y salió en
`db/006_supply_point.sql`. Es, literalmente, **lo único** que la cuarta
organización necesitó de código. Todo lo demás —dominio, `did:web`, M2M, marca,
padrón de prueba— fue configuración.

Lo que **no** necesitó fue declarar tipos: no lleva ninguna `CRM_TYPE_…`. Sin
declarar un tipo, éste lleva todos los atributos del catálogo que la ficha
rellene, que para ella son nombre, apellidos, punto de suministro y fecha de
alta. Los tipos los elige su administrador en la consola, del catálogo
compartido que publica el emisor.

## Lo que se puede demostrar

- **Ni un secreto en el navegador.** `npm run build` y luego
  `grep -ril "M2M_SECRET\|client_secret\|m2mSecret\|webhookSecret" .next/static`
  — vacío. Se comprobó por primera vez el 2026-08-29, entonces con los dos
  secretos del portal también puestos.
- **te-api responde sin ninguna sesión de empleado.** `curl` a
  `/api/organization` sin cookies: contesta igual.
- **El `tx_code` no viaja por el mismo canal que el enlace.** El PIN se pinta en
  su propia tarjeta y no se manda a ningún sitio.
- Aquí había dos pruebas más, **las dos del portal** —que un ID token con la
  firma inventada no vincula, y que vincular dos veces no duplica la fila—. Se
  quitaron con él el 2026-08-31: siguen siendo verdad de te-api, pero **ya no se
  pueden demostrar desde aquí**, porque esta integración no llama a
  `POST /v1/b2b/links`.
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
