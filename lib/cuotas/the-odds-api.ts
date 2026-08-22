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
  DEPORTES,
  EMPATE,
  VIAS,
  esFutbol,
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
  /*
   * Claves verificadas contra `/v4/sports?all=true` el 2026-08-22. Las cinco
   * de fútbol sudamericano estaban activas; las copas europeas figuran
   * inactivas fuera de temporada, igual que la Euroliga, y eso no significa
   * que no estén cubiertas.
   */
  Brasileirao: 'soccer_brazil_campeonato',
  BrasileiraoB: 'soccer_brazil_serie_b',
  Libertadores: 'soccer_conmebol_copa_libertadores',
  Sudamericana: 'soccer_conmebol_copa_sudamericana',
  PremierLeague: 'soccer_epl',
  LaLiga: 'soccer_spain_la_liga',
  SerieA: 'soccer_italy_serie_a',
  Bundesliga: 'soccer_germany_bundesliga',
  Ligue1: 'soccer_france_ligue_one',
  Champions: 'soccer_uefa_champs_league',
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
      deportes: DEPORTES,
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

  private aEvento(bruto: EventoAPI, deporte: Deporte, mercado: Mercado = 'moneyline'): Evento {
    /*
     * Los precios ya vienen en esta misma respuesta, así que calcular la
     * mediana no cuesta ninguna petición extra. Antes se descartaban.
     */
    const claveMercado = MERCADO_API[mercado];
    /*
     * En moneyline los lados son los equipos y se conocen de antemano. En
     * hándicap y totales llevan la línea pegada —«Boston Celtics -1.5»— y hay
     * que sacarlos de lo que cuelgue cada casa, porque no todas cuelgan la
     * misma línea.
     */
    const etiquetar = (o: ResultadoAPI) =>
      o.point === undefined
        ? o.name
        : mercado === 'handicap'
          ? `${o.name} ${o.point > 0 ? '+' : ''}${o.point}`
          : `${o.name} ${o.point}`;

    const lados =
      mercado === 'moneyline'
        ? esFutbol(deporte)
          ? [bruto.away_team, EMPATE, bruto.home_team]
          : [bruto.away_team, bruto.home_team]
        : [
            ...new Set(
              (bruto.bookmakers ?? []).flatMap(
                (c) => c.markets.find((m) => m.key === claveMercado)?.outcomes.map(etiquetar) ?? [],
              ),
            ),
          ];

    const precioDeMercado: PrecioDeMercado[] = [];
    for (const lado of lados) {
      const precios = (bruto.bookmakers ?? []).flatMap(
        (c) =>
          c.markets
            .find((m) => m.key === claveMercado)
            ?.outcomes.filter((o) => etiquetar(o) === lado)
            .map((o) => o.price) ?? [],
      );
      // Con menos de tres casas la mediana no es representativa: mejor nada.
      if (precios.length >= 3) {
        precioDeMercado.push({
          lado,
          mediana: Math.round(TheOddsApi.mediana(precios) * 100) / 100,
          casas: precios.length,
        });
      }
    }

    /*
     * Lo que ofrece cada casa, tal cual. Se conserva porque un pick tiene que
     * poder registrar un precio real: la mediana no la ofrece nadie.
     */
    const porCasa = (bruto.bookmakers ?? [])
      .map((c) => {
        const m = c.markets.find((x) => x.key === claveMercado);
        return {
          casa: c.title,
          lados: (m?.outcomes ?? [])
            .filter((o) => lados.includes(etiquetar(o)))
            .map((o) => ({ lado: etiquetar(o), cuota: o.price })),
        };
      })
      /* Una casa que no cuelga todos los lados no sirve: sin el contrario no
         hay margen que quitar, y sin margen no hay ventaja que valga. */
      .filter((c) => c.lados.length >= 2);

    return {
      id: bruto.id,
      deporte,
      local: bruto.home_team,
      visitante: bruto.away_team,
      comienzo: new Date(bruto.commence_time),
      ...(precioDeMercado.length > 0 ? { mercado: precioDeMercado } : {}),
      ...(porCasa.length > 0 ? { porCasa } : {}),
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
    const mercado = criterio.mercado ?? 'moneyline';
    const brutos = await this.pedir<EventoAPI[]>(`/sports/${clave}/odds/`, {
      regions: this.regiones,
      markets: MERCADO_API[mercado],
      oddsFormat: 'decimal',
    });

    return brutos
      .map((b) => this.aEvento(b, criterio.deporte, mercado))
      .filter((e) => {
        if (criterio.desde && e.comienzo < criterio.desde) return false;
        if (criterio.hasta && e.comienzo > criterio.hasta) return false;
        return true;
      });
  }

  /**
   * Extrae las cuotas de un mercado de una casa concreta.
   *
   * Se exige exactamente el número de salidas del deporte: dos en baloncesto
   * y béisbol, tres en fútbol. Un mercado a medio poblar se descarta aquí y no
   * más abajo — un fútbol sin el empate parece de dos vías, suma mucho menos
   * de lo que debe y produciría un margen y una ventaja inventados.
   */
  private extraer(casa: CasaAPI, mercado: Mercado, vias: 2 | 3): ResultadoAPI[] | null {
    const m = casa.markets.find((x) => x.key === MERCADO_API[mercado]);
    if (!m || m.outcomes.length !== vias) return null;
    return m.outcomes.every((o) => typeof o?.price === 'number') ? m.outcomes : null;
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
    const todos = await this.cierresDelMomento(evento.deporte, evento.comienzo, mercado);
    return todos.get(evento.id) ?? null;
  }

  /**
   * Todos los cierres de una instantánea, indexados por evento.
   *
   * Esta es la forma barata de preguntar y la razón de que exista el método.
   * El histórico cuesta 20 peticiones por consulta y devuelve TODOS los
   * partidos de esa competición a esa hora, así que pedir uno por uno los
   * cierres de tres partidos que empiezan a la misma hora cuesta 60 en vez de
   * 20. Con un solo usuario da igual; con cien, es la diferencia entre que el
   * producto se sostenga y que no.
   */
  async cierresDelMomento(
    deporte: Deporte,
    comienzo: Date,
    mercado: Mercado,
  ): Promise<Map<string, CuotasDeCierre>> {
    const instantanea = await this.pedir<HistoricoAPI>(
      `/historical/sports/${DEPORTE_API[deporte]}/odds/`,
      {
        regions: this.regiones,
        markets: MERCADO_API[mercado],
        oddsFormat: 'decimal',
        // Sin milisegundos: `toISOString()` produce ".000Z" y la API responde
        // 422 con INVALID_HISTORICAL_TIMESTAMP. Verificado contra la API real.
        date: `${comienzo.toISOString().slice(0, 19)}Z`,
      },
    );

    const vias = VIAS[deporte];
    const salida = new Map<string, CuotasDeCierre>();

    for (const bruto of instantanea.data) {
      const consenso = this.consenso(bruto, mercado, bruto.id, instantanea.timestamp, vias);
      if (consenso !== null) {
        salida.set(bruto.id, consenso);
        continue;
      }

      /*
       * Respaldo: una sola casa. Solo se llega aquí si el mercado no está lo
       * bastante poblado como para que una mediana signifique algo — por
       * ejemplo un hándicap donde cada casa cuelga una línea distinta.
       */
      const casa = bruto.bookmakers?.find((c) => this.extraer(c, mercado, vias) !== null);
      const salidas = casa ? this.extraer(casa, mercado, vias) : null;
      if (!casa || salidas === null) continue;

      try {
        salida.set(
          bruto.id,
          validarCuotasDeCierre(
            NOMBRE,
            {
              eventoId: bruto.id,
              mercado,
              lados: salidas.map((o) => ({ etiqueta: this.etiquetar(o, mercado), cuota: o.price })),
              capturadoEn: new Date(casa.last_update),
              casa: casa.title,
              casas: 1,
              porCasa: [
                {
                  casa: casa.title,
                  lados: salidas.map((o) => ({
                    etiqueta: this.etiquetar(o, mercado),
                    cuota: o.price,
                  })),
                },
              ],
            },
            vias,
          ),
        );
      } catch {
        /*
         * Un partido con datos imposibles se descarta y no tumba a los demás
         * de la misma instantánea. Antes, con una petición por evento, ese
         * fallo solo afectaba a su pick; ahora que van juntos, dejar que
         * propague costaría los cierres de todo el grupo.
         */
      }
    }

    return salida;
  }

  /**
   * Cierre de consenso: la mediana de las casas que cuelgan el MISMO conjunto
   * de lados.
   *
   * Antes se cogía la primera casa que tuviera el mercado. Eso metía un sesgo
   * silencioso: los picks se registran a la mediana de treinta casas, así que
   * medir su cierre contra una casa cualquiera comparaba dos cosas distintas y
   * el ruido se colaba en el CLV como si fuera habilidad (o su falta).
   *
   * Se agrupa por CONJUNTO de etiquetas y no por lado suelto a propósito. En
   * hándicaps y totales cada casa puede colgar una línea diferente, y mezclar
   * un «Más 5,5» con un «Más 6,5» produciría una mediana de dos mercados que
   * no existen juntos en ninguna parte. Las etiquetas se ordenan para la clave
   * pero cada lado guarda su propia lista: en fútbol las casas no siempre
   * devuelven local, empate y visitante en el mismo orden.
   */
  private consenso(
    evento: EventoAPI,
    mercado: Mercado,
    eventoId: string,
    instante: string,
    vias: 2 | 3,
  ): CuotasDeCierre | null {
    const grupos = new Map<string, Map<string, number[]>>();
    const porCasa: { casa: string; lados: { etiqueta: string; cuota: number }[] }[] = [];

    for (const casa of evento.bookmakers ?? []) {
      const salidas = this.extraer(casa, mercado, vias);
      if (salidas === null) continue;

      const etiquetas = salidas.map((o) => this.etiquetar(o, mercado));
      porCasa.push({
        casa: casa.title,
        lados: salidas.map((o, i) => ({ etiqueta: etiquetas[i] as string, cuota: o.price })),
      });
      const clave = [...etiquetas].sort().join(' | ');
      const grupo = grupos.get(clave) ?? new Map<string, number[]>();
      etiquetas.forEach((e, i) => {
        const precios = grupo.get(e) ?? [];
        precios.push((salidas[i] as ResultadoAPI).price);
        grupo.set(e, precios);
      });
      grupos.set(clave, grupo);
    }

    let mejor: Map<string, number[]> | null = null;
    let casas = 0;
    for (const g of grupos.values()) {
      const n = Math.min(...[...g.values()].map((v) => v.length));
      if (n > casas) {
        casas = n;
        mejor = g;
      }
    }

    // Con menos de tres casas la mediana no representa a ningún mercado.
    if (mejor === null || casas < 3) return null;

    const redondear = (x: number) => Math.round(x * 100) / 100;

    return validarCuotasDeCierre(
      NOMBRE,
      {
        eventoId,
        mercado,
        lados: [...mejor.entries()].map(([etiqueta, precios]) => ({
          etiqueta,
          cuota: redondear(TheOddsApi.mediana(precios)),
        })),
        /* El instante de la instantánea, no el `last_update` de una casa: el dato
           es de todas ellas, así que la fecha honesta es la del corte. */
        capturadoEn: new Date(instante),
        casa: `mediana de ${casas} casas`,
        casas,
        porCasa,
      },
      vias,
    );
  }
}
