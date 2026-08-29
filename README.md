# crm-demo · el CRM de Banco Demo

La consola de agentes de un banco de mentira que emite credenciales de verdad.
Es la pieza de [`F4`](../docs/fases/F4-crm.md) y **es la única maqueta del
proyecto** — pero la mitad que habla con nosotros no lo es: el token B2B y la
emisión son los de producción.

> **Sus empleados son reales; sus clientes son locales.**
> Los clientes de Banco Demo son filas en la base de este proyecto. Ni te-api ni
> Logto las leen nunca, igual que no leemos el núcleo bancario de un banco de
> verdad.

## Lo que hay hoy y lo que no

| | |
|---|---|
| ✅ | Next.js (App Router, TypeScript) con el patrón de `tenant-admin`: proxy en el servidor, ni un secreto en el navegador |
| ✅ | Base propia Postgres con `customer`, migración reproducible y siembra aparte |
| ✅ | Listado de clientes y alta de cliente |
| ✅ | Cliente del token B2B en el servidor: `client_credentials` + `resource` + `organization_id` + `scope`, cacheado y renovado antes de caducar |
| ✅ | Botón «emitir credencial» → `POST /v1/b2b/credentials` de te-api → QR, enlace debajo y PIN aparte. **Probado de punta a punta el 2026-08-29**: la credencial se recogió con el flujo OID4VCI y salió con `iss = did:web:bank.demo-te.com`, `sub` = el `external_id` de la ficha y los cuatro claims como divulgaciones |
| ✅ | Multi-organización desde el principio: mapa `orgId → {…}` por variables de entorno, sin código que tocar para añadir la segunda |
| ⛔ | **Login de empleado con Logto OIDC.** Es la casilla que queda de F4a. Mientras no esté, esta consola **no está autenticada** y no puede publicarse donde llegue nadie de fuera |
| ✅ | **Portal del cliente en `/portal`** (F4b): login OIDC del titular contra Logto y `POST /v1/b2b/links` desde el servidor. **Probado en el navegador el 2026-08-29**: Teófilo entró con su cuenta de TripleEnable y el vínculo quedó hecho — fila en `te.org_subject` de te-api, y volver a entrar es idempotente |
| ⛔ | Estado de la credencial y del vínculo **en la ficha de la consola de agentes**: hoy el vínculo sólo se ve desde el portal y desde la base de te-api |
| ✅ | Botón «pedir credencial» → `POST /v1/b2b/presentations` de te-api → QR de la petición OID4VP, y en la misma pantalla lo que el titular enseñó. **Probado de punta a punta el 2026-08-29** con un guion que hace de cartera: `pending` → la cartera presenta → `verified` con `given_name` y `family_name`, y sólo con ésos |
| ✅ | **La vía telefónica**: «está al teléfono · avisar a su móvil» → la misma presentación **más `POST /v1/b2b/wakeups`**, el timbre. Es lo que hace que la comprobación sirva para una llamada, donde el cliente no ve la pantalla del agente. **Probado el 2026-08-29**: la llamada sale con `kind: identity` y el `actor` del empleado, te-api contesta `{ wakeupId, expiresAt }` y anota `b2b.wakeup_created`. **Ningún teléfono ha sonado todavía** — ver «Lo que falta para que suene un teléfono» |
| ⛔ | **Revocación** (la otra mitad de F4c) |
| ✅ | `/.well-known/did.json` de Banco Demo — está en `public/.well-known/` y este servidor lo sirve (`curl -s localhost:3000/.well-known/did.json` → 200). Lleva **dos** claves, la del emisor desplegado y la del local, porque durante una rotación las dos tienen que valer; el porqué de cada campo está en `public/.well-known/README.md` |
| ⛔ | Que ese documento se pueda **descargar desde `bank.demo-te.com`**. El dominio no apunta a ningún sitio, así que la cartera todavía no puede validar la firma de una credencial contra el DID — sólo leer que el `iss` es el correcto |

