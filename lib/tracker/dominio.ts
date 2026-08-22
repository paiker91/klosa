/**
 * Picks de usuario: sello y tipos.
 *
 * El sello es el mismo mecanismo que el del registro público. Aquí importa por
 * el mismo motivo: la base de datos ya impide antedatar, y esto impide cambiar
 * una cuota a posteriori sin que se note.
 */
import { createHash } from 'node:crypto';
import type { Deporte, Mercado } from '../cuotas/dominio';

export interface PickUsuario {
  id: string;
  sello: string;
  registrado_en: string;
  comienzo: string;
  deporte: Deporte;
  evento_id: string;
  local: string;
  visitante: string;
  mercado: Mercado;
  linea: number | null;
  lado: string;
  cuota_tomada: number;
  stake: number | null;
  casa: string | null;
  nota: string | null;
  publico: boolean;
}

export interface CierreUsuario {
  pick_id: string;
  capturado_en: string;
  lados: string[];
  cuotas: number[];
  indice_tomado: number;
  casa: string;
  proveedor: string;
}

export interface ResultadoUsuario {
  pick_id: string;
  desenlace: 'ganada' | 'perdida' | 'anulada' | 'media_ganada' | 'media_perdida';
  marcador: string;
}

/**
 * Campos del sello, en orden. Tocar esta lista invalida todos los sellos
 * anteriores, así que solo se puede hacer con la tabla vacía.
 */
const CAMPOS = [
  'evento_id',
  'comienzo',
  'mercado',
  'linea',
  'lado',
  'cuota_tomada',
  'stake',
] as const;

export type CamposSellados = Pick<PickUsuario, (typeof CAMPOS)[number]>;

export function sellarPick(campos: CamposSellados): string {
  const contenido = CAMPOS.map((c) => String(campos[c])).join(' ');
  return createHash('sha256').update(contenido).digest('hex').slice(0, 16);
}
