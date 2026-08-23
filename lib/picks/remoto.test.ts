import { describe, it, expect } from 'vitest';
import { construirRegistro, leerRegistroPublico, ErrorRegistroNoDisponible } from './remoto';
import { crearPick, type Cierre, type Pick, type ResultadoPick } from './dominio';
import type { Deporte } from '../cuotas/dominio';

/* Después de SELLO_VERIFICABLE_DESDE: estos tests comprueban la detección
   de manipulación, que solo aplica a los picks con sello verificable. */
const BASE = Date.UTC(2026, 8, 1, 0, 0, 0);
let contador = 0;

/**
 * El comienzo se calcula SIEMPRE a partir del registro, más seis horas.
 * La primera versión de este generador ciclaba las fechas con un módulo y uno
 * de cada quince picks salía con el partido antes de la anotación: la
 * auditoría los rechazaba, con razón, y el test fallaba por culpa del fixture.
 */
const pick = (deporte: Deporte, cuotaTomada: number): Pick => {
  const registrado = new Date(BASE + contador * 3_600_000);
  const comienzo = new Date(registrado.getTime() + 6 * 3_600_000);
  return crearPick({
    registradoEn: registrado.toISOString(),
    deporte,
    eventoId: `evt-${contador++}`,
    local: 'Local',
    visitante: 'Visitante',
    comienzo: comienzo.toISOString(),
    mercado: 'moneyline',
    lado: 'Visitante',
    cuotaTomada,
    stake: null,
    casa: null,
    nota: null,
  });
};

const cierre = (p: Pick, cuotaCierre: number): Cierre => ({
  pickId: p.id,
  capturadoEn: p.comienzo,
  lados: ['Visitante', 'Local'],
  // Contraria elegida para que el mercado sume algo más del 100 %.
  cuotas: [cuotaCierre, 1 / (1.05 - 1 / cuotaCierre)],
  indiceTomado: 0,
  casa: 'Casa',
  fuente: 'casa',
  proveedor: 'prueba',
});

/** n picks de un deporte, tomados a `tomada` y cerrados a `cierreEn`. */
function lote(deporte: Deporte, n: number, tomada: number, cierreEn: number) {
  const picks: Pick[] = [];
  const cierres: Cierre[] = [];
  for (let i = 0; i < n; i++) {
    const p = pick(deporte, tomada);
    picks.push(p);
    cierres.push(cierre(p, cierreEn));
  }
  return { picks, cierres };
}

describe('construcción del registro público', () => {
  it('devuelve vacío sin picks', () => {
    const r = construirRegistro([], []);
    expect(r.conteos.total).toBe(0);
    expect(r.porDeporte).toEqual([]);
    expect(r.resumen.veredicto).toBe('muestra_insuficiente');
  });

  it('marca como pendiente el pick sin cierre y no lo analiza', () => {
    const p = pick('NBA', 2.1);
    const r = construirRegistro([p], []);
    expect(r.conteos.pendientes).toBe(1);
    expect(r.conteos.conCierre).toBe(0);
    expect(r.entradas[0]?.analisis).toBeNull();
  });

  /*
   * Un pick con el sello roto no debe recibir un número: enseñar su CLV le
   * daría apariencia de dato bueno a algo que ya sabemos que no lo es.
   */
  it('no calcula CLV de un pick manipulado', () => {
    const p = pick('NBA', 2.1);
    const manipulado: Pick = { ...p, cuotaTomada: 5 };
    const r = construirRegistro([manipulado], [cierre(p, 2.0)]);
    expect(r.entradas[0]?.auditoria.valido).toBe(false);
    expect(r.entradas[0]?.analisis).toBeNull();
    expect(r.conteos.validos).toBe(0);
  });

  it('ordena de más reciente a más antiguo', () => {
    const a = pick('NBA', 2.1);
    const b = pick('MLB', 2.1);
    const r = construirRegistro([a, b], []);
    const fechas = r.entradas.map((e) => e.pick.registradoEn);
    expect([...fechas].sort().reverse()).toEqual(fechas);
  });
});

describe('desglose por deporte en el registro', () => {
  it('no se muestra con un solo deporte', () => {
    const l = lote('NBA', 10, 2.1, 2.0);
    expect(construirRegistro(l.picks, l.cierres).porDeporte).toEqual([]);
  });

  /*
   * El caso que motiva el proyecto: en agregado la señal se diluye y solo al
   * separar aparece un deporte que pierde valor de forma sistemática.
   */
  it('destapa el deporte que pierde y el agregado escondía', () => {
    const gana = lote('MLB', 60, 2.2, 2.0); // toma mejor que el cierre
    const pierde = lote('NBA', 60, 2.0, 2.2); // toma peor que el cierre

    const r = construirRegistro(
      [...gana.picks, ...pierde.picks],
      [...gana.cierres, ...pierde.cierres],
    );

    expect(r.porDeporte).toHaveLength(2);
    const nba = r.porDeporte.find((g) => g.clave === 'NBA');
    const mlb = r.porDeporte.find((g) => g.clave === 'MLB');

    expect(nba?.resumen.ventajaMedia).toBeLessThan(0);
    expect(mlb?.resumen.ventajaMedia).toBeGreaterThan(0);
    // Y el agregado, con los dos mezclados, queda mucho más cerca de cero.
    expect(Math.abs(r.resumen.ventajaMedia)).toBeLessThan(
      Math.abs(nba?.resumen.ventajaMedia ?? 1),
    );
  });

  it('ordena los grupos por tamaño de muestra', () => {
    const a = lote('NBA', 5, 2.1, 2.0);
    const b = lote('MLB', 30, 2.1, 2.0);
    const r = construirRegistro([...a.picks, ...b.picks], [...a.cierres, ...b.cierres]);
    expect(r.porDeporte.map((g) => g.clave)).toEqual(['MLB', 'NBA']);
  });

  /*
   * Con muestras pequeñas por grupo, ninguno concluye — aunque el conjunto sí
   * lo hiciera. Es el aviso que la interfaz da antes de enseñar la tabla.
   */
  it('los grupos pequeños no concluyen nada aunque el total sí', () => {
    const a = lote('NBA', 60, 2.2, 2.0);
    const b = lote('MLB', 60, 2.2, 2.0);
    const r = construirRegistro([...a.picks, ...b.picks], [...a.cierres, ...b.cierres]);

    expect(r.resumen.n).toBe(120);
    expect(r.resumen.veredicto).not.toBe('muestra_insuficiente');
    for (const g of r.porDeporte) expect(g.resumen.veredicto).toBe('muestra_insuficiente');
  });
});

