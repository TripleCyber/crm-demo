'use client';

import { Fragment, useState } from 'react';

import { useTranslator } from '@/i18n/client';
import {
  casesOfIndustry,
  CEREMONY_INDUSTRIES,
  type CeremonyCase,
} from '@/lib/ceremony-catalogue';

import type { SendCeremonyResult } from '@/app/(console)/customers/[externalId]/ceremonies/actions';

/**
 * **El catálogo de verificaciones.** Trece industrias, treinta y seis casos.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ES UN CATÁLOGO, NO UN FORMULARIO — Y SE VE EN QUE NO HAY UN SOLO CAMPO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Lo que un agente hace aquí es **elegir y mandar**. Los valores los trae el
 * catálogo, así que no hay nada que teclear y no debe haberlo: lo que el titular
 * lee entra en el texto que firma, y una pantalla con casillas editables sería
 * otra cosa —un compositor de peticiones— con otras preguntas que contestar.
 *
 * ## Se recorre por industria, y por eso no es una lista de 36
 *
 * Treinta y seis tarjetas en una columna no se leen. La fila de arriba elige
 * industria —dos a cuatro casos cada una—, la columna estrecha enseña esos casos
 * con su título y qué resuelven, y la ancha la ficha del que esté abierto. Nadie
 * tiene delante más de cuatro cosas a la vez.
 *
 * ## Se enseña, tal cual, lo que va a ver el titular
 *
 * La misma disciplina de `TransferLauncher` —«se enseña abajo, tal cual, lo que
 * va a ver el titular»— y por el mismo motivo: el agente tiene que poder decir
 * en voz alta lo que la otra persona está leyendo. Aquí es literal: la ficha
 * pinta **los mismos campos que se mandan**, con su héroe y su peso, y los dos
 * verbos tal y como salen en el teléfono.
 *
 * Lo que la ficha **no** promete es lo que el marco no hace. Varios casos rozan
 * el quórum, el enfriamiento o la proximidad, y el que lo roza lo dice en su
 * propia ficha —no en un pie— porque es ahí donde alguien lo va a leer antes de
 * vendérselo a un cliente.
 */
export function CeremonyCatalogue({
  externalId,
  organizationName,
  walletLinked,
  send,
}: {
  externalId: string;
  /** Quien pregunta de verdad. Ver la nota de arriba de la pantalla. */
  organizationName: string;
  /**
   * Si el titular tiene cartera vinculada con esta organización.
   *
   * `undefined` es «no se pudo preguntar al directorio», y **no se trata como
   * `false`**: avisar de que no hay cartera cuando lo que pasó es que te-api no
   * contestó sería afirmar algo del cliente a partir de un fallo nuestro.
   */
  walletLinked: boolean | undefined;
  /**
   * La acción de servidor, inyectada.
   *
   * Baja por parámetro para que este componente siga siendo una pantalla y se
   * pueda leer sin arrastrar detrás la mitad del servidor.
   */
  send: (externalId: string, caseId: string) => Promise<SendCeremonyResult>;
}) {
  const t = useTranslator();
  const [industry, setIndustry] = useState(CEREMONY_INDUSTRIES[0]?.id ?? 'doc');
  const [openId, setOpenId] = useState(casesOfIndustry(industry)[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SendCeremonyResult | null>(null);

  const cases = casesOfIndustry(industry);
  const open = cases.find((entry) => entry.id === openId) ?? cases[0];

  const pick = (nextIndustry: string) => {
    setIndustry(nextIndustry);
    setOpenId(casesOfIndustry(nextIndustry)[0]?.id ?? '');
    setResult(null);
  };

  const show = (caseId: string) => {
    setOpenId(caseId);
    setResult(null);
  };

  const ask = async (caseId: string) => {
    setBusy(true);
    setResult(null);
    try {
      setResult(await send(externalId, caseId));
    } catch {
      setResult({ error: t('errors.generic') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/*
        La línea que evita la confusión de toda esta pantalla. Va arriba y no en
        un pie: los casos están escritos para una notaría, un hospital o una
        eléctrica, y quien pregunta sigue siendo esta organización.
      */}
      <p className="ceremony-note">{t('ceremonies.askerNote', { organization: organizationName })}</p>

      {walletLinked === false && <p className="alert">{t('ceremonies.noWallet')}</p>}

      <nav className="ceremony-tabs" aria-label={t('ceremonies.industriesLabel')}>
        {CEREMONY_INDUSTRIES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={entry.id === industry ? 'ceremony-tab on' : 'ceremony-tab'}
            aria-current={entry.id === industry ? 'true' : undefined}
            onClick={() => pick(entry.id)}
          >
            {t(entry.labelKey)}
            <span className="ceremony-tab-count">{casesOfIndustry(entry.id).length}</span>
          </button>
        ))}
      </nav>

      <div className="ceremony-split">
        <ul className="ceremony-list">
          {cases.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                className={entry.id === open?.id ? 'ceremony-item on' : 'ceremony-item'}
                aria-current={entry.id === open?.id ? 'true' : undefined}
                onClick={() => show(entry.id)}
              >
                <strong>{entry.title}</strong>
                <span className="ceremony-item-why">{entry.problem}</span>
                <span className="ceremony-item-mark mono">{entry.template}</span>
              </button>
            </li>
          ))}
        </ul>

        {open !== undefined && (
          <CeremonyDetail
            key={open.id}
            ceremony={open}
            busy={busy}
            result={result}
            onSend={() => void ask(open.id)}
          />
        )}
      </div>
    </>
  );
}