## Dos secciones, no una

Este proyecto sirve **dos pantallas que no se parecen en nada**, y la separación
es estructural: dos grupos de rutas, dos disposiciones y dos sesiones distintas.

| | Quién la usa | Qué ve | Qué autentica |
|---|---|---|---|
| `(console)` — `/customers`, `/diagnostics` | Un **empleado** del banco, desde el mostrador | El padrón entero de clientes | Nada todavía (F4a pendiente). Contra te-api autentica el **token M2M** |
| `portal` — `/portal` | El **titular** | Su ficha y su vínculo, nada más | Login **OIDC contra Logto** con la cuenta de TripleEnable de esa persona |

El grupo `(console)` no cambia ninguna URL —los paréntesis son de Next.js— y
existe para que la cabecera del banco viva en un fichero aparte de la del
portal. Un `if` en una cabecera compartida se olvida; un enlace a «Clientes»
pintado en la pantalla de un titular es un enlace que alguien va a pulsar.

## Cómo funciona la emisión

```
Navegador  (listado · alta · botón de emitir)
   │  fetch /api/credentials/issue        ← lo único que manda es el externalId
   ▼
Next.js, en el servidor
   │  1. sesión → organización            src/lib/session.ts
   │  2. ficha del cliente                src/lib/customers.ts   (base propia)
   │  3. claims construidos DESDE la ficha
   │  4. token M2M de organización        src/lib/b2b-token.ts   (cacheado 1 h)
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
| **Está al teléfono · avisar a su móvil** | Pedro tiene a Juan al aparato. Juan **no ve esta pantalla** | Le suena el móvil: `POST /v1/b2b/wakeups` |
| **Está delante · enseñar QR** | El cliente está en el mostrador mirando la pantalla del agente | Escanea el QR con su cartera |

Los dos abren **la misma sesión de presentación** y se consultan igual. Lo único
que cambia es cómo se entera la persona de que le están preguntando.

```
Navegador  (ficha · casillas de qué se pide · los dos botones)
   │  fetch /api/credentials/present      ← externalId, tipo, atributos y canal
   ▼
Next.js, en el servidor
   │  1. sesión → organización y EMPLEADO
   │  2. ficha del cliente → qué atributos LLEVA esta credencial
   │  3. los pedidos se recortan a esa lista
   │  4. token M2M de organización
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
decide nada con él. Sirve para que en el móvil de Juan ponga «Pedro Ramírez,
agente 4471» y para el diario. La ficha lo pinta debajo de los botones a
propósito: el agente tiene que poder decir en voz alta el mismo nombre que el
cliente está viendo en la pantalla del móvil, que es lo que convierte la
comprobación en algo que sirve contra quien llama diciendo que es del banco.

**3 · Si el timbre no sale, no hay pantalla de espera.** La sesión de
presentación se deja caducar sola y se enseña el error. Dar por buena una
llamada cuyo aviso no ha salido dejaría al agente diciéndole al cliente que mire
un móvil que no va a sonar.

### Las tres decisiones que importan

**1 · Sólo se puede pedir lo que esta credencial lleva.** Las casillas salen de
la misma función que construye los claims al emitir, y el servidor **vuelve a
recortar** lo que llegó del navegador contra esa lista. Que te-api rechace los
campos reservados no quita que la comprobación tenga que estar también aquí,
que es donde se sabe qué lleva la credencial.

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

### `rejected` y `failed` no son lo mismo, y la pantalla no los junta

te-api devuelve cinco finales y se pintan los cinco por separado, con **el rojo
reservado para uno solo**:

