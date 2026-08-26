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
import { DEPORTES, MERCADOS } from '@/lib/cuotas/dominio';
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
      languages: {
        ...Object.fromEntries(LOCALES.map((l) => [HREFLANG[l], `${SITIO}${urlDe(pagina, l)}`])),
        /*
         * Quien no encaje en ninguno de los tres idiomas cae en el inglés.
         * Sin x-default, Google elige él la versión para el resto del mundo —
         * y con el histórico del sitio elegiría la portuguesa, que era la
         * principal cuando el proyecto miraba solo a Brasil.
         */
        'x-default': `${SITIO}${urlDe(pagina, 'en')}`,
      },
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

      <main id="contenido" className="mx-auto max-w-6xl px-4 pt-10 pb-4 sm:px-6 sm:pt-14">
        {pagina === 'calculadora' ? (
          <>
            {/*
              Datos estructurados. Le dicen a Google que esto es una
              herramienta gratuita, no un artículo — con suerte, el resultado
              sale con más señas. Todo lo declarado es verificable en la
              propia página; schema.org exige `price` para que la ficha sea
              válida y aquí ese cero es verdad.
            */}
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: JSON.stringify({
                  '@context': 'https://schema.org',
                  '@type': 'WebApplication',
                  name: 'Klosa',
                  url: `https://klosa-five.vercel.app${urlDe(pagina, idioma)}`,
                  description: t.meta.descripcion,
                  applicationCategory: 'UtilitiesApplication',
                  operatingSystem: 'Web',
                  inLanguage: HREFLANG[idioma],
                  offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
                }),
              }}
            />
            {/*
              El titular y la calculadora, sin nada en medio. La página se abre
              desde un enlace de Telegram o Reddit: si lo primero que se ve es
              un bloque de texto, el visitante se va antes de usar la herramienta.
            */}
            <section className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-14">
              <div className="max-w-3xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-borde bg-superficie-alta px-3 py-1 texto-ayuda">
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
                  /*
                    Botón sólido, no un recuadro con el acento al 10 %. Es la
                    única llamada a la acción de la página y sobre papel un
                    tinte pálido no se lee como algo pulsable: se lee como otro
                    recuadro de aviso.
                  */
                  className="group inline-flex min-h-11 items-center gap-2 rounded-xl bg-acento px-5 text-sm font-semibold text-superficie-alta shadow-[0_6px_16px_-8px_var(--color-acento)] transition-all hover:brightness-110 hover:shadow-[0_10px_22px_-8px_var(--color-acento)]"
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
              {/*
                Franja de datos. Es el patrón de «prueba social» de cualquier
                landing, pero sin inventar nada: las tres cifras salen de
                constantes del código (DEPORTES.length, MERCADOS.length,
                LOCALES.length) y se actualizan solas si aquello cambia. «Miles
                de usuarios» no hay, así que no se dice.
              */}
              <dl className="mt-9 flex flex-wrap gap-x-8 gap-y-3">
                {(
                  [
                    [DEPORTES.length, tm.hero.datos.competiciones],
                    [MERCADOS.length, tm.hero.datos.mercados],
                    [LOCALES.length, tm.hero.datos.idiomas],
                  ] as const
                ).map(([cifra, etiqueta]) => (
                  <div key={etiqueta} className="flex items-baseline gap-2">
                    <dt className="sr-only">{etiqueta}</dt>
                    <dd className="cifra text-2xl font-bold text-tinta">{cifra}</dd>
                    <dd className="etiqueta-dato">{etiqueta}</dd>
                  </div>
                ))}
              </dl>
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

            {/*
              Banda de cierre. Una landing que se acaba en la letra pequeña
              deja al lector sin siguiente paso; esta lo manda al registro, que
              es donde el producto se juega la credibilidad. El texto promete
              exactamente lo que la herramienta hace — la misma vara para
              nosotros que para él — y nada más.
            */}
            <section className="tarjeta relative mt-16 overflow-hidden p-7 text-center sm:p-10">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_100%_at_50%_0%,rgb(68_87_216/0.08),transparent_70%)]"
              />
              <h2 className="titular-degradado mx-auto max-w-xl text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                {tm.bandaCierre.titulo}
              </h2>
              <p className="mx-auto mt-3 max-w-xl leading-relaxed text-tenue">
                {tm.bandaCierre.texto}
              </p>
              <p className="mt-6">
                <Link
                  href={urlRegistro(idioma)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-acento px-5 text-sm font-semibold text-superficie-alta shadow-[0_6px_16px_-8px_var(--color-acento)] transition-all hover:brightness-110"
                >
                  {tm.bandaCierre.boton}
                  <span aria-hidden="true">→</span>
                </Link>
              </p>
            </section>
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
