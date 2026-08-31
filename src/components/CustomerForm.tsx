'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { createCustomerAction, type CreateCustomerState } from '@/app/(console)/customers/actions';
import { useTranslator } from '@/i18n/client';
import type { MessageKey } from '@/i18n/translate';
import type { ReferenceClaim } from '@/lib/reference-claims';

/**
 * El formulario de alta.
 *
 * Es de cliente sólo para poder enseñar los errores de validación junto a cada
 * campo (`useActionState`) y desactivar el botón mientras se guarda
 * (`useFormStatus`). El trabajo lo hace la acción de servidor: aquí no hay
 * ninguna llamada a nada.
 *
 * De `src/lib` importa **una sola cosa, y sólo el tipo**: el juego cerrado de
 * las cuatro referencias de sector (`reference-claims.ts`), que es de los tres
 * módulos de esa carpeta que no llevan `server-only` porque no leen ni secretos
 * ni base. Todo lo demás de `src/lib` sí lo lleva, y el compilador rechazaría el
 * import desde aquí — que es la propiedad que hay que conservar.
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

/**
 * Cómo se pinta cada una de las cuatro referencias.
 *
 * El nombre del campo es el que lee `createCustomerAction` del `FormData`, así
 * que es también la clave con la que vuelve su error de validación: por eso
 * `name` sirve para las dos cosas y no hay una segunda tabla que mantener.
 *
 * Los ejemplos de póliza e historia siguen en castellano —`PA-…`, `HC-…`— y no
 * se tocan a propósito: son los que ya ven Seguros Aurora y Clínica San Rafael,
 * y este cambio no puede mover ni un píxel de sus pantallas. Cuando a alguna de
 * las dos le toque un cambio propio, ése es el momento de pasarlas a inglés.
 */
interface ReferenceInput {
  /** El `name` del `<input>`, y la clave del error de validación. */
  readonly name: string;
  readonly labelKey: MessageKey;
  readonly placeholder: string;
  /**
   * Sólo los tiene la cuenta: son cuatro dígitos, y el teclado numérico y el
   * tope de cuatro caracteres son lo que evita la mitad de las erratas. Los
   * otros tres no llevan ninguno porque cada mercado numera como quiere —el
   * CUPS español tiene 20 o 22 caracteres y el MPAN británico 13 dígitos—, así
   * que aquí no hay largo que imponer (ver `validateCustomerInput`).
   */
  readonly inputMode?: 'numeric';
  readonly maxLength?: number;
}

const REFERENCE_INPUTS: Record<ReferenceClaim, ReferenceInput> = {
  account_last4: {
    name: 'accountLast4',
    labelKey: 'customerForm.accountLast4',
    placeholder: '4471',
    inputMode: 'numeric',
    maxLength: 4,
  },
  policy_number: {
    name: 'policyNumber',
    labelKey: 'customerForm.policyNumber',
    placeholder: 'PA-2019-004471',
  },
  medical_record_number: {
    name: 'medicalRecordNumber',
    labelKey: 'customerForm.medicalRecordNumber',
    placeholder: 'HC-0044718',
  },
  supply_point_number: {
    name: 'supplyPointNumber',
    labelKey: 'customerForm.supplyPointNumber',
    placeholder: 'LE-SP-0044718',
  },
};

export interface CustomerFormProps {
  /**
   * La referencia de sector de ESTA organización, o `undefined` si no declara
   * ninguna y hay que ofrecer las cuatro.
   *
   * Llega ya resuelta desde el padre, que es un componente de servidor. Lo que
   * baja al navegador es una de cuatro palabras conocidas —`supply_point_number`
   * y poco más—, no la organización: aquí no hay ni `orgId` ni nada de
   * `src/lib` que no sea el tipo de este valor.
   */
  readonly referenceClaim: ReferenceClaim | undefined;
}

export function CustomerForm({ referenceClaim }: CustomerFormProps) {
  const [state, formAction] = useActionState(createCustomerAction, initialState);
  const t = useTranslator();
  const fieldError = (name: string): string | undefined => state.fields?.[name];

  const referenceField = (claim: ReferenceClaim) => {
    const input = REFERENCE_INPUTS[claim];
    return (
      <label className="field">
        <span>{t(input.labelKey)}</span>
        <input
          name={input.name}
          inputMode={input.inputMode}
          maxLength={input.maxLength}
          placeholder={input.placeholder}
        />
        {fieldError(input.name) !== undefined && (
          <small style={{ color: 'var(--danger)' }}>{fieldError(input.name)}</small>
        )}
      </label>
    );
  };

  const customerSinceField = (
    <label className="field">
      <span>{t('customerForm.customerSince')}</span>
      <input name="customerSince" type="date" />
      {fieldError('customerSince') !== undefined && (
        <small style={{ color: 'var(--danger)' }}>{fieldError('customerSince')}</small>
      )}
    </label>
  );

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

      {/*
        ═══════════════════════════════════════════════════════════════════════
         LA REFERENCIA DE SECTOR: SE OFRECE LA DE ESTA EMPRESA, NO LAS CUATRO
        ═══════════════════════════════════════════════════════════════════════

        Cuenta, póliza, historia y punto de suministro son la misma cosa en
        cuatro sectores: el dato con el que el titular reconoce de qué relación
        se le está hablando (`lib/reference-claims.ts`).

        Hasta el 2026-08-31 se enseñaban **las cuatro**, y el razonamiento
        escrito aquí era que este formulario es de CLIENTE y no puede saber de
        qué organización es la pantalla. La primera mitad sigue siendo verdad y
        la conclusión no lo era: **el padre sí lo sabe** — `customers/new/page`
        es de servidor, resuelve la organización por el dominio de la petición
        como todo lo demás, y le pasa el resultado por propiedad. No baja al
        navegador ninguna organización; baja una de cuatro palabras.

        Y no era cosmético. A un agente de Larkfield Energy —luz y gas— le
        aparecía una casilla de «número de historia clínica», lo que en una
        demostración deshace la historia entera del producto; y ofrecer los de
        otros tres sectores invita a escribir el punto de suministro en la
        casilla de la póliza, que después sale mal en el listado, en la ficha y
        dentro de una credencial firmada.

        Sin declarar se siguen enseñando las cuatro, con esta misma disposición.
        No es una transición a medias: es lo que tienen las tres organizaciones
        anteriores, y su alta no cambia (`OrganizationConfig.referenceClaim`).
      */}
      {referenceClaim === undefined ? (
        <>
          <div className="row">
            {referenceField('account_last4')}
            {customerSinceField}
          </div>
          <div className="row">
            {referenceField('policy_number')}
            {referenceField('medical_record_number')}
          </div>
          <div className="row">{referenceField('supply_point_number')}</div>
        </>
      ) : (
        // La referencia declarada ocupa el sitio que tenía la cuenta, junto a la
        // fecha de alta: son los dos datos de la relación comercial y se leen
        // juntos. Dejar la fila de la fecha sola dejaría un hueco donde antes
        // había un campo, y esa fila coja se nota.
        <div className="row">
          {referenceField(referenceClaim)}
          {customerSinceField}
        </div>
      )}

      <SubmitButton />
    </form>
  );
}
