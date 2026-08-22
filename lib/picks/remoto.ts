/**
 * Lee el registro desde el repositorio público.
 *
 * La fuente de verdad es GitHub, no este servidor. La página muestra
 * exactamente lo mismo que cualquiera puede descargarse con curl, y eso es
 * deliberado: si la web mostrara una copia propia, el visitante tendría que
 * fiarse de nosotros — que es justo lo que este producto reprocha a los demás.
 *
 * Sin base de datos y sin estado, como pide la v1.
 */
import type { Cierre, Pick, ResultadoPick } from './dominio';
import { auditar, type Auditoria } from './dominio';
import {
  analizarApuestaN,
  agregar,
  agregarPorGrupo,
  type AnalisisApuesta,
  type GrupoAgregado,
  type ResumenAgregado,
} from '../clv';
import { agregarResultados, type ResumenResultados } from '../resultados';

const REPO = process.env.NEXT_PUBLIC_REPO_PICKS ?? 'paiker91/klosa-picks';
const BASE = `https://raw.githubusercontent.com/${REPO}/main`;

export const URL_PICKS = `${BASE}/picks.jsonl`;
export const URL_CIERRES = `${BASE}/cierres.jsonl`;
export const URL_RESULTADOS = `${BASE}/resultados.jsonl`;
export const URL_REPO = `https://github.com/${REPO}`;

/** Cada cuánto se vuelve a mirar el repositorio, en segundos. */
export const REVALIDAR = 300;

/** No se pudo leer el registro. Distinto de que el registro esté vacío. */
export class ErrorRegistroNoDisponible extends Error {
  constructor(
    readonly url: string,
    readonly causa: unknown,
  ) {
    super(`No se pudo leer el registro desde ${url}`);
    this.name = 'ErrorRegistroNoDisponible';
  }
}

/**
 * Descarga un fichero del registro.
 *
 * Distingue tres cosas que es tentador confundir:
 *   - 404 → el fichero aún no existe. Registro vacío, estado normal.
 *   - otro fallo → NO se pudo leer. No es lo mismo que estar vacío, y decir
 *     "todavía no hay ningún pick" cuando en realidad GitHub no respondió
 *     sería mentir en una página cuyo argumento entero es la verificabilidad.
 *   - 200 → datos.
 */
async function descargarLineas<T>(url: string): Promise<T[]> {
  let res: Response;
  try {
    res = await fetch(url, { next: { revalidate: REVALIDAR } });
  } catch (causa) {
    throw new ErrorRegistroNoDisponible(url, causa);
  }

  if (res.status === 404) return [];
  if (!res.ok) throw new ErrorRegistroNoDisponible(url, `HTTP ${res.status}`);

  return (await res.text())
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '')
    .flatMap((l) => {
      try {
        return [JSON.parse(l) as T];
      } catch {
        // Una línea corrupta no debe tumbar la página entera: se ignora y
        // la auditoría del resto sigue siendo válida.
        return [];
      }
    });
}

export interface EntradaRegistro {
  pick: Pick;
  auditoria: Auditoria;
  cierre: Cierre | null;
  resultado: ResultadoPick | null;
  analisis: AnalisisApuesta | null;
}

export interface RegistroPublico {
  entradas: EntradaRegistro[];
  resumen: ResumenAgregado;
  /** Yield, acierto y cuota media. Solo de las apuestas ya resueltas. */
  resultados: ResumenResultados;
  /** Desglose por deporte. Vacío si solo hay uno: repetiría el agregado. */
  porDeporte: GrupoAgregado[];
  conteos: { total: number; validos: number; conCierre: number; pendientes: number };
  urls: { picks: string; cierres: string; repo: string };
}

export async function leerRegistroPublico(): Promise<RegistroPublico> {
  const [picks, cierres, resultados] = await Promise.all([
    descargarLineas<Pick>(URL_PICKS),
    descargarLineas<Cierre>(URL_CIERRES),
    descargarLineas<ResultadoPick>(URL_RESULTADOS),
  ]);
  return construirRegistro(picks, cierres, resultados);
}

/**
 * Monta el registro a partir de los datos ya descargados.
 *
 * Separado de la descarga a propósito: así se puede probar el desglose y la
 * auditoría con datos sintéticos, sin red y sin depender de que el repositorio
 * público tenga tal o cual contenido.
 */
export function construirRegistro(
  picks: Pick[],
  cierres: Cierre[],
  resultados: ResultadoPick[] = [],
): RegistroPublico {
  const porPick = new Map(cierres.map((c) => [c.pickId, c]));
  const porResultado = new Map(resultados.map((r) => [r.pickId, r]));

  const entradas: EntradaRegistro[] = picks
    .map((pick) => {
      const auditoria = auditar(pick);
      const cierre = porPick.get(pick.id) ?? null;

      /*
       * Solo se calcula el CLV de picks que pasan la auditoría. Enseñar un
       * número junto a un pick con el sello roto le daría apariencia de dato
       * bueno a algo que ya sabemos que no lo es.
       */
      let analisis: AnalisisApuesta | null = null;
      if (auditoria.valido && cierre) {
        try {
          analisis = analizarApuestaN(pick.cuotaTomada, cierre.cuotas, cierre.indiceTomado);
        } catch {
          analisis = null;
        }
      }
      return { pick, auditoria, cierre, resultado: porResultado.get(pick.id) ?? null, analisis };
    })
    // Más recientes primero.
    .sort((a, b) => b.pick.registradoEn.localeCompare(a.pick.registradoEn));

  const analizados = entradas.map((e) => e.analisis).filter((a): a is AnalisisApuesta => a !== null);

  /*
   * El desglose es lo que destapa un deporte que pierde mientras el agregado
   * lo tapa — el caso real que motiva el proyecto. Pero con un solo deporte la
   * tabla repetiría el agregado y sugeriría una precisión que no existe, así
   * que en ese caso no se enseña.
   */
  const porDeporte = agregarPorGrupo(
    entradas
      .filter((e) => e.analisis !== null)
      .map((e) => ({ grupo: e.pick.deporte, analisis: e.analisis as AnalisisApuesta })),
  );

  /*
   * El yield solo cuenta apuestas resueltas y con auditoría válida. Es la
   * métrica que la gente pide, y por eso va SIEMPRE con su contexto de
   * significancia: sin él sería justo la ilusión que este producto desmonta.
   */
  const resueltas = entradas
    .filter((e) => e.auditoria.valido && e.resultado !== null)
    .map((e) => ({
      cuotaTomada: e.pick.cuotaTomada,
      stake: e.pick.stake,
      desenlace: (e.resultado as ResultadoPick).desenlace,
    }));

  return {
    entradas,
    resumen: agregar(analizados),
    resultados: agregarResultados(resueltas),
    porDeporte: porDeporte.length > 1 ? porDeporte : [],
    conteos: {
      total: picks.length,
      validos: entradas.filter((e) => e.auditoria.valido).length,
      conCierre: analizados.length,
      pendientes: entradas.filter((e) => e.auditoria.valido && !e.cierre).length,
    },
    urls: { picks: URL_PICKS, cierres: URL_CIERRES, repo: URL_REPO },
  };
}
