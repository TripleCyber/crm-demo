import { NextResponse } from 'next/server';

import { getTranslator } from '@/i18n/server';
import type { Translator } from '@/i18n/translate';
import { findDeclaredType, resolveCredentialType } from '@/lib/credential-profiles';
import { findCustomer } from '@/lib/customers';
import { getEmployeeSession } from '@/lib/session';
import {
  describeTeApiError,
  fetchB2bOrganizationCached,
  requestCeremony,
  requestPresentation,
  sendWakeup,
  TeApiError,
  type TeApiOperation,
} from '@/lib/te-api';
import { findVerification, recordVerification } from '@/lib/verifications';

/**
 * `POST /api/credentials/present` — el botón «pedir credencial». **Habla con te-api.**
 * `GET  /api/credentials/present?presentationId=…` — lee el diario. **No habla con te-api.**
 *
 * Esa asimetría es el diseño y no una casualidad: lo que sale hacia te-api lo
 * dispara siempre una persona pulsando un botón, y lo que vuelve —el veredicto—
 * llega solo, por el webhook. Ninguna de las dos mitades tiene un temporizador
 * detrás. Ver la cabecera del `GET`.
 *
 * ## La otra mitad del ciclo
 *
 * Hasta ahora este CRM emitía una credencial y ahí se acababa: nadie la pedía
 * nunca de vuelta. Esto es la vuelta. El agente pulsa «pedir credencial» y la
 * cartera del titular **presenta** lo que se le pide.
 *
 * ## Las dos ramas van por el MARCO DE PETICIONES, y ésa es la corrección
 *
 * Lo que el titular recibe es **una petición del marco con su plantilla**
 * (`bank.call.v2`), no un `openid4vp://` suelto. La diferencia se ve en su
 * móvil: por el marco lee de qué va la llamada, quién pregunta y qué firma; por
 * el enlace crudo le salía la pantalla genérica de presentación, que no dice
 * ninguna de esas tres cosas y que es el camino de las credenciales de terceros
 * (Entra ID), no el nuestro.
 *
 * - **`phone`** — el cliente está al teléfono. `POST /v1/b2b/wakeups`, que **ya
 *   compone la petición del marco por dentro** (`bank.call.v2`, `kind: verify`,
 *   `signWith: identity`, con el `requestUri` dentro) y además es la única
 *   llamada que dice si el aviso llegó a salir. Por eso se queda: cambiarla por
 *   la ruta genérica sólo perdería ese dato.
 * - **`qr`** — el cliente está en el mostrador. Es la rama que estaba rota:
 *   pintaba el `openid4vp://` de la sesión y no creaba ninguna petición. Ahora
 *   compone la misma petición del marco por `POST /v1/requests`.
 *
 * Las dos acaban en **la misma pantalla de la cartera**, con los mismos campos
 * y el mismo texto firmado. El canal ya no elige protocolo: dice dónde está el
 * cliente, que es lo único que un CRM sabe de verdad.
 *
 * ## Y el mostrador sigue pintando QR, pero del marco
 *
 * `POST /v1/requests` devuelve `link` desde que se abrió el canal reclamable
 * para las peticiones: un `tripleenable://requests/<id>`, el mismo esquema que
 * el QR de inicio de sesión, que la cartera reclama contra la bandeja. Es lo
 * que se dibuja, y **no se fabrica aquí**: lo compone te-api con su propio
 * `codeLink`, y una copia de ese formato en el CRM se quedaría vieja en
 * silencio el día que cambie.
 *
 * Lo que se retiró es el QR **anterior**, que pintaba el `openid4vp://` crudo
 * de la sesión de presentación y abría la pantalla genérica. Ése sí era una
 * trampa: llevaba al sitio equivocado. El de ahora abre la misma plantilla que
 * el push, con los mismos campos y el mismo texto firmado.
 *
 * `link` puede venir **nulo** —te-api con el canal QR apagado—, y entonces esta
 * rama no pinta código y el cliente recibe la petición en el móvil que lleva
 * encima, igual que el que está al teléfono. Nulo se enseña como ausencia, no
 * como error: la ceremonia está abierta y es reclamable por la bandeja.
 *
 * ## El verificador es de TripleEnable, no nuestro
 *
 * Es la parte que más se nota al leer este fichero: no hay ningún `fetch` a un
 * walt.id, ni configuración de verificador, ni clave. Sólo se llama a te-api,
 * que abre la sesión en **su** verificador y devuelve el enlace. Un banco que
 * verificase en su casa podría dar por buena cualquier cosa —incluida una
 * credencial que TripleEnable haya revocado— y nadie se enteraría.
 *
 * ## Qué decide el navegador y qué decide este servidor
 *
 * Del navegador llegan **cinco cosas, y las cinco son elecciones legítimas del
 * operador**: a qué cliente (`externalId`), qué tipo de credencial (`type`),
 * qué atributos de ese tipo (`claims`), por qué canal se avisa (`channel`) y
 * **de qué va la llamada** (`call.subject`, y el opcional `call.case`). Ninguna
 * de las cinco se cree tal cual:
 *
 * - `externalId` se busca **con la organización de la sesión** en el `where`.
 * - `type` se resuelve **contra el padrón de te-api** (`GET /v1/b2b/organization`).
 * - `claims` se comprueban **contra los que ese tipo lleva en esta ficha**.
 * - `channel` se compara contra una lista cerrada.
 * - `call` se recorta, se mide contra el límite de te-api y **se exige en los
 *   dos canales**: es el héroe obligatorio de `bank.call.v2`, y las dos ramas
 *   componen esa plantilla. Antes se rechazaba por QR, cuando ese canal no
 *   pintaba ninguna pantalla del marco donde pudiera enseñarse.
 *
 * Y hay tres cosas que el navegador **no manda y no puede mandar**, porque las
 * sabe el servidor: el `subjectReference` (sale de la ficha del padrón, no del
 * cuerpo), el `actor` que verá el titular en su móvil (sale de la sesión) y el
 * `kind` del timbre (es constante).
 *
 * ## Se rechaza, no se recorta
 *
 * Un atributo que este tipo no lleva es un **400**, no un silencio. Es la misma
 * regla que te-api aplica en `src/b2b/claims.ts`, que **lanza** en vez de
 * filtrar, y por el mismo motivo escrito allí: recortar por lo bajo deja al
 * integrador convencido de que su código funciona, y el día que ese campo
 * importe nadie sabrá por qué no está. Antes esto filtraba en silencio.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Cómo se le avisa al titular. Ver la cabecera. */
