'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, isLocale } from './config';

/**
 * Cambiar de idioma.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ACCIÓN DE SERVIDOR Y FORMULARIO DE VERDAD, NO UN BOTÓN CON JAVASCRIPT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * El idioma vive en una cookie `httpOnly`, así que quien la escribe tiene que
 * ser el servidor. Con un `<form>` de verdad esto funciona además **con
 * JavaScript desactivado**, que es la misma decisión que ya tomaron el alta de
 * cliente y el buscador del padrón — y en una consola de sucursal no es una
 * excentricidad.
 *
 * `revalidatePath('/', 'layout')` porque el idioma lo lee la disposición raíz
 * (el `lang` del documento) y la barra lateral: sin invalidar el árbol entero,
 * la pantalla se repinta traducida y la barra se queda en el idioma anterior.
 */
export async function setLocaleAction(formData: FormData): Promise<void> {
  const requested = formData.get('locale');
  const locale = isLocale(requested) ? requested : DEFAULT_LOCALE;

  (await cookies()).set(LOCALE_COOKIE, locale, {
    // `httpOnly: false` sería más cómodo para un selector de navegador, pero no
    // hace falta ninguno: aquí no hay JavaScript leyendo esto.
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: LOCALE_COOKIE_MAX_AGE,
  });

  revalidatePath('/', 'layout');
  redirect(safeReturnPath(formData.get('next')));
}

/**
 * A dónde se vuelve después de cambiar de idioma.
 *
 * ⚠ Este valor lo escribe el formulario, o sea el navegador, así que **no se
 *   puede redirigir a él tal cual**: `//otro-sitio.example` es una dirección
 *   absoluta disfrazada de ruta, y una redirección abierta en una aplicación
 *   de un banco es exactamente el ingrediente de un fraude por correo.
 *
 * Se exige una ruta interna: una sola barra al principio, y nada de `\` (que
 * algunos navegadores normalizan a `/`, con lo que `/\ejemplo.com` volvería a
 * ser absoluta). Lo que no encaje vuelve a la portada de la consola, que es un
 * destino correcto aunque no sea el que se quería.
 */
function safeReturnPath(value: FormDataEntryValue | null): string {
  if (typeof value !== 'string') return '/';
  if (!value.startsWith('/')) return '/';
  if (value.startsWith('//') || value.startsWith('/\\')) return '/';
  return value;
}
