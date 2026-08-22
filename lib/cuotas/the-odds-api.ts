/**
 * Adaptador de The Odds API (v4).
 *
 * Traduce sus respuestas a los tipos de `dominio.ts`. Nada de lo que hay aquí
 * debe escaparse fuera de este fichero: si mañana se cambia de proveedor, solo
 * se reescribe este adaptador.
 *
 * La forma de la respuesta está verificada contra la API real el 2026-08-21,
 * no deducida de la documentación:
 *
 *   { id, sport_key, commence_time, home_team, away_team,
 *     bookmakers: [ { key, title, last_update,
 *                     markets: [ { key, last_update,
 *                                  outcomes: [ { name, price, point? } ] } ] } ] }
 *
 * Y el histórico envuelve eso en:
 *   { timestamp, previous_timestamp, next_timestamp, data: [ ...eventos ] }
 */
import {
  type Capacidades,
  type CriterioBusqueda,
  type CuotasDeCierre,
  type Deporte,
  type Evento,
  type Mercado,
  type PrecioDeMercado,
  type ProveedorDeCuotas,
  type ReferenciaEvento,
  type ResultadoEvento,
  ErrorProveedor,
  ErrorCuotaAgotada,
  validarCuotasDeCierre,
} from './dominio';

const BASE = 'https://api.the-odds-api.com/v4';
const NOMBRE = 'the-odds-api';

/**
 * Nuestros deportes a los suyos.
 *
 * `basketball_euroleague` figura como inactivo fuera de temporada y la API lo
 * oculta salvo que se pida `all=true`. Está cubierto: no confundir "inactivo
 * en agosto" con "no soportado".
 */
const DEPORTE_API: Record<Deporte, string> = {
  NBA: 'basketball_nba',
  Euroliga: 'basketball_euroleague',
  MLB: 'baseball_mlb',
};

/** Nuestros mercados a los suyos. `h2h` es lo que ellos llaman al moneyline. */
const MERCADO_API: Record<Mercado, string> = {
  moneyline: 'h2h',
  handicap: 'spreads',
  totales: 'totals',
};

// --- Forma de la respuesta, aislada aquí ------------------------------------

interface ResultadoAPI {
  name: string;
  price: number;
  point?: number;
}
interface MercadoAPI {
  key: string;
  last_update: string;
  outcomes: ResultadoAPI[];
}
interface CasaAPI {
  key: string;
  title: string;
  last_update: string;
  markets: MercadoAPI[];
}
interface EventoAPI {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers?: CasaAPI[];
}
interface HistoricoAPI {
  timestamp: string;
  data: EventoAPI[];
}
interface ResultadoAPI2 {
  id: string;
  completed?: boolean;
  commence_time: string;
  home_team: string;
  away_team: string;
  last_update?: string;
  scores?: { name: string; score: string }[] | null;
}

export interface OpcionesTheOddsApi {
  claveApi: string;
  /** Regiones de casas de apuestas. Brasil se cubre mejor con 'eu' y 'us'. */
  regiones?: string;
  /** Inyectable para poder probar el mapeo sin tocar la red ni gastar cuota. */
  buscar?: typeof fetch;
}

export class TheOddsApi implements ProveedorDeCuotas {
  readonly nombre = NOMBRE;
  private readonly clave: string;
  private readonly regiones: string;
  private readonly buscar: typeof fetch;
  /** Última cuota conocida, leída de las cabeceras de cada respuesta. */
  private peticionesRestantes: number | null = null;

  constructor(opciones: OpcionesTheOddsApi) {
    if (!opciones.claveApi) {
      throw new ErrorProveedor(NOMBRE, 'Falta la clave de API (THE_ODDS_API_KEY).');
    }
    this.clave = opciones.claveApi;
    this.regiones = opciones.regiones ?? 'us,eu';
    this.buscar = opciones.buscar ?? fetch;
  }

  capacidades(): Capacidades {
    return {
      deportes: ['NBA', 'Euroliga', 'MLB'],
      mercados: ['moneyline', 'handicap', 'totales'],
      historico: true,
    };
  }

  /** Cuota restante según la última respuesta. `null` si aún no se ha llamado. */
  cuotaRestante(): number | null {
    return this.peticionesRestantes;
  }

  private async pedir<T>(ruta: string, parametros: Record<string, string>): Promise<T> {
    const url = new URL(`${BASE}${ruta}`);
    url.searchParams.set('apiKey', this.clave);
    for (const [k, v] of Object.entries(parametros)) url.searchParams.set(k, v);

    let respuesta: Response;
    try {
      respuesta = await this.buscar(url, { signal: AbortSignal.timeout(20_000) });
    } catch (causa) {
      throw new ErrorProveedor(NOMBRE, 'No se pudo contactar con la API.', causa);
    }

    const restantes = respuesta.headers.get('x-requests-remaining');
    if (restantes !== null) this.peticionesRestantes = Number(restantes);

    /*
     * 401 y 429 se distinguen del resto porque no se arreglan reintentando:
     * obligan a cambiar de proveedor o de clave. El resto sí puede ser transitorio.
     */
    if (respuesta.status === 429) throw new ErrorCuotaAgotada(NOMBRE);
    if (respuesta.status === 401) {
      throw new ErrorProveedor(NOMBRE, 'Clave de API rechazada.');
    }
    if (!respuesta.ok) {
      throw new ErrorProveedor(NOMBRE, `La API respondió HTTP ${respuesta.status}.`);
    }

    try {
      return (await respuesta.json()) as T;
    } catch (causa) {
      throw new ErrorProveedor(NOMBRE, 'La respuesta no era JSON válido.', causa);
    }
  }

