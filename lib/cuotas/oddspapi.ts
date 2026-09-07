import {
  ErrorProveedor,
  ErrorCuotaAgotada,
  validarCuotasDeCierre,
  viasDe,
  EMPATE,
  type Capacidades,
  type CriterioBusqueda,
  type CuotasDeCierre,
  type Deporte,
  type Evento,
  type Mercado,
  type ProveedorDeCuotas,
  type ReferenciaEvento,
  type ResultadoEvento,
} from './dominio';
import {
  TORNEO_PAPI,
  TOTALES_PAPI,
  HANDICAP_PAPI,
  MERCADO_1X2,
  RESULTADO_LOCAL,
  RESULTADO_EMPATE,
  RESULTADO_VISITANTE,
  esParticipante1,
} from './oddspapi-catalogo';

/**
 * Adaptador de OddsPapi.
 *
 * Existe por dos motivos, y el orden importa. El primero es de dinero: The
 * Odds API cobra 20 peticiones por cada instantánea del histórico y la
 * calculadora pública se estaba comiendo la cuota que necesita el registro.
 * El segundo es de calidad, y resultó ser el bueno: aquí el histórico no es
 * una foto en el instante del saque, es la SERIE TEMPORAL completa de precios.
 * El cierre pasa a ser lo que de verdad significa esa palabra —el último
 * precio antes de empezar— en vez de lo que hubiera en un momento elegido.
 *
 * Lo que este proveedor NO puede hacer, y hay que tener presente:
 *
 *   - Una sola casa, Betfair Exchange, que es lo que incluye la suscripción.
 *     No hay mediana de veinte casas ni «la más afilada del corte». A cambio,
 *     el exchange es el mercado más afilado que existe: márgenes por debajo
 *     del 1 %, así que como referencia única es defendible.
 *   - Sus identificadores de partido son suyos. NO se cruzan con los de The
 *     Odds API: los nombres difieren («Real Sociedad San Sebastian» frente a
 *     «Real Sociedad») y emparejar por aproximación produciría un cierre
 *     creíble y falso. Cada proveedor cierra los picks que él mismo abrió.
 */

const NOMBRE = 'oddspapi';
const BASE = 'https://api.oddspapi.io/v4';
const CASA = 'betfair-ex';
/** Como se le llama a la casa de cara al usuario. */
const CASA_LEGIBLE = 'Betfair Exchange';

/** Separación mínima entre peticiones. Medido: por debajo salta el 429. */
const PAUSA_MS = 1500;
/** Si aun así salta, se espera de verdad antes del único reintento. */
const ESPERA_TRAS_LIMITE_MS = 20_000;

/*
 * Cuántas líneas del mercado se traen y cuántas se está dispuesto a probar.
 *
 * Aquí cada línea son dos peticiones al histórico, y con el freno puesto eso
 * es tiempo real: los dos números son el presupuesto de una pasada, no una
 * preferencia. Tres líneas bastan para tener la apostada y una vecina a cada
 * lado, que es todo lo que `precioEnLinea` necesita para deducir; ocho
 * intentos dan margen para saltarse las líneas muertas de alrededor sin
 * recorrer las cincuenta y tantas de la tabla del hándicap.
 */
const LINEAS_DE_ESCALERA = 3;
const MAXIMOS_INTENTOS = 8;

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Precio de un resultado en un instante. */
interface PuntoAPI {
  createdAt: string;
  price: number;
  active?: boolean;
}

interface JugadorAPI {
  price?: number;
  active?: boolean;
  exchangeMeta?: { bookmakerHandicap?: number | null } | null;
}

interface MercadoAPI {
  outcomes?: Record<string, { players?: Record<string, JugadorAPI> }>;
}

interface PartidoAPI {
  fixtureId: string;
  participant1Id: number;
  participant2Id: number;
  tournamentId?: number;
  startTime: string;
  statusName?: string;
  bookmakerOdds?: Record<string, { markets?: Record<string, MercadoAPI> }>;
}

export interface OpcionesOddsPapi {
  claveApi: string;
  buscar?: typeof fetch;
  /** Solo para los tests: sin esto un cierre de tres líneas tarda diez segundos. */
  pausaMs?: number;
}

export class OddsPapi implements ProveedorDeCuotas {
  readonly nombre = NOMBRE;
  private readonly claveApi: string;
  private readonly buscar: typeof fetch;
  /** Los nombres de equipo son medio mega y no cambian: se piden una vez. */
  private participantes: Map<number, Record<string, string>> = new Map();
  private ultimaPeticion = 0;
  private readonly pausaMs: number;

