import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  LOCALES,
  HREFLANG,
  RUTA_CALCULADORA,
  esLocale,
  urlCalculadora,
  type Locale,
} from '@/i18n/config';
import { TEXTOS } from '@/i18n/textos';
import { CalculadoraCLV } from '@/components/CalculadoraCLV';

const SITIO = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://klosa.app';

/** Solo existen tres páginas: una calculadora por idioma, con su ruta propia. */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale, slug: RUTA_CALCULADORA[locale] }));
}

function resolver(locale: string, slug: string): Locale {
  if (!esLocale(locale) || slug !== RUTA_CALCULADORA[locale]) notFound();
  return locale;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const idioma = resolver(locale, slug);
  const t = TEXTOS[idioma];

  return {
    /*
     * Sin metadataBase, Next resuelve las URL absolutas de Open Graph contra
     * localhost:3000 y la imagen compartida no carga en producción. Como el
     * plan de captación es que el enlace circule por Telegram y Reddit, ese
     * despiste se lleva por delante el canal entero sin dar ningún síntoma.
     */
    metadataBase: new URL(SITIO),
    title: t.meta.titulo,
    description: t.meta.descripcion,
    alternates: {
      canonical: `${SITIO}${urlCalculadora(idioma)}`,
      languages: Object.fromEntries(
        LOCALES.map((l) => [HREFLANG[l], `${SITIO}${urlCalculadora(l)}`]),
      ),
    },
    // Explícito a propósito: el fallo silencioso que se quiere evitar es justo lo contrario.
    robots: { index: true, follow: true },
    openGraph: {
      title: t.meta.titulo,
      description: t.meta.descripcion,
      url: `${SITIO}${urlCalculadora(idioma)}`,
      locale: HREFLANG[idioma],
      type: 'website',
    },
  };
}

export default async function PaginaCalculadora({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const idioma = resolver(locale, slug);
  const t = TEXTOS[idioma];

  return (
    <main className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
      <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{t.h1}</h1>
      <p className="mt-4 text-tenue">{t.entradilla}</p>

      <CalculadoraCLV locale={idioma} textos={t} />

      {/* Contenido indexable: la mitad del motivo por el que existe la página. */}
      <div className="mt-16 space-y-10">
        {t.contenido.map((seccion) => (
          <section key={seccion.titulo}>
            <h2 className="text-xl font-semibold text-balance">{seccion.titulo}</h2>
            {seccion.parrafos.map((parrafo) => (
              <p key={parrafo.slice(0, 40)} className="mt-3 text-tenue">
                {parrafo}
              </p>
            ))}
          </section>
        ))}
      </div>

      {/*
        Los enlaces llevan alto y ancho mínimos a propósito: en móvil un objetivo
        de 17 px es imposible de acertar, y la cláusula 9.2.5.8 pide 24 px.
      */}
      <nav aria-label="Idiomas" className="mt-16 border-t border-borde pt-4">
        <ul className="flex gap-2 font-mono text-sm">
          {LOCALES.map((l) => (
            <li key={l}>
              {l === idioma ? (
                <span
                  aria-current="page"
                  className="flex min-h-11 min-w-11 items-center justify-center px-3 text-tenue"
                >
                  {HREFLANG[l]}
                </span>
              ) : (
                <Link
                  href={urlCalculadora(l)}
                  className="flex min-h-11 min-w-11 items-center justify-center px-3 text-acento hover:underline"
                >
                  {HREFLANG[l]}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