type PresentChannel = 'qr' | 'phone';

interface PresentBody {
  externalId?: unknown;
  type?: unknown;
  claims?: unknown;
  channel?: unknown;
  call?: unknown;
}

/**
 * Lo que te-api acepta en cada texto de la llamada: `z.string().min(1).max(120)`
 * (`src/routes/b2b.ts`, `wakeupCall`).
 *
 * Se repite aquí en vez de importarse porque son dos despliegues distintos y no
 * hay un paquete compartido — pero **se comprueba aquí de todas formas**, y no
 * por ahorrar una llamada: un asunto de 200 caracteres saldría de te-api como
 * `400 invalid_request` con su `requestId`, y el agente, que está al teléfono,
 * leería «te-api ha rechazado los datos de la llamada» para algo que este
 * servidor sabe decir con el nombre del campo y el número.
 */
const CALL_TEXT_MAX = 120;

export async function POST(request: Request): Promise<NextResponse> {
  // El idioma de quien tiene la consola delante: lo que devuelve esta ruta se
  // pinta tal cual en su pantalla.
  const t = await getTranslator();

  let body: PresentBody;
  try {
    body = (await request.json()) as PresentBody;
  } catch {
    return NextResponse.json({ error: t('errors.bodyNotJson') }, { status: 400 });
  }

  const externalId = typeof body.externalId === 'string' ? body.externalId.trim() : '';
  const type = typeof body.type === 'string' ? body.type.trim() : '';
  const requested = Array.isArray(body.claims)
    ? body.claims.filter((name): name is string => typeof name === 'string')
    : [];
  // El canal se compara contra la lista cerrada en vez de convertirse: un valor
  // raro tiene que ser un 400 aquí y no un `else` que acaba tocando el timbre
  // porque no era `'qr'`.
  const channel: PresentChannel | undefined =
    body.channel === 'qr' || body.channel === 'phone' ? body.channel : undefined;

  // ── De qué va la llamada ───────────────────────────────────────────────
  //
  // Se **recorta antes de medir**, y eso no es cosmética: te-api declara
  // `subject` como `.min(1)`, así que una cadena de espacios pasa su esquema y
  // llega hasta la pantalla del titular como un héroe en blanco — que es
  // exactamente el hueco vacío que la tarea 4.0 hizo obligatorio el campo para
  // evitar. Aquí un asunto que no dice nada es un asunto que falta.
  const call =
    typeof body.call === 'object' && body.call !== null
      ? (body.call as { subject?: unknown; case?: unknown })
      : undefined;
  const callSubject = typeof call?.subject === 'string' ? call.subject.trim() : '';
  const callCase = typeof call?.case === 'string' ? call.case.trim() : '';

  if (externalId === '' || type === '') {
    return NextResponse.json({ error: t('errors.missingFields') }, { status: 400 });
  }
  if (channel === undefined) {
    return NextResponse.json({ error: t('errors.badChannel') }, { status: 400 });
  }
  // Antes de tocar la base y te-api: una petición sin atributos no se puede
  // satisfacer mire lo que mire, y te-api tampoco la aceptaría (`claims` es
  // `.min(1)` en su esquema). No hay que gastar una llamada para saberlo.
  if (requested.length === 0) {
    return NextResponse.json({ error: t('errors.noClaimsRequested') }, { status: 400 });
  }

  // ── El asunto se exige EN LOS DOS CANALES, y eso es lo que cambió ──────
  //
  // Antes se exigía sólo en el teléfono y se **rechazaba** con el QR, porque el
  // QR no llegaba a pintar ninguna pantalla del marco: era un `openid4vp://`
  // pelado, y un asunto escrito para él habría sido un dato para tirarlo.
  //
  // Ahora las dos ramas componen `bank.call.v2`, y esa plantilla declara
  // `subject` como su **héroe obligatorio** (`required: ['subject']`,
  // `hero: 'subject'` en `src/requests/catalog.ts` de te-api). Sin él la
  // petición no se puede pintar y te-api la rechaza con `missing_required_field`
  // — así que el que era un campo de un canal es ahora un campo de la ceremonia.
  //
  // Se mide aquí y no se deja caer al 400 de te-api por lo de siempre: el agente
  // está al teléfono, y «te-api ha rechazado los datos» no le dice qué campo
  // arreglar.
  if (callSubject === '') {
    return NextResponse.json({ error: t('errors.missingCallSubject') }, { status: 400 });
  }
  if (callSubject.length > CALL_TEXT_MAX) {
    return NextResponse.json(
      { error: t('errors.callSubjectTooLong', { max: CALL_TEXT_MAX }) },
      { status: 400 },
    );
  }
  if (callCase.length > CALL_TEXT_MAX) {
    return NextResponse.json(
      { error: t('errors.callCaseTooLong', { max: CALL_TEXT_MAX }) },
      { status: 400 },
    );
  }

  try {
    const session = await getEmployeeSession();

    // ── El cliente: contra el padrón, y siempre con la organización ────────
    //
    // El `where` lleva el `org_id` de la sesión, así que un `externalId` de
    // otro banco no encuentra fila. Sin eso, el timbre sonaría en el teléfono
    // de un tercero.
    const customer = await findCustomer(session.organization.orgId, externalId);
    if (customer === null) {
      return NextResponse.json({ error: t('errors.customerNotFound') }, { status: 404 });
    }

    // ── El tipo: contra el padrón de te-api ────────────────────────────────
    //
    // `GET /v1/b2b/organization` devuelve los tipos que ESTA organización puede
    // emitir. Un `type` que no esté ahí se rechaza aquí y con su nombre; te-api
    // también lo rechazaría, pero su cuerpo es `{ error, requestId }` y el
    // agente vería «te-api ha rechazado los datos» para algo que este servidor
    // sabe contestar. La respuesta va cacheada un minuto: ver `te-api.ts`.
    const organization = await fetchB2bOrganizationCached(session.organization);
    const declared = findDeclaredType(organization.credentialTypes, type);
    if (declared === undefined) {
      return NextResponse.json(
        { error: t('errors.unknownType', { type }) },
        { status: 400 },
      );
    }

    // ── Los atributos: contra los que ese tipo lleva en ESTA ficha ─────────
    //
    // La lista la construye el servidor cruzando tres cosas —el tipo del
    // padrón, el perfil declarado en configuración y lo que la fila rellena—, y
    // lo que llegó del navegador es una **selección sobre ella**, no una lista
    // libre. Que te-api rechace los reservados no quita que la comprobación
    // tenga que estar también aquí: es aquí donde se sabe qué lleva la
    // credencial de este cliente, porque los claims los puso este CRM al emitir
    // y te-api nunca los ve.
    const profile = resolveCredentialType(t, declared, customer);
    const requestable = new Set(profile.claims.map((claim) => claim.name));

    // Se RECHAZA, no se recorta. La misma decisión que `src/b2b/claims.ts` de
    // te-api, que lanza en vez de filtrar: un recorte silencioso deja al que
    // llama creyendo que pidió lo que no pidió, y el día que ese atributo
    // importe nadie sabrá por qué no salió. La respuesta nombra los que sobran
    // porque el error es de quien llama y tiene que poder arreglarlo.
    const unavailable = requested.filter((name) => !requestable.has(name));
    if (unavailable.length > 0) {
      return NextResponse.json(
        {
          error: t('errors.claimsNotCarried', {
            label: profile.label,
            claims: unavailable.join(', '),
          }),
        },
        { status: 400 },
      );
    }

    // Duplicados aparte y en el orden del catálogo: te-api los colapsa igual,
    // pero así lo que se devuelve al navegador es lo que se pidió de verdad.
    const claims = profile.claims
      .map((claim) => claim.name)
      .filter((name) => requested.includes(name));

    const presentation = await requestPresentation(session.organization, {
      type: declared.type,
      // El `sub` que te-api exigirá a la credencial presentada. Sale de la fila
      // del padrón —no del cuerpo de la petición—, y es el mismo que se usó al
      // emitir. `CONTRATOS.md` §1.2.
      subjectReference: customer.externalId,
      claims,
    });

    // ── Los hitos de la línea de tiempo, con la hora de ESTE servidor ───────
    //
    // La pantalla de espera tiene que avanzar sola, y para eso necesita horas
    // de verdad. Se sellan aquí y no en el navegador por dos razones:
    //
    //  1. El reloj del navegador lo pone quien tenga el puesto delante. Una
    //     línea de tiempo que un agente puede mover cambiando la hora de su
    //     Windows no sirve para reclamar nada.
    //  2. Es el mismo reloj en las dos marcas, así que la diferencia entre
    //     ellas —«el timbre salió 12 s después de crear la solicitud»— es un
    //     dato real y no la resta de dos relojes distintos.
    //
    // te-api **no devuelve la hora de creación** (`POST /v1/b2b/presentations`
    // contesta `{presentationId, requestUri, authorizationRequestUrl,
    // expiresAt}`), así que ésta es la hora en la que su respuesta llegó aquí.
    // Es la que el banco puede defender: la que él vio.
    const requestedAt = new Date().toISOString();
    let wakeupAt: string | undefined;

    // ── La ventana que corre es la de la CEREMONIA, no la de la sesión ─────
    //
    // Lo que el titular tiene delante es la petición del marco, y es su plazo el
    // que decide hasta cuándo puede contestar. La sesión del verificador tiene
    // el suyo y es otro número: enseñar ése sería enseñar una cuenta atrás de
    // algo que la persona no está mirando.
    //
    // La rama del teléfono se queda con el de la sesión, que es lo que siempre
    // usó: cambiarlo es una decisión aparte y no hace falta para esto.
    let expiresAt = presentation.expiresAt;

    // **El código del mostrador**, cuando lo hay. Lo construye te-api y viaja
    // en la respuesta de `POST /v1/requests`: aquí no se fabrica ninguno. Ver
    // `TransferApprovalResult.link`.
    let counterLink: string | null = null;

    let wakeupId: string | undefined;
    if (channel === 'phone') {
      try {
        const wakeup = await sendWakeup(session.organization, {
          subjectReference: customer.externalId,
          // «Demuéstrame que eres tú», no «aprueba esta operación». La otra
          // mitad —`transaction`, con importe y destinatario— es F4c nivel 2 y
          // no se manda desde aquí: esta pantalla no tiene ninguna operación
          // que aprobar.
          kind: 'identity',
          // **De qué va la llamada**, ya recortado y medido arriba. Es el héroe
          // de la pantalla del titular: lo más grande de lo que va a leer, y la
          // respuesta a la única pregunta que se hace alguien a quien acaban de
          // llamar. Sin esto te-api contesta `400 invalid_request` y no suena
          // ningún teléfono.
          //
          // `case` va **ausente y no vacío** cuando el agente no lo escribe:
          // te-api lo declara `.min(1)` dentro de un objeto `.strict()`, así que
          // `case: ''` es un rechazo y `case` sin poner es lo correcto. `branch`
          // no se manda: ver la cabecera de `VerificationLauncher`.
          call: { subject: callSubject, ...(callCase === '' ? {} : { case: callCase }) },
          // Tal cual salió de te-api. Es el puntero a **su** verificador, y por
          // eso el timbre suena apuntando a la infraestructura de TripleEnable
          // y no a la de Banco Demo.
          requestUri: presentation.requestUri,
          // Atribución, no autenticación: te-api no comprueba nada de esto.
          // Sirve para que en el móvil del titular ponga quién le está llamando.
          actor: session.agent,
        });
        // ── El aviso que no salió ──────────────────────────────────────────
        //
        // te-api contesta `200` toque o no toque el timbre —la fila nace señuelo
        // si no hay a quién despertar—, así que hasta ahora esto seguía adelante
        // y la pantalla prometía «hemos avisado a su móvil» con cinco minutos de
        // cuenta atrás para un aviso inexistente.
        //
        // Ahora lo dice: `delivery.status`. Se para aquí y **por el mismo camino
        // que un timbre que falla**, no con un 200 adornado, porque es la misma
        // situación — no ha salido nada— y la ceremonia no debe quedar anotada
        // como pendiente. La sesión de presentación abierta se deja caducar
        // sola, igual que en el `catch`.
        if (wakeup.delivery?.status === 'not_delivered') {
          console.error('[crm] tocando el timbre: te-api no entregó el aviso', {
            reason: wakeup.delivery.reason,
            wakeupId: wakeup.wakeupId,
          });
          return NextResponse.json(
            {
              error: t('errors.noWalletLink'),
              // El código estable viaja tal cual: quien depure esta integración
              // tiene que poder distinguirlo de un fallo de red sin leer el
              // texto, que además está traducido.
              reason: wakeup.delivery.reason,
            },
            { status: 409 },
          );
        }

        wakeupId = wakeup.wakeupId;
        wakeupAt = new Date().toISOString();
      } catch (error) {
        // La sesión de presentación ya está abierta y **se deja caducar sola**.
        // Se prefiere eso a devolver un 200 con un aviso pequeño: el agente está
        // al teléfono diciéndole al cliente que mire el móvil, y un timbre que
        // no ha salido tiene que parar la ceremonia, no adornarla.
        return errorResponse(t, error, 'tocando el timbre');
      }
    } else {
      // ── El mostrador: la petición del marco, por la ruta genérica ────────
      //
      // Ésta es la rama que estaba rota. Antes terminaba aquí con la sesión de
      // presentación abierta y un `openid4vp://` pintado en un QR: el titular
      // acababa en la pantalla genérica de presentación de la cartera —la misma
      // que atiende a Entra ID— sin ver de qué iba la llamada, quién preguntaba
      // ni qué estaba firmando.
      //
      // Ahora compone **la misma petición que el timbre compone por dentro**
      // (`src/routes/b2b.ts`, `POST /v1/b2b/wakeups`): misma plantilla, mismo
      // `kind`, mismo `signWith` y los mismos rótulos, palabra por palabra. Que
      // sean idénticas no es estética: es lo que hace que el titular vea la
      // misma pantalla esté al teléfono o en el mostrador, y que un cambio en
      // una de las dos se note como una diferencia y no como una variante.
      try {
        const asked = await requestCeremony(session.organization, {
          subjectReference: customer.externalId,
          // La única que `bank.call.v2` admite. Es una verificación: se pregunta
          // quién es quien está delante, no se autoriza ninguna operación.
          kind: 'verify',
          // **Identidad, y no credencial**, que es lo que hace el timbre para
          // esta misma plantilla. La credencial se presenta igual —viaja el
          // `requestUri` y la cartera va al verificador—; lo que `signWith`
          // decide es qué prueba guarda te-api junto a la firma, y con
          // `credential` habría que nombrar además el `credentialType` para
          // acabar con la misma pantalla. Dos peticiones que sólo se distinguen
          // en eso son dos caminos que se separan a la primera corrección.
          signWith: 'identity',
          template: 'bank.call.v2',
          // **La puerta del verificador**, y es lo que ata las dos mitades: sin
          // ella la cartera no sabe a dónde ir a presentar, y la petición
          // quedaría siendo una pregunta sin forma de contestarla.
          requestUri: presentation.requestUri,
          // Los mismos tres campos que `buildCallFields` en te-api, con los
          // mismos rótulos en inglés —los lee el titular— y los mismos estilos.
          fields: [
            {
              key: 'subject',
              label: 'What the call is about',
              value: callSubject,
              // Es una frase, no un identificador: texto y de héroe, que es lo
              // que la plantilla exige (`hero: 'subject'`).
              type: 'text',
              style: 'hero',
            },
            {
              key: 'agent',
              label: 'Agent on the line',
              // Atribución, no autenticación: te-api no comprueba nada de esto.
              // Sirve para que el titular lea con qué nombre le hablan.
              value: session.agent.displayName,
              type: 'text',
              style: 'normal',
            },
            // Ausente y no vacío cuando no se escribe: `value` es `.min(1)` en
            // te-api, así que una cadena vacía es un rechazo.
            ...(callCase === ''
              ? []
              : [
                  {
                    // Se coteja carácter a carácter contra una carta o un
                    // correo, así que monoespaciada —donde el 0 y la O se
                    // distinguen— y en voz baja: es para comprobar, no para
                    // decidir.
                    key: 'case',
                    label: 'Case reference',
                    value: callCase,
                    type: 'mono',
                    style: 'quiet',
                  } as const,
                ]),
          ],
        });

        // `requestCeremony` devuelve dos cosas: lo que contestó te-api y **la
        // petición que salió**, porque el catálogo de verificaciones enseña esa
        // petición en pantalla y tiene que ser la de verdad y no una
        // reconstrucción. Aquí no hace falta la segunda, así que se lee `result`
        // y ya está.
        expiresAt = asked.result.expiresAt;
        counterLink = asked.result.link;
      } catch (error) {
        // Igual que en el timbre: la sesión de presentación ya está abierta y
        // **se deja caducar sola**. Sin petición no hay ceremonia, y anotarla
        // como pendiente pondría en el historial del cliente algo que nadie le
        // llegó a preguntar.
        //
        // El caso que más se va a ver aquí es el `404` de te-api —«sin titular
        // para lo que se nombró»—, que es lo que contesta cuando esa persona no
        // tiene cartera vinculada con esta organización. La pantalla ya lo avisa
        // antes de pulsar, pero el aviso sale del directorio de vínculos y puede
        // no haber contestado.
        return errorResponse(t, error, 'creando la petición del marco');
      }
    }

    // ── El diario del banco ────────────────────────────────────────────────
    //
    // Se anota **aquí y no antes**: si el timbre falla, la ceremonia no ha
    // empezado y la fila no debe existir. Una comprobación «pendiente» que
    // nunca se llegó a pedir aparecería en el historial del cliente y el agente
    // creería que le avisó.
    //
    // Es lo que convierte esta pantalla en una dirección que se puede volver a
    // abrir: sin la fila, recargar la pestaña perdía la ceremonia en curso y no
    // quedaba rastro de lo que se pidió a quién. Ver `db/003_verification.sql`.
    await recordVerification({
      orgId: session.organization.orgId,
      externalId: customer.externalId,
      presentationId: presentation.presentationId,
      typeKey: declared.type,
      requestedClaims: claims,
      channel,
      issuerDid: organization.did,
      authorizationRequestUrl: presentation.authorizationRequestUrl,
      // Sólo lo hay en la rama del mostrador; en la del teléfono es nulo.
      counterLink,
      requestUri: presentation.requestUri,
      expiresAt,
      agentId: session.agent.id,
      agentName: session.agent.displayName,
      actor: session.actor,
      requestedAt,
      wakeupId,
      wakeupAt,
    });

    return NextResponse.json({
      presentationId: presentation.presentationId,
      authorizationRequestUrl: presentation.authorizationRequestUrl,
      // Se devuelve para poder enseñarlo: es lo que se le manda al timbre y lo
      // que la cartera va a buscar, y enseña de un vistazo que apunta a la
      // infraestructura de TripleEnable.
      requestUri: presentation.requestUri,
      expiresAt,
      claims,
      channel,
      // El identificador del aviso. **No significa que haya sonado ningún
      // teléfono**: te-api contesta lo mismo tenga cartera o no (ver
      // `sendWakeup`). Se enseña para poder cruzarlo con el diario de te-api.
      wakeupId,
      // Los dos hitos que este servidor conoce de primera mano. Ver arriba.
      requestedAt,
      wakeupAt,
      // El `iss` que te-api va a exigirle a la credencial presentada. Es el DID
      // de esta organización y sale del padrón, no del cuerpo: se devuelve para
      // que el recibo pueda enseñar contra qué se comprobó, que es la mitad de
      // lo que hace verificable una verificación.
      issuerDid: organization.did,
      // El tipo, ya resuelto. La pantalla lo tiene por otro lado, pero el
      // recibo se guarda por su cuenta y no puede depender de que el
      // desplegable siga en la misma posición.
      type: declared.type,
      // ── El mostrador ──────────────────────────────────────────────────
      //
      // El enlace del código, **sólo en la rama del mostrador**: en la del
      // teléfono el titular no está delante de esta pantalla y un código ahí no
      // sirve de nada. Lo construye te-api —el selector del emisor es
      // configuración de aquel despliegue— y aquí ni se fabrica ni se retoca.
      // Nulo cuando ese despliegue no tiene canal QR.
      //
      // Va **el enlace y no el dibujo**: el SVG lo rehace la pantalla de
      // seguimiento en cada pintado desde la fila guardada, que es lo que hace
      // que el código siga ahí al recargar. Mandarlo también por aquí sería la
      // misma imagen por dos caminos, y el de esta respuesta muere en cuanto el
      // lanzador navega.
      counterLink,
    });
  } catch (error) {
    return errorResponse(t, error, 'pidiendo la presentación');
  }
}

