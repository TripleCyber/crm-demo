'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createCustomer, DuplicateCustomerError, validateCustomerInput } from '@/lib/customers';
import { getEmployeeSession } from '@/lib/session';

/**
 * El alta de cliente.
 *
 * Acción de servidor y no ruta de API: no hay ningún secreto por medio —esto
 * sólo escribe en la base del CRM— y así el formulario funciona igual con
 * JavaScript desactivado. La emisión sí es una ruta de API, porque ahí sí hay
 * un token que no puede bajar al navegador.
 *
 * La organización **no viene del formulario**. Sale de la sesión, como en toda
 * consulta de este proyecto: un campo oculto con el `orgId` sería un campo que
 * se puede editar.
 */

export interface CreateCustomerState {
  readonly error?: string;
  /** Los campos con problema, para poder señalarlos en el formulario. */
  readonly fields?: Record<string, string>;
}

export async function createCustomerAction(
  _previous: CreateCustomerState,
  formData: FormData,
): Promise<CreateCustomerState> {
  const read = (name: string): string | undefined => {
    const value = formData.get(name);
    return typeof value === 'string' ? value : undefined;
  };

  const { input, issues } = validateCustomerInput({
    externalId: read('externalId'),
    givenName: read('givenName'),
    familyName: read('familyName'),
    email: read('email'),
    phone: read('phone'),
    accountLast4: read('accountLast4'),
    customerSince: read('customerSince'),
  });

  if (issues.length > 0) {
    return {
      error: 'Revisa los campos marcados.',
      fields: Object.fromEntries(issues.map((issue) => [issue.field, issue.message])),
    };
  }

  try {
    const session = await getEmployeeSession();
    await createCustomer(session.organization.orgId, input);
  } catch (error) {
    if (error instanceof DuplicateCustomerError) {
      return {
        error: error.message,
        fields: { externalId: 'ya existe en esta organización' },
      };
    }
    return { error: error instanceof Error ? error.message : 'no se ha podido dar de alta' };
  }

  // `redirect` lanza una excepción de control de Next: tiene que quedar FUERA
  // del `try`, o el `catch` de arriba la trataría como un fallo del alta y el
  // cliente se crearía sin que el formulario avanzase.
  revalidatePath('/customers');
  redirect(`/customers/${encodeURIComponent(input.externalId)}`);
}
