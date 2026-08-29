'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { createCustomerAction, type CreateCustomerState } from '@/app/(console)/customers/actions';

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
  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Guardando…' : 'Dar de alta'}
    </button>
  );
}

export function CustomerForm() {
  const [state, formAction] = useActionState(createCustomerAction, initialState);
  const fieldError = (name: string): string | undefined => state.fields?.[name];

  return (
    <form action={formAction} className="card">
      {state.error !== undefined && <p className="alert">{state.error}</p>}

      <label className="field">
        <span>Identificador de cliente (el que irá en la credencial)</span>
        <input name="externalId" placeholder="BD-99120447" required />
        {fieldError('externalId') !== undefined && (
          <small style={{ color: 'var(--danger)' }}>{fieldError('externalId')}</small>
        )}
      </label>

      <div className="row">
        <label className="field">
          <span>Nombre</span>
          <input name="givenName" placeholder="Juan" required />
          {fieldError('givenName') !== undefined && (
            <small style={{ color: 'var(--danger)' }}>{fieldError('givenName')}</small>
          )}
        </label>
        <label className="field">
          <span>Apellidos</span>
          <input name="familyName" placeholder="Pérez Molina" required />
          {fieldError('familyName') !== undefined && (
            <small style={{ color: 'var(--danger)' }}>{fieldError('familyName')}</small>
          )}
        </label>
      </div>

      <div className="row">
        <label className="field">
          <span>Correo</span>
          <input name="email" type="email" placeholder="juan@example.com" />
        </label>
        <label className="field">
          <span>Teléfono</span>
          <input name="phone" placeholder="+34 600 000 000" />
        </label>
      </div>

      <div className="row">
        <label className="field">
          <span>Últimos cuatro de la cuenta</span>
          <input name="accountLast4" inputMode="numeric" maxLength={4} placeholder="4471" />
          {fieldError('accountLast4') !== undefined && (
            <small style={{ color: 'var(--danger)' }}>{fieldError('accountLast4')}</small>
          )}
        </label>
        <label className="field">
          <span>Cliente desde</span>
          <input name="customerSince" type="date" />
          {fieldError('customerSince') !== undefined && (
            <small style={{ color: 'var(--danger)' }}>{fieldError('customerSince')}</small>
          )}
        </label>
      </div>

      <SubmitButton />
    </form>
  );
}
