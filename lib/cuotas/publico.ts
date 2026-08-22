/**
 * Acceso al proveedor desde las rutas públicas.
 *
 * Es la primera pieza de este proyecto que necesita servidor. La v1 se diseñó
 * sin él a propósito, pero dar nosotros la línea de cierre no se puede hacer
 * en el navegador: la clave del proveedor no puede salir de aquí. Sigue sin
 * guardarse nada de nadie — no hay base de datos, ni cuentas, ni cookies.
 *
 * Dos ideas sostienen que esto pueda ser público y gratis:
 *
 *   1. El dominio es acotado. Solo existen los partidos de tres deportes en
 *      los últimos tres días: unas decenas. No hay forma de pedir infinitas
 *      cosas distintas, así que el gasto máximo está tapado por arriba.
 *   2. El cierre de un partido terminado no cambia nunca. Se cachea para
 *      siempre; la primera consulta lo paga y las demás son gratis.
 */
import { TheOddsApi } from './the-odds-api';
import { EMPATE, esFutbol, ErrorProveedor, type Deporte } from './dominio';

/**
 * Peticiones que NO se gastan en la web.
 *
 * La captura automática del registro público tiene prioridad absoluta sobre la
 * calculadora: si la web agota la clave, el registro se queda sin cierres y lo
 * que se rompe es la única pieza verificable del proyecto.
 */
export const RESERVA = 600;

/** El histórico cuesta 20 peticiones por consulta. Medido, no supuesto. */
export const COSTE_HISTORICO = 20;

export class SinCuota extends Error {
  constructor() {
    super('Reserva de cuota agotada.');
    this.name = 'SinCuota';
  }
}

/**
 * Cliente con caché de Next por tipo de petición.
 *
 * El histórico de un partido terminado es inmutable, así que se cachea sin
 * caducidad. La lista de partidos cambia según van empezando, y cinco minutos
 * de retraso ahí no molestan a nadie.
 */
function cliente(claveApi: string): TheOddsApi {
  return new TheOddsApi({
    claveApi,
    buscar: (url, init) => {
      const inmutable = String(url).includes('/historical/');
      return fetch(url, {
        ...init,
        next: inmutable ? { revalidate: false } : { revalidate: 300 },
      });
    },
  });
}

export interface PartidoPublico {
  id: string;
  deporte: Deporte;
  local: string;
  visitante: string;
  comienzo: string;
  terminado: boolean;
}

export interface CierrePublico {
  /** Dos lados en baloncesto y béisbol, tres en fútbol (con el empate). */
  lados: { etiqueta: string; cuota: number }[];
  casas: number;
  capturadoEn: string;
}

function clave(): string {
  const k = process.env.THE_ODDS_API_KEY;
  if (!k) throw new ErrorProveedor('the-odds-api', 'Falta THE_ODDS_API_KEY.');
  return k;
}

/**
 * Partidos que ya empezaron en los últimos tres días.
 *
 * Solo esos: la línea de cierre de un partido que aún no ha empezado no
 * existe todavía, y ofrecerla sería ofrecer un número inventado.
 *
 * Se devuelve además cuándo empieza el siguiente, y no es un adorno. Tres días
 * es el máximo que admite el proveedor, y una liga de fútbol juega una vez por
 * semana: es normal abrir el Brasileirão un martes y que no haya nada. Sin
 * esta fecha, la lista vacía parece una avería; con ella, se entiende y se
 * sabe cuándo volver. No cuesta ninguna petición extra: viene en la misma
 * respuesta que ya se ha pedido.
 */
export async function partidosCerrables(
  deporte: Deporte,
): Promise<{ partidos: PartidoPublico[]; proximo: string | null }> {
  const ahora = Date.now();
  const todos = await cliente(clave()).resultados(deporte, 3);

  const partidos = todos
    .filter((r) => r.comienzo.getTime() <= ahora)
    .sort((a, b) => b.comienzo.getTime() - a.comienzo.getTime())
    .map((r) => ({
      id: r.eventoId,
      deporte,
      local: r.local,
      visitante: r.visitante,
      comienzo: r.comienzo.toISOString(),
      terminado: r.terminado,
    }));

  const futuros = todos
    .filter((r) => r.comienzo.getTime() > ahora)
    .sort((a, b) => a.comienzo.getTime() - b.comienzo.getTime());

  return { partidos, proximo: futuros[0]?.comienzo.toISOString() ?? null };
}

/**
 * Cierre de un partido, validado contra la lista real de partidos.
 *
 * El momento de comienzo NO se acepta del cliente: se busca en la lista. Si se
 * aceptara, cualquiera podría pedir instantáneas arbitrarias del histórico y
 * vaciar la cuota en un rato — a 20 peticiones por consulta, en unos minutos.
 */
export async function cierreDe(
  deporte: Deporte,
  eventoId: string,
): Promise<CierrePublico | null> {
  const api = cliente(clave());

  const partidos = await api.resultados(deporte, 3);
  const partido = partidos.find((p) => p.eventoId === eventoId);
  if (!partido || partido.comienzo.getTime() > Date.now()) return null;

  const restante = api.cuotaRestante();
  if (restante !== null && restante - COSTE_HISTORICO < RESERVA) throw new SinCuota();

  const cierre = await api.cuotasDeCierre(
    { id: eventoId, deporte, comienzo: partido.comienzo },
    'moneyline',
  );
  if (cierre === null) return null;

  return {
    lados: cierre.lados,
    casas: cierre.casas,
    capturadoEn: cierre.capturadoEn.toISOString(),
  };
}

export interface ProximoPartido {
  id: string;
  local: string;
  visitante: string;
  comienzo: string;
  /** Lados con su precio de mercado, si lo hay. Rellena la cuota al elegir. */
  lados: { lado: string; mediana: number | null }[];
}

/**
 * Partidos abiertos, con el precio de mercado de cada lado.
 *
 * Los precios vienen en la misma respuesta, así que no cuestan una petición
 * extra, y se dan como mediana de las casas y nunca como la mejor: la mejor de
 * treinta casas bate al cierre casi siempre y regalaría ventaja por aritmética.
 */
export async function proximosPartidos(deporte: Deporte): Promise<ProximoPartido[]> {
  const ahora = Date.now();
  const eventos = await cliente(clave()).buscarEventos({ deporte });

  return eventos
    .filter((e) => e.comienzo.getTime() > ahora)
    .sort((a, b) => a.comienzo.getTime() - b.comienzo.getTime())
    .map((e) => {
      const lados = esFutbol(deporte)
        ? [e.visitante, EMPATE, e.local]
        : [e.visitante, e.local];
      return {
        id: e.id,
        local: e.local,
        visitante: e.visitante,
        comienzo: e.comienzo.toISOString(),
        lados: lados.map((lado) => ({
          lado,
          mediana: e.mercado?.find((m) => m.lado === lado)?.mediana ?? null,
        })),
      };
    });
}