/**
 * `GET /api/credentials/present?presentationId=…` — **se lee el diario, no te-api.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ESTA RUTA YA NO HABLA CON te-api, Y ESO ES EL CAMBIO ENTERO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Hasta ahora llamaba a `GET /v1/b2b/presentations/:id` en cada consulta del
 * navegador. La pantalla pregunta cada tres segundos, así que **una ceremonia de
 * cinco minutos eran unas cien llamadas a te-api para averiguar un hecho que
 * ocurre una sola vez**. Y ocurría con el agente mirando: con la pestaña
 * cerrada, nadie preguntaba y la fila se quedaba en `pending` para siempre.
 *
 * Ahora el desenlace entra en el diario **por el webhook y sólo por él**
 * (`api/webhooks/te-api`, que verifica la firma antes de tocar nada). Esta ruta
 * lee la fila que ese receptor ha escrito. Los dos caminos que había —el sondeo
 * y el evento— eran uno de más: te-api liquida toda petición que responde *o*
 * que caduca, así que el evento llega en los dos casos y llega igual con la
 * pestaña cerrada.
 *
 * ## Por qué esto ya no escribe nada
 *
 * Antes este `GET` escribía —reconciliaba la fila con lo que dijera te-api— y
 * hacía falta explicarlo. Ya no: el único que cierra el diario es el receptor de
 * webhooks, que es donde llega el dato firmado. Un `GET` que sólo lee es lo que
 * un `GET` debe ser, y de paso desaparece la duda de quién gana la carrera.
 *
 * ## Lo que el navegador sigue haciendo, y por qué está bien
 *
 * La pantalla sigue preguntando **a este mismo servidor** cada tres segundos.
 * Eso es tráfico interno de la maqueta contra su propia base: no gasta el cubo
 * de tasa de la organización en te-api, que era el coste que importaba, y no
 * cruza ninguna frontera. Lo prohibido era sondear a te-api, y ya no se hace ni
 * desde el navegador ni desde aquí.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const t = await getTranslator();
  const presentationId = new URL(request.url).searchParams.get('presentationId') ?? '';
  if (presentationId === '') {
    return NextResponse.json({ error: t('errors.missingPresentationId') }, { status: 400 });
  }

  try {
    const session = await getEmployeeSession();
    // El `org_id` de la sesión va en el `where`, así que la comprobación de otra
    // organización se comporta igual que una inventada. Antes esta garantía la
    // ponía te-api —buscaba con el `org_id` del token—; al leer de la base hay
    // que ponerla aquí, y `findVerification` no tiene ninguna forma de no
    // ponerla: no existe una función que encuentre una comprobación sin decir de
    // qué organización es.
    const verification = await findVerification(session.organization.orgId, presentationId);
    if (verification === null) {
      return NextResponse.json({ error: t('errors.presentationNotFound') }, { status: 404 });
    }

    // `status` sale del diario, que es donde lo dejó el webhook firmado, y
    // `claims` de la misma fila. Mientras el evento no haya llegado la respuesta
    // es `pending` y la pantalla sigue esperando, que es exactamente lo que
    // significa: todavía no se sabe.
    //
    // `settledAt` es nuevo aquí, y arregla de paso una hora que se inventaba: la
    // pantalla sellaba el desenlace con `new Date()` **del navegador**, o sea con
    // el reloj de quien tuviera el puesto delante. Ahora es la hora que escribió
    // `settleVerification` al llegar el evento — la que este servidor puede
    // defender, que es la regla que el `POST` de aquí arriba ya seguía para los
    // otros dos hitos.
    //
    // ── Y el recibo también, para que la pantalla no tenga que recargarse ──
    //
    // `holderKey`, `holderLinkId` y `proof` salen de la misma fila. Van aquí y
    // no sólo en la página servidor porque la ceremonia ocurre **con la pantalla
    // abierta**: el agente está al teléfono, el titular firma, el webhook
    // aterriza, y la consulta siguiente tiene que poder pintar el recibo entero
    // sin que nadie pulse F5. Sin esto, la mitad de arriba del recibo aparecía
    // sola y las filas de la firma sólo salían al volver a entrar mañana.
    //
    // Sigue sin haber una sola llamada a te-api en esta ruta. Son cuatro
    // columnas más del mismo `select`, no una fuente nueva.
    return NextResponse.json({
      presentationId: verification.presentationId,
      status: verification.status,
      claims: verification.disclosedClaims,
      settledAt: verification.settledAt,
      holderKey: verification.holderKey,
      holderKeyJwk: verification.holderKeyJwk,
      holderLinkId: verification.holderLinkId,
      proof: verification.proof,
    });
  } catch (error) {
    return errorResponse(t, error, 'leyendo la comprobación');
  }
}

/**
 * El mismo trato que en la emisión: el `requestId` es lo único accionable.
 *
 * `operation` va siempre a `'presentation'` en este fichero porque el 403 de
 * te-api significa aquí «ese tipo no tiene `vct` en el padrón» y no lo que
 * significa en el vínculo. Ver `TeApiOperation`.
 */
function errorResponse(
  t: Translator,
  error: unknown,
  doing: string,
  operation: TeApiOperation = 'presentation',
): NextResponse {
  if (error instanceof TeApiError) {
    console.error(`[crm] ${doing}: te-api rechazó la llamada`, {
      status: error.status,
      code: error.code,
      requestId: error.requestId,
    });
    return NextResponse.json(
      { error: describeTeApiError(t, error, operation), requestId: error.requestId },
      { status: error.status === 404 ? 502 : error.status },
    );
  }

  console.error(`[crm] ${doing}`, error);

  // Los fallos de configuración sí enseñan su mensaje: nombran la variable que
  // falta o dicen que Logto rechazó el token, y ninguno lleva el secreto
  // dentro. Ver la nota en `api/credentials/issue/route.ts`.
  const isConfigurationFailure =
    error instanceof Error &&
    (error.name === 'B2bTokenError' || error.name === 'OrganizationConfigError');

  return NextResponse.json(
    {
      error: isConfigurationFailure
        ? (error as Error).message
        : t('errors.presentFailed'),
    },
    { status: 500 },
  );
}
