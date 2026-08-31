import Link from 'next/link';

import { CustomerForm } from '@/components/CustomerForm';
import { getTranslator } from '@/i18n/server';

export default async function NewCustomerPage() {
  const t = await getTranslator();

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">
            <Link href="/customers">{t('nav.customers')}</Link>
          </p>
          <h1>{t('customerNew.title')}</h1>
          {/*
            La consecuencia primero —cambiar el identificador rompe el vínculo—
            porque es lo que hay que saber ANTES de teclear. Cómo se llama ese
            campo por dentro no cambia nada de lo que se decide aquí, y va
            debajo, para quien vaya a integrar.
          */}
          <p className="page-sub">{t('customerNew.subtitle')}</p>
          <details className="tech">
            <summary>{t('common.technicalDetail')}</summary>
            <p style={{ maxWidth: '70ch' }}>{t.rich('customerNew.technical')}</p>
          </details>
        </div>
      </header>
      <CustomerForm />
    </>
  );
}
