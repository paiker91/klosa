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

/** Ruta de la calculadora en cada idioma. */
export const RUTA_CALCULADORA: Record<Locale, string> = {
  pt: 'calculadora-clv',
  es: 'calculadora-clv',
  en: 'clv-calculator',
};

export const urlCalculadora = (locale: Locale): string => `/${locale}/${RUTA_CALCULADORA[locale]}`;

/** Separador decimal esperado. Brasil y España escriben coma. */
export const SEPARADOR_DECIMAL: Record<Locale, string> = {
  pt: ',',
  es: ',',
  en: '.',
};
