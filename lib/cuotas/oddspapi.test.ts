import { describe, it, expect } from 'vitest';
import { OddsPapi } from './oddspapi';
import { TOTALES_PAPI, HANDICAP_PAPI } from './oddspapi-catalogo';

/*
 * El fallo que estas pruebas fijan costó cinco renuncias falsas en el
 * registro real.
 *
 * OddsPapi pide el histórico línea a línea, así que el adaptador tiene que
 * elegir cuál trae. Elegía «la principal» —recorría la tabla de la línea más
 * pequeña hacia arriba y paraba en la primera con precio— y en totales esa es
 * siempre el 0.5. Un pick a «Over 2.5» recibía entonces el cierre del
 * «Over 0.5», el robot veía que su línea no estaba, y lo anotaba como línea
 * movida: «no está entre "Over 0.5", "Under 0.5"».
 *
 * Nada de eso saltaba. El cierre era real, el precio era real, y la renuncia
 * era permanente. Los cinco picks se habrían quedado fuera del registro para
 * siempre con una explicación que parecía razonable.
 */

const COMIENZO = '2026-09-06T14:00:00Z';

/** Ids del over y del under de una línea de totales, según el catálogo. */
function totalesDe(linea: number): { idMercado: string; over: string; under: string } {
  for (const [idMercado, salidas] of Object.entries(TOTALES_PAPI)) {
    const ids = Object.entries(salidas).filter(([, l]) => l === linea);
    if (ids.length === 2) {
      const [a, b] = ids.map(([id]) => id) as [string, string];
      // Par es el Over; impar, el Under.
      return Number(a) % 2 === 0
        ? { idMercado, over: a, under: b }
        : { idMercado, over: b, under: a };
    }
  }
  throw new Error(`la tabla de totales no tiene la línea ${linea}`);
}

/**
 * Un OddsPapi falso que solo cuelga precio en las líneas que se le digan.
 *
 * Registra qué resultados se le han pedido, que es lo que de verdad se está
 * comprobando: el orden en que el adaptador recorre la tabla. La ruta
 * `bookmakers → markets → outcomes → players` se construye entera a
 * propósito; simplificarla daría un verde falso.
 */
