'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { createCustomerAction, type CreateCustomerState } from '@/app/(console)/customers/actions';
import { useTranslator } from '@/i18n/client';

/**
 * El formulario de alta.
 *
 * Es de cliente sólo para poder enseñar los errores de validación junto a cada
 * campo (`useActionState`) y desactivar el botón mientras se guarda
 * (`useFormStatus`). El trabajo lo hace la acción de servidor: aquí no hay
 * ninguna llamada a nada, y por eso este fichero **no importa nada de
 * `src/lib`** — todos esos módulos son `server-only` y el compilador rechazaría
 * el import.
 */

const initialState: CreateCustomerState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslator();
  return (
    <button type="submit" disabled={pending}>
      {t(pending ? 'customerForm.submitting' : 'customerForm.submit')}
    </button>
  );
}

export function CustomerForm() {
  const [state, formAction] = useActionState(createCustomerAction, initialState);
  const t = useTranslator();
  const fieldError = (name: string): string | undefined => state.fields?.[name];

  return (
    <form action={formAction} className="card">
      {state.error !== undefined && <p className="alert">{state.error}</p>}

      <label className="field">
        <span>{t('customerForm.externalId')}</span>
        <input name="externalId" placeholder="BD-99120447" required />
        {fieldError('externalId') !== undefined && (
          <small style={{ color: 'var(--danger)' }}>{fieldError('externalId')}</small>
        )}
      </label>

      <div className="row">
        <label className="field">
          <span>{t('customerForm.givenName')}</span>
          <input name="givenName" placeholder={t('customerForm.givenNameExample')} required />
          {fieldError('givenName') !== undefined && (
            <small style={{ color: 'var(--danger)' }}>{fieldError('givenName')}</small>
          )}
        </label>
        <label className="field">
          <span>{t('customerForm.familyName')}</span>
          <input name="familyName" placeholder={t('customerForm.familyNameExample')} required />
          {fieldError('familyName') !== undefined && (
            <small style={{ color: 'var(--danger)' }}>{fieldError('familyName')}</small>
          )}
        </label>
      </div>

      <div className="row">
        <label className="field">
          <span>{t('customerForm.email')}</span>
          <input name="email" type="email" placeholder={t('customerForm.emailExample')} />
        </label>
        <label className="field">
          <span>{t('customerForm.phone')}</span>
          <input name="phone" placeholder="+34 600 000 000" />
        </label>
      </div>

      <div className="row">
        <label className="field">
          <span>{t('customerForm.accountLast4')}</span>
          <input name="accountLast4" inputMode="numeric" maxLength={4} placeholder="4471" />
          {fieldError('accountLast4') !== undefined && (
            <small style={{ color: 'var(--danger)' }}>{fieldError('accountLast4')}</small>
          )}
        </label>
        <label className="field">
          <span>{t('customerForm.customerSince')}</span>
          <input name="customerSince" type="date" />
          {fieldError('customerSince') !== undefined && (
            <small style={{ color: 'var(--danger)' }}>{fieldError('customerSince')}</small>
          )}
        </label>
      </div>

      {/*
        ═══════════════════════════════════════════════════════════════════════
         LOS CUATRO SECTORES COMPARTEN FORMULARIO, Y SE RELLENA EL QUE TOQUE
        ═══════════════════════════════════════════════════════════════════════

        Los cuatro campos —cuenta, póliza, historia, punto de suministro— son la
        misma cosa en cuatro sectores: el dato con el que el titular reconoce de
        qué relación se le habla. Se enseñan los cuatro y son opcionales, en vez
        de esconder tres según la organización.

        No es dejarlo a medias: este formulario es de CLIENTE (`'use client'`),
        no importa nada de `src/lib` —todo eso es `server-only`— y por tanto no
        sabe ni puede saber de qué organización es la pantalla. Ocultarlos
        obligaría a bajar la organización al navegador para una decisión
        cosmética. Lo que sí decide por organización es lo que importa: qué
        atributos ofrece la pantalla de emisión, y eso ya lo filtra el servidor
        descartando los que la ficha no rellena.
      */}
      <div className="row">
        <label className="field">
          <span>{t('customerForm.policyNumber')}</span>
          <input name="policyNumber" placeholder="PA-2019-004471" />
          {fieldError('policyNumber') !== undefined && (
            <small style={{ color: 'var(--danger)' }}>{fieldError('policyNumber')}</small>
          )}
        </label>
        <label className="field">
          <span>{t('customerForm.medicalRecordNumber')}</span>
          <input name="medicalRecordNumber" placeholder="HC-0044718" />
          {fieldError('medicalRecordNumber') !== undefined && (
            <small style={{ color: 'var(--danger)' }}>{fieldError('medicalRecordNumber')}</small>
          )}
        </label>
      </div>

      <div className="row">
        <label className="field">
          <span>{t('customerForm.supplyPointNumber')}</span>
          <input name="supplyPointNumber" placeholder="LE-SP-0044718" />
          {fieldError('supplyPointNumber') !== undefined && (
            <small style={{ color: 'var(--danger)' }}>{fieldError('supplyPointNumber')}</small>
          )}
        </label>
      </div>

      <SubmitButton />
    </form>
  );
}
