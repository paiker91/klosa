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
import { FiguraCLV } from '@/components/FiguraCLV';
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
            <section className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-14">
              <div className="max-w-3xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-borde bg-superficie/80 px-3 py-1 text-xs text-tenue backdrop-blur-sm">
                {/* El punto late: sugiere que hay datos vivos detrás, que los hay. */}
                <span aria-hidden="true" className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-dato opacity-70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-dato" />
                </span>
                {tm.hero.distintivo}
              </p>
              <h1 className="titular-degradado mt-5 text-[2.5rem] leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl">
                {t.h1}
              </h1>
              <p className="mt-5 text-base leading-relaxed text-tenue sm:text-lg">{t.entradilla}</p>
              <p className="mt-7">
                <Link
                  href={urlRegistro(idioma)}
                  className="group inline-flex min-h-11 items-center gap-2 rounded-xl border border-acento/30 bg-acento/10 px-4.5 text-sm font-semibold text-tinta transition-all hover:border-acento/60 hover:bg-acento/15"
                >
                  {tm.hero.verRegistro}
                  <span
                    aria-hidden="true"
                    className="transition-transform group-hover:translate-x-0.5"
                  >
                    →
                  </span>
                </Link>
              </p>
              </div>

              {/*
                También en móvil, aunque el comentario de arriba diga que entre
                el titular y la calculadora no va nada. La regla era contra los
                MUROS DE TEXTO, y una figura no lo es: se entiende de un vistazo
                y explica para qué sirve la herramienta que viene justo debajo.
                En pantalla estrecha va más baja para no empujar la calculadora
                fuera del primer pantallazo.
              */}
              <div className="mx-auto w-full max-w-sm lg:max-w-none">
                <FiguraCLV textos={tm} />
              </div>
            </section>

            <CalculadoraCLV locale={idioma} textos={t} marco={tm} />

            {/*
              Contenido indexable: la mitad del motivo por el que existe la
              página. Era una columna de párrafos con una raya al lado y se leía
              como la letra pequeña; en tarjetas numeradas cada idea tiene
              principio y final, que es lo que hace que alguien empiece a leer.

              Dos columnas desde lg. Con una sola, las líneas de 3xl de ancho
              en un monitor son incómodas de seguir.
            */}
            <div className="mt-24 grid gap-5 lg:grid-cols-2">
              {t.contenido.map((seccion, i) => (
                <section
                  key={seccion.titulo}
                  className="tarjeta group p-6 transition-colors hover:border-borde-fuerte sm:p-7"
                >
                  <div className="flex items-baseline gap-3.5">
                    <span
                      aria-hidden="true"
                      className="cifra shrink-0 text-sm font-semibold text-acento/70 transition-colors group-hover:text-acento"
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <h2 className="titular-degradado text-xl font-semibold tracking-tight text-balance sm:text-2xl">
                      {seccion.titulo}
                    </h2>
                  </div>
                  {seccion.parrafos.map((parrafo) => (
                    <p
                      key={parrafo.slice(0, 40)}
                      className="mt-3.5 pl-[2.1rem] text-sm leading-relaxed text-tenue"
                    >
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
