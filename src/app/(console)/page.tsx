import { redirect } from 'next/navigation';

/** La consola empieza en el listado de clientes: no hay portada que enseñar. */
export default function HomePage() {
  redirect('/customers');
}
