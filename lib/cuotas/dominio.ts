/**
 * Dominio de cuotas: nuestros tipos, no los del proveedor.
 *
 * Este fichero no hace red ni conoce ningún proveedor concreto. Existe porque
 * el `CLAUDE.md` lo exige desde el primer día: el tier gratuito de cualquier
 * proveedor puede desaparecer sin aviso, y si el dominio está acoplado a la
 * forma de su respuesta, cambiarlo obliga a tocar media aplicación.
 *
 * La regla: un proveedor nuevo se añade escribiendo un adaptador que traduzca
 * a estos tipos. Nada fuera de `lib/cuotas/` debe saber cómo responde nadie.
 */
import { validarCuota, ErrorCuota } from '../clv';

/**
 * Competiciones cubiertas.
 *
 * El fútbol va primero y el Brasileirão el primero de todos: es lo que se
 * apuesta en el mercado objetivo. Las otras están porque el mismo proveedor
 * las trae sin coste adicional.
 */
export type Deporte =
  | 'Brasileirao'
  | 'BrasileiraoB'
  | 'Libertadores'
  | 'Sudamericana'
  | 'PremierLeague'
  | 'LaLiga'
  | 'SerieA'
  | 'Bundesliga'
  | 'Ligue1'
  | 'Champions'
  | 'NBA'
  | 'Euroliga'
  | 'MLB';

export type Mercado = 'moneyline' | 'handicap' | 'totales';

export const DEPORTES: readonly Deporte[] = [
  'Brasileirao',
  'BrasileiraoB',
  'Libertadores',
  'Sudamericana',
  'PremierLeague',
  'LaLiga',
  'SerieA',
  'Bundesliga',
  'Ligue1',
  'Champions',
  'NBA',
  'Euroliga',
  'MLB',
];

export const MERCADOS: readonly Mercado[] = ['moneyline', 'handicap', 'totales'];

/**
 * Salidas del mercado principal de cada competición.
 *
 * El fútbol es de tres vías y no es un detalle: quitar el margen suponiendo
 * dos salidas cuando hay tres da un número creíble y equivocado. Aquí está
 * declarado para poder rechazar en la frontera lo que no cuadre, en vez de
 * fiarse de lo que traiga el proveedor.
 */
export const VIAS: Record<Deporte, 2 | 3> = {
  Brasileirao: 3,
  BrasileiraoB: 3,
  Libertadores: 3,
  Sudamericana: 3,
  PremierLeague: 3,
  LaLiga: 3,
  SerieA: 3,
  Bundesliga: 3,
  Ligue1: 3,
  Champions: 3,
  NBA: 2,
  Euroliga: 2,
  MLB: 2,
};

export const esFutbol = (deporte: Deporte): boolean => VIAS[deporte] === 3;

/** Nombres propios: no se traducen, se escriben como se llaman. */
export const NOMBRE_DEPORTE: Record<Deporte, string> = {
  Brasileirao: 'Brasileirão Série A',
  BrasileiraoB: 'Brasileirão Série B',
  Libertadores: 'Copa Libertadores',
  Sudamericana: 'Copa Sudamericana',
  PremierLeague: 'Premier League',
  LaLiga: 'LaLiga',
  SerieA: 'Serie A',
  Bundesliga: 'Bundesliga',
  Ligue1: 'Ligue 1',
  Champions: 'Champions League',
  NBA: 'NBA',
  Euroliga: 'Euroliga',
  MLB: 'MLB',
};

/** Etiqueta con la que el proveedor nombra al empate. */
export const EMPATE = 'Draw';

/**
 * Precio de mercado de un lado en un momento dado.
 *
 * Se usa la MEDIANA de las casas, nunca la mejor. El máximo de treinta casas
 * supera al cierre casi siempre, así que registrarlo daría CLV positivo por
 * construcción: aritmética disfrazada de habilidad.
 */
export interface PrecioDeMercado {
  lado: string;
  mediana: number;
  casas: number;
}

