'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { saveSettingsAction, type SaveSettingsState } from '@/app/(console)/settings/actions';
import { useTranslator } from '@/i18n/client';
import type { MessageKey } from '@/i18n/translate';
import { REFERENCE_CLAIMS, type ReferenceClaim } from '@/lib/reference-claims';

/**
 * **El formulario que configura esta instalación.** Lo que antes era el `.env`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  LOS TRES SECRETOS SE ESCRIBEN Y NO SE RELEEN. NUNCA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Los campos de secreto llegan **siempre vacíos**, aunque haya uno guardado, y
 * lo que se enseña al lado es su huella: `••••••••`, los cuatro últimos
 * caracteres y los dieciséis primeros del SHA-256 (`lib/secret-fingerprint.ts`).
 * Es la misma forma que usa tenant-admin, y a propósito: la huella del secreto
 * M2M se calcula igual en las dos, así que se pueden comparar a ojo para
 * comprobar que se pegó el que era — sin que ninguna de las dos pantallas vuelva
 * a enseñar el secreto.
 *
 * Dejar el campo en blanco significa **«no lo toques»**. Es lo que permite
 * cambiar un color de marca sin que el guardado se lleve por delante la
 * credencial de máquina. Para vaciarlo de verdad hay una casilla por secreto, y
 * hay que marcarla a mano.
 *
 * El motivo entero —quién puede llegar a esta pantalla y por qué eso obliga a
 * esto— está escrito en la página que la monta (`app/(console)/settings/page.tsx`).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ES DE NAVEGADOR POR TRES COSAS, Y NINGUNA ES EL FORMULARIO EN SÍ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * El trabajo lo hace la acción de servidor. Esto baja al navegador para poder
 * enseñar el error de validación **junto a su casilla** (`useActionState`),
 * desactivar el botón mientras guarda (`useFormStatus`) y pintar el color de
 * marca según se escribe. De `src/lib` importa una sola cosa —el juego cerrado
 * de las referencias de sector— que es de los tres módulos de esa carpeta sin
 * `server-only`; todo lo demás lo rechazaría el compilador desde aquí, que es la
 * propiedad que hay que conservar.
 */

const initialState: SaveSettingsState = {};

/** Los valores actuales. **Ninguno es un secreto**: ver la nota de arriba. */
export interface SettingsFormValues {
  readonly orgId: string;
  readonly displayName: string;
  readonly domain: string;
  readonly m2mClientId: string;
  readonly referenceClaim: string;
  readonly officialNumbers: string;
  readonly brandAccent: string;
  readonly brandSurface: string;
  readonly brandMonogram: string;
  readonly portalClientId: string;
  readonly portalLinkType: string;
  readonly portalBaseUrl: string;
  readonly logtoEndpoint: string;
  readonly teApiBaseUrl: string;
  readonly b2bResource: string;
  readonly b2bScope: string;
}

/** Lo que se sabe de un secreto guardado sin enseñarlo. */
export interface SecretState {
  readonly present: boolean;
  /** SHA-256, 16 caracteres. `undefined` si no hay secreto. */
  readonly digest?: string;
  /** Los cuatro últimos caracteres del valor. */
  readonly hint?: string;
}

export interface SettingsFormProps {
  readonly values: SettingsFormValues;
  readonly m2mSecret: SecretState;
  readonly webhookSecret: SecretState;
  readonly portalClientSecret: SecretState;
}

const REFERENCE_LABELS: Record<ReferenceClaim, MessageKey> = {
  account_last4: 'attributes.accountLast4',
  supply_point_number: 'attributes.supplyPointNumber',
};

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslator();
  return (
    <button type="submit" disabled={pending}>
      {t(pending ? 'settings.saving' : 'settings.save')}
    </button>
  );
}

