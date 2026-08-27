import { describe, it, expect } from 'vitest';
import { escaleraDe, precioEnLinea, contrarioEnLinea, MAXIMA_EXTRAPOLACION } from './escalera';

/** El cierre real del Real Sociedad — Real Madrid del 2026-08-26. */
const CIERRE_MADRID = [
  { etiqueta: 'Real Madrid -2', cuota: 1.91 },
  { etiqueta: 'Real Madrid -2', cuota: 1.87 },
  { etiqueta: 'Real Madrid -2', cuota: 1.87 },
  { etiqueta: 'Real Madrid -2', cuota: 1.8 },
  { etiqueta: 'Real Madrid -2.25', cuota: 2.13 },
  { etiqueta: 'Real Madrid -2.5', cuota: 2.27 },
  { etiqueta: 'Real Sociedad +2', cuota: 2.06 },
];

describe('escalera de un lado', () => {
  it('agrupa por línea y toma la mediana, no la mejor cuota', () => {
    const e = escaleraDe(CIERRE_MADRID, 'Real Madrid');
    expect(e).toEqual([
      { linea: -2.5, cuota: 2.27 },
      { linea: -2.25, cuota: 2.13 },
      // Mediana de 1.80, 1.87, 1.87, 1.91 — no el 1.91, que es el atípico.
      { linea: -2, cuota: 1.87 },
    ]);
  });

  it('no mezcla el otro lado del mercado', () => {
    expect(escaleraDe(CIERRE_MADRID, 'Real Madrid').some((e) => e.cuota === 2.06)).toBe(false);
    expect(escaleraDe(CIERRE_MADRID, 'Real Sociedad')).toEqual([{ linea: 2, cuota: 2.06 }]);
  });

  it('descarta cuotas imposibles en vez de dejarlas envenenar la mediana', () => {
    const e = escaleraDe(
      [
        { etiqueta: 'Over 2.5', cuota: 1.9 },
        { etiqueta: 'Over 2.5', cuota: 1 },
        { etiqueta: 'Over 2.5', cuota: 1.94 },
      ],
      'Over',
    );
    expect(e).toEqual([{ linea: 2.5, cuota: 1.92 }]);
  });
});

describe('precio de una línea que no está', () => {
  it('devuelve la exacta cuando existe, sin tocar nada', () => {
    const r = precioEnLinea(escaleraDe(CIERRE_MADRID, 'Real Madrid'), -2);
    expect(r).toEqual({ cuota: 1.87, metodo: 'exacto', vecinas: [] });
  });

  it('interpola entre dos conocidas', () => {
    // Entre -2.5 (2.27) y -2.25 (2.13) pedimos -2.375, el punto medio exacto.
    const r = precioEnLinea(escaleraDe(CIERRE_MADRID, 'Real Madrid'), -2.375);
    expect(r?.metodo).toBe('interpolado');
    // Media de probabilidades: (1/2.27 + 1/2.13) / 2 -> cuota ~2.198
    expect(r?.cuota).toBeCloseTo(2.198, 2);
  });

  /*
   * El caso del Madrid. Marcado como extrapolado porque -1.75 queda fuera del
   * rango del cierre, que iba de -2.5 a -2.
   */
  it('extrapola el −1.75 del Madrid y lo declara extrapolado', () => {
    const r = precioEnLinea(escaleraDe(CIERRE_MADRID, 'Real Madrid'), -1.75);
    expect(r?.metodo).toBe('extrapolado');
    expect(r?.cuota).toBeCloseTo(1.666, 2);
    expect(r?.vecinas).toEqual([
      { linea: -2.25, cuota: 2.13 },
      { linea: -2, cuota: 1.87 },
    ]);
  });

  it('la interpolación va en probabilidad, no en cuota', () => {
    /*
     * Si se interpolara la cuota, el punto medio entre 1.50 y 3.00 sería
     * 2.25. En probabilidad es 1/((1/1.5 + 1/3)/2) = 2.0. La diferencia
     * siempre cae del mismo lado, así que hacerlo mal inflaría el CLV de
     * forma sistemática.
     */
    const r = precioEnLinea(
      [
        { linea: 0, cuota: 1.5 },
        { linea: 1, cuota: 3 },
      ],
      0.5,
    );
    expect(r?.cuota).toBeCloseTo(2, 6);
  });

  it('sin dos puntos no hay pendiente y no se inventa', () => {
    expect(precioEnLinea([{ linea: -2, cuota: 1.87 }], -1.75)).toBeNull();
    expect(precioEnLinea([], -1.75)).toBeNull();
  });

  it('no estira la pendiente más allá del tope', () => {
    const escalera = escaleraDe(CIERRE_MADRID, 'Real Madrid');
    // -1.5 está a 0.5 de -2: justo en el límite, pasa.
    expect(precioEnLinea(escalera, -2 + MAXIMA_EXTRAPOLACION)?.metodo).toBe('extrapolado');
    // -1.25 está a 0.75: fuera.
    expect(precioEnLinea(escalera, -1.25)).toBeNull();
  });

  it('rechaza el resultado si la pendiente lo saca de una probabilidad válida', () => {
    /*
     * De 1,05 (p=0,95) a 2,00 (p=0,50) hay una pendiente de -0,45 por línea.
     * Estirarla media línea hacia atrás da p=1,18: imposible. Antes que
     * devolver una cuota sin sentido, null.
     */
    expect(
      precioEnLinea(
        [
          { linea: 0, cuota: 1.05 },
          { linea: 1, cuota: 2 },
        ],
        -0.5,
      ),
    ).toBeNull();
  });
});

describe('el par entero: dos salidas o no es un mercado', () => {
  const CIERRE = [
    { etiqueta: 'Real Madrid -2', cuota: 1.87 },
    { etiqueta: 'Real Madrid -2.25', cuota: 2.13 },
    { etiqueta: 'Real Sociedad +2', cuota: 2.02 },
    { etiqueta: 'Real Sociedad +2.25', cuota: 1.8 },
  ];

  it('identifica el contrario de un hándicap con el nombre del proveedor', () => {
    expect(contrarioEnLinea('Real Madrid -1.75', CIERRE)).toEqual({
      equipo: 'Real Sociedad',
      linea: 1.75,
    });
  });

  it('en totales el contrario es el otro sentido, misma línea', () => {
    expect(contrarioEnLinea('Over 2.5', [])).toEqual({ equipo: 'Under', linea: 2.5 });
    expect(contrarioEnLinea('Under 3.5', [])).toEqual({ equipo: 'Over', linea: 3.5 });
  });

  /*
   * La prueba que faltaba y que costó una cuota «justa» de 2,68. Deducir solo
   * la pata apostada y dejarla junto al par original da tres salidas y un
   * margen del 60 %. Deducir las dos da un mercado con margen de mercado.
   */
  it('las dos patas deducidas dan un margen creíble', () => {
    const mio = precioEnLinea(escaleraDe(CIERRE, 'Real Madrid'), -1.75);
    const suyo = precioEnLinea(escaleraDe(CIERRE, 'Real Sociedad'), 1.75);
    expect(mio).not.toBeNull();
    expect(suyo).not.toBeNull();

    const margen = 1 / (mio as { cuota: number }).cuota + 1 / (suyo as { cuota: number }).cuota - 1;
    expect(margen).toBeGreaterThan(0);
    expect(margen).toBeLessThan(0.1);

    // Y el error que se cometió: tres salidas.
    const malo = 1 / (mio as { cuota: number }).cuota + 1 / 1.87 + 1 / 2.02 - 1;
    expect(malo).toBeGreaterThan(0.5);
  });
});
