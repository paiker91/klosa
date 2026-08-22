/**
 * Nombres de lado para enseñar.
 *
 * El proveedor llama `Draw` al empate y ese es el valor que se guarda en el
 * registro: cambiarlo al escribir rompería el emparejamiento con lo que
 * devuelve la API y, en los picks, el sello de contenido. Así que se traduce
 * solo al pintarlo, nunca al almacenarlo.
 */
import { EMPATE } from '@/lib/cuotas/dominio';
import type { Locale } from './config';

const NOMBRE_EMPATE: Record<Locale, string> = {
  pt: 'Empate',
  es: 'Empate',
  en: 'Draw',
};

export const etiquetaLado = (lado: string, locale: Locale): string =>
  lado.trim().toLowerCase() === EMPATE.toLowerCase() ? NOMBRE_EMPATE[locale] : lado;
