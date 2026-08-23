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
   * `casa` es la misma casa donde se cogió la cuota, que es lo que hace
   * comparable el número: mide el movimiento de la línea y no lo cara que sea
   * esa casa. `consenso` es la mediana del mercado, y solo se usa cuando la
   * casa del pick ya no cuelga ese mercado en el corte — pasa, porque las
   * casas retiran mercados. Se guarda cuál se usó para no confundirlos.
   */
  fuente: 'casa' | 'consenso';
  proveedor: string;
}

/** La cuota de cierre del lado que se apostó. */
export const cuotaTomadaDelCierre = (c: Cierre): number | undefined => c.cuotas[c.indiceTomado];

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
 */
export const SELLO_VERIFICABLE_DESDE = '2026-08-22T19:00:00.000Z';

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
