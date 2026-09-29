'use client';

import { useState } from 'react';

import { useTranslator } from '@/i18n/client';
import { casesOfIndustry, CEREMONY_INDUSTRIES } from '@/lib/ceremony-catalogue';
import type { CeremonyDraftField } from '@/lib/ceremony-templates';

import type {
  CeremonyEventsResult,
  CeremonyOutcomeResult,
  SendCeremonyResult,
} from '@/app/(console)/customers/[externalId]/ceremonies/actions';

import { CeremonyComposer, type CeremonyBrand } from './CeremonyComposer';

/**
 * **El catálogo de verificaciones.** Trece industrias, treinta y seis casos.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ESTE FICHERO ES LA NAVEGACIÓN. LA FICHA ES `CeremonyComposer.tsx`
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Aquí decía que era un catálogo y no un formulario, y que se veía en que no
 * había un solo campo. **Ahora los hay**, y por eso la ficha se ha ido a su
 * propio fichero: lo que queda aquí es elegir industria y elegir caso, que son
 * dos listas y noventa líneas. El compositor —editar, ensayar, ver la petición
 * exacta, mandarla y ver lo que vuelve— es otro oficio y ocupa otro fichero.
 *
 * La separación es la misma que hay entre `VerificationTracker` y
 * `VerificationStage`: uno decide qué es verdad y el otro cómo se enseña.
 * Mezclarlos es lo que hace que al retocar la lista se toque sin querer lo que
 * se manda.
 *
 * ## Se recorre por industria, y por eso no es una lista de 36
 *
 * Treinta y seis tarjetas en una columna no se leen. La fila de arriba elige
 * industria —dos a cuatro casos cada una—, la columna estrecha enseña esos casos
 * con su título y qué resuelven, y la ancha la ficha del que esté abierto. Nadie
 * tiene delante más de cuatro cosas a la vez.
 */
export function CeremonyCatalogue({
  externalId,
  organizationName,
  askerName,
  verifierUrl,
  credentialType,
  brand,
  walletLinked,
  send,
  readOutcome,
  readEvents,
}: {
  externalId: string;
  /** Quien pregunta de verdad. Ver la nota de arriba de la pantalla. */
  organizationName: string;
  /**
   * El nombre legal del padrón de te-api, que es el que **entra en la frase que
   * se firma**. No es el rótulo de la consola: ver la página.
   */
  askerName: string;
  /**
   * La base de te-api de esta organización — `https://te-api…`.
   *
   * **La base y no la URL entera**: el camino lo pone el mismo constructor que
   * manda la petición, así que la de la pantalla y la del cable no se pueden
   * separar. Se pinta, no se llama: el token no baja al navegador.
   */
  verifierUrl: string;
  /** El tipo del padrón con el que se pedirá la credencial, si hay alguno. */
  credentialType: string | undefined;
  /** La marca de **la organización**, para enseñar de quién es. Ver la ficha. */
  brand: CeremonyBrand | undefined;
  /**
   * Si el titular tiene cartera vinculada con esta organización.
   *
   * `undefined` es «no se pudo preguntar al directorio», y **no se trata como
   * `false`**: avisar de que no hay cartera cuando lo que pasó es que te-api no
   * contestó sería afirmar algo del cliente a partir de un fallo nuestro.
   */
  walletLinked: boolean | undefined;
  /**
   * Las tres acciones de servidor, inyectadas.
   *
   * Bajan por parámetro para que estos componentes sigan siendo pantallas y se
   * puedan leer sin arrastrar detrás la mitad del servidor.
   */
  send: (
    externalId: string,
    caseId: string,
    fields?: readonly CeremonyDraftField[],
  ) => Promise<SendCeremonyResult>;
  /**
   * El desenlace de **esta** ceremonia, de la fila que el webhook cierra. Es la
   * misma fuente que enseña la ficha del cliente; ver `ceremonies/actions.ts`.
   */
  readOutcome: (presentationId: string) => Promise<CeremonyOutcomeResult>;
  readEvents: (since: string) => Promise<CeremonyEventsResult>;
}) {
  const t = useTranslator();
  const [industry, setIndustry] = useState(CEREMONY_INDUSTRIES[0]?.id ?? 'doc');
  const [openId, setOpenId] = useState(casesOfIndustry(industry)[0]?.id ?? '');

  const cases = casesOfIndustry(industry);
  const open = cases.find((entry) => entry.id === openId) ?? cases[0];

  const pick = (nextIndustry: string) => {
    setIndustry(nextIndustry);
    setOpenId(casesOfIndustry(nextIndustry)[0]?.id ?? '');
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
                onClick={() => setOpenId(entry.id)}
              >
                <strong>{entry.title}</strong>
                <span className="ceremony-item-why">{entry.problem}</span>
                <span className="ceremony-item-mark mono">{entry.template}</span>
              </button>
            </li>
          ))}
        </ul>

        {open !== undefined && (
          /*
            `key` por caso, y es lo que hace que el compositor funcione: cambiar
            de caso **desmonta** la ficha entera, así que el borrador, el
            resultado y los eventos de la anterior no sobreviven. Sin esto,
            abrir un contrato mercantil después de un cambio de SIM heredaría
            los campos del otro, y lo que se manda sería una mezcla.
          */
          <CeremonyComposer
            key={open.id}
            ceremony={open}
            externalId={externalId}
            askerName={askerName}
            verifierUrl={verifierUrl}
            credentialType={credentialType}
            brand={brand}
            send={send}
            readOutcome={readOutcome}
            readEvents={readEvents}
          />
        )}
      </div>
    </>
  );
}
