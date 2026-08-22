import { describe, it, expect } from 'vitest';
import {
  validarCuotasDeCierre,
  ErrorProveedor,
  ErrorCuotaAgotada,
  type CuotasDeCierre,
  type ProveedorDeCuotas,
  type Capacidades,
} from './dominio';
import { TheOddsApi } from './the-odds-api';
import { ProveedorConRespaldo } from './con-respaldo';

import nbaH2h from './fixtures/nba-h2h.json';
import historicoNba from './fixtures/historico-nba.json';
import mlbTotales from './fixtures/mlb-totales.json';

/** fetch falso que devuelve el cuerpo indicado según lo que pida la URL. */
function fetchFalso(
  rutas: ReadonlyArray<{ contiene: string; cuerpo: unknown; estado?: number }>,
  cabeceras: Record<string, string> = {},
): typeof fetch {
  return (async (entrada: string | URL) => {
    const url = entrada.toString();
    const encontrada = rutas.find((r) => url.includes(r.contiene));
    const estado = encontrada?.estado ?? (encontrada ? 200 : 404);
    return new Response(JSON.stringify(encontrada?.cuerpo ?? {}), {
      status: estado,
      headers: { 'content-type': 'application/json', ...cabeceras },
    });
  }) as typeof fetch;
}

/** Referencia mínima de evento: id, deporte y comienzo. */
const ref = (id: string, comienzo = '2026-04-09T23:12:28Z') =>
  ({ id, deporte: 'NBA' as const, comienzo: new Date(comienzo) });

const cierreValido: CuotasDeCierre = {
  eventoId: 'x',
  mercado: 'moneyline',
  ladoA: { etiqueta: 'Boston Celtics', cuota: 2.02 },
  ladoB: { etiqueta: 'Detroit Pistons', cuota: 1.83 },
  capturadoEn: new Date('2026-08-21T17:46:26Z'),
  casa: 'FanDuel',
};

describe('validación de frontera', () => {
  it('acepta un par de cuotas real', () => {
    expect(validarCuotasDeCierre('p', cierreValido)).toBe(cierreValido);
  });

  it('rechaza una cuota imposible antes de que entre en el dominio', () => {
    expect(() =>
      validarCuotasDeCierre('p', { ...cierreValido, ladoB: { etiqueta: 'x', cuota: 0 } }),
    ).toThrow(ErrorProveedor);
  });

  /*
   * Dos cuotas que suman menos del 100 % no son un chollo: son dos casas
   * distintas o dos momentos distintos mezclados. Cazarlo en la frontera evita
   * un "ventaja" enorme y falso más abajo.
   */
  it('rechaza un par que suma menos del 100 %', () => {
    expect(() =>
      validarCuotasDeCierre('p', {
        ...cierreValido,
        ladoA: { etiqueta: 'a', cuota: 2.5 },
        ladoB: { etiqueta: 'b', cuota: 2.5 },
      }),
    ).toThrow(/no cierra por debajo del 100/i);
  });

  it('rechaza una etiqueta vacía', () => {
    expect(() =>
      validarCuotasDeCierre('p', { ...cierreValido, ladoA: { etiqueta: '  ', cuota: 2 } }),
    ).toThrow(ErrorProveedor);
  });
});

describe('adaptador de The Odds API', () => {
  const crear = (rutas: Parameters<typeof fetchFalso>[0], cabeceras = {}) =>
    new TheOddsApi({ claveApi: 'prueba', buscar: fetchFalso(rutas, cabeceras) });

  it('exige clave', () => {
    expect(() => new TheOddsApi({ claveApi: '' })).toThrow(ErrorProveedor);
  });

  it('declara los tres deportes, incluida la Euroliga', () => {
    const c = crear([]).capacidades();
    expect(c.deportes).toContain('Euroliga');
    expect(c.historico).toBe(true);
  });

  it('traduce un evento real a nuestro dominio', async () => {
    const api = crear([{ contiene: '/sports/basketball_nba/odds', cuerpo: nbaH2h }]);
    const eventos = await api.buscarEventos({ deporte: 'NBA' });

    expect(eventos).toHaveLength(1);
    expect(eventos[0]?.local).toBe('Detroit Pistons');
    expect(eventos[0]?.visitante).toBe('Boston Celtics');
    expect(eventos[0]?.deporte).toBe('NBA');
    expect(eventos[0]?.comienzo).toBeInstanceOf(Date);
  });

  it('lee la cuota restante de las cabeceras', async () => {
    const api = crear([{ contiene: '/sports/', cuerpo: nbaH2h }], {
      'x-requests-remaining': '11900',
    });
    await api.buscarEventos({ deporte: 'NBA' });
    expect(api.cuotaRestante()).toBe(11900);
  });

  it('extrae las cuotas de cierre de una instantánea histórica real', async () => {
    const evento = historicoNba.data[0];
    const api = crear([
      { contiene: '/historical/', cuerpo: historicoNba },
      { contiene: '/sports/', cuerpo: [evento] },
    ]);

    const cierre = await api.cuotasDeCierre(ref(evento?.id ?? ''), 'moneyline');
    expect(cierre).not.toBeNull();
    expect(cierre?.ladoA.cuota).toBeGreaterThan(1);
    expect(cierre?.ladoB.cuota).toBeGreaterThan(1);
    expect(cierre?.casa).toBeTruthy();
    // Y lo importante: sale ya validado, así que sirve para el de-vig.
    expect(1 / (cierre?.ladoA.cuota ?? 1) + 1 / (cierre?.ladoB.cuota ?? 1)).toBeGreaterThanOrEqual(1);
  });

  it('etiqueta los totales con su línea, que es lo que distingue Más 5,5 de Más 6,5', async () => {
    const evento = mlbTotales[0];
    const api = crear([
      { contiene: '/historical/', cuerpo: { timestamp: 'x', data: [evento] } },
      { contiene: '/sports/', cuerpo: [evento] },
    ]);

    const cierre = await api.cuotasDeCierre(ref(evento?.id ?? ''), 'totales');
    expect(cierre?.ladoA.etiqueta).toMatch(/Over 5\.5|Under 5\.5/);
  });

  it('traduce el 429 a cuota agotada, que no se reintenta', async () => {
    const api = crear([{ contiene: '/sports/', cuerpo: {}, estado: 429 }]);
    await expect(api.buscarEventos({ deporte: 'NBA' })).rejects.toThrow(ErrorCuotaAgotada);
  });

  it('traduce el 401 sin filtrar códigos HTTP al dominio', async () => {
    const api = crear([{ contiene: '/sports/', cuerpo: {}, estado: 401 }]);
    await expect(api.buscarEventos({ deporte: 'NBA' })).rejects.toThrow(/Clave de API rechazada/);
  });
});

