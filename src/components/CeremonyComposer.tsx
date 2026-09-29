'use client';

import Link from 'next/link';
import { Fragment, useEffect, useMemo, useState } from 'react';

import { useTranslator } from '@/i18n/client';
import { formatTimestamp } from '@/lib/format';
import type { CeremonyCase } from '@/lib/ceremony-catalogue';
import {
  describeAnsweredCeremony,
  describeRequestOutcome,
  readAnsweredEvent,
  type AnsweredRequest,
} from '@/lib/request-answered';
import { describeVerification } from '@/lib/verification-status';
import {
  buildCeremonyHttpRequest,
  formatCeremonyHttpRequest,
  PENDING_ASKER_REFERENCE,
  PENDING_REQUEST_URI,
  type CeremonyHttpRequest,
} from '@/lib/ceremony-request';
import {
  CEREMONY_FIELD_KEY_SHAPE,
  CEREMONY_LIMITS,
  checkCeremonyDraft,
  findCeremonyTemplate,
  MAX_CEREMONY_FIELDS,
  renderCeremonyStatement,
  roleOfKey,
  type CeremonyDraftField,
  type CeremonyFieldRole,
} from '@/lib/ceremony-templates';

import type {
  CeremonyEventsResult,
  CeremonyOutcomeResult,
  SendCeremonyResult,
} from '@/app/(console)/customers/[externalId]/ceremonies/actions';

import { CopyButton } from './CopyValue';

/**
 * **El compositor de una ceremonia.** Del caso de ejemplo a la petición mandada,
 * sin salir de la pantalla.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  LO QUE ESTA FICHA TIENE QUE PODER CONTESTAR, EN ORDEN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Quien mira esto está decidiendo si el marco de peticiones le sirve. Así que la
 * ficha contesta, en el orden en que se pregunta:
 *
 *  1. **¿Qué va a leer esa persona?** — el ensayo de su pantalla, con el héroe,
 *     los pares, **la frase que firma** y los dos verbos.
 *  2. **¿Puedo poner mis datos?** — el editor. Los valores del catálogo son el
 *     punto de partida y son buenos; se cambian y todo lo demás cambia con ellos.
 *  3. **¿Qué sale exactamente por el cable?** — la petición HTTP entera, tal
 *     cual, compuesta **del mismo objeto que se manda** (`lib/ceremony-request.ts`).
 *  4. **¿Qué puedo y qué no puedo tocar?** — el contrato: la plantilla, su
 *     revisión, qué claves exige, con qué se firma, y las dos listas de lo que
 *     una organización decide y lo que decide te-api.
 *  5. **¿Se cierra el viaje?** — lo mandado y lo recibido, uno debajo del otro.
 *
 * En cuatro pestañas y no en una columna de dos metros: la ficha va al lado de
 * una lista de casos y quien la enseña salta de uno a otro. Lo que no cabe en
 * una pestaña es que se pierda el botón de mandar, así que ése y el resultado
 * viven **fuera** de las pestañas, siempre a la vista.
 *
 * Y de ahí una regla que se aprendió enseñándolo: **mandar no cambia de
 * pestaña**. Como el resultado no vive en ninguna, moverla al pulsar no lleva a
 * ninguna parte —sólo aparta de la vista lo que se estaba enseñando— y saltar
 * al bloque de código convierte un «ahora le suena el teléfono» en un muro de
 * JSON. Ver `ask`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  EL BORRADOR ES ESTADO LOCAL, Y NO SE GUARDA EN NINGÚN SITIO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * No hay tabla de borradores y no debe haberla: esto es una demostración de la
 * forma de la ceremonia, no un redactor de documentos. Cambiar de caso desmonta
 * la ficha (`key` en el padre) y con ella el borrador, que es exactamente lo que
 * se quiere — un contrato mercantil compuesto a medias no puede acabar dentro de
 * un cambio de SIM.
 *
 * ## Y lo que el navegador manda son los campos, nunca la ceremonia
 *
 * De aquí sale **una lista de campos**. La plantilla, el `kind`, con qué se
 * firma y a quién se le pregunta los pone la acción de servidor desde el
 * catálogo, y eso no es una comodidad: es la frontera que impide que esta
 * pantalla elija qué se comprueba. Está escrita en `ceremonies/actions.ts`.
 */

/** Los dos colores de la organización y su monograma. Ver `lib/brand.ts`. */
export interface CeremonyBrand {
  readonly accent: string;
  readonly surface: string;
  readonly monogram: string;
}

/**
 * Un evento archivado, tal y como lo devuelve la acción.
 *
 * Se declara aquí en vez de importarse de `lib/webhook-events.ts` por lo mismo
 * que `PresentationProof` en `VerificationTracker`: aquel módulo es `server-only`
 * y no debe entrar en el paquete del navegador ni como tipo. Es la misma forma;
 * si allí cambia, el compilador lo dice al pasar la fila.
 */
interface WebhookEventView {
  readonly eventId: string;
  readonly type: string;
  readonly receivedAt: string;
  readonly occurredAt: string | null;
  readonly presentationId: string | null;
  readonly status: string | null;
  readonly signatureOk: boolean;
  readonly signatureError: string | null;
  readonly payload: unknown;
}

/**
 * Lo que se pinta en el sitio del tipo de credencial cuando el padrón no llegó.
 *
 * Es el gemelo de `PENDING_REQUEST_URI` y por la misma razón: el tipo lo elige
 * el padrón de **esta organización** en te-api, no el caso, y si esta consola no
 * pudo preguntarlo lo honesto es decirlo en el hueco en vez de inventarse uno
 * que existiría en otra instalación.
 */
const PENDING_CREDENTIAL_TYPE = "<the first type on this organisation's roster at te-api>";

/**
 * Cada cuánto se vuelve a leer el desenlace mientras la ceremonia siga viva.
 *
 * Los mismos tres segundos que `VerificationTracker`, y por la misma razón: la
 * pregunta **no sale de este servidor**. Lee la fila de `verification` de la
 * base de esta maqueta, la que el receptor de webhooks cerró; no toca te-api, no
 * gasta el cubo de tasa de la organización y no cruza ninguna frontera.
 *
 * Aquí no había ninguno: el compositor sólo miraba cuando alguien pulsaba. Y en
 * una demostración eso significa que el titular firma, el evento aterriza, y el
 * panel sigue en blanco hasta que a alguien se le ocurre pulsar — que es
 * exactamente lo que el dueño vio y llamó «nunca recibe el evento».
 */
const OUTCOME_INTERVAL_MS = 3000;

/**
 * Cuánto se sigue preguntando pasado el plazo de te-api.
 *
 * te-api liquida en cuanto vence la hora y manda el evento, así que un margen
 * corto basta para recoger lo que el webhook acabe de escribir. Sin tope, una
 * pestaña olvidada en un puesto seguiría preguntando por algo que ya no cambia.
 */
const OUTCOME_GRACE_MS = 20_000;

const PANE_LABEL = {
  preview: 'ceremonies.panePreview',
  fields: 'ceremonies.paneFields',
  wire: 'ceremonies.paneWire',
  contract: 'ceremonies.paneContract',
} as const;

/** Las cuatro pestañas. El orden es el de las cinco preguntas de la cabecera. */
type Pane = 'preview' | 'fields' | 'wire' | 'contract';