  constructor(opciones: OpcionesOddsPapi) {
    this.claveApi = opciones.claveApi;
    this.buscar = opciones.buscar ?? fetch;
    this.pausaMs = opciones.pausaMs ?? PAUSA_MS;
  }

  capacidades(): Capacidades {
    return {
      deportes: Object.keys(TORNEO_PAPI) as Deporte[],
      mercados: ['moneyline', 'handicap', 'totales'],
      historico: true,
    };
  }

  /**
   * Espacia las peticiones y reintenta una vez si llega el límite.
   *
   * OddsPapi limita por minuto y el histórico lo toca enseguida: un cierre de
   * 1X2 son tres llamadas seguidas. Ir con la pausa puesta desde dentro evita
   * que cada sitio que use el adaptador tenga que acordarse — y el reintento
   * único, con una espera larga, distingue «vas rápido» de «no hay cuota».
   */
  private async conFreno<T>(hacer: () => Promise<T>): Promise<T> {
    const desde = Date.now() - this.ultimaPeticion;
    if (desde < this.pausaMs) await espera(this.pausaMs - desde);
    this.ultimaPeticion = Date.now();
    try {
      return await hacer();
    } catch (fallo) {
      if (!(fallo instanceof ErrorCuotaAgotada)) throw fallo;
      await espera(ESPERA_TRAS_LIMITE_MS);
      this.ultimaPeticion = Date.now();
      return hacer();
    }
  }

  private async pedir<T>(ruta: string, parametros: Record<string, string>): Promise<T> {
    return this.conFreno(() => this.pedirSinFreno<T>(ruta, parametros));
  }

  private async pedirSinFreno<T>(ruta: string, parametros: Record<string, string>): Promise<T> {
    const url = new URL(`${BASE}${ruta}`);
    for (const [k, v] of Object.entries(parametros)) url.searchParams.set(k, v);
    url.searchParams.set('apiKey', this.claveApi);

    let res: Response;
    try {
      res = await this.buscar(url, { headers: { accept: 'application/json' } });
    } catch (causa) {
      throw new ErrorProveedor(NOMBRE, 'no se pudo contactar con el proveedor', causa);
    }

    /*
     * El límite por minuto se nota enseguida y llega como 429 con un cuerpo
     * propio. Se traduce al mismo error que usa el resto del sistema para
     * quedarse sin cuota, porque la reacción correcta es la misma: parar y
     * reintentar más tarde, nunca insistir.
     */
    if (res.status === 429) throw new ErrorCuotaAgotada(NOMBRE);
    /*
     * Un 404 aquí significa «esa competición no tiene partidos ahora», no un
     * fallo: OddsPapi responde así a la Copa del Rey en septiembre o a la NBA
     * en verano. Se traduce a lista vacía porque es lo que es — tratarlo como
     * error llenaba el panel de mensajes rojos por diez competiciones que solo
     * estaban fuera de temporada.
     */
    if (res.status === 404) return [] as unknown as T;
    if (!res.ok) {
      throw new ErrorProveedor(NOMBRE, `respuesta ${res.status} del proveedor`);
    }

    const cuerpo = (await res.json()) as T & { error?: { message?: string } };
    if (cuerpo && typeof cuerpo === 'object' && 'error' in cuerpo && cuerpo.error) {
      throw new ErrorProveedor(NOMBRE, cuerpo.error.message ?? 'error del proveedor');
    }
    return cuerpo;
  }

  /** Nombres de equipo del deporte, cacheados en memoria. */
  private async nombres(sportId: number): Promise<Record<string, string>> {
    const cacheado = this.participantes.get(sportId);
    if (cacheado) return cacheado;
    const d = await this.pedir<Record<string, string>>('/participants', {
      sportId: String(sportId),
    });
    this.participantes.set(sportId, d);
    return d;
  }

  private torneo(deporte: Deporte): { sportId: number; tournamentId: number } {
    const t = TORNEO_PAPI[deporte];
    if (!t) throw new ErrorProveedor(NOMBRE, `competición no cubierta: ${deporte}`);
    return t;
  }

