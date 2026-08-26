import { Geist, Geist_Mono } from 'next/font/google';

/**
 * Tipografía propia, autoalojada.
 *
 * El sitio iba entero en la fuente del sistema, y esa es la marca de agua de
 * un proyecto sin terminar: cada visitante la ve distinta y ninguno la ve
 * elegida. Geist está diseñada para interfaces de datos —cifras tabulares de
 * verdad, buena a tamaños pequeños— y su mono empareja con ella, que es
 * exactamente el par que este sitio necesita: texto que explica y números que
 * se comparan en columna.
 *
 * OJO con la regla de «sin fuentes remotas» de la hoja de estilos: sigue
 * viva. `next/font` descarga los ficheros EN EL BUILD y los sirve desde
 * nuestro propio dominio con caché inmutable; en producción no sale ni una
 * petición hacia Google. Lo que la regla protegía era la primera pintura sin
 * orígenes externos, y eso se conserva — `display: swap` pinta con la fuente
 * de respaldo ajustada mientras llega la buena, así que tampoco bloquea.
 *
 * Solo el subconjunto latino: cubre el portugués (ã, õ, ç), el español (ñ) y
 * el inglés enteros. Cargar más alfabetos sería peso muerto.
 */
export const sans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  display: 'swap',
});

export const mono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});

/** Para el `<html>` de cada layout que emite documento propio. */
export const claseFuentes = `${sans.variable} ${mono.variable}`;
