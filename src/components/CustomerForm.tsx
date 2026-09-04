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
 * las referencias de sector (`reference-claims.ts`), que es de los tres módulos
 * de esa carpeta que no llevan `server-only` porque no leen ni secretos ni base.
 * Todo lo demás de `src/lib` sí lo lleva, y el compilador rechazaría el import
 * desde aquí — que es la propiedad que hay que conservar.
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
 * Cómo se pinta cada referencia.
 *
 * El nombre del campo es el que lee `createCustomerAction` del `FormData`, así
 * que es también la clave con la que vuelve su error de validación: por eso
 * `name` sirve para las dos cosas y no hay una segunda tabla que mantener.
 */
interface ReferenceInput {
  /** El `name` del `<input>`, y la clave del error de validación. */
  readonly name: string;
  readonly labelKey: MessageKey;
  readonly placeholder: string;
  /**
   * Sólo los tiene la cuenta: son cuatro dígitos, y el teclado numérico y el
   * tope de cuatro caracteres son lo que evita la mitad de las erratas. El punto
   * de suministro no lleva ninguno porque cada mercado numera como quiere —el
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
  supply_point_number: {
    name: 'supplyPointNumber',
    labelKey: 'customerForm.supplyPointNumber',
    placeholder: 'SP-16000412201',
  },
};

export interface CustomerFormProps {
  /**
   * La referencia de sector de ESTA instalación.
   *
   * Llega ya resuelta desde el padre, que es un componente de servidor. Lo que
   * baja al navegador es una de dos palabras conocidas —`supply_point_number` o
   * `account_last4`—, no la organización: aquí no hay ni `orgId` ni nada de
   * `src/lib` que no sea el tipo de este valor.
   *
   * **No admite `undefined`.** Lo admitía cuando un despliegue servía a cuatro
   * empresas y las tres primeras no la declaraban; entonces se ofrecían todas
   * las casillas a la vez, que es lo que le ponía delante a un agente de una
   * eléctrica una casilla de otro negocio. Hoy la declara el entorno y sin ella
   * el proceso no arranca (`CRM_REFERENCE_CLAIM`), así que aquí siempre hay una.
   */
  readonly referenceClaim: ReferenceClaim;
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

  /*
    ═══════════════════════════════════════════════════════════════════════════
     LA FECHA DE NACIMIENTO LLEVA SU EXPLICACIÓN DEBAJO, Y NO SOBRA
    ═══════════════════════════════════════════════════════════════════════════

    Es el único campo del alta que **no se enseña en ninguna otra pantalla**: no
    está en el listado, no está en la ficha y no se puede pedir en una
    comprobación. Quien lo teclea tiene derecho a saber para qué. Sin la frase
    parece un dato más que el banco recoge porque sí —y en un producto que se
    vende diciendo «pide sólo lo que necesitas», eso se nota— cuando es
    exactamente lo contrario: entra para poder contestar «mayor de 18» sin que la
    fecha salga de aquí.

    Va opcional, como las otras dos fechas. Un padrón real llega a medias, y
    exigirla convertiría el alta de un cliente al que sólo se le va a emitir el
    nombre en un formulario que no se puede terminar.
  */
  const birthDateField = (
    <label className="field">
      <span>{t('customerForm.birthDate')}</span>
      <input name="birthDate" type="date" />
      <small>{t('customerForm.birthDateHint')}</small>
      {fieldError('birthDate') !== undefined && (
        <small style={{ color: 'var(--danger)' }}>{fieldError('birthDate')}</small>
      )}
    </label>
  );

  return (
    <form action={formAction} className="card">
      {state.error !== undefined && <p className="alert">{state.error}</p>}

      <label className="field">
        <span>{t('customerForm.externalId')}</span>
        {/*
          El ejemplo sale del catálogo y **no está escrito aquí**. Estaba, y era
          `BD-99120447` — un identificador de Banco Demo, que en la consola de
          una comercializadora de energía es exactamente el mismo error que la
          casilla de «número de historia clínica»: le dice al agente que está
          usando el software de otra empresa. El del catálogo no es de nadie.
        */}
        <input name="externalId" placeholder={t('customerForm.externalIdExample')} required />
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

      {/*
        Va aquí, pegada al nombre y no junto a la fecha de alta, porque es de la
        PERSONA y no de la relación: la de abajo dice desde cuándo es cliente de
        este banco, ésta dice quién es. Y sola en su fila, con sitio para la
        frase que explica que no sale de aquí.
      */}
      {birthDateField}

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
         LA REFERENCIA DE SECTOR: SE OFRECE LA DE ESTA EMPRESA, Y SÓLO ÉSA
        ═══════════════════════════════════════════════════════════════════════

        La cuenta y el punto de suministro son la misma cosa en dos sectores: el
        dato con el que el titular reconoce de qué relación se le está hablando
        (`lib/reference-claims.ts`).

        Hasta el 2026-08-31 se enseñaban **todas**, y el razonamiento escrito
        aquí era que este formulario es de CLIENTE y no puede saber de qué
        organización es la pantalla. La primera mitad sigue siendo verdad y la
        conclusión no lo era: **el padre sí lo sabe** — `customers/new/page` es
        de servidor, lee la configuración de la instalación y le pasa el
        resultado por propiedad. No baja al navegador ninguna organización; baja
        una palabra de un juego cerrado.

        Y no era cosmético. A un agente de Larkfield Energy —luz y gas— le
        aparecía una casilla de «número de historia clínica», lo que en una
        demostración deshace la historia entera del producto; y ofrecer el de
        otro sector invita a escribir el punto de suministro en la casilla que no
        es, que después sale mal en el listado, en la ficha y dentro de una
        credencial firmada.

        La referencia ocupa el sitio que tenía la cuenta, junto a la fecha de
        alta: son los dos datos de la relación comercial y se leen juntos.
      */}
      <div className="row">
        {referenceField(referenceClaim)}
        {customerSinceField}
      </div>

      <SubmitButton />
    </form>
  );
}
