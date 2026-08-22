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
  urlCalculadora,
  urlRegistro,
  type Locale,
  type Pagina,
} from '@/i18n/config';
import { TEXTOS } from '@/i18n/textos';
import { TEXTOS_REGISTRO } from '@/i18n/textos-registro';
import { CalculadoraCLV } from '@/components/CalculadoraCLV';
import { VistaRegistro } from '@/components/VistaRegistro';
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
    (['calculadora', 'registro'] as const).map((p) => ({ locale, slug: RUTAS[p][locale] })),
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
  const meta = pagina === 'calculadora' ? TEXTOS[idioma].meta : TEXTOS_REGISTRO[idioma].meta;

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

  return (
    <main className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
      <nav aria-label="Secciones" className="mb-8 flex gap-5 font-mono text-sm">
        <Link
          href={urlCalculadora(idioma)}
          className={pagina === 'calculadora' ? 'text-tinta' : 'text-acento hover:underline'}
          aria-current={pagina === 'calculadora' ? 'page' : undefined}
        >
          {t.h1}
        </Link>
        <Link
          href={urlRegistro(idioma)}
          className={pagina === 'registro' ? 'text-tinta' : 'text-acento hover:underline'}
          aria-current={pagina === 'registro' ? 'page' : undefined}
        >
          {tr.h1}
        </Link>
      </nav>

      {pagina === 'calculadora' ? (
        <>
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
        </>
      ) : (
        <VistaRegistro
          locale={idioma}
          textos={tr}
          registro={await registroONull()}
          urlRepo={URL_REPO}
        />
      )}

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
                  href={urlDe(pagina, l)}
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
