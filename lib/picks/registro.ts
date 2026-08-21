/**
 * Lectura y escritura de los dos ficheros de solo-añadir.
 *
 *   picks/picks.jsonl    nunca se modifica, solo crece
 *   picks/cierres.jsonl  lo que captura el proveedor, después
 *
 * Están separados a propósito. Si el cierre se escribiera dentro de la línea
 * del pick, cada captura sería una modificación en el diff de git y un pick
 * retocado a posteriori se confundiría con una captura normal. Separados,
 * cualquier cambio en una línea antigua de `picks.jsonl` salta a la vista.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Cierre, Pick } from './dominio';
import { auditar, type Auditoria } from './dominio';

export const RUTA_PICKS = join('picks', 'picks.jsonl');
export const RUTA_CIERRES = join('picks', 'cierres.jsonl');

function leerLineas<T>(ruta: string): T[] {
  if (!existsSync(ruta)) return [];
  return readFileSync(ruta, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '')
    .map((l, i) => {
      try {
        return JSON.parse(l) as T;
      } catch (fallo) {
        throw new Error(`${ruta}, línea ${i + 1}: JSON inválido. ${String(fallo)}`);
      }
    });
}

function anadirLinea(ruta: string, registro: unknown): void {
  mkdirSync(dirname(ruta), { recursive: true });
  appendFileSync(ruta, `${JSON.stringify(registro)}\n`, 'utf8');
}

export const leerPicks = (ruta = RUTA_PICKS): Pick[] => leerLineas<Pick>(ruta);
export const leerCierres = (ruta = RUTA_CIERRES): Cierre[] => leerLineas<Cierre>(ruta);

/**
 * Añade un pick. Rechaza duplicados por sello: dos picks idénticos en el mismo
 * instante son un error de dedo, no dos apuestas.
 */
export function anadirPick(pick: Pick, ruta = RUTA_PICKS): void {
  if (leerPicks(ruta).some((p) => p.id === pick.id)) {
    throw new Error(`Ya existe un pick con el sello ${pick.id}.`);
  }
  anadirLinea(ruta, pick);
}

export function anadirCierre(cierre: Cierre, ruta = RUTA_CIERRES): void {
  if (leerCierres(ruta).some((c) => c.pickId === cierre.pickId)) {
    throw new Error(`El pick ${cierre.pickId} ya tiene cierre capturado.`);
  }
  anadirLinea(ruta, cierre);
}

export interface EstadoRegistro {
  auditorias: Auditoria[];
  cierres: Map<string, Cierre>;
  /** Picks válidos cuyo partido ya empezó y aún no tienen cierre. */
  pendientesDeCierre: Pick[];
  resumen: {
    total: number;
    validos: number;
    invalidos: number;
    conCierre: number;
    pendientes: number;
  };
}

export function estadoDelRegistro(
  ahora = new Date(),
  rutaPicks = RUTA_PICKS,
  rutaCierres = RUTA_CIERRES,
): EstadoRegistro {
  const picks = leerPicks(rutaPicks);
  const auditorias = picks.map(auditar);
  const cierres = new Map(leerCierres(rutaCierres).map((c) => [c.pickId, c]));

  /*
   * Solo se intenta cerrar lo que pasa la auditoría. Capturar el cierre de un
   * pick con el sello roto le daría apariencia de legitimidad a un dato que ya
   * sabemos que no es de fiar.
   */
  const pendientesDeCierre = auditorias
    .filter((a) => a.valido)
    .map((a) => a.pick)
    .filter((p) => new Date(p.comienzo) <= ahora && !cierres.has(p.id));

  const validos = auditorias.filter((a) => a.valido).length;

  return {
    auditorias,
    cierres,
    pendientesDeCierre,
    resumen: {
      total: picks.length,
      validos,
      invalidos: picks.length - validos,
      conCierre: picks.filter((p) => cierres.has(p.id)).length,
      pendientes: pendientesDeCierre.length,
    },
  };
}
