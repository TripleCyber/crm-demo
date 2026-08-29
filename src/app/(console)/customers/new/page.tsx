import { CustomerForm } from '@/components/CustomerForm';

export default function NewCustomerPage() {
  return (
    <>
      <h1>Alta de cliente</h1>
      <p className="muted">
        El identificador es el <code>sub</code> de la credencial que se emita después, y es el campo
        por el que te-api vincula el titular. Una vez emitida una credencial con él, cambiarlo deja
        el vínculo huérfano.
      </p>
      <CustomerForm />
    </>
  );
}
