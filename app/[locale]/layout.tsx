import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
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
      <body className="flex min-h-dvh flex-col bg-fondo text-tinta antialiased">{children}</body>
    </html>
  );
}