  /**
   * Etiqueta de un resultado, en el mismo formato que ya usa el registro.
   *
   * El formato lo fija el otro proveedor y aquí se imita a propósito: es lo
   * que permite que `separarLinea`, la resolución de hándicaps y la escalera
   * de líneas funcionen sin tocar nada.
   */
  private etiqueta(
    outcomeId: string,
    mercado: Mercado,
    linea: number | null,
    local: string,
    visitante: string,
  ): string | null {
    if (mercado === 'moneyline') {
      if (outcomeId === RESULTADO_LOCAL) return local;
      if (outcomeId === RESULTADO_VISITANTE) return visitante;
      if (outcomeId === RESULTADO_EMPATE) return EMPATE;
      return null;
    }
    if (linea === null) return null;
    if (mercado === 'totales') {
      return `${esParticipante1(outcomeId) ? 'Over' : 'Under'} ${linea}`;
    }
    // Hándicap: el signo ya viene en la línea del propio resultado.
    const equipo = esParticipante1(outcomeId) ? local : visitante;
    return `${equipo} ${linea > 0 ? '+' : ''}${linea}`;
  }

  /**
   * Lados del mercado pedido, del partido ya descargado.
   *
   * En totales y hándicap hay una escalera entera de líneas y solo interesa la
   * PRINCIPAL: la pareja cuyos dos precios están más igualados. Es como el
   * mercado señala su línea de referencia, y ofrecer las veinte convertiría el
   * desplegable en algo inusable.
   */
  private ladosDe(
    partido: PartidoAPI,
    mercado: Mercado,
    vias: 2 | 3,
    local: string,
    visitante: string,
  ): { etiqueta: string; cuota: number }[] {
    const mercados = partido.bookmakerOdds?.[CASA]?.markets ?? {};

    if (mercado === 'moneyline') {
      const ids =
        vias === 3
          ? [RESULTADO_LOCAL, RESULTADO_EMPATE, RESULTADO_VISITANTE]
          : [RESULTADO_LOCAL, RESULTADO_VISITANTE];
      const lados = ids
        .map((outcomeId) => {
          const cuota = this.precioDe(partido, MERCADO_1X2, outcomeId);
          const etiqueta = this.etiqueta(outcomeId, mercado, null, local, visitante);
          return cuota !== null && etiqueta !== null ? { etiqueta, cuota } : null;
        })
        .filter((l) => l !== null);
      return lados.length === vias ? lados : [];
    }

    const tabla = mercado === 'totales' ? TOTALES_PAPI : HANDICAP_PAPI;
    let mejor: { etiqueta: string; cuota: number }[] = [];
    let mejorDesvio = Infinity;

    for (const [idMercado, outcomes] of Object.entries(tabla)) {
      if (!(idMercado in mercados)) continue;
      const entradas = Object.entries(outcomes);
      if (entradas.length !== 2) continue;

      const lados = entradas
        .map(([outcomeId, linea]) => {
          const cuota = this.precioDe(partido, idMercado, outcomeId);
          const etiqueta = this.etiqueta(outcomeId, mercado, linea, local, visitante);
          return cuota !== null && etiqueta !== null ? { etiqueta, cuota } : null;
        })
        .filter((l) => l !== null);
      if (lados.length !== 2) continue;

      const desvio = Math.abs(lados[0]!.cuota - lados[1]!.cuota);
      if (desvio < mejorDesvio) {
        mejorDesvio = desvio;
        mejor = lados;
      }
    }
    return mejor;
  }

  async buscarEventos(criterio: CriterioBusqueda): Promise<Evento[]> {
    const { sportId, tournamentId } = this.torneo(criterio.deporte);
    const [partidos, nombres] = await Promise.all([
      this.pedir<PartidoAPI[]>('/odds-by-tournaments', {
        sportId: String(sportId),
        tournamentIds: String(tournamentId),
        oddsFormat: 'decimal',
      }),
      this.nombres(sportId),
    ]);

    const mercado = criterio.mercado ?? 'moneyline';
    const vias = viasDe(criterio.deporte, mercado);

    return partidos
      .map((p) => {
        const local = nombres[String(p.participant1Id)];
        const visitante = nombres[String(p.participant2Id)];
        if (!local || !visitante) return null;

        /*
         * Los lados van dentro del evento porque el panel los necesita para
         * ofrecer opciones sin una segunda llamada. Una sola casa —el
         * exchange— así que `porCasa` tiene un elemento y `mercado` repite su
         * precio: aquí la mediana del mercado y el precio de la casa son lo
         * mismo, y fingir dos fuentes distintas sería adornar.
         */
        const lados = this.ladosDe(p, mercado, vias, local, visitante);
        if (lados.length === 0) {
          return {
            id: p.fixtureId,
            deporte: criterio.deporte,
            local,
            visitante,
            comienzo: new Date(p.startTime),
          } satisfies Evento;
        }

        return {
          id: p.fixtureId,
          deporte: criterio.deporte,
          local,
          visitante,
          comienzo: new Date(p.startTime),
          mercado: lados.map((l) => ({ lado: l.etiqueta, mediana: l.cuota, casas: 1 })),
          porCasa: [
            { casa: CASA_LEGIBLE, lados: lados.map((l) => ({ lado: l.etiqueta, cuota: l.cuota })) },
          ],
        } satisfies Evento;
      })
      .filter((e) => e !== null)
      .filter((e) => {
        if (criterio.desde && e.comienzo < criterio.desde) return false;
        if (criterio.hasta && e.comienzo > criterio.hasta) return false;
        return true;
      });
  }

