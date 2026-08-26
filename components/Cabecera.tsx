import Link from 'next/link';
import {
  HREFLANG,
  LOCALES,
  url as urlDe,
  urlCalculadora,
  urlRegistro,
  type Locale,
  type Pagina,
} from '@/i18n/config';
import type { TextosMarco } from '@/i18n/textos-marco';
import { Marca } from './Marca';

/**
 * Cabecera fija. Sin JavaScript: son tres destinos y tres idiomas, así que un
 * menú desplegable sería complejidad sin ninguna ganancia — y en móvil un
 * desplegable esconde justo lo que hay que enseñar.
 *
 * En móvil va en dos filas. Con la marca, tres enlaces y el selector de idioma
 * en una sola línea no se cabe en 375 px: o se desborda, o se encoge todo
 * hasta que nada se puede pulsar. Dos filas cuestan 40 px y lo dejan usable.
 */
export function Cabecera({
  locale,
  pagina,
  textos: t,
}: {
  locale: Locale;
  pagina: Pagina;
  textos: TextosMarco;
}) {
  const enlace = (activo: boolean, href: string, etiqueta: string) => (
    <Link
      href={href}
      aria-current={activo ? 'page' : undefined}
      className={`relative flex min-h-9 items-center rounded-lg px-3 text-sm font-medium transition-colors ${
        activo
          ? /*
             * La página activa lleva el acento, no otro gris. Antes se marcaba
             * solo con un fondo un punto más claro y en una cabecera de tres
             * enlaces eso no se ve: había que fijarse para saber dónde estabas.
             */
            'bg-acento/10 text-acento shadow-[inset_0_0_0_1px_var(--color-acento)]/35'
          : 'text-tenue hover:bg-superficie-alta/60 hover:text-tinta'
      }`}
    >
      {etiqueta}
    </Link>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-borde/80 bg-fondo/80 shadow-[0_1px_12px_-6px_rgb(16_20_44/0.35)] backdrop-blur-xl">
      {/*
        Primer elemento enfocable de la página. Invisible hasta que recibe el
        foco: quien navega con teclado o lector de pantalla se ahorra tabular
        por toda la cabecera en cada página, y nadie más lo ve.
      */}
      <a
        href="#contenido"
        className="sr-only rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-superficie-alta focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
      >
        {t.saltar}
      </a>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:h-16 sm:flex-nowrap sm:py-0 sm:px-6">
        <Link
          href={urlCalculadora(locale)}
          className="shrink-0 rounded-lg text-tinta"
          aria-label={t.marca.nombre}
        >
          <Marca nombre={t.marca.nombre} reclamo={t.marca.reclamo} />
        </Link>

        {/*
          Los objetivos llegan a 36 px de alto y 40 de ancho. El selector de
          idioma anterior eran tres siglas de 17 px: en un móvil es imposible
          acertar, y la mayoría del tráfico previsto es móvil.
        */}
        <nav
          aria-label={t.nav.idioma}
          className="ml-auto flex shrink-0 items-center gap-0.5 rounded-lg border border-borde bg-superficie p-0.5 sm:order-last"
        >
          {LOCALES.map((l) =>
            l === locale ? (
              <span
                key={l}
                aria-current="page"
                className="flex h-8 min-w-10 items-center justify-center rounded-[0.4rem] bg-acento/12 px-2 font-mono text-xs font-semibold text-acento shadow-[inset_0_0_0_1px_var(--color-acento)]"
              >
                {l.toUpperCase()}
              </span>
            ) : (
              <Link
                key={l}
                href={urlDe(pagina, l)}
                hrefLang={HREFLANG[l]}
                className="flex h-8 min-w-10 items-center justify-center rounded-[0.4rem] px-2 font-mono text-xs font-medium text-apagado transition-colors hover:bg-superficie-alta hover:text-tinta"
              >
                {l.toUpperCase()}
              </Link>
            ),
          )}
        </nav>

        <nav
          aria-label={t.nav.menu}
          className="-mx-1 flex w-full items-center gap-1 overflow-x-auto sm:mx-0 sm:ml-2 sm:w-auto sm:overflow-visible"
        >
          {enlace(pagina === 'calculadora', urlCalculadora(locale), t.nav.calculadora)}
          {enlace(pagina === 'registro', urlRegistro(locale), t.nav.registro)}
          {/*
            La cuenta siempre apunta a /mis-picks. Si no hay sesión, esa página
            redirige a la de entrar: así el enlace es el mismo para todo el
            mundo y la cabecera no depende de quién la pide, que es lo que
            permite seguir cacheando las páginas públicas.
          */}
          {enlace(false, `/${locale}/mis-picks`, t.nav.cuenta)}
        </nav>
      </div>
    </header>
  );
}
