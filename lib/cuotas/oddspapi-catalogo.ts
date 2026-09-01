import type { Deporte } from './dominio';

/**
 * Correspondencia entre nuestras competiciones y las de OddsPapi.
 *
 * Cada entrada se resolvió exigiendo SLUG **Y PAÍS**, y eso no es celo: el
 * primer intento buscó solo por slug y salió un mapa envenenado que parecía
 * correcto. «premier-league» existe en cuarenta países, así que la Premier
 * inglesa acabó apuntando a la de Sierra Leona; «championship» a la de
 * Bangladés; «ligue-1» a la de Burkina Faso; y «bundesliga» a la austríaca.
 * Ninguna habría fallado: habrían servido cuotas perfectamente creíbles de
 * otra competición.
 *
 * Dos rarezas que costaron una segunda vuelta y conviene no «corregir»:
 * Turquía se escribe «Turkiye» en su catálogo, y la Euroliga figura en
 * categoría «International», no «International Clubs».
 *
 * El país va como comentario al final de cada línea para que la próxima
 * revisión se pueda hacer leyendo, sin volver a consultar la API.
 *
 * `sportId` es de OddsPapi: 10 fútbol, 11 baloncesto, 13 béisbol.
 */
export interface TorneoPapi {
  sportId: number;
  tournamentId: number;
  /** Solo para poder rastrear de dónde salió cada id. */
  slug: string;
}

export const TORNEO_PAPI: Partial<Record<Deporte, TorneoPapi>> = {
  Argentina: { sportId: 10, tournamentId: 155, slug: 'liga-profesional' }, // Argentina
  Belgica: { sportId: 10, tournamentId: 38, slug: 'pro-league' }, // Belgium
  Brasileirao: { sportId: 10, tournamentId: 325, slug: 'brasileiro-serie-a' }, // Brazil
  BrasileiraoB: { sportId: 10, tournamentId: 390, slug: 'brasileiro-serie-b' }, // Brazil
  Bundesliga2: { sportId: 10, tournamentId: 44, slug: '2-bundesliga' }, // Germany
  Bundesliga: { sportId: 10, tournamentId: 35, slug: 'bundesliga' }, // Germany
  Champions: { sportId: 10, tournamentId: 7, slug: 'uefa-champions-league' }, // International Clubs
  Championship: { sportId: 10, tournamentId: 18, slug: 'championship' }, // England
  Conference: { sportId: 10, tournamentId: 34480, slug: 'uefa-conference-league' }, // International Clubs
  CopaDelRey: { sportId: 10, tournamentId: 329, slug: 'copa-del-rey' }, // Spain
  CoppaItalia: { sportId: 10, tournamentId: 328, slug: 'coppa-italia' }, // Italy
  CoupeDeFrance: { sportId: 10, tournamentId: 335, slug: 'coupe-de-france' }, // France
  DFBPokal: { sportId: 10, tournamentId: 217, slug: 'dfb-pokal' }, // Germany
  EFLCup: { sportId: 10, tournamentId: 21, slug: 'efl-cup' }, // England
  Eredivisie: { sportId: 10, tournamentId: 37, slug: 'eredivisie' }, // Netherlands
  Escocia: { sportId: 10, tournamentId: 36, slug: 'premiership' }, // Scotland
  Euroliga: { sportId: 11, tournamentId: 138, slug: 'euroleague' }, // International
  EuropaLeague: { sportId: 10, tournamentId: 679, slug: 'uefa-europa-league' }, // International Clubs
  FACup: { sportId: 10, tournamentId: 19, slug: 'fa-cup' }, // England
  LaLiga: { sportId: 10, tournamentId: 8, slug: 'laliga' }, // Spain
  LeagueOne: { sportId: 10, tournamentId: 24, slug: 'league-one' }, // England
  LeagueTwo: { sportId: 10, tournamentId: 25, slug: 'league-two' }, // England
  Libertadores: { sportId: 10, tournamentId: 384, slug: 'copa-libertadores' }, // International Clubs
  LigaMX: { sportId: 10, tournamentId: 352, slug: 'primera-division' }, // Mexico
  Ligue1: { sportId: 10, tournamentId: 34, slug: 'ligue-1' }, // France
  Ligue2: { sportId: 10, tournamentId: 182, slug: 'ligue-2' }, // France
  MLB: { sportId: 13, tournamentId: 109, slug: 'mlb' }, // USA
  MLS: { sportId: 10, tournamentId: 242, slug: 'mls' }, // USA
  Mundial: { sportId: 10, tournamentId: 16, slug: 'world-cup' }, // International
  NBA: { sportId: 11, tournamentId: 132, slug: 'nba' }, // USA
  NCAAB: { sportId: 11, tournamentId: 29630, slug: 'ncaa' }, // USA
  NationsLeague: { sportId: 10, tournamentId: 23755, slug: 'uefa-nations-league' }, // International
  PremierLeague: { sportId: 10, tournamentId: 17, slug: 'premier-league' }, // England
  Primeira: { sportId: 10, tournamentId: 238, slug: 'liga-portugal' }, // Portugal
  Segunda: { sportId: 10, tournamentId: 54, slug: 'laliga-2' }, // Spain
  SerieA: { sportId: 10, tournamentId: 23, slug: 'serie-a' }, // Italy
  SerieB: { sportId: 10, tournamentId: 53, slug: 'serie-b' }, // Italy
  Sudamericana: { sportId: 10, tournamentId: 480, slug: 'copa-sudamericana' }, // International Clubs
  SuperLig: { sportId: 10, tournamentId: 52, slug: 'super-lig' }, // Turkiye
  WNBA: { sportId: 11, tournamentId: 486, slug: 'wnba' }, // USA
};

