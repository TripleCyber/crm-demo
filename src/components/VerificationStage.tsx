'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import { formatClock, formatCountdown, formatSince } from '@/lib/format';
import { describeVerification, type VerificationStatus } from '@/lib/verification-status';

/**
 * **El escenario.** Lo único que hay que mirar de esta pantalla.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  LA ESPERA TIENE QUE VERSE VIVA, Y EL DESENLACE TIENE QUE SER UN MOMENTO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Antes esto eran cinco párrafos en una caja de color: la espera no se
 * distinguía de una pantalla colgada, y el desenlace —que es lo mejor que tiene
 * el producto, el segundo en el que el banco sabe que habla con quien cree—
 * llegaba como un texto que cambiaba de sitio. Nadie lo veía ocurrir.
 *
 * Este bloque es la respuesta, y tiene tres mitades:
 *
 *  1. **El reloj del titular.** Un anillo que se **vacía** con el plazo real
 *     que puso te-api, con la cuenta atrás dentro. Se vacía, no se llena: lo
 *     que avanza es el tiempo que se acaba, no un progreso hacia el sí.
 *  2. **El latido de la consola.** «Comprobando si ha contestado · hace 2 s».
 *     Late **cuando la consola ha preguntado de verdad y le han contestado**,
 *     no con un temporizador decorativo. Es lo que dice que la pantalla está
 *     trabajando, que es lo que no se sabía.
 *  3. **La identidad, fija debajo.** El nombre y **el número de cliente**, en
 *     monoespaciada y grandes, desde el primer segundo y en los cinco
 *     desenlaces. Quien está al teléfono tiene que poder cantarlo sin buscarlo.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  NO SE ANIMA NADA QUE EL SERVIDOR NO HAYA CONFIRMADO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Es la regla que gobierna todo lo de arriba, y es fácil de romper sin querer:
 * una barra que se llenara sola, unos puntos suspensivos que «avanzaran» o un
 * «recibido en su móvil» que apareciera solo serían movimiento inventado — la
 * pantalla afirmando un progreso que nadie ha visto ocurrir.
 *
 * Aquí sólo se mueven dos cosas, y las dos son hechos:
 *
 *  · el anillo, que es el **reloj**: el plazo corre lo mire quien lo mire;
 *  · el latido, que es una **consulta contestada**, con su hora.
 *
 * Lo que el titular esté haciendo con su teléfono no se insinúa, porque no se
 * sabe. La línea de tiempo lo sigue diciendo con todas las letras.
 *
 * El color lo decide `verification-status.ts` y no este componente: **el rojo
 * es sólo del fraude**. Aquí se pide el tono y se pinta. El tono nunca va
 * solo — cada desenlace lleva además **una forma distinta** (aspa, admiración,
 * reloj, visto), porque uno de cada doce hombres no distingue el rojo del
 * verde y porque en una demo se ve el dibujo antes que el texto.
 */

/** Cómo se avisó al titular. */
type Channel = 'qr' | 'phone';

/**
 * El dibujo de dentro del círculo, por desenlace.
 *
 * Son cuatro y no dos a propósito: `failed` y `expired` comparten el ámbar
 * —los dos se reintentan— pero no son lo mismo para quien está al teléfono, y
 * el reloj de uno y la admiración del otro lo dicen sin leer.
 */
type MarkShape = 'check' | 'cross' | 'bang' | 'clock';

const MARK: Record<Exclude<VerificationStatus, 'pending'>, MarkShape> = {
  verified: 'check',
  rejected: 'cross',
  failed: 'bang',
  expired: 'clock',
};

/**
 * Lo que el AGENTE tiene que hacer mientras se espera, **según por dónde se
 * avisó**.
 *
 * Cambia porque lo que hay que hacer a continuación es distinto: por teléfono
 * hay que pedirle a la persona que mire el móvil; en la sucursal, que apunte
 * con la cámara a esta pantalla.
 */
const PENDING_TEXT: Record<Channel, string> = {
  phone: 'Le hemos avisado a su móvil. Pídale que abra la app y confirme.',
  qr: 'Enséñele el código. Tiene que escanearlo con su cartera y confirmar ahí.',
};

interface StageCopy {
  /** El resultado en cuatro palabras. Se lee de reojo, hablando por teléfono. */
  readonly title: string;
  /** Qué hacer ahora. Se lee después. */
  readonly body: ReactNode;
  /** Una salvedad sobre el mundo, cuando la hay. Nunca sobre nuestro código. */
  readonly caveat?: ReactNode;
}

