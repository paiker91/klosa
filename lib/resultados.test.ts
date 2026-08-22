import { describe, it, expect } from 'vitest';
import { agregarResultados, type ApuestaResuelta, type Desenlace } from './resultados';

const apuesta = (desenlace: Desenlace, cuotaTomada = 2, stake: number | null = null): ApuestaResuelta => ({
  cuotaTomada,
  stake,
  desenlace,
});

const serie = (n: number, ganadas: number, cuota = 2): ApuestaResuelta[] =>
  Array.from({ length: n }, (_, i) => apuesta(i < ganadas ? 'ganada' : 'perdida', cuota));

describe('yield y beneficio', () => {
  it('sin apuestas devuelve ceros y no revienta', () => {
    const r = agregarResultados([]);
    expect(r.n).toBe(0);
    expect(r.yield).toBe(0);
    expect(r.t).toBeNull();
  });

  it('a cuota 2 y mitad de aciertos, el yield es cero', () => {
    const r = agregarResultados(serie(100, 50));
    expect(r.yield).toBeCloseTo(0, 10);
    expect(r.tasaAcierto).toBeCloseTo(0.5, 10);
    expect(r.cuotaMedia).toBeCloseTo(2, 10);
  });

  it('calcula el beneficio en unidades', () => {
    // 3 ganadas a 2,00 (+1 cada una) y 2 perdidas (-1 cada una) = +1
    const r = agregarResultados(serie(5, 3));
    expect(r.beneficio).toBeCloseTo(1, 10);
    expect(r.unidadesArriesgadas).toBe(5);
    expect(r.yield).toBeCloseTo(0.2, 10);
  });

  it('respeta stakes desiguales', () => {
    const r = agregarResultados([
      apuesta('ganada', 3, 10), // +20
      apuesta('perdida', 2, 5), // -5
    ]);
    expect(r.beneficio).toBeCloseTo(15, 10);
    expect(r.unidadesArriesgadas).toBe(15);
    expect(r.yield).toBeCloseTo(1, 10);
  });

  /*
   * Una anulada no es media victoria ni una apuesta con beneficio cero: no
   * aporta información sobre la ventaja, y meterla en el denominador diluiría
   * el yield artificialmente hacia cero.
   */
  it('excluye las anuladas de todo el cálculo', () => {
    const r = agregarResultados([...serie(4, 2), apuesta('anulada')]);
    expect(r.n).toBe(4);
    expect(r.anuladas).toBe(1);
    expect(r.unidadesArriesgadas).toBe(4);
    expect(r.yield).toBeCloseTo(0, 10);
  });
});

describe('significancia del yield', () => {
  it('no concluye nada por debajo de 100 apuestas, aunque el yield sea enorme', () => {
    const r = agregarResultados(serie(50, 40)); // yield del 60 %
    expect(r.yield).toBeGreaterThan(0.5);
    expect(r.veredicto).toBe('muestra_insuficiente');
  });

  it('detecta una ventaja clara con muestra suficiente', () => {
    const r = agregarResultados(serie(400, 240)); // 60 % de acierto a cuota 2
    expect(r.veredicto).toBe('significativo');
    expect(r.signo).toBe('favor');
  });

  it('detecta también que se pierde de forma significativa', () => {
    const r = agregarResultados(serie(400, 160));
    expect(r.veredicto).toBe('significativo');
    expect(r.signo).toBe('contra');
  });

  it('un yield indistinguible de cero no concluye', () => {
    const r = agregarResultados(serie(200, 100));
    expect(r.veredicto).toBe('no_distinguible');
    expect(r.signo).toBeNull();
  });
});

/*
 * El número que sostiene la tesis del producto: con la desviación real de las
 * apuestas, un yield pequeño exige miles de apuestas para ser creíble.
 */
describe('cuántas apuestas harían falta', () => {
  it('un yield del 3 % a cuota par exige varios miles', () => {
    // 51,5 % de acierto a cuota 2,00 → yield del 3 %
    const r = agregarResultados(serie(1000, 515));
    expect(r.yield).toBeCloseTo(0.03, 3);
    expect(r.apuestasNecesarias).toBeGreaterThan(3500);
    expect(r.apuestasNecesarias).toBeLessThan(5000);
  });

  it('un yield grande exige muchas menos', () => {
    const grande = agregarResultados(serie(200, 140));
    const pequeno = agregarResultados(serie(1000, 515));
    expect(grande.apuestasNecesarias).toBeLessThan(pequeno.apuestasNecesarias as number);
  });

  it('no estima nada cuando el yield es exactamente cero', () => {
    expect(agregarResultados(serie(100, 50)).apuestasNecesarias).toBeNull();
  });

  /*
   * Comparación que resume el producto entero: los mismos datos exigen miles
   * de apuestas por beneficio y unos cientos por CLV.
   */
  it('la cifra que justifica medir por CLV en vez de por beneficio', () => {
    const r = agregarResultados(serie(1000, 515));
    expect(r.apuestasNecesarias).toBeGreaterThan(2526); // los picks del tipster del caso real
  });
});
