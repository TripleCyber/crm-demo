# `/.well-known/` — lo que Banco Demo publica al mundo

## `did.json` — el documento DID de `did:web:bank.demo-te.com`

Es **la mitad pública** de la identidad del emisor. Cuando la cartera recibe una
credencial cuyo `iss` es `did:web:bank.demo-te.com`, compone
`https://bank.demo-te.com/.well-known/did.json`, se lo descarga, saca de ahí la
clave pública y con ella comprueba la firma.

Sin este fichero **la cartera rechaza la credencial**, y no por un fallo: es la
respuesta correcta. Se comprobó leyendo el código de la cartera —
`IssuerKeys.kt` compone esa URL, y un fallo de red se convierte en
`ISSUER_UNREACHABLE` → `CredentialTrust` devuelve `Err` → `acceptOffer` corta en
el paso 2, antes de guardar nada. «No pude comprobarlo» se trata como «no».

### Por qué lo sirve el CRM y no nosotros

Porque `bank.demo-te.com` es el dominio **del banco**. Que la clave con la que se
comprueba una credencial de Banco Demo se publique en un dominio de Banco Demo
es justo lo que hace que el `iss` signifique algo: si lo publicáramos nosotros,
el `did:web` sería decorativo y volveríamos a que todas las organizaciones
cuelgan de la misma identidad. Ver `docs/fases/CUSTODIA.md` — «`did:web` es el
registro civil, no la caja fuerte».

Que la **clave privada** siga siendo nuestra hoy es otra cosa, y está anotada
como deuda en ese mismo documento. El documento DID es el primer paso de
separarlas: la identidad ya es del banco aunque la llave todavía no.

### Por qué hay DOS claves

Una lista con varias claves no es un descuido, es **cómo se rota una clave**:
durante la rotación las dos tienen que valer, o toda credencial firmada con la
vieja deja de verificar de golpe.

Aquí las dos son:

| `kid` | Cuál es |
|---|---|
| `ThFQ5nNq…` | El emisor **desplegado** (`waltid-issuer2` en Coolify) |
| `_BjP-HuMgg…` | El emisor **local de desarrollo**, para poder probar el recorrido entero contra una máquina sin tocar el despliegue |

La segunda se quita el día que el recorrido de desarrollo deje de necesitarla.
Mientras esté, cualquiera que levante el emisor local con **otras** claves tiene
que añadir la suya aquí, o la cartera rechazará sus credenciales con
`CREDENTIAL_ISSUER_UNRESOLVED`.

> ⚠️ **Nunca la parte privada.** Un JWK con `d` publicado aquí regala la
> capacidad de emitir en nombre de Banco Demo. Sólo van `kty`, `crv`, `x`, `y`,
> `kid`, `alg` y `use`.

### La trampa que ahorra un ciclo de depuración

El JWK **tiene que llevar `y`**. La cartera exige los dos componentes para una
clave `EC` (`Jwk.kt`), y `jwkOf` **descarta en silencio** la que no lo traiga: el
síntoma sería `NO_PUBLISHED_KEY`, que no se parece nada a «te falta un campo».
Un punto comprimido —sólo `x`— no vale.

Y el `id` de cada método de verificación tiene que terminar en el mismo `kid`
que lleva la cabecera del JWT, porque es por ahí por donde la cartera elige cuál
de las claves usar.