export function SettingsForm({
  values,
  m2mSecret,
  webhookSecret,
  portalClientSecret,
}: SettingsFormProps) {
  const [state, formAction] = useActionState(saveSettingsAction, initialState);
  const t = useTranslator();

  const error = (name: string): string | undefined => state.fields?.[name];

  const fieldError = (name: string) =>
    error(name) === undefined ? null : (
      <small style={{ color: 'var(--danger)' }}>{error(name)}</small>
    );

  /**
   * Una casilla de secreto: el campo vacío, la huella de lo que hay guardado y
   * la casilla de vaciar.
   *
   * La huella se pinta **encima** del campo y no debajo: lo primero que quiere
   * saber quien abre esto es si ya hay uno puesto, y verlo después de la caja de
   * texto llega tarde — para entonces ya has empezado a escribir.
   */
  const secretField = (
    name: string,
    labelKey: MessageKey,
    hintKey: MessageKey,
    secret: SecretState,
  ) => (
    <label className="field">
      <span>{t(labelKey)}</span>
      {secret.present ? (
        <span className="secret-state">
          <span className="secret-dots" aria-hidden="true">
            ••••••••
          </span>
          <code className="secret-fingerprint" title={t('settings.fingerprintTitle')}>
            {secret.digest}
          </code>
          <span className="secret-hint">…{secret.hint}</span>
        </span>
      ) : (
        <span className="secret-state warn">{t('settings.secretMissing')}</span>
      )}
      <input
        name={name}
        type="password"
        autoComplete="off"
        placeholder={t(secret.present ? 'settings.secretKeep' : 'settings.secretPaste')}
      />
      <small className="muted">{t(hintKey)}</small>
      {secret.present && (
        <label className="secret-clear">
          <input type="checkbox" name={`clear_${name}`} />
          <span>{t('settings.secretClear')}</span>
        </label>
      )}
      {fieldError(name)}
    </label>
  );

  return (
    <form action={formAction} className="settings-form">
      {state.error !== undefined && <p className="alert">{state.error}</p>}
      {state.saved === true && <p className="alert ok">{t('settings.saved')}</p>}

      {/* ── Quién es ──────────────────────────────────────────────────── */}
      <div className="card">
        <h2>{t('settings.identityTitle')}</h2>
        <p className="muted">{t('settings.identityNote')}</p>

        <div className="row">
          <label className="field">
            <span>{t('settings.orgId')}</span>
            <input name="orgId" defaultValue={values.orgId} placeholder="ww51qgtvpc9h" required />
            {/*
              El aviso va SIEMPRE, no sólo cuando se cambia: el `org_id` es el
              discriminador de `customer`, `verification` y `webhook_event`, así
              que cambiarlo no migra nada — deja el padrón anterior donde está y
              empieza uno nuevo en blanco. Verlo después de guardar sería tarde.
            */}
            <small className="muted">{t('settings.orgIdNote')}</small>
            {fieldError('orgId')}
          </label>
          <label className="field">
            <span>{t('settings.displayName')}</span>
            <input
              name="displayName"
              defaultValue={values.displayName}
              placeholder={t('settings.displayNameExample')}
            />
            <small className="muted">{t('settings.displayNameNote')}</small>
            {fieldError('displayName')}
          </label>
        </div>

        <div className="row">
          <label className="field">
            <span>{t('settings.domain')}</span>
            <input name="domain" defaultValue={values.domain} placeholder="bank.demo-te.com" required />
            <small className="muted">{t('settings.domainNote')}</small>
            {fieldError('domain')}
          </label>
          <label className="field">
            <span>{t('settings.referenceClaim')}</span>
            <select name="referenceClaim" defaultValue={values.referenceClaim}>
              <option value="">{t('settings.referenceChoose')}</option>
              {REFERENCE_CLAIMS.map((claim) => (
                <option key={claim} value={claim}>
                  {t(REFERENCE_LABELS[claim])}
                </option>
              ))}
            </select>
            <small className="muted">{t('settings.referenceNote')}</small>
            {fieldError('referenceClaim')}
          </label>
        </div>

        <label className="field">
          <span>{t('settings.officialNumbers')}</span>
          <input
            name="officialNumbers"
            defaultValue={values.officialNumbers}
            placeholder="+34 918 40 22 47, +34 900 11 22 33"
          />
          <small className="muted">{t('settings.officialNumbersNote')}</small>
          {fieldError('officialNumbers')}
        </label>
      </div>

      {/* ── La aplicación de máquina ──────────────────────────────────── */}
      <div className="card">
        <h2>{t('settings.machineTitle')}</h2>
        <p className="muted">{t('settings.machineNote')}</p>

        <label className="field">
          <span>{t('settings.m2mClientId')}</span>
          <input name="m2mClientId" defaultValue={values.m2mClientId} autoComplete="off" />
          {fieldError('m2mClientId')}
        </label>

        {secretField('m2mSecret', 'settings.m2mSecret', 'settings.m2mSecretNote', m2mSecret)}
      </div>

      {/* ── El webhook ────────────────────────────────────────────────── */}
      <div className="card">
        <h2>{t('settings.webhookSecretTitle')}</h2>
        <p className="muted">{t('settings.webhookSecretIntro')}</p>
        {secretField(
          'webhookSecret',
          'settings.webhookSecret',
          'settings.webhookSecretNote',
          webhookSecret,
        )}
      </div>

      {/* ── La marca ──────────────────────────────────────────────────── */}
      <div className="card">
        <h2>{t('settings.brandTitle')}</h2>
        <p className="muted">{t('settings.brandNote')}</p>
        <div className="row">
          <label className="field">
            <span>{t('settings.brandAccent')}</span>
            <input name="brandAccent" defaultValue={values.brandAccent} placeholder="#1f4ea8" />
            {fieldError('brandAccent')}
          </label>
          <label className="field">
            <span>{t('settings.brandSurface')}</span>
            <input name="brandSurface" defaultValue={values.brandSurface} placeholder="#0d2245" />
            {fieldError('brandSurface')}
          </label>
          <label className="field">
            <span>{t('settings.brandMonogram')}</span>
            <input
              name="brandMonogram"
              defaultValue={values.brandMonogram}
              maxLength={2}
              placeholder="BD"
            />
            {fieldError('brandMonogram')}
          </label>
        </div>
      </div>

      {/* ── El portal ─────────────────────────────────────────────────── */}
      <div className="card">
        <h2>{t('settings.portalTitle')}</h2>
        <p className="muted">{t('settings.portalNote')}</p>
        <div className="row">
          <label className="field">
            <span>{t('settings.portalClientId')}</span>
            <input name="portalClientId" defaultValue={values.portalClientId} autoComplete="off" />
            {fieldError('portalClientId')}
          </label>
          <label className="field">
            <span>{t('settings.portalLinkType')}</span>
            <input
              name="portalLinkType"
              defaultValue={values.portalLinkType}
              placeholder="customer"
            />
            <small className="muted">{t('settings.portalLinkTypeNote')}</small>
            {fieldError('portalLinkType')}
          </label>
        </div>

        {secretField(
          'portalClientSecret',
          'settings.portalClientSecret',
          'settings.portalClientSecretNote',
          portalClientSecret,
        )}

        <label className="field">
          <span>{t('settings.portalBaseUrl')}</span>
          <input
            name="portalBaseUrl"
            defaultValue={values.portalBaseUrl}
            placeholder="https://bank.demo-te.com"
          />
          <small className="muted">{t('settings.portalBaseUrlNote')}</small>
          {fieldError('portalBaseUrl')}
        </label>
      </div>

      {/* ── La plataforma ─────────────────────────────────────────────── */}
      {/*
        Plegada, porque es lo único de esta pantalla que **no se toca al dar de
        alta una instalación**: son las direcciones del producto y valen igual en
        todas. Está aquí y no fuera del formulario porque un Logto de pruebas es
        un caso real, y sin ella «sólo hace falta DATABASE_URL» sería mentira.
      */}
      <div className="card">
        <details className="tech">
          <summary>{t('settings.platformTitle')}</summary>
          <p className="muted">{t('settings.platformNote')}</p>
          <div className="row">
            <label className="field">
              <span>{t('settings.logtoEndpoint')}</span>
              <input name="logtoEndpoint" defaultValue={values.logtoEndpoint} />
              {fieldError('logtoEndpoint')}
            </label>
            <label className="field">
              <span>{t('settings.teApiBaseUrl')}</span>
              <input name="teApiBaseUrl" defaultValue={values.teApiBaseUrl} />
              {fieldError('teApiBaseUrl')}
            </label>
          </div>
          <label className="field">
            <span>{t('settings.b2bResource')}</span>
            <input name="b2bResource" defaultValue={values.b2bResource} />
            <small className="muted">{t('settings.b2bResourceNote')}</small>
            {fieldError('b2bResource')}
          </label>
          <label className="field">
            <span>{t('settings.b2bScope')}</span>
            <input name="b2bScope" defaultValue={values.b2bScope} />
            <small className="muted">{t('settings.b2bScopeNote')}</small>
            {fieldError('b2bScope')}
          </label>
        </details>
      </div>

      <SubmitButton />
    </form>
  );
}