/*
 * La distinción entre "vacío" y "no se pudo leer" es la razón de ser de este
 * bloque. Confundirlas convertiría una caída momentánea de GitHub en una
 * afirmación falsa sobre el registro, en una página cuyo argumento es
 * precisamente que se puede verificar.
 */
describe('registro vacío frente a registro ilegible', () => {
  const conFetch = async (respuesta: (url: string | URL) => Promise<Response>) => {
    const original = globalThis.fetch;
    globalThis.fetch = respuesta as typeof fetch;
    try {
      return await leerRegistroPublico();
    } finally {
      globalThis.fetch = original;
    }
  };

  it('404 significa registro vacío: el fichero aún no existe', async () => {
    const r = await conFetch(async () => new Response('', { status: 404 }));
    expect(r.conteos.total).toBe(0);
    expect(r.entradas).toEqual([]);
  });

  it('un 500 NO es un registro vacío: es un fallo y hay que decirlo', async () => {
    await expect(conFetch(async () => new Response('', { status: 500 }))).rejects.toThrow(
      ErrorRegistroNoDisponible,
    );
  });

  it('si la red falla, tampoco se finge que el registro está vacío', async () => {
    await expect(
      conFetch(async () => {
        throw new Error('sin red');
      }),
    ).rejects.toThrow(ErrorRegistroNoDisponible);
  });

  it('lee líneas correctas y descarta las corruptas sin tumbar el resto', async () => {
    const p = pick('NBA', 2.1);
    await conFetch(async (url: string | URL) => {
      const esPicks = url.toString().includes('picks.jsonl');
      const cuerpo = esPicks ? `${JSON.stringify(p)}\nesto no es json\n` : '';
      return new Response(cuerpo, { status: 200 });
    }).then((r) => {
      expect(r.conteos.total).toBe(1);
      expect(r.entradas[0]?.pick.id).toBe(p.id);
    });
  });
});

describe('construirRegistro: yield, cuota media y acierto', () => {
  const resultado = (p: Pick, desenlace: 'ganada' | 'perdida' | 'anulada'): ResultadoPick => ({
    pickId: p.id,
    desenlace,
    marcador: '1-0',
    capturadoEn: p.comienzo,
    proveedor: 'prueba',
  });

  it('sin resultados capturados, el bloque de yield queda a cero y no inventa nada', () => {
    const p = pick('MLB', 1.92);
    const r = construirRegistro([p], [cierre(p, 1.9)]);
    expect(r.resultados.n).toBe(0);
    expect(r.resultados.veredicto).toBe('muestra_insuficiente');
    expect(r.resultados.apuestasNecesarias).toBeNull();
  });

  it('calcula el yield con las apuestas resueltas, tengan cierre o no', () => {
    // Dos a 2,00: una ganada y una perdida. Beneficio 0, acierto 50 %.
    const a = pick('MLB', 2);
    const b = pick('MLB', 2);
    const r = construirRegistro([a, b], [], [resultado(a, 'ganada'), resultado(b, 'perdida')]);
    expect(r.resultados.n).toBe(2);
    expect(r.resultados.beneficio).toBeCloseTo(0, 10);
    expect(r.resultados.yield).toBeCloseTo(0, 10);
    expect(r.resultados.tasaAcierto).toBeCloseTo(0.5, 10);
    expect(r.resultados.cuotaMedia).toBeCloseTo(2, 10);
    // Sin cierre no hay CLV: los dos bloques son independientes.
    expect(r.conteos.conCierre).toBe(0);
  });

  it('un pick que no pasa la auditoría no entra en el yield', () => {
    const p = pick('NBA', 2);
    const trucado: Pick = { ...p, cuotaTomada: 9 };
    const r = construirRegistro([trucado], [], [resultado(trucado, 'ganada')]);
    expect(r.resultados.n).toBe(0);
  });

  it('las anuladas se cuentan aparte y no diluyen el yield', () => {
    const a = pick('NBA', 2);
    const b = pick('NBA', 2);
    const r = construirRegistro([a, b], [], [resultado(a, 'ganada'), resultado(b, 'anulada')]);
    expect(r.resultados.n).toBe(1);
    expect(r.resultados.anuladas).toBe(1);
    expect(r.resultados.yield).toBeCloseTo(1, 10);
  });

  it('cada entrada lleva su resultado para poder enseñarlo en la tabla', () => {
    const p = pick('MLB', 1.92);
    const r = construirRegistro([p], [], [resultado(p, 'perdida')]);
    expect(r.entradas[0]?.resultado?.desenlace).toBe('perdida');
  });
});