/**
 * Las palabras de cada desenlace.
 *
 * Están aquí y no en `verification-status.ts` porque aquél es el **vocabulario**
 * —dos palabras y una frase, las mismas en la tabla, en la ficha y en la
 * insignia— y esto es lo que hay que **hacer** en esta pantalla concreta, que
 * es distinto en cada una y sólo tiene sentido con un cliente al teléfono.
 * Lo que sí sale de allí, y no se repite aquí, es el color.
 */
function stageCopy(status: VerificationStatus, overdue: boolean, channel: Channel): StageCopy {
  if (status === 'pending') {
    return overdue
      ? {
          title: 'Sin respuesta',
          body: 'El plazo se agotó y nadie contestó. Puede volver a intentarlo desde aquí.',
        }
      : { title: 'Esperando al titular', body: PENDING_TEXT[channel] };
  }

  if (status === 'verified') {
    return {
      title: 'Es quien dice ser',
      body: 'Ha presentado su credencial y la verificación ha salido bien. Puede continuar con la operación.',
    };
  }

  if (status === 'rejected') {
    return {
      title: 'El titular dice que no ha sido él',
      body: (
        <>
          Ha <strong>rechazado la petición desde su cartera</strong>. No continúe con la operación y
          curse el aviso de fraude: si usted está hablando con alguien y el titular dice que no, hay
          dos personas distintas.
        </>
      ),
    };
  }

  if (status === 'failed') {
    return {
      title: 'La credencial no ha valido',
      body: 'No es un «no soy yo»: es la credencial fallando —caducada, revocada o de otro titular—. Se puede volver a intentar.',
    };
  }

  return {
    title: 'Caducó sin respuesta',
    body: 'Nadie contestó dentro del plazo. Puede volver a intentarlo desde aquí.',
    /*
      T9 (`docs/TAREAS.md` §3.2): hoy una denuncia del titular —«no estoy en
      ninguna llamada»— llega a te-api y muere ahí sin tocar la sesión de
      presentación, así que acaba aquí, con el ámbar de caducidad, y no en el
      rojo. La pantalla no lo puede distinguir y por eso no afirma que el
      titular no mirara el móvil. Cuando el puente exista, `rejected` llegará
      solo y pintará rojo sin tocar este componente.
    */
    caveat: (
      <>
        Una denuncia del titular —«no estoy en ninguna llamada»— se ve hoy exactamente igual que un
        plazo agotado. Si sospecha, pregúntele.
      </>
    ),
  };
}

