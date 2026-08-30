import Link from 'next/link';

import { CustomerForm } from '@/components/CustomerForm';

export default function NewCustomerPage() {
  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">
            <Link href="/customers">Clientes</Link>
          </p>
          <h1>Alta de cliente</h1>
          {/*
            La consecuencia primero —cambiar el identificador rompe el vínculo—
            porque es lo que hay que saber ANTES de teclear. Cómo se llama ese
            campo por dentro no cambia nada de lo que se decide aquí, y va
            debajo, para quien vaya a integrar.
          */}
          <p className="page-sub">
            El identificador es el que llevará dentro su credencial y por el que se le reconoce
            después. Una vez emitida una credencial con él, cambiarlo deja el vínculo huérfano.
          </p>
          <details className="tech">
            <summary>Ver el detalle técnico</summary>
            <p style={{ maxWidth: '70ch' }}>
              Es el <span className="mono">sub</span> de la credencial y el{' '}
              <span className="mono">subjectReference</span> con el que te-api ata el titular a su
              perfil, tanto al emitir como al pedir una presentación.
            </p>
          </details>
        </div>
      </header>
      <CustomerForm />
    </>
  );
}
