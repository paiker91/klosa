import type { MetadataRoute } from 'next';

const SITIO = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://klosa-five.vercel.app';

/**
 * Permiso explícito de rastreo.
 *
 * No hace falta técnicamente —sin robots.txt se rastrea todo igual— pero aquí
 * cumple una función concreta: dejar por escrito y verificable que este sitio
 * quiere ser indexado. Es una defensa más contra el fallo que arrastra este
 * equipo, donde un `noindex` heredado de preview bloqueó producción durante
 * meses sin dar ningún síntoma.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${SITIO}/sitemap.xml`,
    host: SITIO,
  };
}
