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
  type ProveedorDeCuotas,
  type ReferenciaEvento,
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

  private aEvento(bruto: EventoAPI, deporte: Deporte): Evento {
    return {
      id: bruto.id,
      deporte,
      local: bruto.home_team,
      visitante: bruto.away_team,
      comienzo: new Date(bruto.commence_time),
    };
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
    const casa = enCierre?.bookmakers?.find((c) => this.extraer(c, mercado) !== null);
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
    });
  }
}
