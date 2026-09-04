'use client';

import Link from 'next/link';
import { Fragment, useMemo, useState } from 'react';

import { useTranslator } from '@/i18n/client';
import { formatTimestamp } from '@/lib/format';
import type { CeremonyCase } from '@/lib/ceremony-catalogue';
import {
  buildCeremonyHttpRequest,
  formatCeremonyHttpRequest,
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
  const [events, setEvents] = useState<readonly WebhookEventView[] | null>(null);
  const [eventsBusy, setEventsBusy] = useState(false);
  const [eventsError, setEventsError] = useState<string | undefined>(undefined);

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
   * Los dos huecos que no se pueden saber antes de mandar van con su marcador:
   * el `requestUri` sale de la sesión del verificador, que se abre un instante
   * antes, y por eso sólo aparece en la mitad de credencial.
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
    setEvents(null);
    try {
      const sent = await send(externalId, ceremony.id, fields);
      setResult(sent);
      // La petición ya está hecha: lo que se enseña ahora es lo que salió, así
      // que la pestaña útil es ésa y no la de editar.
      if (sent.requestId !== undefined) setPane('wire');
    } catch {
      setResult({ error: t('errors.generic') });
    } finally {
      setBusy(false);
    }
  };

  const look = async (since: string) => {
    setEventsBusy(true);
    setEventsError(undefined);
    try {
      const answer = await readEvents(since);
      setEventsError(answer.error);
      setEvents(answer.events ?? []);
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
            setResult(null);
            setEvents(null);
            setEventsError(undefined);
            setPane('fields');
          }}
          events={events}
          eventsError={eventsError}
          busy={eventsBusy}
          signsWithCredential={ceremony.signWith === 'credential'}
          onLook={() => void look(result.sentAt ?? new Date().toISOString())}
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
 * Lo recibido es lo que ha entrado por el webhook **desde que se pulsó**, y ahí
 * hay que ser exacto, porque es lo que un cliente va a preguntar:
 *
 *  · una ceremonia que firma con **credencial** cierra el viaje de verdad — el
 *    evento `presentation.settled` llega con el `presentationId` que esta consola
 *    anotó, y la pareja se ve;
 *  · una que firma con la **identidad de la cartera** se aprueba, se rechaza o
 *    caduca **sin que salga ningún evento**, porque te-api no manda hoy ninguno
 *    sobre peticiones del marco. No se disimula con un «esperando»: se dice, se
 *    nombra el hueco y se apunta a dónde se arregla.
 *
 * Y no hay temporizador. El botón pregunta al servidor de esta organización, que
 * contesta de su propia base: los eventos llegan solos y quedan archivados con
 * la pestaña cerrada. Ver `readCeremonyEventsAction`.
 */
function Exchange({
  result,
  events,
  eventsError,
  busy,
  signsWithCredential,
  onLook,
  onAgain,
}: {
  result: SendCeremonyResult;
  events: readonly WebhookEventView[] | null;
  eventsError: string | undefined;
  busy: boolean;
  signsWithCredential: boolean;
  onLook: () => void;
  onAgain: () => void;
}) {
  const t = useTranslator();

  return (
    <div className="ceremony-exchange">
      <div className="ceremony-half">
        <h3 className="ceremony-heading">{t('ceremonies.sentTitle')}</h3>
        <p>{t('ceremonies.sent')}</p>
        <dl className="facts">
          <dt>{t('ceremonies.sentRequestId')}</dt>
          <dd className="mono">{result.requestId}</dd>
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

      <div className="ceremony-half">
        <h3 className="ceremony-heading">{t('ceremonies.receivedTitle')}</h3>

        {!signsWithCredential && <p className="ceremony-hint">{t('ceremonies.receivedNoEvent')}</p>}

        <button type="button" className="secondary" disabled={busy} onClick={onLook}>
          {busy ? t('ceremonies.checking') : t('ceremonies.checkEvents')}
        </button>

        {eventsError !== undefined && <p className="alert">{eventsError}</p>}

        {eventsError === undefined && events !== null && events.length === 0 && (
          <p className="ceremony-hint">{t('ceremonies.receivedEmpty')}</p>
        )}

        {events !== null && events.length > 0 && (
          <ul className="ceremony-events">
            {events.map((event) => {
              // La pareja de verdad: el evento que habla de **esta** sesión de
              // verificador. Lo demás que haya entrado desde el corte se enseña
              // igual —es lo que llegó— pero sin decir que es la respuesta.
              const mine =
                result.presentationId !== undefined
                  && event.presentationId === result.presentationId;
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
                  {mine && <p className="ceremony-event-match">{t('ceremonies.receivedMatch')}</p>}
                  <details className="tech">
                    <summary>{t('common.technicalDetail')}</summary>
                    <pre>{JSON.stringify(event.payload, null, 2)}</pre>
                  </details>
                </li>
              );
            })}
          </ul>
        )}

        <p className="ceremony-hint">
          <Link href="/events">{t('ceremonies.eventsLink')}</Link>
        </p>
      </div>
    </div>
  );
}
