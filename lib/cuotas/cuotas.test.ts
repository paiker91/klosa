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
  lados: [
    { etiqueta: 'Boston Celtics', cuota: 2.02 },
    { etiqueta: 'Detroit Pistons', cuota: 1.83 },
  ],
  capturadoEn: new Date('2026-08-21T17:46:26Z'),
  casa: 'FanDuel',
  casas: 1,
  porCasa: [],
};

describe('validación de frontera', () => {
  it('acepta un par de cuotas real', () => {
    expect(validarCuotasDeCierre('p', cierreValido)).toBe(cierreValido);
  });

  it('rechaza una cuota imposible antes de que entre en el dominio', () => {
    expect(() =>
      validarCuotasDeCierre('p', {
        ...cierreValido,
        lados: [cierreValido.lados[0]!, { etiqueta: 'x', cuota: 0 }],
      }),
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
        lados: [
          { etiqueta: 'a', cuota: 2.5 },
          { etiqueta: 'b', cuota: 2.5 },
        ],
      }),
    ).toThrow(/no cierra por debajo del 100/i);
  });

  it('rechaza una etiqueta vacía', () => {
    expect(() =>
      validarCuotasDeCierre('p', {
        ...cierreValido,
        lados: [{ etiqueta: '  ', cuota: 2 }, cierreValido.lados[1]!],
      }),
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
    expect(cierre?.lados).toHaveLength(2);
    for (const l of cierre?.lados ?? []) expect(l.cuota).toBeGreaterThan(1);
    expect(cierre?.casa).toBeTruthy();
    // Y lo importante: sale ya validado, así que sirve para el de-vig.
    expect((cierre?.lados ?? []).reduce((s, l) => s + 1 / l.cuota, 0)).toBeGreaterThanOrEqual(1);
  });

  it('etiqueta los totales con su línea, que es lo que distingue Más 5,5 de Más 6,5', async () => {
    const evento = mlbTotales[0];
    const api = crear([
      { contiene: '/historical/', cuerpo: { timestamp: 'x', data: [evento] } },
      { contiene: '/sports/', cuerpo: [evento] },
    ]);

    const cierre = await api.cuotasDeCierre(ref(evento?.id ?? ''), 'totales');
    expect(cierre?.lados[0]?.etiqueta).toMatch(/Over 5\.5|Under 5\.5/);
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
    async cierresDelMomento() {
      if (comportamiento.falla) throw comportamiento.falla;
      const c = comportamiento.cierre;
      return c ? new Map([[c.eventoId, c]]) : new Map();
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
    expect(cierre?.lados[0]?.etiqueta).toBe('Over 5.5');
    expect(cierre?.lados[1]?.etiqueta).toBe('Under 5.5');
  });
});

describe('cierre de consenso', () => {
  const casa = (titulo: string, a: number, b: number, punto?: number) => ({
    key: titulo.toLowerCase(),
    title: titulo,
    last_update: '2026-04-09T23:10:00Z',
    markets: [
      {
        key: punto === undefined ? 'h2h' : 'totals',
        last_update: '2026-04-09T23:10:00Z',
        outcomes:
          punto === undefined
            ? [
                { name: 'Chicago Bulls', price: a },
                { name: 'Washington Wizards', price: b },
              ]
            : [
                { name: 'Over', price: a, point: punto },
                { name: 'Under', price: b, point: punto },
              ],
      },
    ],
  });

  const instantanea = (casas: unknown[]) => ({
    timestamp: '2026-04-09T23:11:00Z',
    data: [
      {
        id: 'evt',
        sport_key: 'basketball_nba',
        commence_time: '2026-04-09T23:12:28Z',
        home_team: 'Washington Wizards',
        away_team: 'Chicago Bulls',
        bookmakers: casas,
      },
    ],
  });

  const pedir = async (casas: unknown[], mercado: 'moneyline' | 'totales' = 'moneyline') =>
    new TheOddsApi({
      claveApi: 'x',
      buscar: fetchFalso([{ contiene: '/historical/', cuerpo: instantanea(casas) }]),
    }).cuotasDeCierre(
      { id: 'evt', deporte: 'NBA', comienzo: new Date('2026-04-09T23:12:28Z') },
      mercado,
    );

  it('devuelve la mediana de las casas, no la primera que aparezca', async () => {
    const cierre = await pedir([
      casa('A', 1.9, 2.0),
      casa('B', 2.0, 1.9),
      casa('C', 2.1, 1.8),
      casa('D', 5.0, 1.2), // Atípica: la mediana la absorbe, una media no.
    ]);

    expect(cierre?.casas).toBe(4);
    expect(cierre?.casa).toBe('mediana de 4 casas');
    expect(cierre?.lados[0]?.cuota).toBeCloseTo(2.05, 2);
    expect(cierre?.lados[1]?.cuota).toBeCloseTo(1.85, 2);
  });

  it('la fecha es la del corte, no el last_update de una casa cualquiera', async () => {
    const cierre = await pedir([casa('A', 1.9, 2.0), casa('B', 2.0, 1.9), casa('C', 2.1, 1.8)]);
    expect(cierre?.capturadoEn.toISOString()).toBe('2026-04-09T23:11:00.000Z');
  });

  it('con menos de tres casas no inventa un consenso: cae a una sola casa', async () => {
    const cierre = await pedir([casa('A', 1.9, 2.0), casa('B', 2.0, 1.9)]);
    expect(cierre?.casas).toBe(1);
    expect(cierre?.casa).toBe('A');
  });

  it('no mezcla líneas distintas de un total en la misma mediana', async () => {
    /*
     * Tres casas en 5,5 y dos en 6,5. Son mercados distintos: promediarlos
     * daría una cuota de una línea que no existe en ninguna casa.
     */
    const cierre = await pedir(
      [
        casa('A', 1.9, 1.95, 5.5),
        casa('B', 1.92, 1.93, 5.5),
        casa('C', 1.94, 1.91, 5.5),
        casa('D', 2.4, 1.6, 6.5),
        casa('E', 2.45, 1.58, 6.5),
      ],
      'totales',
    );

    expect(cierre?.casas).toBe(3);
    expect(cierre?.lados[0]?.etiqueta).toBe('Over 5.5');
    expect(cierre?.lados[0]?.cuota).toBeCloseTo(1.92, 2);
  });
});

