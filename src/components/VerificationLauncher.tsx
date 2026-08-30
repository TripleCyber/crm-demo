'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

/**
 * La pantalla que **lanza** una comprobación de identidad — la primera mitad
 * de **C1** del artifact «Llamada Verificada».
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  LANZAR Y SEGUIR SON DOS PANTALLAS, Y ESO ARREGLA UN FALLO REAL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Antes esto era un panel de la ficha que además se quedaba con el seguimiento:
 * recargar la pestaña perdía la ceremonia en curso, no se podía pasar a un
 * compañero y no quedaba rastro de lo que se pidió a quién. Ahora este
 * formulario abre la sesión, el servidor la anota, y el navegador se va a
 * `/verifications/<id>` — una dirección que se puede recargar, mandar por chat
 * y volver a abrir mañana con su recibo dentro.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ESTE COMPONENTE NO SABE CÓMO SE LLAMA EL BANCO NI QUÉ EMITE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * No hay ni un `given_name` ni un `cliente` escritos aquí. Los tipos salen del
 * padrón de te-api y los atributos y los rótulos de la configuración de esa
 * organización (`credential-profiles.ts`), resueltos en el servidor. Una
 * organización que comprueba otra cosa —una póliza, una colegiación— funciona
 * con esta misma pantalla y sin tocarla.
 *
 * Lo que sí es de este CRM, y se queda, es **el canal**: un CRM sabe por qué vía
 * está hablando con su cliente, y por eso puede rotular «está al teléfono» o
 * «está delante». Eso es un dato real, no una suposición.
 *
 * ## Los dos niveles, que son dos ceremonias y no dos botones
 *
 * **Nivel 1 · «verificar quién habla»** — que la persona que está al teléfono
 * sea quien dice. Es lo que hay construido y funciona de punta a punta.
 *
 * **Nivel 2 · «autorizar operación»** — firmar un importe y un destinatario. Es
 * F7, y **aquí no se manda nada**: seleccionar ese nivel enseña lo que falta y
 * por qué no se puede simular. Lo que no se hace es enviar la ceremonia de
 * nivel 1 con el rótulo del nivel 2, que es exactamente el ataque que las dos
 * ceremonias existen para impedir — si el gesto es el mismo, acostumbrarse a
 * uno enseña a ejecutar el otro por reflejo.
 *
 * ## Dos canales dentro del nivel 1, porque son dos situaciones distintas
 *
 * - **Por teléfono.** El agente tiene al titular al aparato y necesita que le
 *   suene el móvil: el QR ahí no sirve de nada.
 * - **En el mostrador.** El titular está delante y mira esta misma pantalla.
 *
 * El canal cambia **cómo se avisa**, no qué se pide ni qué se comprueba.
 */

/** Un atributo pedible, ya resuelto en el servidor. */
interface CredentialClaimOption {
  readonly name: string;
  readonly label: string;
}

/** Un tipo del padrón, con lo que lleva y cómo se rotula. */
interface CredentialTypeOption {
  readonly type: string;
  readonly label: string;
  readonly claims: readonly CredentialClaimOption[];
  readonly defaultClaims: readonly string[];
}

/** Cómo se avisa al titular. El mismo valor que entiende la ruta del servidor. */
type Channel = 'qr' | 'phone';

/** Los dos niveles de la ceremonia. Ver la cabecera. */
type Level = 'identity' | 'transaction';

