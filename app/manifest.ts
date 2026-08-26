import type { MetadataRoute } from 'next';

/**
 * Manifiesto de aplicación web.
 *
 * No aspira a PWA: existe para que «añadir a pantalla de inicio» en un móvil
 * ponga el nombre y los colores correctos en vez de un pantallazo genérico.
 * El público objetivo entra desde Telegram en el teléfono, así que este
 * camino se usa más de lo que parece.
 *
 * En un solo idioma a propósito: el manifiesto es único por dominio y el
 * nombre de la marca no se traduce.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Klosa',
    short_name: 'Klosa',
    description: 'CLV: the metric that separates real edge from luck.',
    start_url: '/',
    display: 'standalone',
    background_color: '#e9edf7',
    theme_color: '#e9edf7',
    icons: [{ src: '/apple-icon', sizes: '180x180', type: 'image/png' }],
  };
}
