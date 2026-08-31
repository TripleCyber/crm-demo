'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getTranslator } from '@/i18n/server';
import { describeConsoleFailure } from '@/lib/console-failures';
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
  const t = await getTranslator();

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
    supplyPointNumber: read('supplyPointNumber'),
    customerSince: read('customerSince'),
  });

  if (issues.length > 0) {
    return {
      error: t('customerForm.checkFields'),
      fields: Object.fromEntries(issues.map((issue) => [issue.field, t(issue.messageKey)])),
    };
  }

  try {
    const session = await getEmployeeSession();
    await createCustomer(session.organization.orgId, input);
  } catch (error) {
    if (error instanceof DuplicateCustomerError) {
      return {
        error: t('customerForm.duplicate', { externalId: error.externalId }),
        fields: { externalId: t('customerForm.duplicateField') },
      };
    }
    // El duplicado de arriba SÍ se dice tal cual: es del padrón, lo entiende
    // quien está dando el alta y lo puede corregir. Lo que cae aquí es
    // configuración o base, que no es ni una cosa ni la otra.
    return { error: describeConsoleFailure(t, error, 'el alta de cliente falló') };
  }

  // `redirect` lanza una excepción de control de Next: tiene que quedar FUERA
  // del `try`, o el `catch` de arriba la trataría como un fallo del alta y el
  // cliente se crearía sin que el formulario avanzase.
  revalidatePath('/customers');
  redirect(`/customers/${encodeURIComponent(input.externalId)}`);
}
