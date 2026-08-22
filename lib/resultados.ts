/**
 * Métricas de resultado: yield, acierto y cuota media.
 *
 * El `CLAUDE.md` no prohíbe enseñarlas: prohíbe enseñarlas SIN contexto de
 * significancia. Y enseñarlas junto al CLV es el mejor argumento del producto,
 * porque en el mismo registro se ve que el yield necesita miles de apuestas
 * para decir algo mientras el CLV necesita unos cientos.
 *
 * De ahí `apuestasNecesarias`: con la desviación observada de sus propios
 * datos, cuántas apuestas harían falta para que ese yield fuera significativo.
 * Es la tesis del producto convertida en un número sobre los datos del usuario.
 */
import { T_CRITICO, N_MINIMO, desviacionMuestral, type Veredicto } from './clv';

export type Desenlace = 'ganada' | 'perdida' | 'anulada';

export interface ApuestaResuelta {
  cuotaTomada: number;
  /** Unidades arriesgadas. `null` se cuenta como una unidad. */
  stake: number | null;
  desenlace: Desenlace;
}

export interface ResumenResultados {
  /** Apuestas que cuentan: las anuladas quedan fuera de todo. */
  n: number;
  ganadas: number;
  perdidas: number;
  anuladas: number;
  tasaAcierto: number;
  cuotaMedia: number;
  unidadesArriesgadas: number;
  beneficio: number;
  /** Beneficio sobre lo arriesgado. Es lo que la gente llama yield o ROI. */
  yield: number;
  desviacion: number;
  t: number | null;
  veredicto: Veredicto;
  signo: 'favor' | 'contra' | null;
  /**
   * Apuestas que harían falta para que un yield de este tamaño fuera
   * significativo, con la desviación observada. `null` si aún no se puede
   * estimar (sin datos, o con un yield indistinguible de cero).
   */
  apuestasNecesarias: number | null;
}

const VACIO: ResumenResultados = {
  n: 0,
  ganadas: 0,
  perdidas: 0,
  anuladas: 0,
  tasaAcierto: 0,
  cuotaMedia: 0,
  unidadesArriesgadas: 0,
  beneficio: 0,
  yield: 0,
  desviacion: Number.NaN,
  t: null,
  veredicto: 'muestra_insuficiente',
  signo: null,
  apuestasNecesarias: null,
};

/** Beneficio de una apuesta, en unidades. Ganada: (cuota-1)×stake. Perdida: -stake. */
function beneficioDe(a: ApuestaResuelta): number {
  const stake = a.stake ?? 1;
  if (a.desenlace === 'anulada') return 0;
  return a.desenlace === 'ganada' ? (a.cuotaTomada - 1) * stake : -stake;
}

export function agregarResultados(apuestas: readonly ApuestaResuelta[]): ResumenResultados {
  const anuladas = apuestas.filter((a) => a.desenlace === 'anulada').length;
  /*
   * Las anuladas se excluyen por completo, no se cuentan como medio acierto ni
   * como apuesta con beneficio cero: no aportan información sobre la ventaja y
   * meterlas en el denominador diluiría el yield artificialmente hacia cero.
   */
  const validas = apuestas.filter((a) => a.desenlace !== 'anulada');
  const n = validas.length;
  if (n === 0) return { ...VACIO, anuladas };

  const ganadas = validas.filter((a) => a.desenlace === 'ganada').length;
  const unidadesArriesgadas = validas.reduce((s, a) => s + (a.stake ?? 1), 0);
  const beneficio = validas.reduce((s, a) => s + beneficioDe(a), 0);

  // Beneficio por unidad arriesgada de cada apuesta: la serie sobre la que se
  // mide la significancia. Así el estadístico respeta los stakes desiguales.
  const porUnidad = validas.map((a) => beneficioDe(a) / (a.stake ?? 1));
  const media = porUnidad.reduce((s, x) => s + x, 0) / n;
  const desviacion = desviacionMuestral(porUnidad);

  const t =
    n < 2 || !Number.isFinite(desviacion) || desviacion === 0
      ? null
      : media / (desviacion / Math.sqrt(n));

  const veredicto: Veredicto =
    n < N_MINIMO
      ? 'muestra_insuficiente'
      : t === null || Math.abs(t) < T_CRITICO
        ? 'no_distinguible'
        : 'significativo';

  /*
   * n = (t_crítico · σ / efecto)². Con σ ≈ 1 a cuota par y un yield del 3 %
   * salen unas 4.270 apuestas — más que los 2.526 picks del tipster cuyo caso
   * motiva este proyecto, y a él no le bastaron.
   */
  const apuestasNecesarias =
    Number.isFinite(desviacion) && desviacion > 0 && Math.abs(media) > 1e-9
      ? Math.ceil((T_CRITICO * desviacion / Math.abs(media)) ** 2)
      : null;

  return {
    n,
    ganadas,
    perdidas: n - ganadas,
    anuladas,
    tasaAcierto: ganadas / n,
    cuotaMedia: validas.reduce((s, a) => s + a.cuotaTomada, 0) / n,
    unidadesArriesgadas,
    beneficio,
    yield: beneficio / unidadesArriesgadas,
    desviacion,
    t,
    veredicto,
    signo: veredicto === 'significativo' ? (media > 0 ? 'favor' : 'contra') : null,
    apuestasNecesarias,
  };
}
