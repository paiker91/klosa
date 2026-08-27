import { separarLinea } from './handicap';

/**
 * Precio de una línea que no existe, deducido de las que sí existen.
 *
 * El problema: un pick a «Real Madrid −1.75» cuyo mercado cerró en −2, −2.25
 * y −2.5. La línea apostada desapareció porque el mercado se movió, y sin
 * ella el pick no tiene CLV medible.
 *
 * Dos decisiones que sostienen que esto no sea inventar un número:
 *
 *   1. Se interpola en PROBABILIDAD, no en cuota. La cuota es 1/p y no es
 *      lineal: interpolarla directamente curva el resultado hacia arriba y
 *      siempre en la misma dirección. La probabilidad implícita sí se mueve
 *      de forma casi lineal en tramos cortos de línea, que es todo lo que se
 *      recorre aquí. El margen va dentro de 1/p y se conserva, que es lo que
 *      se quiere: el precio deducido tiene la misma comisión que los reales
 *      con los que se compara.
 *
 *   2. Se distingue INTERPOLAR de EXTRAPOLAR y no se disimula. Interpolar
 *      entre dos líneas conocidas es sólido; extrapolar fuera del rango se
 *      apoya en que la pendiente siga valiendo un poco más allá, y eso es una
 *      suposición. Sale marcado como tal y con un tope: media línea, no más.
 *
 * Todo lo que devuelve viene de precios que una casa colgó de verdad, y las
 * vecinas usadas se guardan con el resultado para que la cuenta se pueda
 * rehacer desde fuera.
 */

export type MetodoPrecio = 'exacto' | 'interpolado' | 'extrapolado';

export interface PrecioDeducido {
  cuota: number;
  metodo: MetodoPrecio;
  /** Las líneas reales en las que se apoya. Vacío si fue exacto. */
  vecinas: { linea: number; cuota: number }[];
}

/** Hasta dónde se admite estirar la pendiente más allá del rango conocido. */
export const MAXIMA_EXTRAPOLACION = 0.5;

/**
 * Escalera de un lado: cada línea con su precio de consenso.
 *
 * Se agrupa por línea y se toma la MEDIANA de las casas que la cuelgan, no la
 * mejor. La mejor de veinte casas es un valor atípico por construcción, y
 * meterla aquí sesgaría el precio deducido a favor de quien apostó.
 */
export function escaleraDe(
  lados: readonly { etiqueta: string; cuota: number }[],
  equipo: string,
): { linea: number; cuota: number }[] {
  const bajo = equipo.trim().toLowerCase();
  const porLinea = new Map<number, number[]>();

  for (const l of lados) {
    const partes = separarLinea(l.etiqueta);
    if (partes === null || partes.equipo.toLowerCase() !== bajo) continue;
    if (!Number.isFinite(l.cuota) || l.cuota <= 1) continue;
    porLinea.set(partes.linea, [...(porLinea.get(partes.linea) ?? []), l.cuota]);
  }

  return [...porLinea.entries()]
    .map(([linea, cuotas]) => {
      const orden = [...cuotas].sort((a, b) => a - b);
      const medio = Math.floor(orden.length / 2);
      const mediana =
        orden.length % 2 === 1
          ? (orden[medio] as number)
          : ((orden[medio - 1] as number) + (orden[medio] as number)) / 2;
      return { linea, cuota: mediana };
    })
    .sort((a, b) => a.linea - b.linea);
}

/**
 * Precio de `linea` a partir de una escalera. `null` si no hay base para
 * decirlo — y entonces el pick se queda sin cierre, que es lo correcto.
 */
export function precioEnLinea(
  escalera: readonly { linea: number; cuota: number }[],
  linea: number,
): PrecioDeducido | null {
  const exacta = escalera.find((e) => Math.abs(e.linea - linea) < 1e-9);
  if (exacta !== undefined) return { cuota: exacta.cuota, metodo: 'exacto', vecinas: [] };
  if (escalera.length < 2) return null;

  const orden = [...escalera].sort((a, b) => a.linea - b.linea);
  const primera = orden[0] as { linea: number; cuota: number };
  const ultima = orden[orden.length - 1] as { linea: number; cuota: number };

  /*
   * Dos puntos y el método. Dentro del rango, los que abrazan la línea; fuera,
   * los dos del extremo por el que se sale — la pendiente local, no la media
   * de toda la escalera, que en tramos largos se curva.
   */
  let a: { linea: number; cuota: number };
  let b: { linea: number; cuota: number };
  let metodo: MetodoPrecio;

  if (linea < primera.linea) {
    if (primera.linea - linea > MAXIMA_EXTRAPOLACION) return null;
    a = primera;
    b = orden[1] as { linea: number; cuota: number };
    metodo = 'extrapolado';
  } else if (linea > ultima.linea) {
    if (linea - ultima.linea > MAXIMA_EXTRAPOLACION) return null;
    a = orden[orden.length - 2] as { linea: number; cuota: number };
    b = ultima;
    metodo = 'extrapolado';
  } else {
    const iDerecha = orden.findIndex((e) => e.linea > linea);
    a = orden[iDerecha - 1] as { linea: number; cuota: number };
    b = orden[iDerecha] as { linea: number; cuota: number };
    metodo = 'interpolado';
  }

  if (Math.abs(b.linea - a.linea) < 1e-9) return null;

  const pA = 1 / a.cuota;
  const pB = 1 / b.cuota;
  const pendiente = (pB - pA) / (b.linea - a.linea);
  const p = pA + pendiente * (linea - a.linea);

  /*
   * Una probabilidad fuera de (0,1) significa que la pendiente ya no vale
   * donde se ha estirado. Antes que devolver una cuota imposible —o peor, una
   * plausible pero sin sentido— se devuelve null y el pick se queda sin
   * cierre.
   */
  if (!(p > 0.01 && p < 0.99)) return null;

  return {
    cuota: 1 / p,
    metodo,
    vecinas: [
      { linea: a.linea, cuota: a.cuota },
      { linea: b.linea, cuota: b.cuota },
    ],
  };
}
