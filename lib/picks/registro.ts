/**
 * Lectura y escritura de los dos ficheros de solo-añadir.
 *
 *   picks/picks.jsonl      nunca se modifica, solo crece
 *   picks/cierres.jsonl    lo que captura el proveedor, después
 *   picks/resultados.jsonl el desenlace, del marcador final
 *   picks/renuncias.jsonl  los cierres que ya no se van a poder capturar
 *
 * Están separados a propósito. Si el cierre se escribiera dentro de la línea
 * del pick, cada captura sería una modificación en el diff de git y un pick
 * retocado a posteriori se confundiría con una captura normal. Separados,
 * cualquier cambio en una línea antigua de `picks.jsonl` salta a la vista.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { EMPATE } from '../cuotas/dominio';
import type { Cierre, Pick, ResultadoPick, SinCierre } from './dominio';
import { auditar, type Auditoria } from './dominio';

/**
 * Dónde vive el registro.
 *
 * Por defecto `picks/` dentro del proyecto, pero se puede apuntar a otro sitio
 * con `KLOSA_PICKS_DIR`. Existe para que el registro pueda estar en su propio
 * repositorio: así cada commit de ese repositorio es un pronóstico y nada más,
 * y auditarlo es leer la lista de commits. Mezclado con los commits de código,
 * habría que filtrar para comprobar lo mismo.
 */
const DIRECTORIO = process.env.KLOSA_PICKS_DIR ?? 'picks';

export const RUTA_PICKS = join(DIRECTORIO, 'picks.jsonl');
export const RUTA_CIERRES = join(DIRECTORIO, 'cierres.jsonl');
export const RUTA_RESULTADOS = join(DIRECTORIO, 'resultados.jsonl');
export const RUTA_RENUNCIAS = join(DIRECTORIO, 'renuncias.jsonl');

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

export const leerResultados = (ruta = RUTA_RESULTADOS): ResultadoPick[] =>
  leerLineas<ResultadoPick>(ruta);

export function anadirResultado(resultado: ResultadoPick, ruta = RUTA_RESULTADOS): void {
  if (leerResultados(ruta).some((r) => r.pickId === resultado.pickId)) {
    throw new Error(`El pick ${resultado.pickId} ya tiene resultado.`);
  }
  anadirLinea(ruta, resultado);
}

export const leerRenuncias = (ruta = RUTA_RENUNCIAS): SinCierre[] =>
  leerLineas<SinCierre>(ruta);

/**
 * Deja constancia de que el cierre de un pick no se va a poder capturar.
 *
 * Es idempotente por diseño: si ya se renunció, no vuelve a escribir. Lanzar
 * aquí como hacen `anadirCierre` y `anadirResultado` rompería el job entero
 * por un caso que no es un error sino la ejecución normal repitiéndose.
 */
export function anadirRenuncia(renuncia: SinCierre, ruta = RUTA_RENUNCIAS): boolean {
  if (leerRenuncias(ruta).some((r) => r.pickId === renuncia.pickId)) return false;
  anadirLinea(ruta, renuncia);
  return true;
}

/**
 * Resuelve una apuesta de moneyline a partir del marcador.
 *
 * `empatePosible` distingue los dos casos y no es un detalle. En baloncesto y
 * béisbol no hay empate, así que un marcador igualado significa que el partido
 * no ha terminado y hay que esperar. En fútbol el empate es un resultado más y
 * además es apostable: tratarlo como "sin terminar" dejaría sin resolver una
 * de cada cuatro apuestas, y tratar un partido a medias como empate resolvería
 * apuestas con datos falsos. Por eso lo decide quien llama, que sabe el deporte.
 *
 * Un marcador incompleto o un lado que no está en el partido se dejan sin
 * resolver en vez de adivinar, que es lo que haría falso el registro.
 */
export function resolverMoneyline(
  lado: string,
  marcador: { equipo: string; puntos: number }[],
  empatePosible = false,
): 'ganada' | 'perdida' | null {
  if (marcador.length !== 2) return null;
  const [a, b] = marcador as [
    { equipo: string; puntos: number },
    { equipo: string; puntos: number },
  ];
  const normal = (s: string) => s.trim().toLowerCase();
  const apostado = normal(lado);

  if (a.puntos === b.puntos) {
    if (!empatePosible) return null;
    return apostado === normal(EMPATE) ? 'ganada' : 'perdida';
  }

  // El empate se apostó y no se dio: perdida, sin mirar los equipos.
  if (empatePosible && apostado === normal(EMPATE)) return 'perdida';

  if (![a.equipo, b.equipo].some((e) => normal(e) === apostado)) return null;
  const ganador = a.puntos > b.puntos ? a.equipo : b.equipo;
  return normal(ganador) === apostado ? 'ganada' : 'perdida';
}

export interface EstadoRegistro {
  auditorias: Auditoria[];
  cierres: Map<string, Cierre>;
  /** Picks válidos cuyo partido ya empezó y aún no tienen cierre. */
  pendientesDeCierre: Pick[];
  /** Picks a los que ya se renunció, por sello. No se vuelven a intentar. */
  renuncias: Map<string, SinCierre>;
  resumen: {
    total: number;
    validos: number;
    invalidos: number;
    conCierre: number;
    pendientes: number;
    renunciados: number;
  };
}

export function estadoDelRegistro(
  ahora = new Date(),
  rutaPicks = RUTA_PICKS,
  rutaCierres = RUTA_CIERRES,
  rutaRenuncias = RUTA_RENUNCIAS,
): EstadoRegistro {
  const picks = leerPicks(rutaPicks);
  const auditorias = picks.map(auditar);
  const cierres = new Map(leerCierres(rutaCierres).map((c) => [c.pickId, c]));
  const renuncias = new Map(leerRenuncias(rutaRenuncias).map((r) => [r.pickId, r]));

  /*
   * Solo se intenta cerrar lo que pasa la auditoría. Capturar el cierre de un
   * pick con el sello roto le daría apariencia de legitimidad a un dato que ya
   * sabemos que no es de fiar.
   */
  const pendientesDeCierre = auditorias
    .filter((a) => a.valido)
    .map((a) => a.pick)
    .filter(
      (p) => new Date(p.comienzo) <= ahora && !cierres.has(p.id) && !renuncias.has(p.id),
    );

  const validos = auditorias.filter((a) => a.valido).length;

  return {
    auditorias,
    cierres,
    pendientesDeCierre,
    renuncias,
    resumen: {
      total: picks.length,
      validos,
      invalidos: picks.length - validos,
      conCierre: picks.filter((p) => cierres.has(p.id)).length,
      pendientes: pendientesDeCierre.length,
      renunciados: picks.filter((p) => renuncias.has(p.id)).length,
    },
  };
}
