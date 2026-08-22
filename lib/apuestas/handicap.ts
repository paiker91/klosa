/**
 * Resolución de hándicaps.
 *
 * Aquí es donde un registro se falsea sin que nadie lo note. Un CLV mal
 * calculado suele saltar a la vista; un hándicap mal resuelto produce un
 * «ganada» perfectamente creíble donde había un empate a efectos de apuesta, y
 * nadie lo va a repasar a mano.
 *
 * Tres familias de línea, y cada una se comporta distinto:
 *
 *   media   (−1,5)  nunca empata: o gana o pierde.
 *   entera  (−2)    puede empatar exacto, y entonces la apuesta se anula.
 *   cuarto  (−1,25) se parte en dos mitades, −1 y −1,5, cada una con medio
 *                   dinero. De ahí salen «media ganada» y «media perdida».
 *
 * El proveedor actual solo devuelve medias y enteras —verificado contra NBA y
 * WNBA el 2026-08-22, ninguna línea de cuarto—, pero las de cuarto están
 * implementadas porque una casa asiática sí las cuelga y el día que se apunte
 * una a mano tiene que resolverse bien, no aproximadamente.
 */

export type Desenlace = 'ganada' | 'perdida' | 'anulada' | 'media_ganada' | 'media_perdida';

/**
 * Separa la etiqueta del proveedor en equipo y línea.
 *
 * Las etiquetas vienen como «Boston Celtics -1.5» porque las construye el
 * adaptador pegando el punto al nombre. La línea es siempre el último trozo.
 */
export function separarLinea(etiqueta: string): { equipo: string; linea: number } | null {
  const trozos = etiqueta.trim().split(/\s+/);
  if (trozos.length < 2) return null;

  const ultimo = trozos[trozos.length - 1] as string;
  const linea = Number(ultimo.replace(',', '.'));
  if (!Number.isFinite(linea)) return null;

  const equipo = trozos.slice(0, -1).join(' ');
  return equipo === '' ? null : { equipo, linea };
}

/** Cuánto vale media línea: 0 si es media o entera, 0,25 si es de cuarto. */
function esDeCuarto(linea: number): boolean {
  // 1,25 × 4 = 5, impar. 1,5 × 4 = 6, par. 2 × 4 = 8, par.
  return Math.abs(Math.round(linea * 4)) % 2 === 1;
}

/** Resultado de una línea simple: positivo gana, cero empata, negativo pierde. */
function resolverSimple(margen: number, linea: number): 'ganada' | 'perdida' | 'anulada' {
  const resultado = margen + linea;
  if (Math.abs(resultado) < 1e-9) return 'anulada';
  return resultado > 0 ? 'ganada' : 'perdida';
}

/**
 * Resuelve un hándicap a partir del marcador final.
 *
 * `null` cuando no se puede decidir con lo que hay: marcador incompleto, o un
 * equipo que no juega este partido. No se adivina nunca — un desenlace
 * inventado es peor que un dato que falta, porque el que falta se ve.
 */
export function resolverHandicap(
  equipo: string,
  linea: number,
  marcador: readonly { equipo: string; puntos: number }[],
): Desenlace | null {
  if (marcador.length !== 2) return null;
  if (!Number.isFinite(linea)) return null;

  const normal = (s: string) => s.trim().toLowerCase();
  const mio = marcador.find((m) => normal(m.equipo) === normal(equipo));
  const suyo = marcador.find((m) => normal(m.equipo) !== normal(equipo));
  if (!mio || !suyo) return null;
  if (!Number.isFinite(mio.puntos) || !Number.isFinite(suyo.puntos)) return null;

  const margen = mio.puntos - suyo.puntos;

  if (!esDeCuarto(linea)) return resolverSimple(margen, linea);

  /*
   * Línea de cuarto: el dinero se reparte entre las dos líneas vecinas. Una de
   * ellas es entera y la otra media, así que una puede empatar y la otra no —
   * y por eso nunca salen una ganada y una perdida a la vez.
   */
  const baja = resolverSimple(margen, linea - 0.25);
  const alta = resolverSimple(margen, linea + 0.25);

  if (baja === alta) return baja;
  if (baja === 'anulada' || alta === 'anulada') {
    const otra = baja === 'anulada' ? alta : baja;
    return otra === 'ganada' ? 'media_ganada' : 'media_perdida';
  }
  // Inalcanzable con dos líneas a media distancia, pero se deja explícito en
  // vez de devolver algo por descarte.
  return null;
}

/**
 * Resuelve un total (más/menos) a partir del marcador.
 *
 * Misma aritmética que el hándicap con el signo cambiado: en vez del margen
 * entre equipos se mira la suma, y la línea se resta en lugar de sumarse.
 */
export function resolverTotal(
  lado: 'Over' | 'Under',
  linea: number,
  marcador: readonly { equipo: string; puntos: number }[],
): Desenlace | null {
  if (marcador.length !== 2) return null;
  if (!Number.isFinite(linea)) return null;
  if (marcador.some((m) => !Number.isFinite(m.puntos))) return null;

  const total = marcador.reduce((s, m) => s + m.puntos, 0);
  // Un «Más» gana cuando el total supera la línea; un «Menos», al revés.
  const signo = lado === 'Over' ? 1 : -1;
  const efectiva = signo * (total - linea);

  if (!esDeCuarto(linea)) {
    if (Math.abs(efectiva) < 1e-9) return 'anulada';
    return efectiva > 0 ? 'ganada' : 'perdida';
  }

  const baja = resolverSimple(0, signo * (total - (linea - 0.25)));
  const alta = resolverSimple(0, signo * (total - (linea + 0.25)));
  if (baja === alta) return baja;
  if (baja === 'anulada' || alta === 'anulada') {
    const otra = baja === 'anulada' ? alta : baja;
    return otra === 'ganada' ? 'media_ganada' : 'media_perdida';
  }
  return null;
}