// --- Proveedores de mentira para probar el respaldo -------------------------

function proveedorFalso(
  nombre: string,
  capacidades: Capacidades,
  comportamiento: { eventos?: unknown[]; cierre?: CuotasDeCierre | null; falla?: Error },
): ProveedorDeCuotas {
  return {
    nombre,
    capacidades: () => capacidades,
    async buscarEventos() {
      if (comportamiento.falla) throw comportamiento.falla;
      return (comportamiento.eventos ?? []) as never[];
    },
    async cuotasDeCierre() {
      if (comportamiento.falla) throw comportamiento.falla;
      return comportamiento.cierre ?? null;
    },
    async resultados() {
      if (comportamiento.falla) throw comportamiento.falla;
      return [];
    },
  };
}

const TODO: Capacidades = {
  deportes: ['NBA', 'Euroliga', 'MLB'],
  mercados: ['moneyline', 'handicap', 'totales'],
  historico: true,
};

describe('proveedor con respaldo', () => {
  it('exige al menos un proveedor', () => {
    expect(() => new ProveedorConRespaldo([])).toThrow(ErrorProveedor);
  });

  it('pasa al siguiente cuando el primero agota su cuota', async () => {
    const compuesto = new ProveedorConRespaldo([
      proveedorFalso('caido', TODO, { falla: new ErrorCuotaAgotada('caido') }),
      proveedorFalso('vivo', TODO, { cierre: cierreValido }),
    ]);

    expect(await compuesto.cuotasDeCierre(ref('x'), 'moneyline')).toBe(cierreValido);
    expect(compuesto.incidencias[0]?.proveedor).toBe('caido');
  });

  /*
   * No basta con que el proveedor exista: si no declara el deporte, preguntarle
   * gasta una petición de un tier gratuito para nada.
   */
  it('no gasta cuota preguntando a quien no cubre el deporte', async () => {
    let preguntado = false;
    const sinEuroliga = proveedorFalso('parcial', { ...TODO, deportes: ['NBA'] }, {});
    const espiado: ProveedorDeCuotas = {
      ...sinEuroliga,
      async buscarEventos(c) {
        preguntado = true;
        return sinEuroliga.buscarEventos(c);
      },
    };
    const compuesto = new ProveedorConRespaldo([espiado]);

    await compuesto.buscarEventos({ deporte: 'Euroliga' });
    expect(preguntado).toBe(false);
  });

  it('suma las capacidades: si uno cubre Euroliga, el conjunto la cubre', () => {
    const compuesto = new ProveedorConRespaldo([
      proveedorFalso('a', { deportes: ['NBA'], mercados: ['moneyline'], historico: false }, {}),
      proveedorFalso('b', { deportes: ['Euroliga'], mercados: ['totales'], historico: true }, {}),
    ]);
    const c = compuesto.capacidades();
    expect(c.deportes).toEqual(expect.arrayContaining(['NBA', 'Euroliga']));
    expect(c.historico).toBe(true);
  });

  it('detecta que todos se han quedado sin cuota', async () => {
    const compuesto = new ProveedorConRespaldo([
      proveedorFalso('a', TODO, { falla: new ErrorCuotaAgotada('a') }),
      proveedorFalso('b', TODO, { falla: new ErrorCuotaAgotada('b') }),
    ]);
    await compuesto.cuotasDeCierre(ref('x'), 'moneyline');
    expect(compuesto.todosSinCuota()).toBe(true);
  });

  it('devuelve null sin reventar cuando nadie tiene el dato', async () => {
    const compuesto = new ProveedorConRespaldo([proveedorFalso('a', TODO, { cierre: null })]);
    expect(await compuesto.cuotasDeCierre(ref('x'), 'moneyline')).toBeNull();
  });
});

describe('etiquetado por mercado', () => {
  const conMercado = async (evento: unknown, mercado: 'handicap' | 'totales') => {
    const api = new TheOddsApi({
      claveApi: 'prueba',
      buscar: fetchFalso([
        { contiene: '/historical/', cuerpo: { timestamp: 'x', data: [evento] } },
        { contiene: '/sports/', cuerpo: [evento] },
      ]),
    });
    return api.cuotasDeCierre(ref((evento as { id: string }).id), mercado);
  };

  it('en totales el punto es un umbral y no lleva signo', async () => {
    const cierre = await conMercado(mlbTotales[0], 'totales');
    expect(cierre?.ladoA.etiqueta).toBe('Over 5.5');
    expect(cierre?.ladoB.etiqueta).toBe('Under 5.5');
  });
});
