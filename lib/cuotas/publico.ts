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
import { ErrorProveedor, type Deporte } from './dominio';

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
  ladoA: { etiqueta: string; cuota: number };
  ladoB: { etiqueta: string; cuota: number };
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
 */
export async function partidosCerrables(deporte: Deporte): Promise<PartidoPublico[]> {
  const ahora = Date.now();
  return (await cliente(clave()).resultados(deporte, 3))
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
    ladoA: cierre.ladoA,
    ladoB: cierre.ladoB,
    casas: cierre.casas,
    capturadoEn: cierre.capturadoEn.toISOString(),
  };
}
