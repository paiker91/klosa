/**
 * Etiquetas de los grupos del desplegable de competiciones.
 *
 * Las competiciones son nombres propios y no se traducen; los grupos sí,
 * porque «Selecciones» o «Resto de Europa» son descripción, no marca. El
 * grupo de tenis va aquí aunque los circuitos vivan en lib/cuotas/tenis.ts:
 * la etiqueta es cosa de la interfaz, no del dominio.
 */
import type { ClaveGrupo } from '@/lib/cuotas/dominio';
import type { Locale } from './config';

type Etiquetas = Record<ClaveGrupo | 'tenis', string>;

export const NOMBRE_GRUPO: Record<Locale, Etiquetas> = {
  pt: {
    copasEuropa: 'Copas europeias',
    inglaterra: 'Inglaterra',
    espana: 'Espanha',
    italia: 'Itália',
    alemania: 'Alemanha',
    francia: 'França',
    restoEuropa: 'Resto da Europa',
    america: 'América',
    selecciones: 'Seleções',
    baloncesto: 'Basquete',
    beisbol: 'Beisebol',
    tenis: 'Tênis',
  },
  es: {
    copasEuropa: 'Copas europeas',
    inglaterra: 'Inglaterra',
    espana: 'España',
    italia: 'Italia',
    alemania: 'Alemania',
    francia: 'Francia',
    restoEuropa: 'Resto de Europa',
    america: 'América',
    selecciones: 'Selecciones',
    baloncesto: 'Baloncesto',
    beisbol: 'Béisbol',
    tenis: 'Tenis',
  },
  en: {
    copasEuropa: 'European cups',
    inglaterra: 'England',
    espana: 'Spain',
    italia: 'Italy',
    alemania: 'Germany',
    francia: 'France',
    restoEuropa: 'Rest of Europe',
    america: 'Americas',
    selecciones: 'National teams',
    baloncesto: 'Basketball',
    beisbol: 'Baseball',
    tenis: 'Tennis',
  },
};