function papiConSeries(series: Record<string, { idMercado: string; precio: number }>) {
  const pedidos: string[] = [];

  const buscar = (async (entrada: string | URL) => {
    const url = new URL(entrada.toString());
    const responder = (cuerpo: unknown) =>
      new Response(JSON.stringify(cuerpo), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });

    if (url.pathname.endsWith('/participants')) {
      return responder({ '1': 'Brentford FC', '2': 'Sunderland AFC' });
    }
    if (url.pathname.endsWith('/fixtures')) {
      return responder([
        {
          fixtureId: 'id999',
          participant1Id: 1,
          participant2Id: 2,
          startTime: COMIENZO,
          statusName: 'Finished',
        },
      ]);
    }
    if (url.pathname.endsWith('/historical-odds')) {
      const outcomeId = url.searchParams.get('outcomeId') ?? '';
      pedidos.push(outcomeId);
      const s = series[outcomeId];
      if (s === undefined) return responder({});
      return responder({
        bookmakers: {
          'betfair-ex': {
            markets: {
              [s.idMercado]: {
                outcomes: {
                  [outcomeId]: {
                    players: {
                      '0': [
                        { createdAt: '2026-09-06T10:00:00Z', price: s.precio + 0.1 },
                        { createdAt: '2026-09-06T13:59:00Z', price: s.precio },
                        // Posterior al saque: no debe entrar en el cierre.
                        { createdAt: '2026-09-06T14:30:00Z', price: 9.9 },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      });
    }
    return new Response('{}', { status: 404 });
  }) as typeof fetch;

  return { buscar, pedidos };
}

const evento = {
  id: 'id999',
  deporte: 'PremierLeague' as const,
  comienzo: new Date(COMIENZO),
};

describe('el cierre se pide alrededor de la línea del pick', () => {
  it('trae el 2.5 aunque el 0.5 también tenga precio', async () => {
    const l25 = totalesDe(2.5);
    const l05 = totalesDe(0.5);
    const { buscar, pedidos } = papiConSeries({
      [l25.over]: { idMercado: l25.idMercado, precio: 1.9 },
      [l25.under]: { idMercado: l25.idMercado, precio: 1.95 },
      [l05.over]: { idMercado: l05.idMercado, precio: 1.05 },
      [l05.under]: { idMercado: l05.idMercado, precio: 11.0 },
    });

    const cierre = await new OddsPapi({ claveApi: 'x', buscar, pausaMs: 0 }).cuotasDeCierre(
      evento,
      'totales',
      2.5,
    );

    const etiquetas = (cierre?.lados ?? []).map((l) => l.etiqueta);
    expect(etiquetas).toContain('Over 2.5');
    expect(etiquetas).toContain('Under 2.5');

    // El precio es el último ANTERIOR al saque, no el posterior ni el primero.
    expect(cierre?.lados.find((l) => l.etiqueta === 'Over 2.5')?.cuota).toBe(1.9);

    // Y lo primero que se pide es la línea del pick, no la más pequeña.
    expect(pedidos[0]).toBe(l25.over);
  });

  it('sin la pista se comporta como antes y empieza por el centro', async () => {
    const l05 = totalesDe(0.5);
    const { buscar, pedidos } = papiConSeries({
      [l05.over]: { idMercado: l05.idMercado, precio: 1.05 },
      [l05.under]: { idMercado: l05.idMercado, precio: 11.0 },
    });

    await new OddsPapi({ claveApi: 'x', buscar, pausaMs: 0 }).cuotasDeCierre(evento, 'totales');
    expect(pedidos[0]).toBe(l05.over);
  });

  it('acumula vecinas: la escalera necesita más de una línea', async () => {
    const l25 = totalesDe(2.5);
    const l15 = totalesDe(1.5);
    const l35 = totalesDe(3.5);
    const { buscar } = papiConSeries({
      [l25.over]: { idMercado: l25.idMercado, precio: 1.9 },
      [l25.under]: { idMercado: l25.idMercado, precio: 1.95 },
      [l15.over]: { idMercado: l15.idMercado, precio: 1.3 },
      [l15.under]: { idMercado: l15.idMercado, precio: 3.6 },
      [l35.over]: { idMercado: l35.idMercado, precio: 3.4 },
      [l35.under]: { idMercado: l35.idMercado, precio: 1.32 },
    });

    const cierre = await new OddsPapi({ claveApi: 'x', buscar, pausaMs: 0 }).cuotasDeCierre(
      evento,
      'totales',
      2.5,
    );

    const lineas = new Set(
      (cierre?.lados ?? []).map((l) => l.etiqueta.replace(/^(Over|Under) /, '')),
    );
    expect(lineas).toEqual(new Set(['1.5', '2.5', '3.5']));
  });

  it('una línea a medias no entra: sin las dos patas no hay margen', async () => {
    /*
     * Si se colara el Over sin su Under, el mercado sumaría menos del 100 % y
     * el de-vig repartiría sobre un margen inventado. Ya pasó una vez y
     * produjo una cuota «justa» de 2,68 donde el cierre bruto era 1,67.
     */
    const l25 = totalesDe(2.5);
    const l35 = totalesDe(3.5);
    const { buscar } = papiConSeries({
      [l25.over]: { idMercado: l25.idMercado, precio: 1.9 },
      // falta l25.under a propósito
      [l35.over]: { idMercado: l35.idMercado, precio: 3.4 },
      [l35.under]: { idMercado: l35.idMercado, precio: 1.32 },
    });

    const cierre = await new OddsPapi({ claveApi: 'x', buscar, pausaMs: 0 }).cuotasDeCierre(
      evento,
      'totales',
      2.5,
    );

    expect((cierre?.lados ?? []).map((l) => l.etiqueta)).toEqual(['Over 3.5', 'Under 3.5']);
  });

  it('sin ninguna línea con precio no se inventa un cierre', async () => {
    const { buscar } = papiConSeries({});
    const cierre = await new OddsPapi({ claveApi: 'x', buscar, pausaMs: 0 }).cuotasDeCierre(
      evento,
      'totales',
      2.5,
    );
    expect(cierre).toBeNull();
  });

  it('en hándicap el orden también arranca en la línea apostada', async () => {
    const par = Object.entries(HANDICAP_PAPI).find(([, s]) =>
      Object.values(s).some((l) => l === -2.25),
    );
    expect(par).toBeDefined();
    const [idMercado, salidas] = par as [string, Record<string, number>];
    const ids = Object.keys(salidas) as [string, string];

    const { buscar, pedidos } = papiConSeries({
      [ids[0]]: { idMercado, precio: 2.1 },
      [ids[1]]: { idMercado, precio: 1.8 },
    });

    await new OddsPapi({ claveApi: 'x', buscar, pausaMs: 0 }).cuotasDeCierre(
      evento,
      'handicap',
      -2.25,
    );
    expect(ids).toContain(pedidos[0]);
  });
});
