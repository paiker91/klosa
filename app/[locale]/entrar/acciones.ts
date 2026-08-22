'use server';

import { redirect } from 'next/navigation';
import { clienteServidor } from '@/lib/supabase/servidor';
import { esLocale, type Locale } from '@/i18n/config';
import { TEXTOS_CUENTA } from '@/i18n/textos-cuenta';

export interface Resultado {
  ok: boolean;
  mensaje: string;
}

/** Mínimo razonable. Supabase acepta 6; ocho no molesta y ayuda bastante. */
const LARGO_MINIMO = 8;

function idioma(valor: FormDataEntryValue | null): Locale {
  const v = String(valor ?? 'pt');
  return esLocale(v) ? v : 'pt';
}

/**
 * Traduce el error de Supabase a algo que se pueda leer.
 *
 * Nunca se distingue «no existe ese email» de «la contraseña no es esa»: decir
 * cuál de las dos falló le confirma a cualquiera qué correos están dados de
 * alta, que es filtrar datos de terceros sin ninguna necesidad.
 */
function traducir(codigo: string | undefined, t: (typeof TEXTOS_CUENTA)['es']): string {
  switch (codigo) {
    case 'invalid_credentials':
    case 'email_not_confirmed':
      return t.errores.credenciales;
    case 'user_already_exists':
    case 'email_exists':
      return t.errores.emailEnUso;
    case 'weak_password':
      return t.errores.passwordCorta;
    case 'validation_failed':
      return t.errores.emailInvalido;
    default:
      return t.errores.generico;
  }
}

export async function entrar(_previo: Resultado | null, datos: FormData): Promise<Resultado> {
  const locale = idioma(datos.get('locale'));
  const t = TEXTOS_CUENTA[locale];

  const supabase = await clienteServidor();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(datos.get('email') ?? '').trim(),
    password: String(datos.get('password') ?? ''),
  });

  if (error) return { ok: false, mensaje: traducir(error.code, t) };
  redirect(`/${locale}/mis-picks`);
}

export async function crearCuenta(_previo: Resultado | null, datos: FormData): Promise<Resultado> {
  const locale = idioma(datos.get('locale'));
  const t = TEXTOS_CUENTA[locale];

  const email = String(datos.get('email') ?? '').trim();
  const password = String(datos.get('password') ?? '');

  if (!email.includes('@')) return { ok: false, mensaje: t.errores.emailInvalido };
  if (password.length < LARGO_MINIMO) return { ok: false, mensaje: t.errores.passwordCorta };

  const supabase = await clienteServidor();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { ok: false, mensaje: traducir(error.code, t) };

  /*
   * Con confirmación por correo activada, `signUp` no abre sesión: devuelve el
   * usuario sin sesión y manda el email. Hay que decirlo, porque si no la
   * pantalla se queda igual y parece que no ha pasado nada.
   */
  if (data.session === null) return { ok: true, mensaje: t.entrar.confirmaEmail };
  redirect(`/${locale}/mis-picks`);
}

export async function salir(datos: FormData): Promise<void> {
  const locale = idioma(datos.get('locale'));
  const supabase = await clienteServidor();
  await supabase.auth.signOut();
  redirect(`/${locale}/entrar`);
}
