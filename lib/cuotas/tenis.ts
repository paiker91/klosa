/**
 * Tenis, solo en la calculadora pública.
 *
 * El proveedor no tiene una clave estable de tenis: tiene una por torneo
 * (`tennis_atp_wimbledon`, `tennis_wta_madrid_open`, unas cuarenta) que se
 * activan y desactivan con el calendario. Eso rompe el supuesto del resto del
 * sistema —una competición, una clave fija— sobre el que se apoyan el sello
 * de los picks y la captura de cierres.
 *
 * Por eso el tenis NO es un `Deporte`: es una capa aparte que solo usa la
 * calculadora, donde nada se sella ni se captura después. Los circuitos ATP y
 * WTA se despliegan al vuelo en los torneos activos del momento, y cada
 * partido viaja con su clave de torneo dentro del identificador para que la
 * consulta del cierre sepa a qué torneo preguntar sin volver a buscarlo.
 *
 * Decisión explícita del 2026-08-27: el registro propio no publica tenis,
 * pero la calculadora sí lo ofrece a los usuarios.
 */

export const CIRCUITOS = ['ATP', 'WTA'] as const;
export type Circuito = (typeof CIRCUITOS)[number];

export const esCircuito = (x: string): x is Circuito =>
  (CIRCUITOS as readonly string[]).includes(x);

/** Nombres propios, como las competiciones: no se traducen. */
export const NOMBRE_CIRCUITO: Record<Circuito, string> = {
  ATP: 'Tenis · ATP',
  WTA: 'Tenis · WTA',
};

const PREFIJO: Record<Circuito, string> = {
  ATP: 'tennis_atp_',
  WTA: 'tennis_wta_',
};

/**
 * Torneos activos de un circuito, a partir del listado del proveedor.
 *
 * Función pura a propósito: el filtrado es lo que hay que poder probar sin
 * red. El listado llega de `listarDeportes()`, que es gratis.
 */
export function torneosActivos(
  listado: readonly { key: string; active: boolean }[],
  circuito: Circuito,
): string[] {
  return listado.filter((d) => d.active && d.key.startsWith(PREFIJO[circuito])).map((d) => d.key);
}

/*
 * Identificador compuesto: torneo y evento en uno.
 *
 * El público pide un cierre con `deporte=ATP&evento=...`, pero el histórico
 * del proveedor se consulta por torneo. Meter la clave del torneo dentro del
 * identificador evita tener que redescubrirla —una llamada de marcadores por
 * torneo activo— en cada consulta. El identificador ya era opaco por contrato
 * («no se interpreta»), así que nadie de fuera pierde nada.
 *
 * La virgulilla como separador: no aparece en las claves del proveedor (todo
 * minúsculas y guiones bajos) ni se escapa en una URL.
 */
export const idCompuesto = (torneo: string, eventoId: string): string => `${torneo}~${eventoId}`;

export function separarId(id: string): { torneo: string; eventoId: string } | null {
  const corte = id.indexOf('~');
  if (corte <= 0 || corte === id.length - 1) return null;
  const torneo = id.slice(0, corte);
  if (!torneo.startsWith('tennis_')) return null;
  return { torneo, eventoId: id.slice(corte + 1) };
}