export function VerificationStage({
  status,
  overdue,
  channel,
  requestedAt,
  expiresAt,
  now,
  holderName,
  externalId,
  signedAt,
  settledAt,
  justSettled,
  lastPolledAt,
  pollTick,
  onRetry,
  retrying,
  retryError,
  configureHref,
}: {
  status: VerificationStatus;
  /** Pendiente **y** con el plazo vencido. Ver `describeVerification`. */
  overdue: boolean;
  channel: Channel;
  /** Cuándo abrió te-api la sesión. Con `expiresAt`, es el largo del anillo. */
  requestedAt: string;
  expiresAt: string;
  /** El reloj de la pantalla, que late una vez por segundo y no toca la red. */
  now: number;
  /** El nombre del padrón, o `null` si la ficha ya no está. */
  holderName: string | null;
  /** **El número de cliente.** Lo que el agente tiene que poder cantar. */
  externalId: string;
  /** Cuándo firmó el titular, según su propio teléfono. Puede no venir. */
  signedAt: string | null | undefined;
  /** Cuándo se enteró esta consola. No es lo mismo, y el rótulo lo dice. */
  settledAt: string | null;
  /**
   * Si el desenlace ha ocurrido **con esta pantalla delante**.
   *
   * Sólo entonces se representa el cambio. Abrir mañana el recibo de ayer
   * enseña el mismo resultado quieto: animar un desenlace que pasó hace
   * catorce horas sería contar un suceso que no está ocurriendo.
   */
  justSettled: boolean;
  /** Cuándo contestó la última consulta. `null` mientras no haya contestado ninguna. */
  lastPolledAt: number | null;
  /** Sube uno por consulta contestada. Es lo que hace latir el punto. */
  pollTick: number;
  /** Lanza otra petición igual. No se ofrece en `rejected`: ver abajo. */
  onRetry: () => void;
  retrying: boolean;
  retryError: string | undefined;
  /** La pantalla de lanzar, para cuando hay que pedir **otra cosa**. */
  configureHref: string;
}) {
  const { tone } = describeVerification(status, expiresAt, now);
  const { title, body, caveat } = stageCopy(status, overdue, channel);
  const waiting = status === 'pending' && !overdue;

  /*
    EL REINTENTO NO SE OFRECE EN EL RECHAZO, Y ESO ES LA MITAD DE LA REGLA.

    `failed`, `expired` y un plazo agotado son «ha ido mal»: la salida es volver
    a intentarlo, y hasta ahora no había ninguna desde esta pantalla. `rejected`
    es la persona diciendo que no ha sido ella —un aviso de fraude— y ahí un
    botón grande de «volver a intentarlo» enseñaría al agente a insistirle al
    móvil de alguien que acaba de denunciar que le están suplantando. Es
    exactamente el reflejo que estas dos ceremonias existen para no crear.

    Es la misma distinción que el color: si el rojo sólo es del fraude, el
    botón de reintentar tampoco puede estar en el rojo.
  */
  const retryable = status === 'failed' || status === 'expired' || (status === 'pending' && overdue);

  return (
    <section
      /*
        `justSettled` es lo que dispara la representación del cambio, y sólo
        se pone una vez: la clase entra, la animación corre y se queda. Los
        repintados del reloj no la vuelven a lanzar.
      */
      className={`stage ${tone}${justSettled ? ' settling' : ''}`}
    >
      <div className="stage-top">
        <div className="stage-figure">
          {waiting ? (
            <CountdownRing requestedAt={requestedAt} expiresAt={expiresAt} now={now} />
          ) : (
            <OutcomeMark shape={status === 'pending' ? 'clock' : MARK[status]} />
          )}
        </div>

        <div className="stage-copy">
          {/*
            El titular y la instrucción, y **sólo** eso, dentro de la región
            que se anuncia: el desenlace tiene que llegar también a quien no
            mira la pantalla. La cuenta atrás se queda fuera a propósito —
            dentro haría que un lector de pantalla cantara los segundos.
          */}
          <div role="status">
            <h2>{title}</h2>
            <p className="stage-body">{body}</p>
          </div>

          {waiting && (
            <p className="stage-live">
              {/*
                El punto late **por cada consulta contestada**, no por un
                temporizador: `pollTick` lo remonta y la animación vuelve a
                correr. Si la red se cae, deja de latir y el «hace…» crece —
                que es justo lo que hay que ver.
              */}
              <span key={pollTick} className="stage-live-dot" aria-hidden="true" />
              Comprobando si ha contestado
              {lastPolledAt !== null && (
                <>
                  {' · '}
                  <span className="mono">{formatSince(lastPolledAt, now)}</span>
                </>
              )}
            </p>
          )}

          {caveat !== undefined && <p className="stage-caveat">{caveat}</p>}
        </div>
      </div>

      {/*
        LA IDENTIDAD, FIJA Y EN LOS CINCO DESENLACES.

        No cambia de sitio cuando cambia el estado: es el ancla. Quien está al
        teléfono mira arriba para saber cómo ha ido y aquí para saber de quién
        está hablando, y esas dos preguntas no pueden compartir línea.

        El número de cliente va en monoespaciada, grande y con aire entre los
        caracteres porque **se canta en voz alta**: es el dato que el agente le
        repite al cliente para que los dos sepan que hablan de la misma ficha.
      */}
      <dl className="stage-who">
        <div>
          <dt>Titular</dt>
          <dd>{holderName ?? <span className="none">la ficha ya no está en el padrón</span>}</dd>
        </div>
        <div>
          <dt>Número de cliente</dt>
          <dd className="mono stage-id">{externalId}</dd>
        </div>
        {/*
          Las dos horas del desenlace, y son dos porque no son la misma. La del
          titular la pone su teléfono al firmar; la de esta consola es cuándo se
          enteró. Entre ellas hay hasta un intervalo de consulta, y hasta que
          te-api devolvió la primera el banco sólo podía archivar la segunda.
        */}
        {signedAt != null && signedAt !== '' && (
          <div>
            <dt>Firmó a las</dt>
            <dd className="mono">{formatClock(signedAt)}</dd>
          </div>
        )}
        {status !== 'pending' && settledAt !== null && (
          <div>
            <dt>Lo supimos a las</dt>
            <dd className="mono">{formatClock(settledAt)}</dd>
          </div>
        )}
      </dl>

      {retryable && (
        <div className="stage-actions">
          <button type="button" onClick={onRetry} disabled={retrying}>
            {retrying ? 'Lanzando otra…' : 'Volver a intentarlo'}
          </button>
          {/*
            La otra salida: lanzar la misma petición es un botón, pero cambiar
            lo que se pide —otro tipo, otros atributos, el otro canal— es la
            pantalla de lanzar, y se llega con un enlace y no rehaciendo el
            camino desde el listado de clientes.
          */}
          <Link className="button-link secondary" href={configureHref}>
            Pedir otra cosa
          </Link>
        </div>
      )}

      {retryError !== undefined && (
        <p className="alert stage-retry-error">{retryError}</p>
      )}
    </section>
  );
}