  /** Mediana de una lista de precios. */
  private static mediana(xs: number[]): number {
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? (s[m] as number) : (((s[m - 1] as number) + (s[m] as number)) / 2);
  }

  private aEvento(bruto: EventoAPI, deporte: Deporte): Evento {
    /*
     * Los precios ya vienen en esta misma respuesta, así que calcular la
     * mediana no cuesta ninguna petición extra. Antes se descartaban.
     */
    const mercado: PrecioDeMercado[] = [];
    for (const lado of [bruto.away_team, bruto.home_team]) {
      const precios = (bruto.bookmakers ?? []).flatMap(
        (c) =>
          c.markets
            .find((m) => m.key === 'h2h')
            ?.outcomes.filter((o) => o.name === lado)
            .map((o) => o.price) ?? [],
      );
      // Con menos de tres casas la mediana no es representativa: mejor nada.
      if (precios.length >= 3) {
        mercado.push({
          lado,
          mediana: Math.round(TheOddsApi.mediana(precios) * 100) / 100,
          casas: precios.length,
        });
      }
    }

    return {
      id: bruto.id,
      deporte,
      local: bruto.home_team,
      visitante: bruto.away_team,
      comienzo: new Date(bruto.commence_time),
      ...(mercado.length > 0 ? { mercado } : {}),
    };
  }

  /**
   * Marcadores de los partidos terminados.
   *
   * Forma verificada contra la API el 2026-08-22:
   *   { id, completed, home_team, away_team,
   *     scores: [ { name, score } ], last_update }
   *
   * `scores` llega como texto y puede venir a null mientras el partido no ha
   * terminado; se descarta lo que no sea un número para no resolver una
   * apuesta con un marcador a medias.
   */
  async resultados(deporte: Deporte, diasAtras: number): Promise<ResultadoEvento[]> {
    const brutos = await this.pedir<ResultadoAPI2[]>(
      `/sports/${DEPORTE_API[deporte]}/scores/`,
      { daysFrom: String(Math.max(1, Math.min(3, diasAtras))) },
    );

    return brutos.map((b) => ({
      eventoId: b.id,
      terminado: b.completed === true,
      local: b.home_team,
      visitante: b.away_team,
      comienzo: new Date(b.commence_time),
      marcador: (b.scores ?? [])
        .map((s) => ({ equipo: s.name, puntos: Number(s.score) }))
        .filter((s) => Number.isFinite(s.puntos)),
      actualizadoEn: new Date(b.last_update ?? b.commence_time),
    }));
  }

  async buscarEventos(criterio: CriterioBusqueda): Promise<Evento[]> {
    const clave = DEPORTE_API[criterio.deporte];
    const brutos = await this.pedir<EventoAPI[]>(`/sports/${clave}/odds/`, {
      regions: this.regiones,
      markets: 'h2h',
      oddsFormat: 'decimal',
    });

    return brutos
      .map((b) => this.aEvento(b, criterio.deporte))
      .filter((e) => {
        if (criterio.desde && e.comienzo < criterio.desde) return false;
        if (criterio.hasta && e.comienzo > criterio.hasta) return false;
        return true;
      });
  }

  /**
   * Extrae las dos cuotas de un mercado de una casa concreta.
   *
   * Se exigen exactamente dos resultados. Un mercado de tres vías o uno a
   * medio poblar se descarta aquí y no más abajo: el de-vig de `lib/clv.ts`
   * asume dos salidas y darle tres produciría un número sin significado.
   */
  private extraer(casa: CasaAPI, mercado: Mercado): { a: ResultadoAPI; b: ResultadoAPI } | null {
    const m = casa.markets.find((x) => x.key === MERCADO_API[mercado]);
    if (!m || m.outcomes.length !== 2) return null;
    const [a, b] = m.outcomes;
    return a && b ? { a, b } : null;
  }

  /**
   * Etiqueta legible del lado.
   *
   * El signo solo se pone en el hándicap, donde +5,5 y -5,5 son apuestas
   * distintas. En totales el punto es un umbral: «Over 5,5» está bien y
   * «Over +5,5» no significa nada.
   */
  private etiquetar(resultado: ResultadoAPI, mercado: Mercado): string {
    if (resultado.point === undefined) return resultado.name;
    if (mercado === 'handicap') {
      return `${resultado.name} ${resultado.point > 0 ? '+' : ''}${resultado.point}`;
    }
    return `${resultado.name} ${resultado.point}`;
  }