export interface Evento {
  /** Identificador del proveedor. Opaco a propósito: no se interpreta. */
  id: string;
  deporte: Deporte;
  local: string;
  visitante: string;
  comienzo: Date;
  /** Precio de mercado por lado, si el proveedor lo trae en la misma respuesta. */
  mercado?: PrecioDeMercado[];
  /**
   * Lo que ofrece cada casa por separado, del mismo momento.
   *
   * Hace falta para poder registrar un precio que exista de verdad. La mediana
   * del mercado no la ofrece nadie: sirve de referencia, pero apostarla es
   * imposible, y medir el CLV contra ella condena a cualquiera a salir en
   * negativo por el margen.
   */
  porCasa?: { casa: string; lados: { lado: string; cuota: number }[] }[];
}

export interface LadoCuota {
  /** Etiqueta del lado tal y como la entiende el usuario: equipo, "Más 210,5"... */
  etiqueta: string;
  cuota: number;
}

/**
 * Las cuotas de cierre de un mercado, TODAS.
 *
 * Todos los lados son obligatorios y no es un capricho: sin ellos no se puede
 * calcular el margen, y sin margen no hay ventaja que valga. En fútbol son
 * tres, y quedarse con dos daría un margen falso y una ventaja falsa. Que el
 * tipo lo imponga evita que un adaptador devuelva medio dato y el fallo
 * aparezca tres capas más abajo.
 */
export interface CuotasDeCierre {
  eventoId: string;
  mercado: Mercado;
  /** Dos o tres, en el orden en que los da el proveedor. */
  lados: LadoCuota[];
  /** Momento del último dato antes del comienzo, no el momento de la consulta. */
  capturadoEn: Date;
  /**
   * De dónde salen estas cuotas: el nombre de una casa, o «mediana de N casas»
   * cuando son el consenso del mercado.
   */
  casa: string;
  /** Casas detrás del dato. 1 si es una sola. */
  casas: number;
  /**
   * Las líneas de cada casa por separado, del mismo corte.
   *
   * Existe porque comparar la cuota que se cogió en una casa contra la mediana
   * del mercado mezcla dos cosas distintas: el movimiento de la línea y lo
   * cara que sea esa casa en particular. Una casa con margen ancho da CLV
   * negativo siempre, y eso no dice nada de quien apuesta. Enfrentando la
   * casa consigo misma, lo que queda es lo único que se quería medir.
   *
   * No cuesta ninguna petición extra: viene en la misma instantánea.
   */
  porCasa: { casa: string; lados: LadoCuota[] }[];
}

export interface CriterioBusqueda {
  deporte: Deporte;
  /** Mercado a pedir. Por defecto el de resultado. */
  mercado?: Mercado;
  desde?: Date;
  hasta?: Date;
}

/** Lo que un proveedor puede o no puede dar. Permite elegir a quién preguntar. */
export interface Capacidades {
  deportes: readonly Deporte[];
  mercados: readonly Mercado[];
  /** Si no da histórico, no sirve para capturar cierres de apuestas pasadas. */
  historico: boolean;
}

/**
 * Lo mínimo para pedir un cierre.
 *
 * Hace falta el deporte y la hora de comienzo, no solo el identificador: una
 * línea de cierre es de un partido que ya ocurrió, y los proveedores sirven el
 * histórico por instantáneas indexadas por deporte y momento. Resolver el
 * evento buscándolo entre los próximos partidos —como se hacía antes— no
 * podía funcionar nunca, porque un partido jugado ya no está en esa lista.
 */
export interface ReferenciaEvento {
  id: string;
  deporte: Deporte;
  comienzo: Date;
}

/** Marcador final de un partido, para resolver si la apuesta ganó. */
export interface ResultadoEvento {
  eventoId: string;
  terminado: boolean;
  local: string;
  visitante: string;
  comienzo: Date;
  /** Puntos por equipo, con el nombre tal y como lo da el proveedor. */
  marcador: { equipo: string; puntos: number }[];
  actualizadoEn: Date;
}