describe('líneas por casa dentro del mismo corte', () => {
  const casa = (titulo: string, a: number, b: number) => ({
    key: titulo.toLowerCase(),
    title: titulo,
    last_update: '2026-04-09T23:10:00Z',
    markets: [
      {
        key: 'h2h',
        last_update: '2026-04-09T23:10:00Z',
        outcomes: [
          { name: 'Chicago Bulls', price: a },
          { name: 'Washington Wizards', price: b },
        ],
      },
    ],
  });

  const pedir = async (casas: unknown[]) =>
    new TheOddsApi({
      claveApi: 'x',
      buscar: fetchFalso([
        {
          contiene: '/historical/',
          cuerpo: {
            timestamp: '2026-04-09T23:11:00Z',
            data: [
              {
                id: 'evt',
                sport_key: 'basketball_nba',
                commence_time: '2026-04-09T23:12:28Z',
                home_team: 'Washington Wizards',
                away_team: 'Chicago Bulls',
                bookmakers: casas,
              },
            ],
          },
        },
      ]),
    }).cuotasDeCierre(
      { id: 'evt', deporte: 'NBA', comienzo: new Date('2026-04-09T23:12:28Z') },
      'moneyline',
    );

  it('guarda la línea de cada casa además de la mediana', async () => {
    const cierre = await pedir([
      casa('Bet365', 1.9, 2.0),
      casa('Pinnacle', 2.05, 1.87),
      casa('Betfair', 2.0, 1.9),
    ]);

    expect(cierre?.casa).toBe('mediana de 3 casas');
    expect(cierre?.porCasa).toHaveLength(3);

    /*
     * Lo que hace falta para medir contra la misma casa: poder recuperar SU
     * línea, no la del mercado. Aquí Pinnacle cerró el lado de Chicago más
     * alto que la mediana, y eso tiene que verse tal cual.
     */
    const pinnacle = cierre?.porCasa.find((c) => c.casa === 'Pinnacle');
    expect(pinnacle?.lados[0]?.cuota).toBe(2.05);
    expect(pinnacle?.lados[0]?.etiqueta).toBe('Chicago Bulls');
  });

  it('cada casa trae todos los lados de su propio mercado', async () => {
    const cierre = await pedir([casa('A', 1.9, 2.0), casa('B', 2.0, 1.9), casa('C', 2.1, 1.8)]);
    for (const c of cierre?.porCasa ?? []) {
      expect(c.lados).toHaveLength(2);
      // Y suman por encima del 100 %: es una casa real, con su margen.
      expect(c.lados.reduce((s, l) => s + 1 / l.cuota, 0)).toBeGreaterThan(1);
    }
  });
});

describe('datos imposibles en una instantánea compartida', () => {
  const casa = (titulo: string, a: number, b: number) => ({
    key: titulo.toLowerCase(),
    title: titulo,
    last_update: '2026-04-09T23:10:00Z',
    markets: [
      {
        key: 'h2h',
        last_update: '2026-04-09T23:10:00Z',
        outcomes: [
          { name: 'Chicago Bulls', price: a },
          { name: 'Washington Wizards', price: b },
        ],
      },
    ],
  });

  const evento = (id: string, casas: unknown[]) => ({
    id,
    sport_key: 'basketball_nba',
    commence_time: '2026-04-09T23:12:28Z',
    home_team: 'Washington Wizards',
    away_team: 'Chicago Bulls',
    bookmakers: casas,
  });

  const pedir = (eventos: unknown[]) =>
    new TheOddsApi({
      claveApi: 'x',
      buscar: fetchFalso([
        { contiene: '/historical/', cuerpo: { timestamp: '2026-04-09T23:11:00Z', data: eventos } },
      ]),
    }).cierresDelMomento('NBA', new Date('2026-04-09T23:12:28Z'), 'moneyline');

  it('una casa con cuota 1 no entra en la mediana', async () => {
    /*
     * Una cuota de 1 aparece de verdad en el histórico: es un mercado
     * suspendido. Si se colara, arrastraría la mediana con un número que nunca
     * fue un precio.
     */
    const m = await pedir([
      evento('a', [casa('A', 1.9, 2.0), casa('B', 2.0, 1.9), casa('C', 2.1, 1.8), casa('Rota', 1, 1)]),
    ]);
    expect(m.get('a')?.casas).toBe(3);
    expect(m.get('a')?.lados[0]?.cuota).toBeCloseTo(2.0, 2);
  });

  it('un evento imposible no se lleva por delante a los demás del mismo corte', async () => {
    // Este es el fallo que apareció en producción: un partido con datos rotos
    // abortaba la instantánea entera y dejaba sin cierre a todos los picks del
    // grupo, no solo al suyo.
    const m = await pedir([
      evento('roto', [casa('A', 1, 1), casa('B', 1, 1), casa('C', 1, 1)]),
      evento('bueno', [casa('A', 1.9, 2.0), casa('B', 2.0, 1.9), casa('C', 2.1, 1.8)]),
    ]);
    expect(m.has('roto')).toBe(false);
    expect(m.get('bueno')?.casas).toBe(3);
  });
});