  /**
   * Cuotas de cierre de un evento ya empezado.
   *
   * El histórico de esta API funciona por instantáneas: se pide un momento y
   * devuelve la más cercana. Se pide el instante del comienzo, que es la
   * definición de línea de cierre.
   */
  async cuotasDeCierre(
    evento: ReferenciaEvento,
    mercado: Mercado,
  ): Promise<CuotasDeCierre | null> {
    /*
     * Una sola petición al histórico, indexada por deporte y momento de
     * comienzo. La versión anterior buscaba primero el evento entre los
     * próximos partidos, lo que además de gastar peticiones no podía
     * funcionar: un partido ya jugado no está en esa lista.
     */
    const instantanea = await this.pedir<HistoricoAPI>(
      `/historical/sports/${DEPORTE_API[evento.deporte]}/odds/`,
      {
        regions: this.regiones,
        markets: MERCADO_API[mercado],
        oddsFormat: 'decimal',
        // Sin milisegundos: `toISOString()` produce ".000Z" y la API responde
        // 422 con INVALID_HISTORICAL_TIMESTAMP. Verificado contra la API real.
        date: `${evento.comienzo.toISOString().slice(0, 19)}Z`,
      },
    );

    const enCierre = instantanea.data.find((e) => e.id === evento.id);
    if (!enCierre) return null;

    const consenso = this.consenso(enCierre, mercado, evento.id, instantanea.timestamp);
    if (consenso !== null) return consenso;

    /*
     * Respaldo: una sola casa. Solo se llega aquí si el mercado no está lo
     * bastante poblado como para que una mediana signifique algo — por ejemplo
     * un hándicap donde cada casa cuelga una línea distinta.
     */
    const casa = enCierre.bookmakers?.find((c) => this.extraer(c, mercado) !== null);
    if (!casa) return null;

    const par = this.extraer(casa, mercado);
    if (par === null) return null;

    return validarCuotasDeCierre(NOMBRE, {
      eventoId: evento.id,
      mercado,
      ladoA: { etiqueta: this.etiquetar(par.a, mercado), cuota: par.a.price },
      ladoB: { etiqueta: this.etiquetar(par.b, mercado), cuota: par.b.price },
      capturadoEn: new Date(casa.last_update),
      casa: casa.title,
      casas: 1,
    });
  }

  /**
   * Cierre de consenso: la mediana de las casas que cuelgan el MISMO par de
   * lados.
   *
   * Antes se cogía la primera casa que tuviera el mercado. Eso metía un sesgo
   * silencioso: los picks se registran a la mediana de treinta casas, así que
   * medir su cierre contra una casa cualquiera comparaba dos cosas distintas y
   * el ruido se colaba en el CLV como si fuera habilidad (o su falta).
   *
   * Se agrupa por PAR de etiquetas y no por lado suelto a propósito. En
   * hándicaps y totales cada casa puede colgar una línea diferente, y mezclar
   * un «Más 5,5» con un «Más 6,5» produciría una mediana de dos mercados que
   * no existen juntos en ninguna parte.
   */
  private consenso(
    evento: EventoAPI,
    mercado: Mercado,
    eventoId: string,
    instante: string,
  ): CuotasDeCierre | null {
    const grupos = new Map<string, { a: string; b: string; precios: [number[], number[]] }>();

    for (const casa of evento.bookmakers ?? []) {
      const par = this.extraer(casa, mercado);
      if (par === null) continue;
      const a = this.etiquetar(par.a, mercado);
      const b = this.etiquetar(par.b, mercado);
      const clave = `${a} ${b}`;
      const grupo = grupos.get(clave) ?? { a, b, precios: [[], []] };
      grupo.precios[0].push(par.a.price);
      grupo.precios[1].push(par.b.price);
      grupos.set(clave, grupo);
    }

    let mejor: { a: string; b: string; precios: [number[], number[]] } | null = null;
    for (const g of grupos.values()) {
      if (mejor === null || g.precios[0].length > mejor.precios[0].length) mejor = g;
    }

    // Con menos de tres casas la mediana no representa a ningún mercado.
    if (mejor === null || mejor.precios[0].length < 3) return null;

    const redondear = (x: number) => Math.round(x * 100) / 100;

    return validarCuotasDeCierre(NOMBRE, {
      eventoId,
      mercado,
      ladoA: { etiqueta: mejor.a, cuota: redondear(TheOddsApi.mediana(mejor.precios[0])) },
      ladoB: { etiqueta: mejor.b, cuota: redondear(TheOddsApi.mediana(mejor.precios[1])) },
      /* El instante de la instantánea, no el `last_update` de una casa: el dato
         es de todas ellas, así que la fecha honesta es la del corte. */
      capturadoEn: new Date(instante),
      casa: `mediana de ${mejor.precios[0].length} casas`,
      casas: mejor.precios[0].length,
    });
  }
}
