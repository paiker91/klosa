import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { Analytics } from '@vercel/analytics/next';
import { LOCALES, HTML_LANG, esLocale } from '@/i18n/config';
import '../globals.css';

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function LayoutIdioma({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!esLocale(locale)) notFound();

  return (
    <html lang={HTML_LANG[locale]}>
      <body className="flex min-h-dvh flex-col bg-fondo text-tinta antialiased">
        {children}
        {/*
          Contador de visitas, solo en las páginas públicas.

          No pone cookies ni sigue a nadie entre sitios: cuenta páginas vistas y
          poco más. Está aquí y no en el panel ni en la cuenta porque medir a
          quien ya entró no aporta nada y sí añade una llamada de red.

          Va declarado en la política de privacidad. Un contador que no se
          menciona es exactamente el tipo de cosa que este producto le reprocha
          a los demás, por muy inofensivo que sea.
        */}
        <Analytics />
      </body>
    </html>
  );
}
