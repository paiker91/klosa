import type { MetadataRoute } from 'next';
import { LOCALES, HREFLANG, url as urlDe, type Pagina } from '@/i18n/config';

const SITIO = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://klosa-five.vercel.app';
const PAGINAS: readonly Pagina[] = ['calculadora', 'registro', 'privacidad'];

/**
 * Una entrada por página e idioma, cada una declarando sus alternativas.
 *
 * Las versiones de una misma página en distintas lenguas no son contenido
 * duplicado, y el sitemap tiene que decirlo igual que lo dicen los `hreflang`
 * del HTML. Si los dos no coinciden, Google se queda con la peor lectura.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return PAGINAS.flatMap((pagina) => {
    const alternativas = Object.fromEntries(
      [...LOCALES.map((l): [string, string] => [HREFLANG[l], `${SITIO}${urlDe(pagina, l)}`]),
       ['x-default', `${SITIO}${urlDe(pagina, 'en')}`]],
    );
    return LOCALES.map((locale) => ({
      url: `${SITIO}${urlDe(pagina, locale)}`,
      lastModified: new Date(),
      changeFrequency: pagina === 'registro' ? ('daily' as const) : ('monthly' as const),
      /* Los tres idiomas pesan igual: la herramienta sirve en cualquier
         mercado y priorizar uno solo dejaba fuera a los demás. */
      priority: pagina === 'privacidad' ? 0.3 : 1,
      alternates: { languages: alternativas },
    }));
  });
}