| Estado | Qué es | Qué hace el agente |
|---|---|---|
| `verified` | Es quien dice ser | Verde. Salen los atributos que se pidieron |
| `rejected` | **La persona ha dicho que no ha sido ella**, desde su cartera | **Rojo.** Cortar la llamada y cursar el aviso de fraude: si el agente habla con alguien y el titular dice que no, hay dos personas distintas |
| `failed` | La credencial no ha valido —caducada, revocada, de otro titular— | Ámbar. Se vuelve a intentar |
| `expired` | Nadie contestó a tiempo | Ámbar. Se vuelve a avisar |
| `pending` | Se sigue esperando | Ámbar |

Compartir el rojo entre `rejected` y `failed` volvería a juntarlos en el único
sitio donde alguien los mira de verdad, que es esta pantalla. Por eso hay un
tercer color en `globals.css` y no dos.

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
npm run db:seed                     # opcional: tres clientes de prueba
npm run dev                         # http://localhost:3000
```

Dos direcciones, no una:

```
http://localhost:3000/customers     la consola de agentes
http://localhost:3000/portal        el portal del cliente
```

El portal necesita además la aplicación de Logto y el `portal_client_id` en el
padrón de te-api — ver «El portal del cliente» más arriba. Sin ellos la pantalla
lo dice y el botón de entrar se queda deshabilitado, en vez de mandar a nadie a
un error de Logto.

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
| `CRM_ORG_<SLUG>_M2M_CLIENT_ID` | La aplicación M2M de esa organización |
| `CRM_ORG_<SLUG>_M2M_SECRET` | Su secreto. **Sólo en el servidor** |
| `CRM_ORG_<SLUG>_ISSUER_URL` | Base de te-api para emitir. Opcional |
| `CRM_ORG_<SLUG>_VERIFIER_URL` | Base de te-api para verificar. Opcional |
| `CRM_ACTIVE_ORG_ID` | Con qué organización trabajan la consola y el portal. Se puede omitir si sólo hay una declarada |
| `CRM_ACTIVE_ACTOR` | Etiqueta del operador para el diario, mientras no haya login de empleado |
| `CRM_ACTIVE_AGENT_ID` | El número de agente que ve el **titular** en su móvil cuando suena el timbre. te-api **no lo verifica**: es atribución |
| `CRM_ACTIVE_AGENT_NAME` | El nombre del agente, igual. Sin estas dos al titular le sale «Agente de Banco Demo» — no se inventa un nombre de persona |
| `CRM_ORG_<SLUG>_PORTAL_CLIENT_ID` | La aplicación **Traditional Web** del portal de esa organización. Es además el `portal_client_id` que te-api tiene en su padrón |
| `CRM_ORG_<SLUG>_PORTAL_CLIENT_SECRET` | Su secreto. **Sólo en el servidor.** Va junta con la de arriba: una sin la otra es un error de configuración y se ve al arrancar |
| `CRM_ORG_<SLUG>_PORTAL_LINK_TYPE` | El `type` que el portal declara al vincular (`cliente`). Opcional |
| `CRM_PORTAL_BASE_URL` | La dirección pública del portal. De aquí sale el `redirect_uri`, **nunca de la cabecera `Host`** |
| `CRM_PORTAL_COOKIE_SECRET` | Firma la cookie de sesión del portal (HS256). 32 caracteres o más |

### Añadir un segundo banco

Copiar el bloque `CRM_ORG_…` con otro slug y reiniciar. No se toca código: la
configuración se descubre recorriendo el entorno. El slug va en **mayúsculas y
sin guiones bajos** — el descubrimiento busca las claves que acaban en `_ID`, y
con guiones bajos permitidos `CRM_ORG_X_M2M_CLIENT_ID` se leería como una
organización llamada `X_M2M_CLIENT`.

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
  respuesta de te-api trajo `{ "given_name": "Teófilo" }` y nada más.
- **Un identificador de cliente con una expresión regular dentro no cuela.** Se
  pidió una presentación con `subjectReference = ".*"`: te-api construyó la
  política del verificador con el valor escapado (`\.\*`), la credencial real
  no cuadró y la sesión acabó en `failed`.

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
