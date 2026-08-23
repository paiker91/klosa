/**
 * Configuración de idiomas.
 *
 * pt-BR es el principal: el mercado objetivo es Brasil. Las rutas cambian por
 * idioma a propósito, porque una URL en el idioma del usuario posiciona mejor
 * que un prefijo sobre una ruta en inglés.
 */

export const LOCALES = ['pt', 'es', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_POR_DEFECTO: Locale = 'pt';

export function esLocale(valor: string): valor is Locale {
  return (LOCALES as readonly string[]).includes(valor);
}

/** Atributo `lang` del html. Distinto del prefijo de ruta a propósito. */
export const HTML_LANG: Record<Locale, string> = {
  pt: 'pt-BR',
  es: 'es-ES',
  en: 'en',
};

/** Código para hreflang. `pt-BR` y no `pt`: el producto apunta a Brasil, no a Portugal. */
export const HREFLANG: Record<Locale, string> = {
  pt: 'pt-BR',
  es: 'es',
  en: 'en',
};

/** Las dos páginas del sitio, con su ruta en cada idioma. */
export type Pagina = 'calculadora' | 'registro' | 'privacidad';

export const RUTAS: Record<Pagina, Record<Locale, string>> = {
  calculadora: { pt: 'calculadora-clv', es: 'calculadora-clv', en: 'clv-calculator' },
  registro: { pt: 'registro', es: 'registro', en: 'record' },
  privacidad: { pt: 'privacidade', es: 'privacidad', en: 'privacy' },
};

export const RUTA_CALCULADORA = RUTAS.calculadora;

export const url = (pagina: Pagina, locale: Locale): string =>
  `/${locale}/${RUTAS[pagina][locale]}`;

export const urlCalculadora = (locale: Locale): string => url('calculadora', locale);
export const urlRegistro = (locale: Locale): string => url('registro', locale);
export const urlPrivacidad = (locale: Locale): string => url('privacidad', locale);

/** Qué página corresponde a un slug en un idioma. `null` si no es ninguna. */
export function paginaDe(locale: Locale, slug: string): Pagina | null {
  for (const p of ['calculadora', 'registro', 'privacidad'] as const) {
    if (RUTAS[p][locale] === slug) return p;
  }
  return null;
}

/** Separador decimal esperado. Brasil y España escriben coma. */
export const SEPARADOR_DECIMAL: Record<Locale, string> = {
  pt: ',',
  es: ',',
  en: '.',
};