/*
 * Mercados de OddsPapi, descifrados de las respuestas reales.
 *
 * No hay endpoint de catálogo de mercados —`/v4/markets` da 404—, así que la
 * correspondencia se obtuvo leyendo partidos con favorito claro y
 * contrastando el 1X2 contra el hándicap asiático. Queda anotada aquí porque
 * volver a deducirla cuesta media hora.
 *
 * La regla de paridad es lo importante y vale para todos:
 *
 *   outcomeId PAR   -> participante 1 (local) · en totales, «Over»
 *   outcomeId IMPAR -> participante 2 (visitante) · en totales, «Under»
 *
 * Comprobado en Real Betis (8,00) vs Real Madrid (1,43): el resultado par
 * llevaba el hándicap del Betis en todos los mercados, y el impar el del
 * Madrid. Invertirlo produciría cuotas perfectamente creíbles y del equipo
 * equivocado, que es la peor clase de error posible aquí.
 */

/** Mercado de resultado. Tres salidas en fútbol: 101 local, 102 empate, 103 visitante. */
export const MERCADO_1X2 = '101';
export const RESULTADO_LOCAL = '101';
export const RESULTADO_EMPATE = '102';
export const RESULTADO_VISITANTE = '103';

/** La línea de un total o un hándicap vive aquí, ya con su signo. */
export const lineaDe = (jugador: {
  exchangeMeta?: { bookmakerHandicap?: number | null } | null;
}): number | null => jugador.exchangeMeta?.bookmakerHandicap ?? null;

/** Par es el participante 1; impar, el 2. Vale también para Over/Under. */
export const esParticipante1 = (outcomeId: string): boolean => Number(outcomeId) % 2 === 0;

/*
 * Tabla de mercados de OddsPapi: qué línea corresponde a cada par
 * (mercado, resultado).
 *
 * Se generó leyendo quince partidos reales el 2026-09-01 y comprobando que el
 * esquema es GLOBAL: 126 pares distintos, cero casos en que el mismo par
 * llevara dos líneas diferentes. Eso permite consultar el histórico de un
 * partido ya terminado sin pedir antes sus cuotas — que era imposible, porque
 * `odds-by-tournaments` solo devuelve partidos futuros.
 *
 * Si algún día apareciera una línea nueva, saldría como par desconocido y el
 * cierre se declararía no disponible en vez de adivinarse.
 */

