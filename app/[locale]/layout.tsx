import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { Analytics } from '@vercel/analytics/next';
import { LOCALES, HTML_LANG, esLocale } from '@/i18n/config';
import '../globals.css';
import { claseFuentes } from '../fuentes';
import { ScriptTema } from '@/components/Tema';

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
    <html lang={HTML_LANG[locale]} className={claseFuentes}>
      <head>
        {/*
          Tiñe la barra del navegador en móvil. Sin esto, Chrome de Android
          pinta la suya oscura por defecto y quedaba una franja negra sobre una
          página clara, que es exactamente el remiendo que se ve mal.
        */}
        <meta name="theme-color" content="#e9edf7" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#151b38" />
        <ScriptTema />
      </head>
      <body className="flex min-h-dvh flex-col bg-fondo text-tinta">
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