export function VerificationLauncher({
  externalId,
  holderName,
  credentialTypes,
  agent,
  initialLevel,
}: {
  externalId: string;
  holderName: string;
  /**
   * Los tipos que el padrón de esta organización declara, con los atributos que
   * cada uno lleva **en esta ficha**. Se resuelven en el servidor cruzando
   * te-api, la configuración y la fila del cliente.
   */
  credentialTypes: readonly CredentialTypeOption[];
  /**
   * Quién sale en el móvil del titular. Viene de la sesión del servidor y es
   * *atribución*: te-api no lo verifica. Se pinta aquí para que el agente vea
   * con qué nombre le está llegando la llamada al cliente y pueda decirlo en
   * voz alta — es la mitad que hace que la comprobación sirva de algo.
   */
  agent: { readonly id: string; readonly displayName: string };
  /** Con qué nivel se ha entrado, según el enlace que se pulsó en la ficha. */
  initialLevel: Level;
}) {
  const router = useRouter();
  const [level, setLevel] = useState<Level>(initialLevel);
  const [type, setType] = useState(credentialTypes[0]?.type ?? '');

  const selectedType = useMemo(
    () => credentialTypes.find((option) => option.type === type),
    [credentialTypes, type],
  );

  // Lo marcado de salida lo dice el tipo, no este componente. Antes era
  // `given_name`/`family_name` escrito aquí, que acertaba con un banco y fallaba
  // con el siguiente; ahora sale de `defaultClaims`, que el servidor resuelve
  // con el catálogo del padrón de esa organización.
  const [selected, setSelected] = useState<readonly string[]>(
    () => credentialTypes[0]?.defaultClaims ?? [],
  );
  /** Qué botón se está atendiendo, para deshabilitar sólo ése. */
  const [busy, setBusy] = useState<Channel | undefined>();
  const [error, setError] = useState<string | undefined>();

  const toggle = (name: string) => {
    setSelected((current) =>
      current.includes(name) ? current.filter((other) => other !== name) : [...current, name],
    );
  };

  // Cambiar de tipo cambia qué atributos existen, así que la selección del tipo
  // anterior no se puede arrastrar: dejaría marcado algo que el tipo nuevo no
  // lleva, el servidor lo rechazaría y el agente no sabría por qué.
  const chooseType = (next: string) => {
    setType(next);
    setSelected(credentialTypes.find((option) => option.type === next)?.defaultClaims ?? []);
  };

  const startRequest = async (channel: Channel) => {
    setBusy(channel);
    setError(undefined);
    try {
      const response = await fetch('/api/credentials/present', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ externalId, type, claims: selected, channel }),
      });
      const payload = (await response.json()) as { presentationId?: string; error?: string };
      if (!response.ok || typeof payload.presentationId !== 'string') {
        setError(payload.error ?? `la petición ha fallado (${response.status})`);
        setBusy(undefined);
        return;
      }
      // A la pantalla de seguimiento, que es donde vive la ceremonia. No se
      // quita el `busy`: la navegación tarda un instante y devolver el botón a
      // su sitio antes de irse invita a pulsarlo dos veces — y dos pulsaciones
      // son dos timbres en el móvil de la misma persona.
      router.push(`/verifications/${encodeURIComponent(payload.presentationId)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'no se ha podido contactar con el servidor');
      setBusy(undefined);
    }
  };

  if (credentialTypes.length === 0) {
    return (
      <div className="card">
        <h2>No hay nada que comprobar</h2>
        <p className="alert">
          Esta organización no declara ningún tipo de credencial. Compruébalo en{' '}
          <a href="/diagnostics">Diagnóstico</a>: el catálogo lo declara TripleEnable, no esta
          consola.
        </p>
      </div>
    );
  }

  const claimOptions = selectedType?.claims ?? [];

  return (
    <>
      {/*
        Los dos niveles. Son dos ceremonias distintas, no dos etiquetas del
        mismo botón: el nivel 1 se aprueba deslizando y el nivel 2 tecleando
        cuatro cifras que hay que haber oído. Que el gesto difiera es lo que
        impide que acostumbrarse a uno enseñe a ejecutar el otro sin leer.
      */}
      <div className="levels">
        <button
          type="button"
          className={level === 'identity' ? 'level on' : 'level'}
          aria-pressed={level === 'identity'}
          onClick={() => setLevel('identity')}
        >
          Verificar quién habla
          <small>Nivel 1 · que sea él quien está al teléfono</small>
        </button>
        <button
          type="button"
          className={level === 'transaction' ? 'level on' : 'level'}
          aria-pressed={level === 'transaction'}
          onClick={() => setLevel('transaction')}
        >
          Autorizar operación
          <small>Nivel 2 · firmar un importe · todavía no</small>
        </button>
      </div>

      {level === 'transaction' ? (
        <TransactionLevel />
      ) : (
        <div className="split wide-side">
          <div className="col-main">
            <div className="card">
              <h2>Qué se le pide</h2>
              <p className="muted">
                Se le enviará una solicitud <strong>firmada a nombre de esta entidad</strong>, y su
                cartera comprobará esa firma antes de enseñar nada. La verificación la hace
                TripleEnable: esta organización no tiene que custodiar ninguna clave.
              </p>

              <label className="field">
                <span>Tipo de credencial</span>
                {/*
                  El rótulo, y sólo el rótulo. Sale de configuración y puede no
                  estar; entonces `label` ES el `type_key` y se lee igual de bien.
                  Enseñar los dos —«Cliente del banco · cliente»— obligaba a
                  leer dos veces para elegir una.
                */}
                <select value={type} onChange={(event) => chooseType(event.target.value)}>
                  {credentialTypes.map((option) => (
                    <option key={option.type} value={option.type}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <fieldset className="field claims" style={{ border: 0, padding: 0, margin: 0 }}>
                <legend style={{ padding: 0 }}>Atributos</legend>
                {claimOptions.length === 0 ? (
                  <p className="alert warn" style={{ marginTop: 8 }}>
                    Este tipo no lleva ningún atributo que esta ficha pueda rellenar, así que no hay
                    nada que pedirle. Revisa la ficha, o el perfil del tipo en la configuración.
                  </p>
                ) : (
                  /*
                    El rótulo humano, sin la clave debajo. Marcar «Nombre» no
                    requiere saber que por dentro se llama `given_name`, y la
                    clave duplicaba la altura de cada casilla en la pantalla que
                    el agente usa con un cliente esperando al teléfono. La
                    correspondencia completa está en el detalle de abajo.
                  */
                  claimOptions.map((claim) => (
                    <label key={claim.name} className="claim">
                      <input
                        type="checkbox"
                        checked={selected.includes(claim.name)}
                        onChange={() => toggle(claim.name)}
                      />
                      <span>{claim.label}</span>
                    </label>
                  ))
                )}
                <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
                  Se pide sólo lo que hace falta: <strong>lo que no se marque no sale de la cartera
                  del titular</strong>, y lo que su cartera enseñe de más tampoco llega hasta aquí.
                </p>
                {claimOptions.length > 0 && (
                  <details className="tech">
                    <summary>Ver el detalle técnico</summary>
                    <dl className="facts">
                      {claimOptions.map((claim) => (
                        <div key={claim.name} style={{ display: 'contents' }}>
                          <dt className="mono">{claim.name}</dt>
                          <dd>{claim.label}</dd>
                        </div>
                      ))}
                    </dl>
                    <p>
                      Se piden por nombre en la sesión de presentación y te-api devuelve la
                      intersección entre lo pedido y lo que la cartera reveló.
                    </p>
                  </details>
                )}
              </fieldset>
            </div>

            <div className="card">
              <h2>Cómo se le avisa</h2>
              {/*
                Los dos botones, y en este orden. El de arriba es el de la llamada de
                teléfono, que es la situación normal de un agente con auriculares
                puestos; el QR sólo sirve si el cliente está en el mostrador mirando
                esta misma pantalla. Rotularlos por la SITUACIÓN y no por la tecnología
                —«está al teléfono» en vez de «push»— es lo que hace que no haya que
                elegir bien para acertar.
              */}
              <div className="row" style={{ alignItems: 'stretch' }}>
                <button
                  type="button"
                  onClick={() => void startRequest('phone')}
                  disabled={busy !== undefined || type === '' || selected.length === 0}
                >
                  {busy === 'phone' ? 'Avisando…' : 'Está al teléfono · avisar a su móvil'}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => void startRequest('qr')}
                  disabled={busy !== undefined || type === '' || selected.length === 0}
                >
                  {busy === 'qr' ? 'Pidiendo…' : 'Está delante · enseñar QR'}
                </button>
              </div>

              {error !== undefined && (
                <p className="alert" style={{ marginTop: 16, marginBottom: 0 }}>
                  {error}
                </p>
              )}
            </div>
          </div>

          <div className="col-side">
            <div className="panel">
              <h2>
                Lo que le llega a él
                <span className="panel-mark">TripleEnable</span>
              </h2>
              <dl className="facts">
                <dt>A nombre de</dt>
                <dd>
                  {agent.displayName}, agente <span className="mono">{agent.id}</span>
                </dd>
                <dt>Sobre</dt>
                <dd>{holderName}</dd>
                <dt>Se le pedirá</dt>
                <dd>
                  {selected.length === 0 ? (
                    <span className="none">Nada todavía. Marca al menos un atributo.</span>
                  ) : (
                    selected
                      .map(
                        (name) =>
                          claimOptions.find((claim) => claim.name === name)?.label ?? name,
                      )
                      .join(', ')
                  )}
                </dd>
              </dl>
              <p className="panel-note">
                <strong>Dile en voz alta que se la has mandado y con qué nombre.</strong> Que lo que
                oye por teléfono sea lo que lee en la pantalla del móvil es la mitad de la
                comprobación — la otra mitad la pone la firma de su cartera.
              </p>
              {/*
                Se queda entera: es una salvedad sobre el mundo —el nombre del
                agente no lo garantiza nadie— y es justo la que impide que el
                agente se confíe. Sólo se le ha quitado el nombre de la pieza
                interna, que no cambiaba ni una coma de lo que significa.
              */}
              <p className="panel-note">
                El nombre del agente es <em>informativo</em>: no lo verifica nadie y no decide nada.
                Lo infalsificable es que la solicitud viene firmada por esta organización, y eso lo
                comprueba su cartera antes de enseñar nada.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * **Nivel 2 · autorizar operación.** Lo que hay, lo que falta, y por qué no se
 * simula.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ESTE PANEL NO MANDA NADA, Y ES LA DECISIÓN, NO UNA LIMITACIÓN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Se podría mandar hoy mismo un `kind: 'transaction'` a `POST /v1/b2b/wakeups`
 * —la ruta lo acepta y está probada— y rotular el botón «autorizar operación».
 * Sería mentira, y de la peligrosa:
 *
 *  - **El importe no viaja.** El cuerpo del timbre no tiene campo para él, y la
 *    cartera todavía no implementa `transaction_data` de OID4VP, así que la
 *    firma del titular no cubriría lo que leyó. Una firma que no cubre el
 *    importe es indistinguible de una de «verifica que eres tú».
 *  - **Las cuatro cifras no llegan a nadie.** te-api las acuña —`createWakeup`
 *    escribe `match_digits` porque el motor las exige a toda fila del canal
 *    push— pero **no las devuelve**: ni en la respuesta del timbre, ni en
 *    `GET /v1/requests/pending`, que es de donde las leería la cartera. Y
 *    `POST /v1/requests/:id/outcome` no las pide al responder, así que nadie
 *    las comprueba. Un número de cuatro cifras que el CRM se inventara y que
 *    nadie coteja no es una comprobación: es enseñarle al agente a dictar
 *    números por teléfono, que es justo el reflejo que un estafador explota.
 *
 * Por eso el panel dice qué falta y en dónde. Cuando esté, esta pantalla es una
 * cifra grande y una advertencia — la parte fácil.
 */
function TransactionLevel() {
  return (
    <div className="level-pane">
      <p className="alert warn" style={{ marginBottom: 16 }}>
        El nivel 2 todavía no se puede ejecutar, y esta pantalla no lo simula.
      </p>

      <p>
        Autorizar una operación es <strong>otra ceremonia</strong>, no la misma con otro rótulo: el
        titular tiene que ver el importe, firmarlo —de forma que la firma cubra lo que leyó— y
        teclear cuatro cifras que sólo pueden haber llegado por la voz de quien le está llamando.
        Mandar la ceremonia del nivel 1 con este nombre acostumbraría a todo el mundo a autorizar
        transferencias deslizando, que es exactamente lo que las dos ceremonias existen para
        impedir.
      </p>

      <p className="muted" style={{ margin: '18px 0 0' }}>
        Mientras tanto, para confirmar que quien está al teléfono es el titular, usa el nivel 1.
        No autoriza ninguna operación y lo dice: es lo que separa esta ceremonia de un permiso.
      </p>

      {/*
        El inventario pieza por pieza se queda —hace falta para planificar y es
        la prueba de que esto no se ha simulado— pero plegado: quien mira esta
        pantalla para decidir si compra necesita el párrafo de arriba, que dice
        POR QUÉ no se puede, no la lista de rutas que faltan.
      */}
      <details className="tech">
        <summary>Ver el detalle técnico · qué falta y dónde</summary>
        <dl className="facts">
          <dt>Cartera</dt>
          <dd>
            <span className="mono">transaction_data</span> de OID4VP en el KB-JWT, y negarse a
            firmar si no coincide con lo que se pintó. Es el único trabajo de criptografía nuevo
            del plan.
          </dd>
          <dt>te-api · las cuatro cifras</dt>
          <dd>
            Ya las acuña <span className="mono">createWakeup</span>, pero no salen: hacen falta en
            la respuesta de <span className="mono">POST /v1/b2b/wakeups</span> —para que este CRM
            las enseñe— y en <span className="mono">GET /v1/requests/pending</span> —para que la
            cartera las pida—, y <span className="mono">POST /v1/requests/:id/outcome</span> tiene
            que comprobarlas y matar el reto al primer fallo.
          </dd>
          <dt>te-api · la operación</dt>
          <dd>
            El timbre no lleva importe ni destinatario. Sin ellos no hay nada que resumir dentro
            del <span className="mono">transaction_data</span>.
          </dd>
        </dl>
      </details>
    </div>
  );
}
