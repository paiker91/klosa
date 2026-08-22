/**
 * Mercados de tres vías: fútbol.
 *
 * Se prueban aparte porque el riesgo aquí es distinto. En dos vías casi
 * cualquier error de de-vig salta a la vista (las dos probabilidades tienen
 * que sumar 1 y son simétricas). En tres, un reparto mal hecho sigue sumando 1
 * y produce números creíbles: el fallo sería silencioso, que es el peor tipo.
 *
 * Las cuotas de abajo son reales, del Brasileirão, verificadas contra la API
 * el 2026-08-22: Remo @ Fluminense — 1,50 / 4,27 / 7,04.
 */
import { describe, it, expect } from 'vitest';
import { devigN, overroundN, resolverKN, analizarApuestaN, ErrorCuota } from './clv';

/** Local, empate, visitante. Margen real de la casa: 4,29 %. */
const PARTIDO = [1.5, 4.27, 7.04] as const;

describe('de-vig de tres vías', () => {
  it('calcula el overround de tres salidas', () => {
    expect(overroundN(PARTIDO)).toBeCloseTo(1.0429, 4);
  });

  it('exige al menos dos cuotas: con una no hay margen que quitar', () => {
    expect(() => devigN([2])).toThrow(ErrorCuota);
  });

  for (const metodo of ['multiplicativo', 'power', 'aditivo'] as const) {
    it(`las tres probabilidades suman 1 con el método ${metodo}`, () => {
      const r = devigN(PARTIDO, metodo);
      expect(r.p).toHaveLength(3);
      expect(r.p.reduce((s, x) => s + x, 0)).toBeCloseTo(1, 9);
    });

    it(`ninguna probabilidad sale negativa con el método ${metodo}`, () => {
      const r = devigN(PARTIDO, metodo);
      for (const p of r.p) expect(p).toBeGreaterThan(0);
    });
  }

  it('conserva el orden de las cuotas', () => {
    const r = devigN(PARTIDO);
    // El favorito tiene que salir con la probabilidad más alta, y va primero.
    expect(r.p[0]).toBeGreaterThan(r.p[1] as number);
    expect(r.p[1]).toBeGreaterThan(r.p[2] as number);
  });

  it('el power converge en tres vías igual que en dos', () => {
    const k = resolverKN(PARTIDO);
    expect(k).toBeGreaterThan(1);
    expect(PARTIDO.reduce((s, c) => s + (1 / c) ** k, 0)).toBeCloseTo(1, 9);
  });

  /*
   * Este es el caso que hace inservible al aditivo en fútbol y que en dos vías
   * no puede darse. En un cruce muy desigual y con margen gordo (aquí 11,9 %),
   * repartirlo a partes iguales le quita a la sorpresa más probabilidad de la
   * que tiene: 1/26 = 3,85 % menos 3,96 % sale negativo.
   */
  it('avisa cuando el aditivo deja una probabilidad en cero o negativa', () => {
    const r = devigN([1.02, 10, 26], 'aditivo');
    expect(r.aviso).toBeDefined();
    for (const p of r.p) expect(p).toBeGreaterThan(0);
  });

  it('rechaza un mercado que suma menos del 100 %: o es arbitraje o es un error', () => {
    expect(() => devigN([3.5, 3.5, 3.5])).toThrow(/menos del 100/);
  });
});

describe('análisis de una apuesta de tres vías', () => {
  it('mide la ventaja del lado apostado, no del primero', () => {
    // Empate cogido a 4,60 contra un cierre de 4,27.
    const r = analizarApuestaN(4.6, PARTIDO, 1);

    expect(r.indiceTomado).toBe(1);
    expect(r.cuotaCierreTomada).toBe(4.27);
    expect(r.cierres).toEqual([1.5, 4.27, 7.04]);
    expect(r.cogioValor).toBe(true);
    // Cogió por encima del cierre, así que la ventaja tiene que ser positiva
    // pero menor que el CLV bruto, que no descuenta el margen.
    expect(r.ventaja).toBeGreaterThan(0);
    expect(r.ventaja).toBeLessThan(r.clvBruto);
  });

  it('coger exactamente la cuota de cierre deja ventaja negativa: falta el margen', () => {
    const r = analizarApuestaN(4.27, PARTIDO, 1);
    expect(r.clvBruto).toBeCloseTo(0, 12);
    expect(r.ventaja).toBeLessThan(0);
    expect(r.cogioValor).toBe(false);
  });

  it('rechaza un lado que no existe en el mercado', () => {
    expect(() => analizarApuestaN(2, PARTIDO, 3)).toThrow(ErrorCuota);
  });

  it('el resultado no depende de en qué orden vengan los lados', () => {
    const directo = analizarApuestaN(4.6, [1.5, 4.27, 7.04], 1);
    const alReves = analizarApuestaN(4.6, [7.04, 4.27, 1.5], 1);
    expect(alReves.ventaja).toBeCloseTo(directo.ventaja, 12);
  });
});