/**
 * La ficha de un caso: qué resuelve, qué va a leer el titular, y el botón.
 *
 * El héroe se pinta arriba y en grande, y los demás pares debajo en el orden en
 * que se mandan. No es decoración: es **el mismo escalón** que la cartera pinta,
 * y verlo aquí es lo que permite al agente decir en voz alta lo que la otra
 * persona está mirando.
 */
function CeremonyDetail({
  ceremony,
  busy,
  result,
  onSend,
}: {
  ceremony: CeremonyCase;
  busy: boolean;
  result: SendCeremonyResult | null;
  onSend: () => void;
}) {
  const t = useTranslator();
  const hero = ceremony.fields.find((field) => field.style === 'hero');
  const pairs = ceremony.fields.filter((field) => field.style !== 'hero');

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

      <h3 className="ceremony-heading">{t('ceremonies.previewTitle')}</h3>

      <div className="ceremony-screen">
        {hero === undefined ? (
          <p className="ceremony-nohero">{t('ceremonies.noHero')}</p>
        ) : (
          <div className="ceremony-hero">
            <span>{hero.label}</span>
            <strong className={hero.type === 'mono' ? 'mono' : undefined}>{hero.value}</strong>
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
              </dd>
            </Fragment>
          ))}
        </dl>

        {/*
          Los dos verbos, y cuál manda. `account.change.v1` es la única en la
          que negar pesa más que aprobar, y es su razón de ser: es el cambio que
          abre todas las demás cuentas. Enseñarlo aquí al revés que en las otras
          es lo que hace que el agente lo cuente bien.
        */}
        <div className={ceremony.denyLeads ? 'ceremony-verbs deny-first' : 'ceremony-verbs'}>
          <span className="ceremony-verb">{ceremony.verb}</span>
          <span className="ceremony-deny">{ceremony.deny}</span>
        </div>
      </div>

      <p className="ceremony-problem">{ceremony.problem}</p>

      {ceremony.flag !== undefined && (
        <p className="ceremony-flag">
          <strong>{t('ceremonies.flagTitle')}</strong> {ceremony.flag}
        </p>
      )}

      {result?.error !== undefined && <p className="alert">{result.error}</p>}

      {result?.requestId === undefined ? (
        <button type="button" disabled={busy} onClick={onSend}>
          {busy ? t('ceremonies.sending') : t('ceremonies.send')}
        </button>
      ) : (
        <div className="ceremony-sent">
          <p>{t('ceremonies.sent')}</p>
          <p className="page-facts">
            <span className="mono">{result.requestId}</span>
            {result.presentationId !== undefined && (
              <span className="mono">{result.presentationId}</span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
