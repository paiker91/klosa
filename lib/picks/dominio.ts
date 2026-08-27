/**
 * Registro público de pronósticos propios.
 *
 * Un histórico que se apunta uno mismo no vale nada: es exactamente el
 * problema que Klosa existe para denunciar. Todo lo que hay aquí sirve a una
 * sola idea — que cualquiera pueda comprobar que el pick existía ANTES del
 * partido, sin tener que fiarse de nosotros.
 *
 * Tres capas de verificación, de más débil a más fuerte:
 *
 *   1. `registradoEn < comienzo`, comprobado al escribir y al auditar.
 *   2. Un sello de contenido: el `id` es el hash de los campos del pick, así
 *      que cambiar una cuota a posteriori rompe el sello y se ve.
 *   3. El histórico de git. Los ficheros son de solo-añadir, así que modificar
 *      una línea antigua aparece como modificación en el diff, y la fecha en
 *      que GitHub recibió el push no la controla quien escribe.
 *
 * Ninguna es infalible por separado. Juntas son más verificación de la que
 * ofrece prácticamente nadie en este mercado.
 */
import { createHash } from 'node:crypto';
import type { Deporte, Mercado } from '../cuotas/dominio';
import { validarCuota } from '../clv';
import type { Desenlace } from '../apuestas/handicap';

export interface Pick {
  /** Sello de contenido. Se recalcula al auditar: si no cuadra, se tocó algo. */
  id: string;
  /** Cuándo se anotó. Tiene que ser anterior al comienzo del partido. */
  registradoEn: string;
  deporte: Deporte;
  eventoId: string;
  local: string;
  visitante: string;
  comienzo: string;
  mercado: Mercado;
  /** Etiqueta exacta del lado apostado, tal y como la devuelve el proveedor. */
  lado: string;
  cuotaTomada: number;
  /** Unidades arriesgadas. Va dentro del sello: cambiarlo después falsearía el registro. */
  stake: number | null;
  /**
   * Casa donde se cogió la cuota.
   *
   * Dejó de ser opcional en la práctica: el CLV se mide contra el cierre de
   * ESTA casa, porque comparar el precio de una casa contra la mediana del
   * mercado mezcla el movimiento de la línea con lo cara que sea esa casa.
   * `null` solo en los picks antiguos, registrados a precio de mercado.
   */
  casa: string | null;
  nota: string | null;
  /** Versión del sello. Ausente en los picks anteriores a que existiera. */
  version?: 1 | 2;
}

/**
 * Línea de cierre capturada para un pick.
 *
 * Guarda TODOS los lados del mercado, no solo el apostado y su contrario: en
 * fútbol son tres y con dos el margen saldría mal. Y guarda las etiquetas
 * junto a las cuotas para que quien audite el registro pueda comprobar a qué
 * lado corresponde cada número, en vez de fiarse del orden.
 */
export interface Cierre {
  pickId: string;
  capturadoEn: string;
  /** Etiquetas de cada lado, en el orden del proveedor. */
  lados: string[];
  /** Cuotas de cierre, en el mismo orden que `lados`. */
  cuotas: number[];
  /** Cuál de esos lados es el apostado. */
  indiceTomado: number;
  casa: string;
  /**
   * De dónde salió el cierre.
   *
   * `afilada` es la casa de menor margen del corte, y es la referencia buena:
   * su precio, una vez quitada la comisión, es el mejor estimador disponible de
   * la probabilidad real. Medido sobre los primeros 34 picks, esa casa cerraba
   * con un 0,66 % de margen frente al 4,14 % de la mediana del mercado — medir
   * contra la mediana inflaba el CLV bruto en cuatro puntos que eran comisión,
   * no habilidad.
   *
   * `consenso` es la mediana, y solo se usa si no hay ninguna casa utilizable.
   * `casa` son los cierres antiguos, capturados contra la casa del pick.
   */
  fuente: 'afilada' | 'casa' | 'consenso';
  /**
   * La línea apostada no existía al cierre y se midió contra una IGUAL O MÁS
   * DIFÍCIL, cuyo precio es mayor. El CLV resultante es por tanto una COTA
   * INFERIOR del verdadero: puede quedarse corto, nunca pasarse.
   *
   * Se guarda qué línea se pidió y cuál se usó para que la cuenta se pueda
   * rehacer desde fuera. Ausente cuando el emparejamiento fue exacto, que es
   * el caso normal.
   */
  cota?: { pedida: string; usada: string };
  /** Margen del mercado que hay en `cuotas`. */
  margen: number;
  /**
   * El mercado más afilado del corte, para estimar la probabilidad real.
   *
   * Va aparte del cierre de arriba porque responden a preguntas distintas y
   * mezclarlas era injusto: el CLV bruto compara precios y solo vale contra el
   * mismo mercado donde se apostó; la ventaja estima valor esperado y necesita
   * el mejor precio sin comisión que hubiera, venga de donde venga.
   *
   * `null` en los cierres antiguos, capturados antes de que existiera.
   */
  referencia: {
    casa: string;
    lados: string[];
    cuotas: number[];
    indiceTomado: number;
    margen: number;
  } | null;
  proveedor: string;
}