export function CeremonyComposer({
  ceremony,
  externalId,
  askerName,
  verifierUrl,
  credentialType,
  brand,
  send,
  readOutcome,
  readEvents,
}: {
  ceremony: CeremonyCase;
  externalId: string;
  askerName: string;
  verifierUrl: string;
  credentialType: string | undefined;
  brand: CeremonyBrand | undefined;
  send: (
    externalId: string,
    caseId: string,
    fields?: readonly CeremonyDraftField[],
  ) => Promise<SendCeremonyResult>;
  readOutcome: (presentationId: string) => Promise<CeremonyOutcomeResult>;
  readEvents: (since: string) => Promise<CeremonyEventsResult>;
}) {
  const t = useTranslator();
  const template = findCeremonyTemplate(ceremony.template);

  // El borrador arranca **en los valores del catálogo**, copiados: son los
  // buenos y son los que se mandan si nadie toca nada.
  const [fields, setFields] = useState<readonly CeremonyDraftField[]>(() =>
    ceremony.fields.map((field) => ({ ...field })),
  );
  const [pane, setPane] = useState<Pane>('preview');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SendCeremonyResult | null>(null);
  // Lo de la vuelta —el desenlace y los eventos— vive dentro de `Received`, que
  // sólo existe cuando hay una petición mandada. Vivía aquí, y eso obligaba a
  // acordarse de vaciarlo a mano en cada camino que empezaba otra ceremonia: el
  // día que se olvidara uno, el panel enseñaría el desenlace de la anterior al
  // lado de la petición nueva. Ahora se desmonta con la petición y no hay nada
  // que acordarse de borrar.

  const check = checkCeremonyDraft({
    template: ceremony.template,
    kind: ceremony.kind,
    signWith: ceremony.signWith,
    fields,
  });

  /*
   * **La petición, compuesta con el mismo constructor que la manda.**
   *
   * No hay aquí ni un literal con forma de cuerpo: `buildCeremonyHttpRequest`
   * es el único sitio del repositorio donde se decide qué claves lleva
   * `POST /v1/requests`, y `lib/te-api.ts` llama a ese mismo constructor para
   * mandarlo. Por eso el bloque de abajo no puede describir una petición que ya
   * no existe — que es el fallo silencioso de toda pantalla que documenta.
   *
   * Los huecos que no se pueden saber antes de mandar van con su marcador: el
   * `requestUri` sale de la sesión del verificador, que se abre un instante
   * antes, y por eso sólo aparece en la mitad de credencial; y el `reference` lo
   * acuña el servidor al mandar —uno por envío, ver `PENDING_ASKER_REFERENCE`—,
   * así que aparece en las catorce.
   *
   * El marcador del expediente además **enseña algo**: la clave está en el
   * cuerpo, con su nombre, y lo que dice el hueco es que ese número lo pone
   * quien pregunta. Es la mitad de la lección; la otra es ver, después de
   * mandar, el expediente propio al lado del `requestId` de te-api.
   */
  const planned = useMemo<CeremonyHttpRequest>(
    () =>
      buildCeremonyHttpRequest(verifierUrl, {
        subjectReference: externalId,
        kind: ceremony.kind,
        signWith: ceremony.signWith,
        ...(ceremony.signWith === 'credential'
          ? {
              credentialType: credentialType ?? PENDING_CREDENTIAL_TYPE,
              requestUri: PENDING_REQUEST_URI,
            }
          : {}),
        reference: PENDING_ASKER_REFERENCE,
        template: ceremony.template,
        fields,
      }),
    [verifierUrl, externalId, ceremony, credentialType, fields],
  );

  // Después de mandar se enseña **lo que devolvió el servidor**, que ya lleva
  // los dos huecos rellenos. Antes, lo que se va a mandar.
  const wire = result?.sent ?? planned;

  const statement = renderCeremonyStatement({
    template: ceremony.template,
    askerName,
    fields,
  });

  const hero = fields.find((field) => field.style === 'hero');
  const pairs = fields.filter((field) => field.style !== 'hero');

  const editField = (index: number, patch: Partial<CeremonyDraftField>) => {
    setFields((current) =>
      current.map((field, at) => (at === index ? { ...field, ...patch } : field)),
    );
  };

  const removeField = (index: number) => {
    setFields((current) => current.filter((_, at) => at !== index));
  };

  const addField = (field: CeremonyDraftField) => {
    setFields((current) => [...current, field]);
  };

  const ask = async () => {
    setBusy(true);
    setResult(null);
    try {
      const sent = await send(externalId, ceremony.id, fields);
      setResult(sent);
      // **La pestaña no se toca al mandar, y ésa es la corrección.**
      //
      // Aquí se saltaba a `wire` con el argumento de que «lo que se enseña ahora
      // es lo que salió». El argumento era falso por dos motivos, y los dos se
      // vieron en cuanto alguien enseñó esto en directo:
      //
      //  1. **El resultado no está en ninguna pestaña.** El intercambio —lo
      //     mandado y lo recibido— vive FUERA de ellas, debajo, y aparece solo en
      //     cuanto hay `requestId`. Saltar a `wire` no llevaba al resultado:
      //     llevaba a otro sitio y encima empujaba el resultado más abajo.
      //  2. **El JSON es una ayuda para quien integra, no el desenlace.** Quien
      //     está enseñando la ceremonia estaba mirando la vista previa —lo que va
      //     a leer el titular— y decía «ahora le suena el teléfono»; el clic le
      //     contestaba con un muro de cabeceras y llaves. La pantalla que hay que
      //     mirar después de mandar es la misma que antes, con el intercambio
      //     debajo.
      //
      // Quien quiera el cuerpo que de verdad salió sigue teniéndolo a un clic, y
      // sigue siendo el del servidor: `wire` usa `result.sent` en cuanto existe.
    } catch {
      setResult({ error: t('errors.generic') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel ceremony-detail">
      <h2>
        {ceremony.title}
        <span className="panel-mark mono">{ceremony.template}</span>
      </h2>

      <p className="ceremony-written">
        {t('ceremonies.writtenFor', { organization: ceremony.writtenFor })} ·{' '}
        <span className="mono">{ceremony.kind}</span> ·{' '}
        <span className="mono">{ceremony.signWith}</span>
      </p>

      <nav className="ceremony-panes" aria-label={t('ceremonies.panesLabel')}>
        {(['preview', 'fields', 'wire', 'contract'] as const).map((entry) => (
          <button
            key={entry}
            type="button"
            className={entry === pane ? 'ceremony-pane on' : 'ceremony-pane'}
            aria-current={entry === pane ? 'true' : undefined}
            onClick={() => setPane(entry)}
          >
            {t(PANE_LABEL[entry])}
          </button>
        ))}
      </nav>

      {pane === 'preview' && (
        <>
          <h3 className="ceremony-heading">{t('ceremonies.previewTitle')}</h3>

          <div className="ceremony-screen">
            {hero === undefined ? (
              <p className="ceremony-nohero">{t('ceremonies.noHero')}</p>
            ) : (
              <div className="ceremony-hero">
                <span>{hero.label}</span>
                <strong className={hero.type === 'mono' ? 'mono' : undefined}>{hero.value}</strong>
                {/* La segunda línea cuelga del valor, sin rótulo: es parte del
                    mismo dato y se firma con él. */}
                {hero.sub !== undefined && hero.sub !== '' && (
                  <span className="ceremony-sub">{hero.sub}</span>
                )}
              </div>
            )}

            <dl className="ceremony-pairs">
              {pairs.map((field) => (
                <Fragment key={field.key}>
                  <dt className={field.style === 'quiet' ? 'quiet' : undefined}>{field.label}</dt>
                  <dd
                    className={[
                      field.type === 'mono' ? 'mono' : '',
                      field.style === 'quiet' ? 'quiet' : '',
                    ]
                      .filter((entry) => entry !== '')
                      .join(' ')}
                  >
                    {field.value}
                    {field.sub !== undefined && field.sub !== '' && (
                      <span className="ceremony-sub">{field.sub}</span>
                    )}
                  </dd>
                </Fragment>
              ))}
            </dl>

            {/*
              **La frase que se firma**, dentro del ensayo de la pantalla y no
              en una nota al pie: en el teléfono va ahí, y es lo único de esa
              pantalla que no escribe quien pregunta. Verla aquí es lo que
              permite decir en voz alta qué se está firmando.
            */}
            <div className="ceremony-statement">
              <span className="ceremony-statement-head">{t('ceremonies.statementTitle')}</span>
              {statement.ok ? (
                <p>{statement.statement}</p>
              ) : (
                <p className="warn mono">{statement.reason}</p>
              )}
            </div>

            {/*
              Los dos verbos, y cuál manda. `account.change.v1` es la única en la
              que negar pesa más que aprobar, y es su razón de ser: es el cambio
              que abre todas las demás cuentas. Enseñarlo aquí al revés que en
              las otras es lo que hace que el agente lo cuente bien.
            */}
            <div className={ceremony.denyLeads ? 'ceremony-verbs deny-first' : 'ceremony-verbs'}>
              <span className="ceremony-verb">{ceremony.verb}</span>
              <span className="ceremony-deny">{ceremony.deny}</span>
            </div>
          </div>

          <p className="ceremony-statement-note">{t('ceremonies.statementNote')}</p>

          {template !== undefined && template.askerMustShow !== null && (
            <p className="ceremony-mustshow">
              <strong>{t('ceremonies.askerMustShowTitle')}</strong> {template.askerMustShow}
            </p>
          )}

          <p className="ceremony-problem">{ceremony.problem}</p>

          {ceremony.flag !== undefined && (
            <p className="ceremony-flag">
              <strong>{t('ceremonies.flagTitle')}</strong> {ceremony.flag}
            </p>
          )}
        </>
      )}

      {pane === 'fields' && (
        <>
          <h3 className="ceremony-heading">{t('ceremonies.fieldsTitle')}</h3>
          <p className="ceremony-hint">{t('ceremonies.fieldsNote')}</p>

          <div className="ceremony-fields">
            {fields.map((field, index) => (
              <FieldEditor
                key={field.key}
                field={field}
                role={roleOfKey(template, field.key)}
                heroKey={template?.hero ?? null}
                onChange={(patch) => editField(index, patch)}
                onRemove={() => removeField(index)}
              />
            ))}
          </div>

          <AddPair
            taken={fields.map((field) => field.key)}
            full={fields.length >= MAX_CEREMONY_FIELDS}
            onAdd={addField}
          />

          <div className="ceremony-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => setFields(ceremony.fields.map((field) => ({ ...field })))}
            >
              {t('ceremonies.reset')}
            </button>
          </div>
        </>
      )}

      {pane === 'wire' && (
        <>
          <h3 className="ceremony-heading">
            {t(result?.sent === undefined ? 'ceremonies.wireWillSend' : 'ceremonies.wireWasSent')}
          </h3>

          {/*
            La línea de la marca, arriba del bloque y no debajo: quien mira el
            cuerpo va a buscar el logotipo y el color, y tiene que encontrar
            **por qué no están** antes de concluir que faltan.
          */}
          <BrandNote brand={brand} />

          {ceremony.signWith === 'credential' && (
            <p className="ceremony-hint">{t('ceremonies.wireCredentialNote')}</p>
          )}

          <div className="ceremony-wire">
            <CopyButton value={formatCeremonyHttpRequest(wire)} />
            <pre>{formatCeremonyHttpRequest(wire)}</pre>
          </div>

          {result?.sent === undefined && ceremony.signWith === 'credential' && (
            <p className="ceremony-hint">{t('ceremonies.wirePlaceholders')}</p>
          )}
        </>
      )}

      {pane === 'contract' && (
        <Contract
          ceremony={ceremony}
          credentialType={credentialType}
          fields={fields}
          confirmedVersion={result?.templateVersion}
        />
      )}

      {/* ── Fuera de las pestañas: mandar, y lo que pasó ──────────────────── */}

      {!check.ok && (
        <p className="ceremony-refused">
          {t('ceremonies.draftRefused')} <span className="mono">{check.reason}</span>
        </p>
      )}

      {result?.error !== undefined && (
        <p className="alert">
          {result.error}
          {result.reason !== undefined && <span className="mono sub">{result.reason}</span>}
        </p>
      )}

      {result?.requestId === undefined ? (
        <button type="button" disabled={busy || !check.ok} onClick={() => void ask()}>
          {busy ? t('ceremonies.sending') : t('ceremonies.send')}
        </button>
      ) : (
        <Exchange
          result={result}
          onAgain={() => {
            // Volver a componer sin cambiar de caso. Antes había que saltar a
            // otro y volver, que en una demostración es perder el hilo: lo que
            // se enseña aquí es justamente que los mismos valores se pueden
            // cambiar y mandar otra vez.
            //
            // Aquí se vaciaban además los eventos y su aviso; ya no hace falta,
            // porque quitar el resultado desmonta la mitad de la vuelta entera.
            setResult(null);
            setPane('fields');
          }}
          signsWithCredential={ceremony.signWith === 'credential'}
          readOutcome={readOutcome}
          readEvents={readEvents}
        />
      )}
    </div>
  );
}

/**
 * **La casilla de un campo.** Un rótulo, un valor, y lo que la plantilla permita.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  QUÉ SE PUEDE QUITAR Y QUÉ NO, QUE ES LA ÚNICA DECISIÓN DE ESTE COMPONENTE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Una clave obligatoria **no lleva botón de quitar**. No es una comodidad: sin
 * ella la petición sale con `missing_required_field` y, peor, la pantalla del
 * titular pierde justo el dato que la plantilla considera parte de la decisión
 * —la huella del documento, el «hasta cuándo» de un permiso—. El editor deja
 * cambiar lo que dice; no deja quitar lo que la ceremonia necesita para
 * significar algo.
 *
 * El héroe tampoco cambia de peso: sólo la clave que la plantilla corona puede
 * llevarlo, así que su desplegable no ofrece otra cosa. Al revés —una clave que
 * no es el héroe— el desplegable no ofrece `hero`, y no por cortesía: te-api
 * contesta `hero_not_allowed` y la pantalla saldría torcida.
 *
 * ## Y por qué el valor a veces es un `textarea`
 *
 * Porque hay valores que son frases: la consecuencia de un cambio de SIM son dos
 * líneas de lenguaje llano, y una declaración responsable es una frase entera.
 * Meterlas en una caja de una línea las esconde por la derecha mientras se
 * escriben, que es cómo se cuelan las erratas en un texto que alguien va a
 * firmar.
 */
function FieldEditor({
  field,
  role,
  heroKey,
  onChange,
  onRemove,
}: {
  field: CeremonyDraftField;
  role: CeremonyFieldRole;
  heroKey: string | null;
  onChange: (patch: Partial<CeremonyDraftField>) => void;
  onRemove: () => void;
}) {
  const t = useTranslator();
  // Obligatoria = el héroe y las que la plantilla exige. Son las únicas que
  // pueden llevar segunda línea, que es la regla de te-api (`sub_not_allowed`).
  const required = role === 'hero' || role === 'required';
  const long = field.value.length > 80;

  return (
    <div className={`ceremony-field role-${role}`}>
      <div className="ceremony-field-head">
        <span className="mono ceremony-field-key">{field.key}</span>
        <span className={`pill ceremony-role ${role}`}>{t(ROLE_LABEL[role])}</span>
        {!required && (
          <button type="button" className="ceremony-field-drop" onClick={onRemove}>
            {t('ceremonies.remove')}
          </button>
        )}
      </div>

      <label className="ceremony-field-line">
        <span>{t('ceremonies.fieldLabel')}</span>
        <input
          value={field.label}
          maxLength={CEREMONY_LIMITS.label}
          onChange={(event) => onChange({ label: event.target.value })}
        />
      </label>

      <label className="ceremony-field-line">
        <span>{t('ceremonies.fieldValue')}</span>
        {long ? (
          <textarea
            value={field.value}
            rows={3}
            maxLength={CEREMONY_LIMITS.value}
            onChange={(event) => onChange({ value: event.target.value })}
          />
        ) : (
          <input
            value={field.value}
            maxLength={CEREMONY_LIMITS.value}
            className={field.type === 'mono' ? 'mono' : undefined}
            onChange={(event) => onChange({ value: event.target.value })}
          />
        )}
      </label>

      {required && (
        <label className="ceremony-field-line" title={t('ceremonies.fieldSubNote')}>
          <span>{t('ceremonies.fieldSub')}</span>
          <input
            value={field.sub ?? ''}
            maxLength={CEREMONY_LIMITS.sub}
            placeholder={t('ceremonies.fieldSubHint')}
            onChange={(event) => onChange({ sub: event.target.value })}
          />
        </label>
      )}

      <div className="ceremony-field-choices">
        <label>
          <span>{t('ceremonies.fieldReading')}</span>
          <select
            value={field.type}
            onChange={(event) =>
              onChange({ type: event.target.value as CeremonyDraftField['type'] })
            }
          >
            <option value="text">{t('ceremonies.readingText')}</option>
            <option value="mono">{t('ceremonies.readingMono')}</option>
            <option value="numeric">{t('ceremonies.readingNumeric')}</option>
          </select>
        </label>
        <label>
          <span>{t('ceremonies.fieldWeight')}</span>
          <select
            value={field.style}
            onChange={(event) =>
              onChange({ style: event.target.value as CeremonyDraftField['style'] })
            }
          >
            {/* `hero` sólo lo ofrece la clave que la plantilla corona. */}
            {field.key === heroKey && <option value="hero">{t('ceremonies.weightHero')}</option>}
            <option value="normal">{t('ceremonies.weightNormal')}</option>
            <option value="quiet">{t('ceremonies.weightQuiet')}</option>
          </select>
        </label>
      </div>
    </div>
  );
}

const ROLE_LABEL = {
  hero: 'ceremonies.roleHero',
  required: 'ceremonies.roleRequired',
  optional: 'ceremonies.roleOptional',
  generic: 'ceremonies.roleGeneric',
} as const;

/**
 * **Añadir un par.** Es la mitad que hace que el vocabulario abierto sirva.
 *
 * te-api acepta claves que la plantilla no declara: entran como pares genéricos
 * y es lo que permite que la misma pantalla de firma valga para un contrato
 * mercantil y para un consentimiento informado. Sin esta casilla, el compositor
 * dejaría cambiar los valores de otro y no meter los propios, que es media
 * demostración.
 *
 * Lo que un par genérico **no** puede es ser héroe ni entrar en la frase que se
 * firma, y eso no lo impide este formulario: lo impone te-api. Aquí sólo se
 * comprueba la forma de la clave —minúsculas, dígitos y guiones bajos— porque es
 * el único error que se puede corregir mientras se escribe.
 */
function AddPair({
  taken,
  full,
  onAdd,
}: {
  taken: readonly string[];
  full: boolean;
  onAdd: (field: CeremonyDraftField) => void;
}) {
  const t = useTranslator();
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');

  const keyOk = CEREMONY_FIELD_KEY_SHAPE.test(key);
  const free = !taken.includes(key);
  const ready = keyOk && free && label !== '' && value !== '' && !full;

  const add = () => {
    if (!ready) return;
    onAdd({ key, label, value, type: 'text', style: 'normal' });
    setKey('');
    setLabel('');
    setValue('');
  };

  return (
    <div className="ceremony-add">
      <h4>{t('ceremonies.addPair')}</h4>
      {full ? (
        <p className="ceremony-hint">{t('ceremonies.addFull', { max: MAX_CEREMONY_FIELDS })}</p>
      ) : (
        <div className="ceremony-add-line">
          <label>
            <span>{t('ceremonies.addKey')}</span>
            <input
              value={key}
              className="mono"
              maxLength={CEREMONY_LIMITS.key}
              placeholder="parties"
              onChange={(event) => setKey(event.target.value)}
            />
          </label>
          <label>
            <span>{t('ceremonies.fieldLabel')}</span>
            <input
              value={label}
              maxLength={CEREMONY_LIMITS.label}
              onChange={(event) => setLabel(event.target.value)}
            />
          </label>
          <label>
            <span>{t('ceremonies.fieldValue')}</span>
            <input
              value={value}
              maxLength={CEREMONY_LIMITS.value}
              onChange={(event) => setValue(event.target.value)}
            />
          </label>
          <button type="button" className="secondary" disabled={!ready} onClick={add}>
            {t('ceremonies.add')}
          </button>
        </div>
      )}
      {key !== '' && !keyOk && <p className="ceremony-refused">{t('ceremonies.addKeyBad')}</p>}
      {key !== '' && keyOk && !free && (
        <p className="ceremony-refused">{t('ceremonies.addKeyTaken')}</p>
      )}
    </div>
  );
}

/**
 * **La marca es de la organización, no de la petición.** Una decisión ya tomada,
 * enseñada donde alguien la iba a echar de menos.
 *
 * te-api **congela** el logotipo y los dos colores desde su padrón al crear la
 * fila —`asker_logo_url`, `asker_color`, `asker_dark_color` en
 * `src/requests/ask.ts`— y por eso el cuerpo de la petición no los lleva ni los
 * puede llevar. No es una limitación que haya que disculpar: es lo que impide
 * que quien pregunta aparezca en el teléfono de otra persona con un logotipo que
 * no es suyo, que es exactamente el ataque que esta pantalla existe para hacer
 * imposible.
 *
 * Así que aquí no hay ningún selector de color, y **no puede haberlo**: el sitio
 * donde se cambia la marca es la pantalla de ajustes, que escribe la
 * configuración de esta instalación. Lo que se pinta abajo es esa marca, para
 * que se vea de quién es y dónde se toca.
 *
 * ⚠ Y con una honestidad más: lo que la cartera pinta sale del padrón de te-api,
 * que se da de alta en tenant-admin. Estos dos colores son los que **esta
 * consola** tiene declarados para la misma organización. Decir que son
 * literalmente los mismos sería afirmar algo de una base que este proceso no
 * lee.
 */
function BrandNote({ brand }: { brand: CeremonyBrand | undefined }) {
  const t = useTranslator();

  return (
    <div className="ceremony-brand">
      <p>{t('ceremonies.brandNote')}</p>
      {brand === undefined ? (
        <p className="ceremony-hint">{t('ceremonies.brandNone')}</p>
      ) : (
        <div className="ceremony-brand-row">
          <span
            className="ceremony-brand-mark"
            // El color viene de la configuración de la organización y ya está
            // validado al guardarse (`normalizeBrandColor`). Va en `style`
            // porque es un dato, no una clase: no hay una hoja por empresa.
            style={{ background: brand.surface, color: '#fff' }}
          >
            {brand.monogram}
          </span>
          <span className="ceremony-brand-swatch" style={{ background: brand.accent }} />
          <span className="mono">{brand.accent}</span>
          <span className="ceremony-brand-swatch" style={{ background: brand.surface }} />
          <span className="mono">{brand.surface}</span>
          <Link href="/settings">{t('ceremonies.brandChange')}</Link>
        </div>
      )}
    </div>
  );
}

/**
 * **Qué usa y qué permite este caso.** La pestaña que lee quien va a integrar.
 *
 * Todo sale del espejo del catálogo de te-api (`lib/ceremony-templates.ts`) y no
 * de una lista escrita al lado: las claves obligatorias de una plantilla son un
 * dato del contrato, y escribirlas aquí a mano las separaría de las que se
 * comprueban tres líneas más arriba.
 *
 * Las dos listas de «puede» y «no puede» sí son texto, y van por i18n como el
 * resto de los rótulos de la consola: no son carga, no las lee el titular y no
 * viajan a ninguna parte.
 */
function Contract({
  ceremony,
  credentialType,
  fields,
  confirmedVersion,
}: {
  ceremony: CeremonyCase;
  credentialType: string | undefined;
  fields: readonly CeremonyDraftField[];
  confirmedVersion: number | undefined;
}) {
  const t = useTranslator();
  const template = findCeremonyTemplate(ceremony.template);
  const generic = fields
    .map((field) => field.key)
    .filter((key) => roleOfKey(template, key) === 'generic');

  return (
    <>
      <h3 className="ceremony-heading">{t('ceremonies.contractTitle')}</h3>

      {template === undefined ? (
        <p className="alert">{t('ceremonies.contractUnknown')}</p>
      ) : (
        <>
          {template.internal && <p className="alert">{t('ceremonies.contractInternal')}</p>}

          <dl className="facts">
            <dt>{t('ceremonies.contractTemplate')}</dt>
            <dd className="mono">{template.id}</dd>

            <dt>{t('ceremonies.contractVersion')}</dt>
            <dd>
              <span className="mono">{template.version}</span>
              {/*
                La revisión que contestó te-api, cuando ya se ha mandado algo. Es
                la comprobación que hace seguro tener una copia del catálogo: si
                difieren, la copia está vieja y se ve — que es todo lo que se le
                pide.
              */}
              {confirmedVersion !== undefined && (
                <span className={confirmedVersion === template.version ? 'sub' : 'warn sub'}>
                  {confirmedVersion === template.version
                    ? t('ceremonies.versionAgrees', { version: confirmedVersion })
                    : t('ceremonies.versionDiffers', {
                        actual: confirmedVersion,
                        expected: template.version,
                      })}
                </span>
              )}
            </dd>

            <dt>{t('ceremonies.contractKind')}</dt>
            <dd className="mono">{template.kinds.join(' · ')}</dd>

            <dt>{t('ceremonies.contractSignWith')}</dt>
            <dd>
              <span className="mono">{ceremony.signWith}</span>
              <span className="sub">
                {t('ceremonies.contractSignWithNote', { allowed: template.signWith.join(' · ') })}
              </span>
            </dd>

            {ceremony.signWith === 'credential' && (
              <>
                <dt>{t('ceremonies.contractCredential')}</dt>
                <dd>
                  <span className="mono">{credentialType ?? t('common.dash')}</span>
                  <span className="sub">
                    {t('ceremonies.contractClaims', {
                      claims: (ceremony.claims ?? []).join(', '),
                    })}
                  </span>
                </dd>
              </>
            )}

            <dt>{t('ceremonies.contractHero')}</dt>
            <dd className="mono">{template.hero ?? t('ceremonies.contractNoHero')}</dd>

            <dt>{t('ceremonies.contractRequired')}</dt>
            <dd className="mono">{template.required.join(' · ')}</dd>

            <dt>{t('ceremonies.contractOptional')}</dt>
            <dd className="mono">
              {template.optional.length === 0 ? t('common.dash') : template.optional.join(' · ')}
            </dd>

            <dt>{t('ceremonies.contractGeneric')}</dt>
            <dd className="mono">
              {generic.length === 0 ? t('common.dash') : generic.join(' · ')}
            </dd>
          </dl>

          {template.askerMustShow !== null && (
            <p className="ceremony-mustshow">
              <strong>{t('ceremonies.askerMustShowTitle')}</strong> {template.askerMustShow}
            </p>
          )}

          <div className="ceremony-allows">
            <div>
              <h4>{t('ceremonies.mayTitle')}</h4>
              <ul>
                <li>{t('ceremonies.may1')}</li>
                <li>{t('ceremonies.may2')}</li>
                <li>{t('ceremonies.may3')}</li>
                <li>{t('ceremonies.may4')}</li>
              </ul>
            </div>
            <div>
              <h4>{t('ceremonies.mayNotTitle')}</h4>
              <ul>
                <li>{t('ceremonies.mayNot1')}</li>
                <li>{t('ceremonies.mayNot2')}</li>
                <li>{t('ceremonies.mayNot3')}</li>
                <li>{t('ceremonies.mayNot4')}</li>
                <li>{t('ceremonies.mayNot5')}</li>
              </ul>
            </div>
          </div>
        </>
      )}
    </>
  );
}

/**
 * **Lo mandado y lo recibido**, uno debajo del otro. El viaje entero.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  LA MITAD DE ARRIBA ES UN HECHO. LA DE ABAJO TIENE UN HUECO, Y SE DICE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Lo mandado sale de la respuesta de te-api: el identificador de la petición, su
 * plazo, la revisión que clavó y el enlace del mostrador si el despliegue tiene
 * canal QR.
 *
 * Lo recibido lo pinta `Received`, que es donde está escrito el porqué de cada
 * una de sus dos lecturas. Aquí sólo se decide qué se le pasa, y la pieza que lo
 * decide todo es `result.presentationId`: existe cuando la ceremonia firmó con
 * credencial —hay sesión de verificador, hay fila y hay desenlace que leer— y no
 * existe cuando firmó con la identidad de la cartera.
 */
function Exchange({
  result,
  signsWithCredential,
  readOutcome,
  readEvents,
  onAgain,
}: {
  result: SendCeremonyResult;
  signsWithCredential: boolean;
  readOutcome: (presentationId: string) => Promise<CeremonyOutcomeResult>;
  readEvents: (since: string) => Promise<CeremonyEventsResult>;
  onAgain: () => void;
}) {
  const t = useTranslator();

  return (
    <div className="ceremony-exchange">
      <div className="ceremony-half">
        <h3 className="ceremony-heading">{t('ceremonies.sentTitle')}</h3>
        <p>{t('ceremonies.sent')}</p>
        <dl className="facts">
          {/*
            **Los dos identificadores, uno debajo del otro y rotulados por su
            dueño.** Es la lección entera de esta pareja: el de arriba lo emite
            te-api y nombra la ceremonia; el de abajo lo emite esta organización
            y nombra su caso. Quien integra tiene que salir de esta pantalla
            sabiendo cuál va a poder buscar en su propio sistema.
          */}
          <dt>{t('ceremonies.sentRequestId')}</dt>
          <dd className="mono">{result.requestId}</dd>
          <dt>{t('ceremonies.sentReference')}</dt>
          <dd className="mono">
            {result.askerReference ?? t('common.dash')}
            <span className="sub">{t('ceremonies.sentReferenceNote')}</span>
          </dd>
          <dt>{t('ceremonies.sentStatus')}</dt>
          <dd className="mono">{result.status ?? t('common.dash')}</dd>
          <dt>{t('ceremonies.sentTemplate')}</dt>
          <dd className="mono">
            {result.template ?? t('common.dash')}
            {result.templateVersion !== undefined && ` · v${result.templateVersion}`}
          </dd>
          <dt>{t('ceremonies.sentExpires')}</dt>
          {/*
            La hora escrita para leerla, y debajo el valor **tal y como lo
            contestó te-api**. Las dos, porque esta pantalla la miran dos
            personas: quien enseña la ceremonia lee la primera y quien va a
            integrar compara la segunda con su propio registro.
          */}
          <dd>
            {result.expiresAt === undefined ? (
              t('common.dash')
            ) : (
              <>
                {formatTimestamp(result.expiresAt, t.locale)}
                <span className="mono sub">{result.expiresAt}</span>
              </>
            )}
          </dd>
          {result.presentationId !== undefined && (
            <>
              <dt>{t('ceremonies.sentPresentation')}</dt>
              <dd className="mono">{result.presentationId}</dd>
            </>
          )}
          {typeof result.link === 'string' && (
            <>
              <dt>{t('ceremonies.sentLink')}</dt>
              <dd className="mono">{result.link}</dd>
            </>
          )}
        </dl>

        <div className="ceremony-actions">
          <button type="button" className="secondary" onClick={onAgain}>
            {t('ceremonies.sendAgain')}
          </button>
        </div>
      </div>

      {/*
        `key` por petición: mandar otra desmonta la vuelta entera —el desenlace
        que se estaba leyendo, los eventos y el temporizador— en vez de dejar
        colgado el de la anterior debajo de la nueva.
      */}
      <Received
        key={result.requestId}
        requestId={result.requestId}
        presentationId={result.presentationId}
        expiresAt={result.expiresAt}
        sentAt={result.sentAt}
        signsWithCredential={signsWithCredential}
        readOutcome={readOutcome}
        readEvents={readEvents}
      />
    </div>
  );
}

/**
 * **La vuelta.** Qué contestó el titular, y qué entró por el cable.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  SON DOS LECTURAS Y CONTESTAN DOS PREGUNTAS DISTINTAS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Aquí sólo había una —«enséñame los eventos que han entrado desde que pulsé»— y
 * era la equivocada para la pregunta que hace quien está enseñando esto. El
 * dueño lo dijo con estas palabras: *nunca recibe el evento cuando la cartera
 * firma, o por lo menos no lo muestra como pasa en la ficha del usuario*. Y la
 * ficha lo enseñaba porque lee **la fila de esa ceremonia**, no un barrido del
 * diario por hora.
 *
 *  1. **El desenlace** (`readOutcome`) — la fila de `verification`, la misma que
 *     cierra el receptor de webhooks y la misma que sondea `/verifications/<id>`.
 *     Es lo que contesta «¿dijo que sí?», y se relee sola mientras la ceremonia
 *     siga viva: el titular firma con el agente al teléfono, y nadie va a estar
 *     pulsando un botón para enterarse.
 *  2. **Los eventos** (`readEvents`) — el sobre firmado tal y como llegó, para
 *     quien está integrando y quiere ver el `presentation.settled` entero con su
 *     firma comprobada. Sigue detrás del botón: es evidencia, no veredicto.
 *
 * Ninguna de las dos llama a te-api. Las dos preguntan al servidor de esta
 * organización, que contesta de su propia base — la misma propiedad que un
 * empleado puede comprobar abriendo la pestaña de red y que ya defendía
 * `VerificationTracker`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  LA MITAD QUE NO SE PODÍA CONTESTAR YA SE CONTESTA, Y POR OTRA PUERTA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Aquí decía —y era verdad, y estaba comprobado en su código— que una ceremonia
 * que firma con la identidad de la cartera no tenía nada que enseñar: no abre
 * sesión de verificador, así que no hay `presentationId` ni fila que leer, y
 * te-api no publicaba **nada** sobre el desenlace de una petición del marco.
 *
 * Ya publica `request.answered`. Así que la lectura de la fila sigue sin existir
 * para esas ceremonias —y se sigue diciendo, porque es una fila que no hay— pero
 * la respuesta sí llega, y llega por el canal de abajo con el `requestId`
 * dentro. Las consecuencias, que son tres:
 *
 *  1. **El canal deja de ser sólo evidencia.** Para una ceremonia de identidad
 *     es la única respuesta que hay, así que se lee sola y no detrás de un
 *     botón: dejarla ahí era exactamente lo que el dueño vio —pulsas, no hay
 *     nada, y parece que no funciona—.
 *  2. **Y se puede parar.** Antes un temporizador aquí no habría sabido cuándo,
 *     porque ningún evento nombraba la petición. Ahora la respuesta a ésta se
 *     reconoce por su identificador y el ciclo se apaga en cuanto entra (o al
 *     vencer el plazo, con su margen).
 *  3. **El emparejamiento es de verdad y ya no es sólo por sesión.** Una fila se
 *     marca como «ésta es la respuesta» si su `requestId` es el de esta petición
 *     —lo que vale para las catorce plantillas— o si su `presentationId` es el de
 *     esta sesión, que es lo que ya hacía.
 *
 * El botón se queda. No sobra: relee a mano cuando el ciclo ya se ha parado, y
 * es lo que dice en voz alta que el fallo fue de la consulta y no del titular.
 */
function Received({
  requestId,
  presentationId,
  expiresAt,
  sentAt,
  signsWithCredential,
  readOutcome,
  readEvents,
}: {
  /** La petición del marco. Es lo que empareja `request.answered`. */
  requestId: string | undefined;
  /** La sesión del verificador. `undefined` = ceremonia de identidad. */
  presentationId: string | undefined;
  /** El plazo de te-api: separa «esperando» de «sin respuesta». */
  expiresAt: string | undefined;
  /** El corte de los eventos, sellado por el servidor al mandar. */
  sentAt: string | undefined;
  signsWithCredential: boolean;
  readOutcome: (presentationId: string) => Promise<CeremonyOutcomeResult>;
  readEvents: (since: string) => Promise<CeremonyEventsResult>;
}) {
  const t = useTranslator();

  const [outcome, setOutcome] = useState<CeremonyOutcomeResult | null>(null);
  const [events, setEvents] = useState<readonly WebhookEventView[] | null>(null);
  const [eventsBusy, setEventsBusy] = useState(false);
  const [eventsError, setEventsError] = useState<string | undefined>(undefined);

  const deadline = expiresAt === undefined ? Number.NaN : new Date(expiresAt).getTime();

  /*
   * **La respuesta a ESTA petición**, si ya ha entrado por el canal.
   *
   * Se busca entre lo que haya llegado desde el corte y se compara por
   * `requestId`, que es lo que el evento trae siempre. Lo demás que haya entrado
   * se sigue enseñando —es lo que llegó— pero sin decir que es la respuesta.
   */
  const answer = useMemo<AnsweredRequest | null>(() => {
    if (requestId === undefined || events === null) return null;
    for (const event of events) {
      const parsed = readAnsweredEvent(event.payload);
      if (parsed !== null && parsed.requestId === requestId) return parsed;
    }
    return null;
  }, [events, requestId]);

  /*
   * Booleano y no el objeto, por lo mismo que `settled` de aquí abajo: es lo que
   * entra en las dependencias del ciclo del canal, y con el objeto cada
   * respuesta remontaría el temporizador y volvería a preguntar de inmediato.
   */
  const arrived = answer !== null;

  /*
   * **Ya hay desenlace**, o sea que no hay nada más que preguntar.
   *
   * Es un booleano y no el objeto entero a propósito: es lo que entra en las
   * dependencias del efecto de abajo, y con el objeto cada respuesta volvería a
   * montar el ciclo, cancelaría el temporizador y preguntaría de inmediato. Eso
   * no es una consulta cada tres segundos: es un bucle tan rápido como conteste
   * la base. Ya pasó una vez en `VerificationTracker` y allí está contado.
   */
  const settled = outcome?.status !== undefined && outcome.status !== 'pending';

  useEffect(() => {
    // Una ceremonia de identidad no tiene fila. No hay ciclo que montar, y
    // montarlo para recibir `found: false` cada tres segundos sería preguntar
    // por algo que no puede llegar a existir.
    if (presentationId === undefined) return;
    if (settled) return;

    let stopped = false;
    // Declarado antes que `read` porque `read` lo apaga: sin esto, pasado el
    // tope de cortesía el intervalo seguiría disparando cada tres segundos sólo
    // para salir por la primera línea.
    let timer: ReturnType<typeof setInterval> | undefined;

    const stop = () => {
      stopped = true;
      if (timer !== undefined) clearInterval(timer);
    };

    const read = async () => {
      // Vencido el plazo y con su margen, el evento ya no va a llegar.
      if (!Number.isNaN(deadline) && Date.now() > deadline + OUTCOME_GRACE_MS) {
        stop();
        return;
      }
      try {
        const answer = await readOutcome(presentationId);
        if (stopped) return;
        setOutcome(answer);
      } catch {
        // Un corte suelto no para el ciclo —el titular puede estar contestando
        // ahora mismo— pero **se dice**: una espera muda es peor que un aviso,
        // porque parece que funciona.
        if (stopped) return;
        setOutcome({ error: t('errors.generic') });
      }
    };

    void read();
    // `read` corre síncrono hasta el primer `await`, y el tope está antes de él:
    // si ya se pasó, `stopped` es `true` aquí y no hay que montar nada.
    if (!stopped) timer = setInterval(() => void read(), OUTCOME_INTERVAL_MS);
    return stop;
    // `readOutcome` es la referencia de una acción de servidor: baja del árbol
    // de servidor y no cambia entre repintados, así que no remonta el ciclo.
    // `t` tampoco: `useTranslator` lo memoriza por idioma.
  }, [presentationId, settled, deadline, readOutcome, t]);

  /*
   * **El canal, releído solo hasta que entre la respuesta de esta petición.**
   *
   * Aquí no había ciclo y estaba argumentado: ningún evento nombraba la
   * petición, así que un temporizador no habría sabido cuándo parar y habría
   * traído el diario de la organización cada tres segundos para siempre.
   * `request.answered` quita ese argumento —la respuesta se reconoce— y añade
   * uno a favor: en una ceremonia de identidad **esto es lo único que hay**, y
   * detrás de un botón se lee como que no funciona.
   *
   * Los mismos tres segundos que el desenlace, y las mismas dos condiciones de
   * parada: la respuesta a esta petición, o el plazo con su margen. Tampoco toca
   * te-api: pregunta al servidor de esta organización, que contesta de su base.
   */
  useEffect(() => {
    // Sin petición no hay nada que reconocer, así que tampoco hay ciclo: el
    // botón sigue estando para mirar el canal a mano.
    if (requestId === undefined) return;
    if (arrived) return;

    let stopped = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    const stop = () => {
      stopped = true;
      if (timer !== undefined) clearInterval(timer);
    };

    const read = async () => {
      if (!Number.isNaN(deadline) && Date.now() > deadline + OUTCOME_GRACE_MS) {
        stop();
        return;
      }
      try {
        const reply = await readEvents(sentAt ?? new Date().toISOString());
        if (stopped) return;
        setEventsError(reply.error);
        setEvents(reply.events ?? []);
      } catch {
        // Un corte suelto **no se pinta desde el ciclo**, al revés que en el
        // desenlace. Aquí un aviso que aparece y desaparece cada tres segundos
        // no informa de nada; quien quiera saber si la consulta falla tiene el
        // botón, que sí lo dice y para eso se ha quedado.
      }
    };

    void read();
    if (!stopped) timer = setInterval(() => void read(), OUTCOME_INTERVAL_MS);
    return stop;
    // `readEvents` es la referencia de una acción de servidor: no cambia entre
    // repintados. `sentAt` lo selló el servidor al mandar y tampoco.
  }, [requestId, arrived, deadline, sentAt, readEvents]);

  const look = async () => {
    setEventsBusy(true);
    setEventsError(undefined);
    try {
      const reply = await readEvents(sentAt ?? new Date().toISOString());
      setEventsError(reply.error);
      setEvents(reply.events ?? []);
    } catch {
      // Que la consulta falle no es «no ha llegado nada»: son dos cosas
      // distintas y decir la primera por la segunda es mentir en la mitad de la
      // pantalla que tiene que demostrar que el viaje se cierra.
      setEventsError(t('errors.generic'));
      setEvents([]);
    } finally {
      setEventsBusy(false);
    }
  };

  return (
    <div className="ceremony-half">
      <h3 className="ceremony-heading">{t('ceremonies.receivedTitle')}</h3>

      {/*
        **Primero lo que contestó el titular, venga de donde venga.**

        Y viene de dos sitios que contestan la misma pregunta con distinto
        alcance, así que hay un orden y no es arbitrario:

         · `answer` es el evento de **esta petición**, y vale para las catorce
           plantillas: firme con credencial o con la identidad de la cartera. Es
           lo que faltaba, así que va primero.
         · `Outcome` es la fila de `verification`, que sólo existe cuando hubo
           sesión de verificador — y entonces enseña más: los claims que el
           titular decidió mostrar y las dos horas del recibo. Se queda debajo
           porque es la mitad detallada, no la que resume.

        Una ceremonia de identidad sin respuesta todavía no pinta ni una cosa ni
        la otra: dice qué se está esperando y por dónde va a llegar, que es
        distinto de un hueco girando.
      */}
      {answer !== null && <Answer answer={answer} />}

      {presentationId === undefined
        ? answer === null && <p className="ceremony-hint">{t('ceremonies.receivedNoRow')}</p>
        : <Outcome outcome={outcome} expiresAt={expiresAt} />}

      {/*
        El canal, plegado debajo del desenlace y rotulado como lo que es. Antes
        era lo único que había aquí, y por eso parecía la respuesta.
      */}
      <h4 className="ceremony-wire-head">{t('ceremonies.receivedWireTitle')}</h4>
      <p className="ceremony-hint">{t('ceremonies.receivedWireNote')}</p>

      <button type="button" className="secondary" disabled={eventsBusy} onClick={() => void look()}>
        {eventsBusy ? t('ceremonies.checking') : t('ceremonies.checkEvents')}
      </button>

      {eventsError !== undefined && <p className="alert">{eventsError}</p>}

      {eventsError === undefined && events !== null && events.length === 0 && (
        <p className="ceremony-hint">{t('ceremonies.receivedEmpty')}</p>
      )}

      {events !== null && events.length > 0 && (
        <ul className="ceremony-events">
          {events.map((event) => {
            /*
             * La pareja de verdad, ahora por dos caminos.
             *
             * `requestId` es el que vale para las catorce plantillas y el que
             * cubre la mitad que antes no se podía emparejar; `presentationId`
             * es el de siempre y sigue siendo el de `presentation.settled`. Lo
             * demás que haya entrado desde el corte se enseña igual —es lo que
             * llegó— pero sin decir que es la respuesta.
             */
            const parsed = readAnsweredEvent(event.payload);
            const byRequest =
              parsed !== null && requestId !== undefined && parsed.requestId === requestId;
            const bySession =
              presentationId !== undefined && event.presentationId === presentationId;
            const mine = byRequest || bySession;
            return (
              <li key={event.eventId} className={mine ? 'match' : undefined}>
                <div className="ceremony-event-head">
                  <span className="mono">{event.type}</span>
                  {/*
                    Cuándo llegó **aquí**. Es la mitad del dato en esta
                    pantalla: lo que se está demostrando es que la respuesta
                    del titular vuelve sola, y sin la hora eso es una fila más.
                  */}
                  <span className="sub">{formatTimestamp(event.receivedAt, t.locale)}</span>
                  {event.status !== null && <span className="pill">{event.status}</span>}
                  {event.signatureOk ? (
                    <span className="pill ok">{t('events.signatureOk')}</span>
                  ) : (
                    <span className="pill alarm">
                      {t('events.signatureBad')}
                      {event.signatureError !== null && ` · ${event.signatureError}`}
                    </span>
                  )}
                </div>
                {/*
                  Dos frases y no una: «la misma sesión de verificador» era
                  verdad cuando ése era el único emparejamiento posible, y sería
                  falsa en una ceremonia de identidad, que no tiene ninguna.
                */}
                {mine && (
                  <p className="ceremony-event-match">
                    {t(byRequest ? 'ceremonies.receivedMatchRequest' : 'ceremonies.receivedMatch')}
                  </p>
                )}
                <details className="tech">
                  <summary>{t('common.technicalDetail')}</summary>
                  <pre>{JSON.stringify(event.payload, null, 2)}</pre>
                </details>
              </li>
            );
          })}
        </ul>
      )}

      {/*
        La nota de la credencial va al final y no arriba: quien firma con una
        está mirando el desenlace, y lo que aquí se cuenta —que lo que se liquida
        es la SESIÓN DEL VERIFICADOR y no la petición del marco— es la letra
        pequeña que hace que el rótulo no mienta.
      */}
      {signsWithCredential && <p className="ceremony-hint">{t('ceremonies.receivedCredentialNote')}</p>}

      <p className="ceremony-hint">
        <Link href="/events">{t('ceremonies.eventsLink')}</Link>
      </p>
    </div>
  );
}

/**
 * **Lo que contestó el titular a esta petición.** La mitad que faltaba.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ESTO NO ES EL DESENLACE DE UNA PRESENTACIÓN, Y POR ESO ES UN COMPONENTE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `Outcome`, aquí abajo, lee la fila de `verification`: existe cuando la
 * ceremonia abrió sesión de verificador y enseña lo que trae el recibo. Esto lee
 * el evento `request.answered`, que habla de **la petición** y llega para las
 * catorce plantillas del catálogo, con sesión o sin ella.
 *
 * Las dos pueden estar a la vez y no se contradicen: una dice que el titular
 * aprobó la petición, la otra qué enseñó al hacerlo. Colapsarlas en un solo
 * bloque obligaría a elegir una fuente, y la que sobrevive deja media ceremonia
 * sin contestar.
 *
 * El color sale de `describeRequestOutcome`, que es el mismo reparto que el
 * resto de la consola: **rojo sólo `not_me`**. Un titular que lee y dice que no
 * pintado del color de una suplantación haría que el agente cortase la llamada
 * por una respuesta normal.
 */
function Answer({ answer }: { answer: AnsweredRequest }) {
  const t = useTranslator();
  const verdict = describeRequestOutcome(t, answer.outcome);

  return (
    <>
      <p className="ceremony-outcome">
        <span className={`pill ${verdict.tone}`}>
          <span className="pill-mark" aria-hidden="true" />
          {verdict.label}
        </span>
        <span className="ceremony-outcome-detail">{verdict.detail}</span>
      </p>

      <dl className="facts">
        <dt>{t('ceremonies.answerCeremony')}</dt>
        <dd>
          {describeAnsweredCeremony(t, answer)}
          <span className="mono sub">
            {answer.template ?? t('common.dash')}
            {answer.templateVersion !== null && ` · v${String(answer.templateVersion)}`}
            {answer.kind !== null && ` · ${answer.kind}`}
          </span>
        </dd>

        {/*
          Cuándo contestó **el titular**, según el reloj de su teléfono. La otra
          hora —cuándo entró el evento aquí— está en la fila del canal, debajo, y
          la distancia entre las dos es justo lo que demuestra que esto vuelve
          solo. Mismo criterio que `outcomeSignedAt` en la mitad de credencial.
        */}
        {answer.answeredAt !== null && (
          <>
            <dt>{t('ceremonies.answerAnsweredAt')}</dt>
            <dd>
              {formatTimestamp(answer.answeredAt, t.locale)}
              <span className="mono sub">{answer.answeredAt}</span>
            </dd>
          </>
        )}

        {/*
          **Los dos identificadores otra vez, ahora de vuelta.** Es lo que cierra
          la demostración: los mismos dos que se enseñaron al mandar, devueltos
          por te-api dentro de un cuerpo firmado. Quien integra compara la línea
          de arriba con la de la mitad de al lado y ve que cuadran.

          El expediente puede venir vacío y no se disimula: un socio que no
          mandara ninguno recibe su evento igual, y entonces lo que ata la
          respuesta es el identificador de te-api y sólo él.
        */}
        <dt>{t('ceremonies.answerRequestId')}</dt>
        <dd className="mono">{answer.requestId}</dd>

        <dt>{t('ceremonies.answerReference')}</dt>
        <dd className="mono">{answer.reference ?? t('common.dash')}</dd>
      </dl>
    </>
  );
}

/**
 * **El desenlace, con las palabras y el color de las otras cuatro pantallas.**
 *
 * `describeVerification` es el mismo vocabulario que usan el listado, la ficha y
 * el seguimiento, y usarlo aquí no es ahorrar líneas: es lo que garantiza que
 * **el rojo siga siendo sólo del fraude** también en esta pantalla. Un `rejected`
 * pintado aquí del color de un `expired` haría que quien enseña la ceremonia
 * contara un «no ha contestado» donde el titular dijo *no he sido yo*.
 *
 * Los cuatro estados de la lectura se distinguen y ninguno se confunde con otro:
 *
 *  · **`null`** — todavía no se ha contestado la primera consulta. Se dice que se
 *    está mirando, que es lo que está pasando.
 *  · **`error`** — la consulta falló. **No** es «no ha llegado nada»: eso dejaría
 *    la pantalla afirmando algo del titular a partir de un fallo nuestro.
 *  · **`found: false`** — la fila no está todavía. Es normal durante un instante
 *    y se lee como «todavía no», no como un fallo.
 *  · **con `status`** — el veredicto, con su hora y lo que el titular enseñó.
 */
function Outcome({
  outcome,
  expiresAt,
}: {
  outcome: CeremonyOutcomeResult | null;
  expiresAt: string | undefined;
}) {
  const t = useTranslator();

  if (outcome === null) return <p className="ceremony-hint">{t('ceremonies.outcomeReading')}</p>;
  if (outcome.error !== undefined) return <p className="alert">{outcome.error}</p>;
  if (outcome.status === undefined) {
    return <p className="ceremony-hint">{t('ceremonies.outcomeNotYet')}</p>;
  }

  // El plazo sale de la fila cuando la hay, y de la respuesta del envío si no.
  // Hace falta porque una fila que sigue `pending` con la hora vencida **no
  // está en curso**: es una que nadie miró cuando caducó, y el vocabulario ya
  // sabe decir esa diferencia.
  const deadline = outcome.expiresAt ?? expiresAt ?? new Date().toISOString();
  const verdict = describeVerification(t, outcome.status, deadline);
  const claims = Object.entries(outcome.disclosedClaims ?? {});

  return (
    <>
      <p className="ceremony-outcome">
        <span className={`pill ${verdict.tone}`}>
          <span className="pill-mark" aria-hidden="true" />
          {verdict.label}
        </span>
        <span className="ceremony-outcome-detail">{verdict.detail}</span>
      </p>

      <dl className="facts">
        {/*
          Las dos horas, con rótulos distintos y a propósito: `signedAt` es el
          reloj del teléfono del titular cuando firmó, y `settledAt` cuándo se
          enteró esta consola. Entre las dos está lo que tardó el evento, que es
          justo el dato que hay que poder enseñar cuando alguien pregunta si esto
          llega solo.
        */}
        {outcome.signedAt !== undefined && outcome.signedAt !== null && (
          <>
            <dt>{t('ceremonies.outcomeSignedAt')}</dt>
            <dd>
              {formatTimestamp(outcome.signedAt, t.locale)}
              <span className="mono sub">{outcome.signedAt}</span>
            </dd>
          </>
        )}
        {outcome.settledAt !== undefined && outcome.settledAt !== null && (
          <>
            <dt>{t('ceremonies.outcomeSettledAt')}</dt>
            <dd>
              {formatTimestamp(outcome.settledAt, t.locale)}
              <span className="mono sub">{outcome.settledAt}</span>
            </dd>
          </>
        )}
        {outcome.holderKey !== undefined && outcome.holderKey !== null && (
          <>
            <dt>{t('ceremonies.outcomeHolderKey')}</dt>
            <dd className="mono">{outcome.holderKey}</dd>
          </>
        )}
      </dl>

      {/*
        Lo que el titular decidió enseñar. Sólo cuando hay algo: una lista vacía
        con su rótulo diría que enseñó cero atributos, y lo que pasa cuando la
        comprobación no es `verified` es que no hay nada que enseñar.
      */}
      {claims.length > 0 && (
        <>
          <h4 className="ceremony-wire-head">{t('ceremonies.outcomeClaimsTitle')}</h4>
          <dl className="facts">
            {claims.map(([name, value]) => (
              <Fragment key={name}>
                <dt className="mono">{name}</dt>
                <dd className="mono">{String(value)}</dd>
              </Fragment>
            ))}
          </dl>
        </>
      )}
    </>
  );
}