/**
 * El reloj del plazo: un anillo que **se vacía**.
 *
 * El largo no es una constante nuestra: es `expiresAt − requestedAt`, o sea el
 * plazo que puso te-api medido con la hora en la que su respuesta llegó a este
 * servidor. Si mañana el plazo cambia allí, el anillo cambia aquí solo.
 *
 * Se vacía y no se llena porque lo que representa es **el tiempo que queda**.
 * Un anillo llenándose se lee como progreso hacia el sí, y de eso esta pantalla
 * no sabe nada: mientras el titular no conteste, no ha avanzado nada más que el
 * reloj.
 */
function CountdownRing({
  requestedAt,
  expiresAt,
  now,
}: {
  requestedAt: string;
  expiresAt: string;
  now: number;
}) {
  const deadline = new Date(expiresAt).getTime();
  const opened = new Date(requestedAt).getTime();
  const total = deadline - opened;
  const remaining = deadline - now;

  // Un plazo ilegible —fechas rotas, o un `expiresAt` anterior a la creación—
  // deja el anillo entero en vez de dibujar una fracción inventada. La cuenta
  // atrás de dentro sigue diciendo la verdad por su cuenta.
  const fraction =
    Number.isNaN(total) || total <= 0 ? 1 : Math.min(1, Math.max(0, remaining / total));

  return (
    <>
      <svg className="stage-ring" viewBox="0 0 96 96" aria-hidden="true">
        <circle className="stage-ring-track" cx="48" cy="48" r="41" pathLength={1} />
        <circle
          className="stage-ring-live"
          cx="48"
          cy="48"
          r="41"
          pathLength={1}
          // `pathLength=1` normaliza la circunferencia: la fracción se escribe
          // tal cual y no hace falta calcular 2πr ni recalcularla si cambia el
          // radio en la hoja de estilos.
          style={{ strokeDasharray: 1, strokeDashoffset: 1 - fraction }}
        />
      </svg>
      <span className="stage-ring-clock" aria-hidden="true">
        {formatCountdown(expiresAt, now)}
      </span>
      <span className="visually-hidden">
        La solicitud caduca en {formatCountdown(expiresAt, now)}.
      </span>
    </>
  );
}

/**
 * El sello del desenlace: un círculo que se cierra y un dibujo que se traza.
 *
 * Se dibuja con `pathLength=1` y `stroke-dashoffset`, así que la animación es
 * la misma para las cuatro formas aunque midan distinto. Con
 * `prefers-reduced-motion` los trazos salen **enteros y de golpe**: el mismo
 * dibujo, sin recorrido.
 */
function OutcomeMark({ shape }: { shape: MarkShape }) {
  return (
    <svg className="stage-mark" viewBox="0 0 96 96" aria-hidden="true">
      <circle className="stage-mark-ring" cx="48" cy="48" r="41" pathLength={1} />
      {shape === 'check' && <path className="stage-mark-glyph" d="M31 49 L43 61 L65 36" pathLength={1} />}
      {shape === 'cross' && (
        <>
          <path className="stage-mark-glyph" d="M35 35 L61 61" pathLength={1} />
          <path className="stage-mark-glyph delayed" d="M61 35 L35 61" pathLength={1} />
        </>
      )}
      {shape === 'bang' && (
        <>
          <path className="stage-mark-glyph" d="M48 28 L48 53" pathLength={1} />
          <circle className="stage-mark-dot" cx="48" cy="65" r="3.4" />
        </>
      )}
      {shape === 'clock' && (
        <>
          <path className="stage-mark-glyph" d="M48 26 L48 49" pathLength={1} />
          <path className="stage-mark-glyph delayed" d="M48 49 L64 57" pathLength={1} />
        </>
      )}
    </svg>
  );
}
