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
import type { Cierre, Pick } from './dominio';
import { auditar, type Auditoria } from './dominio';
import { analizarApuesta, agregar, type AnalisisApuesta, type ResumenAgregado } from '../clv';

const REPO = process.env.NEXT_PUBLIC_REPO_PICKS ?? 'paiker91/klosa-picks';
const BASE = `https://raw.githubusercontent.com/${REPO}/main`;

export const URL_PICKS = `${BASE}/picks.jsonl`;
export const URL_CIERRES = `${BASE}/cierres.jsonl`;
export const URL_REPO = `https://github.com/${REPO}`;

/** Cada cuánto se vuelve a mirar el repositorio, en segundos. */
export const REVALIDAR = 300;

async function descargarLineas<T>(url: string): Promise<T[]> {
  const res = await fetch(url, { next: { revalidate: REVALIDAR } });
  // 404 es el estado normal antes del primer pick, no un error.
  if (!res.ok) return [];
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
  analisis: AnalisisApuesta | null;
}

export interface RegistroPublico {
  entradas: EntradaRegistro[];
  resumen: ResumenAgregado;
  conteos: { total: number; validos: number; conCierre: number; pendientes: number };
  urls: { picks: string; cierres: string; repo: string };
}

export async function leerRegistroPublico(): Promise<RegistroPublico> {
  const [picks, cierres] = await Promise.all([
    descargarLineas<Pick>(URL_PICKS),
    descargarLineas<Cierre>(URL_CIERRES),
  ]);

  const porPick = new Map(cierres.map((c) => [c.pickId, c]));

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
          analisis = analizarApuesta(
            pick.cuotaTomada,
            cierre.cuotaLadoTomado,
            cierre.cuotaLadoContrario,
          );
        } catch {
          analisis = null;
        }
      }
      return { pick, auditoria, cierre, analisis };
    })
    // Más recientes primero.
    .sort((a, b) => b.pick.registradoEn.localeCompare(a.pick.registradoEn));

  const analizados = entradas.map((e) => e.analisis).filter((a): a is AnalisisApuesta => a !== null);

  return {
    entradas,
    resumen: agregar(analizados),
    conteos: {
      total: picks.length,
      validos: entradas.filter((e) => e.auditoria.valido).length,
      conCierre: analizados.length,
      pendientes: entradas.filter((e) => e.auditoria.valido && !e.cierre).length,
    },
    urls: { picks: URL_PICKS, cierres: URL_CIERRES, repo: URL_REPO },
  };
}