  /**
   * Partidos de los últimos días con su estado.
   *
   * `/fixtures` ignora `tournamentIds` —devuelve el deporte entero, unos
   * cuatro mil partidos— así que el filtro va aquí. Es feo y es lo que hay.
   */
  async resultados(deporte: Deporte, diasAtras: number): Promise<ResultadoEvento[]> {
    const { sportId, tournamentId } = this.torneo(deporte);
    const dias = Math.max(1, Math.min(9, diasAtras));
    const hasta = new Date();
    const desde = new Date(hasta.getTime() - dias * 24 * 60 * 60 * 1000);
    const fecha = (d: Date) => d.toISOString().slice(0, 10);

    const [partidos, nombres] = await Promise.all([
      this.pedir<PartidoAPI[]>('/fixtures', {
        sportId: String(sportId),
        from: fecha(desde),
        to: fecha(hasta),
      }),
      this.nombres(sportId),
    ]);

    return partidos
      .filter((p) => p.tournamentId === tournamentId)
      .map((p) => {
        const local = nombres[String(p.participant1Id)];
        const visitante = nombres[String(p.participant2Id)];
        if (!local || !visitante) return null;
        /*
         * El marcador NO viene aquí: `/fixtures` solo trae el estado, y los
         * puntos exigen una llamada por partido a `/scores`. Se devuelve vacío
         * porque quien usa esto —la lista de partidos con cierre disponible—
         * solo necesita saber si empezó y si terminó. Inventar un marcador a
         * cero sería peor que no traerlo.
         */
        return {
          eventoId: p.fixtureId,
          local,
          visitante,
          comienzo: new Date(p.startTime),
          terminado: (p.statusName ?? '').toLowerCase() === 'finished',
          marcador: [],
          actualizadoEn: new Date(p.startTime),
        } satisfies ResultadoEvento;
      })
      .filter((r) => r !== null);
  }