/** La cuota de cierre del lado que se apostó. */
export const cuotaTomadaDelCierre = (c: Cierre): number | undefined => c.cuotas[c.indiceTomado];

/**
 * Renuncia a capturar el cierre de un pick.
 *
 * Existe por dinero. La instantánea histórica de un partido que ya terminó es
 * inmutable: si el lado apostado no aparece en ella hoy, no va a aparecer
 * mañana. Sin este fichero el job reintentaba cada dos horas, para siempre, a
 * 20 peticiones por intento — 240 al día quemadas en algo que no puede salir
 * bien. Con la clave a 3.824 peticiones eso era casi un tercio de lo que
 * quedaba.
 *
 * No es tapar un fallo: es declararlo. Un pick cuya línea se movió fuera del
 * mercado NO tiene CLV medible, y decirlo es más honesto que dejarlo
 * «esperando cierre» eternamente, que es lo que hacía y sugería que algún día
 * llegaría.
 *
 * Va en su propio fichero de solo-añadir, como los cierres y los resultados.
 */
export interface SinCierre {
  pickId: string;
  /**
   * `linea_movida`: el mercado existía pero el lado apostado ya no estaba en
   * él. Es determinista — la instantánea no cambia — así que se renuncia al
   * primer intento.
   *
   * `evento_ausente`: el partido entero no venía en la instantánea. Se parece
   * demasiado a una respuesta incompleta del proveedor, así que aquí NO se
   * renuncia enseguida: hay que esperar a `ESPERA_ANTES_DE_RENUNCIAR`.
   */
  motivo: 'linea_movida' | 'evento_ausente';
  /** Qué había en su lugar. Sin esto la renuncia no se puede auditar. */
  detalle: string;
  renunciadoEn: string;
  proveedor: string;
}

/**
 * Cuánto se espera antes de dar por perdido un partido que no aparece.
 *
 * Un fallo transitorio del proveedor y un partido que de verdad no está se ven
 * igual desde aquí. Tres días de reintentos cuestan unas 720 peticiones en el
 * peor caso y compran la certeza de que no se renunció por un mal minuto.
 */
export const ESPERA_ANTES_DE_RENUNCIAR = 3 * 24 * 60 * 60 * 1000;

/**
 * Desenlace de la apuesta, capturado del marcador final.
 *
 * Va en su propio fichero de solo-añadir, como los cierres: el pick no se
 * toca nunca, así que cualquier modificación de una línea antigua de
 * `picks.jsonl` sigue saltando en el diff.
 */
export interface ResultadoPick {
  pickId: string;
  /**
   * Las medias salen de las líneas de cuarto, donde la apuesta se parte en
   * dos. Y `anulada` sale de las líneas enteras: ganar exactamente por la
   * línea no es ganar, es que se devuelve el dinero. Contarlo como victoria
   * infla el acierto y el yield a la vez.
   */
  desenlace: Desenlace;
  /** Marcador tal cual, para que se pueda comprobar la resolución. */
  marcador: string;
  capturadoEn: string;
  proveedor: string;
}

export type MotivoInvalidez =
  | 'sello_roto'
  | 'registrado_despues_del_comienzo'
  | 'cuota_invalida'
  | 'campos_incompletos';

/** Anomalías que no invalidan el pick pero hay que decir en voz alta. */
export type Reparo = 'sello_no_verificable';

/**
 * Frontera del sello verificable.
 *
 * Los picks anteriores a este instante se sellaron con una receta que no se ha
 * podido reconstruir: se probaron 49.152 combinaciones de campos, formatos y
 * separadores contra los datos publicados y ninguna reproduce un solo `id`.
 *
 * La conclusión honesta es que para esos picks el sello NO sirve de nada, y
 * decir que «pasan la auditoría» sería mentir igual que decir que están rotos.
 * Se marcan como no verificables por sello y siguen apoyándose en la capa que
 * sí funciona y que además es la más fuerte: el historial de git, donde la
 * fecha del push la puso GitHub y no quien escribe.
 *
 * La frontera es una fecha fija y no una condición sobre el propio pick. Si
 * bastara con «no trae versión», cualquiera podría añadir mañana una línea sin
 * versión con un `id` inventado y se aceptaría. Con la fecha, todo lo nuevo
 * está obligado a traer sello verificable.
 *
 * Se movió al 2026-08-26, el día que se vació el registro de pruebas. Al otro
 * lado de esa frontera ya no queda ningún pick, así que la excepción no cubre
 * a nadie: de aquí en adelante, un sello que no se recalcula es un sello ROTO
 * y el pick no pasa la auditoría. La concesión existía por dieciséis picks que
 * ya no están, y mantenerla habría sido dejar una puerta abierta sin motivo.
 */
