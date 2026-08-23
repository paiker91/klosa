import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  LOCALES,
  HREFLANG,
  RUTAS,
  esLocale,
  paginaDe,
  url as urlDe,
  urlRegistro,
  type Locale,
  type Pagina,
} from '@/i18n/config';
import { TEXTOS } from '@/i18n/textos';
import { TEXTOS_REGISTRO } from '@/i18n/textos-registro';
import { TEXTOS_MARCO } from '@/i18n/textos-marco';
import { TEXTOS_PRIVACIDAD } from '@/i18n/textos-privacidad';
import { VistaPrivacidad } from '@/components/VistaPrivacidad';
import { CalculadoraCLV } from '@/components/CalculadoraCLV';
import { VistaRegistro } from '@/components/VistaRegistro';
import { Cabecera } from '@/components/Cabecera';
import { PiePagina } from '@/components/PiePagina';
import { leerRegistroPublico, URL_REPO, type RegistroPublico } from '@/lib/picks/remoto';

const SITIO = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://klosa-five.vercel.app';

/**
 * Cada 5 minutos se vuelve a leer el repositorio, así que un pick nuevo
 * aparece solo sin necesidad de desplegar.
 *
 * Tiene que ser un literal: Next analiza esta exportación estáticamente y
 * rechaza el build si es un valor importado.
 */
export const revalidate = 300;

/** Dos páginas por idioma, cada una con su ruta propia. */
export function generateStaticParams() {
  return LOCALES.flatMap((locale) =>
    (['calculadora', 'registro', 'privacidad'] as const).map((p) => ({
      locale,
      slug: RUTAS[p][locale],
    })),
  );
}

/**
 * Devuelve `null` si el registro no se pudo leer, en vez de tumbar la página.
 *
 * La distinción importa: la vista enseña un aviso claro de "no se pudo leer",
 * que no es lo mismo que "no hay picks". Confundirlos convertiría una caída
 * momentánea de GitHub en una afirmación falsa sobre el registro.
 */
async function registroONull(): Promise<RegistroPublico | null> {
  try {
    return await leerRegistroPublico();
  } catch {
    return null;
  }
}

function resolver(locale: string, slug: string): { idioma: Locale; pagina: Pagina } {
  if (!esLocale(locale)) notFound();
  const pagina = paginaDe(locale, slug);
  if (pagina === null) notFound();
  return { idioma: locale, pagina };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const { idioma, pagina } = resolver(locale, slug);
  const meta =
    pagina === 'calculadora'
      ? TEXTOS[idioma].meta
      : pagina === 'registro'
        ? TEXTOS_REGISTRO[idioma].meta
        : TEXTOS_PRIVACIDAD[idioma].meta;

  return {
    /*
     * Sin metadataBase, Next resuelve las URL absolutas de Open Graph contra
     * localhost:3000 y la imagen compartida no carga en producción. Como el
     * plan de captación es que el enlace circule por Telegram y Reddit, ese
     * despiste se lleva por delante el canal entero sin dar ningún síntoma.
     */
    metadataBase: new URL(SITIO),
    title: meta.titulo,
    description: meta.descripcion,
    alternates: {
      canonical: `${SITIO}${urlDe(pagina, idioma)}`,
      languages: Object.fromEntries(
        LOCALES.map((l) => [HREFLANG[l], `${SITIO}${urlDe(pagina, l)}`]),
      ),
    },
    // Explícito a propósito: el fallo silencioso que se quiere evitar es justo lo contrario.
    robots: { index: true, follow: true },
    openGraph: {
      title: meta.titulo,
      description: meta.descripcion,
      url: `${SITIO}${urlDe(pagina, idioma)}`,
      locale: HREFLANG[idioma],
      type: 'website',
    },
  };
}

export default async function Pagina({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const { idioma, pagina } = resolver(locale, slug);
  const t = TEXTOS[idioma];
  const tr = TEXTOS_REGISTRO[idioma];
  const tm = TEXTOS_MARCO[idioma];

  return (
    <>
      <Cabecera locale={idioma} pagina={pagina} textos={tm} />

      <main className="mx-auto max-w-6xl px-4 pt-10 pb-4 sm:px-6 sm:pt-14">
        {pagina === 'calculadora' ? (
          <>
            {/*
              El titular y la calculadora, sin nada en medio. La página se abre
              desde un enlace de Telegram o Reddit: si lo primero que se ve es
              un bloque de texto, el visitante se va antes de usar la herramienta.
            */}
            <section className="max-w-3xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-borde bg-superficie px-3 py-1 text-xs text-tenue">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-dato" />
                {tm.hero.distintivo}
              </p>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                {t.h1}
              </h1>
              <p className="mt-4 text-base leading-relaxed text-tenue sm:text-lg">{t.entradilla}</p>
              <p className="mt-6">
                <Link
                  href={urlRegistro(idioma)}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-borde bg-superficie px-4 text-sm font-medium text-tinta transition-colors hover:border-borde-fuerte"
                >
                  {tm.hero.verRegistro}
                  <span aria-hidden="true">→</span>
                </Link>
              </p>
            </section>

            <CalculadoraCLV locale={idioma} textos={t} marco={tm} />

            {/* Contenido indexable: la mitad del motivo por el que existe la página. */}
            <div className="mt-20 max-w-3xl space-y-12">
              {t.contenido.map((seccion) => (
                <section key={seccion.titulo}>
                  <h2 className="text-2xl font-semibold tracking-tight text-balance">
                    {seccion.titulo}
                  </h2>
                  {seccion.parrafos.map((parrafo) => (
                    <p key={parrafo.slice(0, 40)} className="mt-3.5 leading-relaxed text-tenue">
                      {parrafo}
                    </p>
                  ))}
                </section>
              ))}
            </div>
          </>
        ) : pagina === 'registro' ? (
          <VistaRegistro
            locale={idioma}
            textos={tr}
            marco={tm}
            registro={await registroONull()}
            urlRepo={URL_REPO}
          />
        ) : (
          <VistaPrivacidad textos={TEXTOS_PRIVACIDAD[idioma]} />
        )}
      </main>

      <PiePagina locale={idioma} textos={tm} urlRepoPicks={URL_REPO} />
    </>
  );
}