  /**
   * Cierre de un partido: el último precio de cada lado ANTES del saque.
   *
   * Esta es la diferencia que justifica el adaptador. El otro proveedor
   * devuelve una instantánea del momento que se le pida; aquí llega la serie
   * entera y el cierre se elige, que es lo que esa palabra significa.
   *
   * Cuesta una petición POR RESULTADO —tres en un 1X2— porque el histórico de
   * OddsPapi no admite pedir un mercado completo. Con cien mil al mes sobra,
   * pero conviene saberlo antes de meterlo en un bucle.
   */
  async cuotasDeCierre(
    evento: ReferenciaEvento,
    mercado: Mercado,
    linea?: number | null,
  ): Promise<CuotasDeCierre | null> {
    const { sportId } = this.torneo(evento.deporte);
    const nombres = await this.nombres(sportId);

    /*
     * Las cuotas actuales del partido NO se consultan: `odds-by-tournaments`
     * solo devuelve futuros, así que para uno terminado no habría nada que
     * leer. Se va directo al histórico con la tabla fija de mercados, que se
     * verificó global sobre quince partidos: 126 pares, cero inconsistencias.
     */
    const partido = await this.partidoDe(evento);
    if (partido === null) return null;
    const local = nombres[String(partido.participant1Id)];
    const visitante = nombres[String(partido.participant2Id)];
    if (!local || !visitante) return null;

    const vias = viasDe(evento.deporte, mercado);

    /*
     * Las líneas se prueban ordenadas por cercanía a la del pick, y se
     * ACUMULAN varias en vez de parar en la primera que tenga precio.
     *
     * Parar en la primera era el error que costó cinco renuncias falsas: la
     * primera línea con precio de un total es casi siempre el 0.5, así que un
     * pick a «Over 2.5» recibía un cierre de «Over 0.5» y se declaraba línea
     * movida. La línea principal del mercado no tiene por qué ser la apostada,
     * y la que importa es la apostada.
     *
     * Acumular vecinas tampoco es un lujo: es lo que da la escalera con la que
     * `precioEnLinea` deduce un cierre cuando la línea del pick desapareció de
     * verdad. Sin vecinas no hay pendiente y no hay nada que deducir.
     */
    const lados: { etiqueta: string; cuota: number }[] = [];
    let capturadoEn: Date | null = null;
    let conPrecio = 0;
    let probados = 0;

    for (const grupo of this.candidatosDe(mercado, vias, linea)) {
      if (conPrecio >= LINEAS_DE_ESCALERA || probados >= MAXIMOS_INTENTOS) break;
      probados++;

      const delGrupo: { etiqueta: string; cuota: number }[] = [];
      let cuandoGrupo: Date | null = null;

      for (const c of grupo) {
        const punto = await this.ultimoAntesDe(evento.id, c.outcomeId, c.idMercado, evento.comienzo);
        if (punto === null) break;
        const etiqueta = this.etiqueta(c.outcomeId, mercado, c.linea, local, visitante);
        if (etiqueta === null) break;
        delGrupo.push({ etiqueta, cuota: punto.price });
        const cuando = new Date(punto.createdAt);
        if (cuandoGrupo === null || cuando > cuandoGrupo) cuandoGrupo = cuando;
      }

      /*
       * Media línea sin las dos patas no entra. Un mercado al que le falta un
       * lado suma menos del 100 % y el de-vig repartiría sobre un margen
       * inventado, que es exactamente el fallo que produjo una cuota «justa»
       * de 2,68 donde el cierre bruto era 1,67.
       */
      if (delGrupo.length !== vias) continue;

      conPrecio++;
      lados.push(...delGrupo);
      if (capturadoEn === null || (cuandoGrupo !== null && cuandoGrupo > capturadoEn)) {
        capturadoEn = cuandoGrupo;
      }
    }

    if (lados.length === 0) return null;

    return validarCuotasDeCierre(NOMBRE, {
      eventoId: evento.id,
      mercado,
      lados,
      capturadoEn: capturadoEn ?? evento.comienzo,
      casa: CASA_LEGIBLE,
      casas: 1,
      porCasa: [{ casa: CASA_LEGIBLE, lados }],
    });
  }

  /**
   * Marcador final de un partido.
   *
   * `result` es el resultado bueno; `fulltime` es el de los noventa minutos y
   * `p1` el del descanso. Se prefiere `result` y se cae a `fulltime`: en liga
   * coinciden, y donde no coinciden —una eliminatoria con prórroga— el que
   * decide la apuesta es el primero.
   *
   * Devuelve null si no hay marcador todavía, que NO es lo mismo que un 0-0.
   * Confundirlos liquidaría como perdida una apuesta de un partido que aún no
   * ha terminado, y eso no se arregla luego porque el fichero es de
   * solo-añadir.
   */
  async marcadorDe(
    fixtureId: string,
    local: string,
    visitante: string,
  ): Promise<{ equipo: string; puntos: number }[] | null> {
    const d = await this.pedir<{
      scores?: {
        periods?: Record<string, { participant1Score?: number; participant2Score?: number }>;
      };
    }>('/scores', { fixtureId });

    const periodos = d.scores?.periods;
    if (!periodos) return null;
    const p = periodos['result'] ?? periodos['fulltime'];
    if (!p || typeof p.participant1Score !== 'number' || typeof p.participant2Score !== 'number') {
      return null;
    }
    return [
      { equipo: local, puntos: p.participant1Score },
      { equipo: visitante, puntos: p.participant2Score },
    ];
  }

  /** El partido en el listado por fechas, que sí incluye los terminados. */
  private async partidoDe(evento: ReferenciaEvento): Promise<PartidoAPI | null> {
    const { sportId } = this.torneo(evento.deporte);
    const dia = (d: Date) => d.toISOString().slice(0, 10);
    const partidos = await this.pedir<PartidoAPI[]>('/fixtures', {
      sportId: String(sportId),
      from: dia(new Date(evento.comienzo.getTime() - 24 * 60 * 60 * 1000)),
      to: dia(new Date(evento.comienzo.getTime() + 24 * 60 * 60 * 1000)),
    });
    return partidos.find((p) => p.fixtureId === evento.id) ?? null;
  }

