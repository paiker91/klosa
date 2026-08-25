import Link from 'next/link';
import { LOCALE_POR_DEFECTO, HTML_LANG, urlCalculadora } from '@/i18n/config';
import './globals.css';

/**
 * 404 global. Emite documento completo porque el layout raíz es de paso y no
 * lo hace: fuera de `[locale]` no hay idioma que aplicar.
 */
export default function NoEncontrado() {
  return (
    <html lang={HTML_LANG[LOCALE_POR_DEFECTO]}>
      <body className="min-h-dvh bg-fondo text-tinta antialiased">
        <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-5 py-16">
          <p className="cifra text-sm text-apagado">404</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Página não encontrada</h1>
          <p className="mt-3 text-tenue">
            Esta página não existe. Talvez você queira a calculadora de CLV.
          </p>
          <Link
            href={urlCalculadora(LOCALE_POR_DEFECTO)}
            className="mt-7 inline-flex min-h-11 w-fit items-center rounded-xl bg-acento px-5 text-sm font-semibold text-superficie-alta shadow-[0_4px_12px_-6px_var(--color-acento)] transition-all hover:brightness-110"
          >
            Ir para a calculadora
          </Link>
        </main>
      </body>
    </html>
  );
}
