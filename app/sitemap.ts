import type { MetadataRoute } from 'next';
import { LOCALES, HREFLANG, urlCalculadora } from '@/i18n/config';

const SITIO = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://klosa-five.vercel.app';

/**
 * Una entrada por idioma, cada una declarando sus alternativas.
 *
 * Las tres son la misma página en distintas lenguas, no contenido duplicado, y
 * el sitemap tiene que decirlo igual que lo dicen los `hreflang` del HTML. Si
 * los dos no coinciden, Google se queda con la peor interpretación.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const alternativas = Object.fromEntries(
    LOCALES.map((l) => [HREFLANG[l], `${SITIO}${urlCalculadora(l)}`]),
  );

  return LOCALES.map((locale) => ({
    url: `${SITIO}${urlCalculadora(locale)}`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: locale === 'pt' ? 1 : 0.8,
    alternates: { languages: alternativas },
  }));
}
