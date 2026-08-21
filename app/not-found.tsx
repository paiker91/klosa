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
          <p className="font-mono text-sm text-tenue">404</p>
          <h1 className="mt-2 text-2xl font-semibold">Página não encontrada</h1>
          <p className="mt-3 text-tenue">
            Esta página não existe. Talvez você queira a calculadora de CLV.
          </p>
          <Link
            href={urlCalculadora(LOCALE_POR_DEFECTO)}
            className="mt-6 inline-block w-fit rounded border border-acento px-4 py-2 font-medium text-acento hover:bg-superficie"
          >
            Ir para a calculadora
          </Link>
        </main>
      </body>
    </html>
  );
}
