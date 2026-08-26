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
import { EMPATE, esFutbol, ErrorProveedor, type Deporte, type Mercado } from './dominio';
import { esCircuito, idCompuesto, separarId, torneosActivos, type Circuito } from './tenis';

/**
 * Lo que la calculadora puede consultar: las competiciones del dominio más
 * los dos circuitos de tenis. Los circuitos NO son `Deporte` a propósito —
 * ver lib/cuotas/tenis.ts — y por eso este tipo existe solo aquí.
 */
export type DeporteCalculadora = Deporte | Circuito;

/**
 * Peticiones que NO se gastan en la web.
 *
 * La captura automática del registro público tiene prioridad absoluta sobre la
 * calculadora, y la razón es que los dos fallos no son simétricos. Un cierre
 * que no se captura hoy no se recupera nunca: la instantánea de ese instante
 * deja de estar disponible y ese pick se queda sin CLV para siempre. A un
 * visitante al que hoy se le dice que no, en cambio, se le puede decir que sí
 * mañana. Se protege lo irreversible.
 *
 * El número sale de medir lo que consume el registro: unas 350 peticiones en
 * un día de mucho movimiento —doce instantáneas de cierre más los marcadores
 * de cada pasada—, así que 2.000 son unos seis días de autonomía. Suficiente
 * para cruzar un fin de semana entero sin que nadie mire.
 *
 * Estaba en 600, que es menos de dos días. Nunca llegó a saltar, pero era la
 * red que sostenía la única pieza verificable del proyecto y estaba puesta
 * demasiado baja.
 */
export const RESERVA = 2000;

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
 * caducidad. La lista de partidos cambia según van empezando, y unos minutos
 * de retraso ahí no molestan a nadie.
 *
 * Sin esto, `fetch` en Next 15+ no cachea nada por defecto y CADA render paga
 * su llamada al proveedor. Es lo que le pasaba al panel, que construía su
 * propio cliente pelado: dos peticiones por carga de página, y cambiar de
 * competición en el desplegable es una carga de página. Publicar una tarde de
 * picks costaba cientos de peticiones en un recurso que solo tiene 20.000 al
 * mes.
 *
 * `frescura` en segundos. Las rutas públicas usan 300; el panel, donde el
 * precio que se ve es el que se registra, usa 60.
 */
export function clienteCacheado(claveApi: string, frescura = 300): TheOddsApi {
  return new TheOddsApi({
    claveApi,
    buscar: (url, init) => {
      const inmutable = String(url).includes('/historical/');
      return fetch(url, {
        ...init,
        next: inmutable ? { revalidate: false } : { revalidate: frescura },
      });
    },
  });
}

const cliente = (claveApi: string): TheOddsApi => clienteCacheado(claveApi);

export interface PartidoPublico {
  id: string;
  deporte: DeporteCalculadora;
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
  deporte: DeporteCalculadora,
): Promise<{ partidos: PartidoPublico[]; proximo: string | null }> {
  const ahora = Date.now();
  const api = cliente(clave());

  /*
   * Tenis: el circuito se despliega en sus torneos activos. El listado es
   * gratis; los marcadores cuestan 2 peticiones por torneo, y rara vez hay
   * más de tres torneos a la vez por circuito. Cada partido viaja con su
   * torneo dentro del identificador para que el cierre no tenga que
   * redescubrirlo.
   */
  if (esCircuito(deporte)) {
    const torneos = torneosActivos(await api.listarDeportes(), deporte);
    const porTorneo = await Promise.all(
      torneos.map(async (torneo) => {
        const eventos = await api.resultadosPorClave(torneo, 3).catch(() => []);
        return eventos.map((r) => ({ torneo, r }));
      }),
    );
    const todos = porTorneo.flat();

    const partidos = todos
      .filter(({ r }) => r.comienzo.getTime() <= ahora)
      .sort((a, b) => b.r.comienzo.getTime() - a.r.comienzo.getTime())
      .map(({ torneo, r }) => ({
        id: idCompuesto(torneo, r.eventoId),
        deporte,
        local: r.local,
        visitante: r.visitante,
        comienzo: r.comienzo.toISOString(),
        terminado: r.terminado,
      }));

    const futuros = todos
      .filter(({ r }) => r.comienzo.getTime() > ahora)
      .sort((a, b) => a.r.comienzo.getTime() - b.r.comienzo.getTime());

    return { partidos, proximo: futuros[0]?.r.comienzo.toISOString() ?? null };
  }

  const todos = await api.resultados(deporte, 3);

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
  deporte: DeporteCalculadora,
  eventoId: string,
  mercado: Mercado = 'moneyline',
): Promise<CierrePublico | null> {
  const api = cliente(clave());

  if (esCircuito(deporte)) {
    /*
     * El identificador trae el torneo dentro. Se valida contra la lista real
     * de ese torneo igual que en el camino normal: el comienzo NUNCA se
     * acepta del cliente, porque aceptarlo permitiría pedir instantáneas
     * arbitrarias del histórico y vaciar la cuota en minutos.
     */
    const partes = separarId(eventoId);
    if (partes === null) return null;

    const eventos = await api.resultadosPorClave(partes.torneo, 3).catch(() => []);
    const evento = eventos.find((p) => p.eventoId === partes.eventoId);
    if (!evento || evento.comienzo.getTime() > Date.now()) return null;

    const restante = api.cuotaRestante();
    if (restante !== null && restante - COSTE_HISTORICO < RESERVA) throw new SinCuota();

    // Dos vías siempre: en tenis no hay empate, y el único mercado es ganador.
    const todos = await api.cierresDelMomentoPorClave(partes.torneo, evento.comienzo, 'moneyline', 2);
    const cierre = todos.get(partes.eventoId) ?? null;
    if (cierre === null) return null;

    return {
      lados: cierre.lados,
      casas: cierre.casas,
      capturadoEn: cierre.capturadoEn.toISOString(),
    };
  }

  const partidos = await api.resultados(deporte, 3);
  const partido = partidos.find((p) => p.eventoId === eventoId);
  if (!partido || partido.comienzo.getTime() > Date.now()) return null;

  const restante = api.cuotaRestante();
  if (restante !== null && restante - COSTE_HISTORICO < RESERVA) throw new SinCuota();

  const cierre = await api.cuotasDeCierre(
    { id: eventoId, deporte, comienzo: partido.comienzo },
    mercado,
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
  /**
   * Lados con su mejor precio disponible y la mediana como referencia.
   *
   * Se rellena con el MEJOR y no con la mediana: la mediana no la ofrece
   * nadie, y registrarla deja el CLV bruto en cero por construccion. Medido
   * sobre los primeros 34 picks, la diferencia era de 2,4 puntos.
   */
  lados: { lado: string; mejor: number | null; mediana: number | null; casa: string | null }[];
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
        lados: lados.map((lado) => {
          const ofertas = (e.porCasa ?? []).flatMap((c) =>
            c.lados.filter((l) => l.lado === lado).map((l) => ({ casa: c.casa, cuota: l.cuota })),
          );
          const mejor = ofertas.reduce<{ casa: string; cuota: number } | null>(
            (a, b) => (a === null || b.cuota > a.cuota ? b : a),
            null,
          );
          return {
            lado,
            mejor: mejor?.cuota ?? null,
            casa: mejor?.casa ?? null,
            mediana: e.mercado?.find((m) => m.lado === lado)?.mediana ?? null,
          };
        }),
      };
    });
}