export interface ProveedorDeCuotas {
  readonly nombre: string;
  capacidades(): Capacidades;
  buscarEventos(criterio: CriterioBusqueda): Promise<Evento[]>;
  /** `null` cuando el proveedor no tiene ese cierre, que no es lo mismo que fallar. */
  cuotasDeCierre(evento: ReferenciaEvento, mercado: Mercado): Promise<CuotasDeCierre | null>;
  /**
   * Todos los cierres de una competición a una hora dada, por evento.
   *
   * Está en la interfaz y no solo en el adaptador porque es la forma barata de
   * preguntar: una instantánea sirve a todos los picks que empiecen a la vez.
   */
  cierresDelMomento(
    deporte: Deporte,
    comienzo: Date,
    mercado: Mercado,
  ): Promise<Map<string, CuotasDeCierre>>;
  /** Marcadores de los partidos terminados de un deporte en los últimos días. */
  resultados(deporte: Deporte, diasAtras: number): Promise<ResultadoEvento[]>;
}

// ---------------------------------------------------------------------------
// Errores del dominio
// ---------------------------------------------------------------------------

/** Fallo de un proveedor, ya traducido: nadie fuera de aquí ve un código HTTP. */
export class ErrorProveedor extends Error {
  constructor(
    readonly proveedor: string,
    mensaje: string,
    readonly causa?: unknown,
  ) {
    super(`[${proveedor}] ${mensaje}`);
    this.name = 'ErrorProveedor';
  }
}

/** Cuota agotada. Se distingue del resto porque obliga a cambiar de proveedor, no a reintentar. */
export class ErrorCuotaAgotada extends ErrorProveedor {
  constructor(proveedor: string, readonly reintentarEn?: Date) {
    super(proveedor, 'Se ha agotado la cuota de peticiones.');
    this.name = 'ErrorCuotaAgotada';
  }
}

// ---------------------------------------------------------------------------
// Validación de frontera
// ---------------------------------------------------------------------------

/**
 * Comprueba que lo que devuelve un adaptador es utilizable ANTES de que entre
 * en el dominio. Un proveedor puede mandar un null, un cero o una cuota
 * imposible; que eso reviente aquí y no dentro del cálculo es la diferencia
 * entre un error que se entiende y un resultado silenciosamente falso.
 */
export function validarCuotasDeCierre(
  proveedor: string,
  datos: CuotasDeCierre,
  /** Salidas esperadas. Si se pasa y no cuadra, se rechaza. */
  vias?: 2 | 3,
): CuotasDeCierre {
  if (datos.lados.length < 2) {
    throw new ErrorProveedor(
      proveedor,
      `El cierre de ${datos.eventoId} trae ${datos.lados.length} lado(s). Sin todos no hay margen.`,
    );
  }

  /*
   * Un mercado de fútbol al que le falta el empate parece de dos vías y suma
   * bastante menos de lo que debería: el margen saldría negativo o ridículo y
   * la ventaja calculada, inventada. Mejor romper aquí.
   */
  if (vias !== undefined && datos.lados.length !== vias) {
    throw new ErrorProveedor(
      proveedor,
      `El cierre de ${datos.eventoId} trae ${datos.lados.length} lados y se esperaban ${vias}.`,
    );
  }

  datos.lados.forEach((lado, i) => {
    try {
      validarCuota(lado.cuota);
    } catch (fallo) {
      throw new ErrorProveedor(
        proveedor,
        `Cuota inválida en el lado ${i} del evento ${datos.eventoId}: ${lado.cuota}`,
        fallo instanceof ErrorCuota ? fallo : undefined,
      );
    }
    if (lado.etiqueta.trim() === '') {
      throw new ErrorProveedor(proveedor, `Falta la etiqueta del lado ${i} en ${datos.eventoId}.`);
    }
  });

  const overround = datos.lados.reduce((s, l) => s + 1 / l.cuota, 0);
  if (overround < 1) {
    throw new ErrorProveedor(
      proveedor,
      `Las cuotas de cierre de ${datos.eventoId} suman ${(overround * 100).toFixed(2)} %. ` +
        'Un mercado real no cierra por debajo del 100 %: probablemente sean de casas o momentos distintos.',
    );
  }

  return datos;
}
