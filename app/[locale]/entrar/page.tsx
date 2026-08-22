import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { esLocale } from '@/i18n/config';
import { TEXTOS_CUENTA } from '@/i18n/textos-cuenta';
import { TEXTOS_MARCO } from '@/i18n/textos-marco';
import { Cabecera } from '@/components/Cabecera';
import { PiePagina } from '@/components/PiePagina';
import { URL_REPO } from '@/lib/picks/remoto';
import { usuarioActual } from '@/lib/supabase/servidor';
import { FormularioCuenta } from './Formulario';

/** Depende de la sesión, así que no se puede cachear. */
export const dynamic = 'force-dynamic';

/*
 * Fuera de los buscadores: una pantalla de acceso no aporta nada indexada, y
 * sí invita a que la rastreen. El contenido que posiciona es la calculadora.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function Entrar({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!esLocale(locale)) notFound();

  if (await usuarioActual()) redirect(`/${locale}/mis-picks`);

  const t = TEXTOS_CUENTA[locale];
  const tm = TEXTOS_MARCO[locale];

  return (
    <>
      <Cabecera locale={locale} pagina="calculadora" textos={tm} />
      <main className="mx-auto w-full max-w-lg px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">{t.entrar.titulo}</h1>
        <p className="mt-4 leading-relaxed text-tenue">{t.entrar.entradilla}</p>
        <FormularioCuenta locale={locale} textos={t} />
      </main>
      <PiePagina locale={locale} textos={tm} urlRepoPicks={URL_REPO} />
    </>
  );
}
