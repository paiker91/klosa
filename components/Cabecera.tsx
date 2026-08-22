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
 * Cabecera fija. Sin JavaScript: son dos secciones y tres idiomas, así que un
 * menú desplegable sería complejidad sin ninguna ganancia — y en móvil un
 * desplegable esconde justo lo que hay que enseñar.
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
  const enlace = (destino: Pagina, href: string, etiqueta: string) => {
    const activo = pagina === destino;
    return (
      <Link
        href={href}
        aria-current={activo ? 'page' : undefined}
        className={`flex min-h-9 items-center rounded-lg px-3 text-sm font-medium transition-colors ${
          activo
            ? 'bg-superficie-alta text-tinta shadow-[inset_0_0_0_1px_var(--color-borde)]'
            : 'text-tenue hover:text-tinta'
        }`}
      >
        {etiqueta}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-30 border-b border-borde/80 bg-fondo/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link
          href={urlCalculadora(locale)}
          className="shrink-0 rounded-lg text-tinta"
          aria-label={t.marca.nombre}
        >
          <Marca nombre={t.marca.nombre} reclamo={t.marca.reclamo} />
        </Link>

        <nav aria-label={t.nav.menu} className="ml-2 flex items-center gap-1">
          {enlace('calculadora', urlCalculadora(locale), t.nav.calculadora)}
          {enlace('registro', urlRegistro(locale), t.nav.registro)}
        </nav>

        {/*
          Los objetivos llegan a 36 px de alto y 40 de ancho. El selector de
          idioma anterior eran tres siglas de 17 px: en un móvil es imposible
          acertar, y la mayoría del tráfico previsto es móvil.
        */}
        <nav
          aria-label={t.nav.idioma}
          className="ml-auto flex items-center gap-0.5 rounded-lg border border-borde bg-superficie p-0.5"
        >
          {LOCALES.map((l) =>
            l === locale ? (
              <span
                key={l}
                aria-current="page"
                className="flex h-8 min-w-10 items-center justify-center rounded-[0.4rem] bg-superficie-alta px-2 font-mono text-xs font-semibold text-tinta shadow-[inset_0_0_0_1px_var(--color-borde-fuerte)]"
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
      </div>
    </header>
  );
}
