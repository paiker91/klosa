import type { NextConfig } from 'next';

/**
 * Deliberadamente NO se emite ninguna cabecera `X-Robots-Tag` desde aquí.
 *
 * El gotcha heredado era un `noindex` de preview colado en producción. La
 * tentación es poner una cabecera propia que fuerce `index, follow`, pero
 * `headers()` se compila dentro de `routes-manifest.json` durante el build:
 * el valor queda congelado con las variables de entorno del build, no del
 * arranque. Una condición mal evaluada ahí hornea un `noindex` en producción
 * sin dar ningún síntoma — que es precisamente el fallo que se quiere evitar.
 *
 * En su lugar:
 *   1. Vercel ya marca `noindex` en los despliegues de preview por su cuenta.
 *   2. Cada página declara `robots: { index: true, follow: true }` en su metadata.
 *   3. `npm run comprobar-indexacion -- <url>` verifica el despliegue real,
 *      que es la única comprobación que vale.
 */
const nextConfig: NextConfig = {
  poweredByHeader: false,
};

export default nextConfig;