/** Totales: cada mercado con la línea de sus dos resultados. */
export const TOTALES_PAPI: Record<string, Record<string, number>> = {
  '106': { 106: 0.5, 107: 0.5 },
  '108': { 108: 1.5, 109: 1.5 },
  '1010': { 1010: 2.5, 1011: 2.5 },
  '1012': { 1012: 3.5, 1013: 3.5 },
  '1014': { 1014: 4.5, 1015: 4.5 },
  '1016': { 1016: 5.5, 1017: 5.5 },
  '1018': { 1018: 6.5, 1019: 6.5 },
  '1020': { 1020: 7.5 },
  '1022': { 1022: 8.5 },
};

/** Hándicap asiático: la línea ya viene con su signo por resultado. */
export const HANDICAP_PAPI: Record<string, Record<string, number>> = {
  '1040': { 1040: -4.0, 1041: 4.0 },
  '1042': { 1042: -3.75, 1043: 3.75 },
  '1044': { 1044: -3.5, 1045: 3.5 },
  '1046': { 1046: -3.25, 1047: 3.25 },
  '1048': { 1048: -3.0, 1049: 3.0 },
  '1050': { 1050: -2.75, 1051: 2.75 },
  '1052': { 1052: -2.5, 1053: 2.5 },
  '1054': { 1054: -2.25, 1055: 2.25 },
  '1056': { 1056: -2.0, 1057: 2.0 },
  '1058': { 1058: -1.75, 1059: 1.75 },
  '1060': { 1060: -1.5, 1061: 1.5 },
  '1062': { 1062: -1.25, 1063: 1.25 },
  '1064': { 1064: -1.0, 1065: 1.0 },
  '1066': { 1066: -0.75, 1067: 0.75 },
  '1068': { 1068: -0.5, 1069: 0.5 },
  '1070': { 1070: -0.25, 1071: 0.25 },
  '1074': { 1074: 0.25, 1075: -0.25 },
  '1076': { 1076: 0.5, 1077: -0.5 },
  '1078': { 1078: 0.75, 1079: -0.75 },
  '1080': { 1080: 1.0, 1081: -1.0 },
  '1082': { 1082: 1.25, 1083: -1.25 },
  '1084': { 1084: 1.5, 1085: -1.5 },
  '1086': { 1086: 1.75, 1087: -1.75 },
  '1088': { 1088: 2.0, 1089: -2.0 },
  '1090': { 1090: 2.25, 1091: -2.25 },
  '1092': { 1092: 2.5, 1093: -2.5 },
  '1094': { 1094: 2.75, 1095: -2.75 },
  '1096': { 1096: 3.0, 1097: -3.0 },
  '1098': { 1098: 3.25, 1099: -3.25 },
  '10100': { 10100: 3.5, 10101: -3.5 },
  '10102': { 10102: 3.75, 10103: -3.75 },
  '10104': { 10104: 4.0, 10105: -4.0 },
  '10160': { 10160: 0.75, 10161: 0.75 },
  '10162': { 10162: 1.0, 10163: 1.0 },
  '10164': { 10164: 1.25, 10165: 1.25 },
  '10166': { 10166: 1.75, 10167: 1.75 },
  '10168': { 10168: 2.0, 10169: 2.0 },
  '10170': { 10170: 2.25, 10171: 2.25 },
  '10172': { 10172: 2.75, 10173: 2.75 },
  '10174': { 10174: 3.0, 10175: 3.0 },
  '10176': { 10176: 3.25, 10177: 3.25 },
  '10178': { 10178: 3.75, 10179: 3.75 },
  '10180': { 10180: 4.0, 10181: 4.0 },
  '10182': { 10182: 4.25, 10183: 4.25 },
  '10184': { 10184: 4.75, 10185: 4.75 },
  '10186': { 10186: 5.0, 10187: 5.0 },
  '10188': { 10188: 5.25, 10189: 5.25 },
  '10190': { 10190: 5.75, 10191: 5.75 },
  '10192': { 10192: 6.0, 10193: 6.0 },
  '10194': { 10194: 6.25, 10195: 6.25 },
  '10196': { 10196: 6.75, 10197: 6.75 },
  '10198': { 10198: 7.0, 10199: 7.0 },
  '10200': { 10200: 7.25, 10201: 7.25 },
  '10202': { 10202: 7.75, 10203: 7.75 },
  '10204': { 10204: 8.0 },
  '10206': { 10206: 8.25 },
};