export const SELLO_VERIFICABLE_DESDE = '2026-08-26T00:00:00.000Z';

export interface Auditoria {
  pick: Pick;
  valido: boolean;
  motivos: MotivoInvalidez[];
  /** Cosas que hay que declarar aunque no invaliden. */
  reparos: Reparo[];
}

/**
 * Campos que entran en el sello, por versión.
 *
 * Cambiar una lista invalidaría todos los sellos hechos con ella, así que no se
 * cambia: se añade una versión. Es justo lo que anticipaba el comentario que
 * había aquí, y llegó el día. La v2 mete `casa`, porque desde que el CLV se
 * mide contra el cierre de la misma casa, poder cambiarla a posteriori
 * permitiría elegir el cierre que más conviniera.
 *
 * Los picks anteriores a `SELLO_VERIFICABLE_DESDE` no traen versión y su
 * receta original no se ha podido reconstruir; se auditan como no verificables
 * por sello, no como rotos.
 */
const CAMPOS_POR_VERSION = {
  1: ['registradoEn', 'deporte', 'eventoId', 'comienzo', 'mercado', 'lado', 'cuotaTomada', 'stake'],
  2: [
    'registradoEn',
    'deporte',
    'eventoId',
    'comienzo',
    'mercado',
    'lado',
    'cuotaTomada',
    'stake',
    'casa',
  ],
} as const;

export const VERSION_SELLO = 2 as const;

export function sellar(pick: Omit<Pick, 'id'>, version: 1 | 2 = pick.version ?? 1): string {
  const contenido = CAMPOS_POR_VERSION[version].map((c) => String(pick[c])).join(' ');
  return createHash('sha256').update(contenido).digest('hex').slice(0, 16);
}

export function crearPick(datos: Omit<Pick, 'id' | 'version'>): Pick {
  const conVersion: Omit<Pick, 'id'> = { ...datos, version: VERSION_SELLO };
  return { ...conVersion, id: sellar(conVersion) };
}

/**
 * Audita un pick sin confiar en nada de lo que trae escrito.
 *
 * No lanza: devuelve todos los motivos por los que un pick no es válido, para
 * que la página pública pueda mostrarlos. Un registro que oculta sus propias
 * anomalías no es un registro verificable.
 */
export function auditar(pick: Pick): Auditoria {
  const motivos: MotivoInvalidez[] = [];
  const reparos: Reparo[] = [];

  const completo =
    pick.eventoId !== '' &&
    pick.lado.trim() !== '' &&
    pick.local.trim() !== '' &&
    pick.visitante.trim() !== '';
  if (!completo) motivos.push('campos_incompletos');

  try {
    validarCuota(pick.cuotaTomada);
  } catch {
    motivos.push('cuota_invalida');
  }

  const registrado = new Date(pick.registradoEn);
  const comienzo = new Date(pick.comienzo);
  if (
    Number.isNaN(registrado.getTime()) ||
    Number.isNaN(comienzo.getTime()) ||
    registrado >= comienzo
  ) {
    motivos.push('registrado_despues_del_comienzo');
  }

  /*
   * Un sello que no se puede recalcular no es un sello. Para los picks
   * anteriores a la frontera se dice eso y no otra cosa: ni «válido», que
   * afirmaría una comprobación que no se ha hecho, ni «roto», que acusaría de
   * manipulación a un dato que solo es antiguo.
   */
  const { id, ...resto } = pick;
  const anterior = pick.registradoEn < SELLO_VERIFICABLE_DESDE;

  if (sellar(resto, pick.version ?? 1) !== id) {
    if (anterior) reparos.push('sello_no_verificable');
    else motivos.push('sello_roto');
  }

  return { pick, valido: motivos.length === 0, motivos, reparos };
}

/** Un pick ya se puede cerrar cuando su partido ha empezado. */
export function esperandoCierre(pick: Pick, ahora: Date): boolean {
  return new Date(pick.comienzo) <= ahora;
}
