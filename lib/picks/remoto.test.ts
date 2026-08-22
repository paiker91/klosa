import { describe, it, expect } from 'vitest';
import { construirRegistro } from './remoto';
import { crearPick, type Cierre, type Pick } from './dominio';
import type { Deporte } from '../cuotas/dominio';

const BASE = Date.UTC(2026, 7, 1, 0, 0, 0);
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
    casa: null,
    nota: null,
  });
};

const cierre = (p: Pick, cuotaCierre: number): Cierre => ({
  pickId: p.id,
  capturadoEn: p.comienzo,
  cuotaLadoTomado: cuotaCierre,
  // Contraria elegida para que el mercado sume algo más del 100 %.
  cuotaLadoContrario: 1 / (1.05 - 1 / cuotaCierre),
  casa: 'Casa',
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