  /**
   * Grupos de resultados a probar, ordenados por cercanía a la línea del pick.
   *
   * El 1X2 tiene un solo grupo y el orden da igual. En totales y hándicap el
   * orden ES la decisión: ordenar por línea más pequeña —lo que se hacía
   * antes— pone el 0.5 primero siempre, y como se paraba en la primera con
   * precio, un pick a «Over 2.5» recibía el cierre del «Over 0.5».
   */
  private candidatosDe(
    mercado: Mercado,
    vias: 2 | 3,
    linea?: number | null,
  ): { idMercado: string; outcomeId: string; linea: number | null }[][] {
    if (mercado === 'moneyline') {
      const ids =
        vias === 3
          ? [RESULTADO_LOCAL, RESULTADO_EMPATE, RESULTADO_VISITANTE]
          : [RESULTADO_LOCAL, RESULTADO_VISITANTE];
      return [ids.map((outcomeId) => ({ idMercado: MERCADO_1X2, outcomeId, linea: null }))];
    }

    /*
     * El centro del orden es la línea del pick. Sin ella se cae al cero, que
     * es el comportamiento antiguo y solo sirve para no quedarse sin orden;
     * quien llama debería pasarla siempre.
     *
     * Se compara en VALOR ABSOLUTO de la distancia porque la tabla del
     * hándicap tiene el mismo número con los dos signos —«−2.25» es el
     * mercado del favorito y «+2.25» el del otro— y las dos patas del par ya
     * vienen dentro del mismo grupo.
     */
    const centro = linea ?? 0;
    const tabla = mercado === 'totales' ? TOTALES_PAPI : HANDICAP_PAPI;
    return Object.entries(tabla)
      .map(([idMercado, outcomes]) =>
        Object.entries(outcomes).map(([outcomeId, l]) => ({ idMercado, outcomeId, linea: l })),
      )
      .filter((g) => g.length === 2)
      .sort(
        (a, b) =>
          Math.min(...a.map((c) => Math.abs(Math.abs(c.linea) - Math.abs(centro)))) -
          Math.min(...b.map((c) => Math.abs(Math.abs(c.linea) - Math.abs(centro)))),
      );
  }


  private precioDe(partido: PartidoAPI, idMercado: string, outcomeId: string): number | null {
    const jugadores =
      partido.bookmakerOdds?.[CASA]?.markets?.[idMercado]?.outcomes?.[outcomeId]?.players ?? {};
    for (const j of Object.values(jugadores)) {
      if (typeof j.price === 'number' && j.price > 1) return j.price;
    }
    return null;
  }

  /** Último precio de un resultado anterior o igual al saque. */
  private async ultimoAntesDe(
    fixtureId: string,
    outcomeId: string,
    idMercado: string,
    comienzo: Date,
  ): Promise<PuntoAPI | null> {
    const d = await this.pedir<{
      bookmakers?: Record<
        string,
        { markets?: Record<string, { outcomes?: Record<string, { players?: Record<string, PuntoAPI[]> }> }> }
      >;
    }>('/historical-odds', {
      fixtureId,
      bookmaker: CASA,
      outcomeId,
      oddsFormat: 'decimal',
    });

    const serie =
      d.bookmakers?.[CASA]?.markets?.[idMercado]?.outcomes?.[outcomeId]?.players?.['0'] ?? [];
    const antes = serie.filter((p) => new Date(p.createdAt) <= comienzo && p.price > 1);
    return antes.length > 0 ? (antes[antes.length - 1] as PuntoAPI) : null;
  }

  /**
   * No implementado, y a propósito.
   *
   * El histórico de OddsPapi se pide por partido y resultado, así que no
   * existe la instantánea de «toda la competición a esta hora» que hace barato
   * al otro proveedor. Devolver un mapa vacío sería mentir; lanzar deja claro
   * que este adaptador sirve a la calculadora, no a la captura del registro.
   */
  async cierresDelMomento(): Promise<Map<string, CuotasDeCierre>> {
    throw new ErrorProveedor(
      NOMBRE,
      'OddsPapi no sirve instantáneas de competición: su histórico va por partido y resultado',
    );
  }
}
