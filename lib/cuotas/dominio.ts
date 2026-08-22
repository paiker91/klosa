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

export type Deporte = 'NBA' | 'Euroliga' | 'MLB';

/** Solo mercados de dos vías: el de-vig de `lib/clv.ts` asume dos resultados. */
export type Mercado = 'moneyline' | 'handicap' | 'totales';

export const DEPORTES: readonly Deporte[] = ['NBA', 'Euroliga', 'MLB'];
export const MERCADOS: readonly Mercado[] = ['moneyline', 'handicap', 'totales'];

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
}

export interface LadoCuota {
  /** Etiqueta del lado tal y como la entiende el usuario: equipo, "Más 210,5"... */
  etiqueta: string;
  cuota: number;
}

/**
 * Las dos cuotas de cierre de un mercado.
 *
 * Los dos lados son obligatorios y no es un capricho: sin el contrario no se
 * puede calcular el margen, y sin margen no hay ventaja que valga. Que el tipo
 * lo imponga evita que un adaptador devuelva medio dato y el fallo aparezca
 * tres capas más abajo.
 */
export interface CuotasDeCierre {
  eventoId: string;
  mercado: Mercado;
  ladoA: LadoCuota;
  ladoB: LadoCuota;
  /** Momento del último dato antes del comienzo, no el momento de la consulta. */
  capturadoEn: Date;
  /**
   * De dónde salen estas cuotas: el nombre de una casa, o «mediana de N casas»
   * cuando son el consenso del mercado.
   */
  casa: string;
  /**
   * Casas detrás del dato. 1 si es una sola.
   *
   * Importa porque los picks se registran a la mediana del mercado: comparar
   * una mediana de treinta casas contra el cierre de una sola casa elegida al
   * azar mete un sesgo que no tiene nada que ver con la habilidad de nadie.
   */
  casas: number;
}

export interface CriterioBusqueda {
  deporte: Deporte;
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
): CuotasDeCierre {
  for (const [nombre, lado] of [
    ['ladoA', datos.ladoA],
    ['ladoB', datos.ladoB],
  ] as const) {
    try {
      validarCuota(lado.cuota);
    } catch (fallo) {
      throw new ErrorProveedor(
        proveedor,
        `Cuota inválida en ${nombre} del evento ${datos.eventoId}: ${lado.cuota}`,
        fallo instanceof ErrorCuota ? fallo : undefined,
      );
    }
    if (lado.etiqueta.trim() === '') {
      throw new ErrorProveedor(proveedor, `Falta la etiqueta de ${nombre} en ${datos.eventoId}.`);
    }
  }

  const overround = 1 / datos.ladoA.cuota + 1 / datos.ladoB.cuota;
  if (overround < 1) {
    throw new ErrorProveedor(
      proveedor,
      `Las dos cuotas de cierre de ${datos.eventoId} suman ${(overround * 100).toFixed(2)} %. ` +
        'Un mercado real no cierra por debajo del 100 %: probablemente sean de casas o momentos distintos.',
    );
  }

  return datos;
}
