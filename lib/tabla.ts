/**
 * Lectura de varias apuestas pegadas desde una hoja de cálculo o un CSV.
 *
 * El formato esperado por fila es:
 *   cuota tomada · cierre de tu lado · cierre del otro lado · [stake] · [deporte]
 *
 * Dos trampas que solo aparecen con datos reales:
 *
 * 1. El separador. En Brasil y en España la coma es el separador DECIMAL, así
 *    que un CSV de Excel en esos idiomas usa punto y coma, y quien pega directo
 *    desde la hoja trae tabuladores. Adivinar mal convierte 2,10 en dos
 *    columnas y arruina el análisis en silencio, así que se prueban los tres y
 *    se puntúa cuál funciona.
 *
 * 2. Las comillas. Excel entrecomilla cualquier celda que contenga el separador,
 *    y un CSV exportado sale con TODOS los campos entrecomillados. Sin quitarlas,
 *    "2,10" no parsea y no se lee ni una fila.
 */
import { parsearCuota, ErrorCuota } from './clv';

export type Delimitador = 'tabulador' | 'punto y coma' | 'coma';

const CANDIDATOS: ReadonlyArray<{ nombre: Delimitador; caracter: string }> = [
  { nombre: 'tabulador', caracter: '\t' },
  { nombre: 'punto y coma', caracter: ';' },
  { nombre: 'coma', caracter: ',' },
];

export interface FilaApuesta {
  /** Número de línea en el texto original, para poder señalar el error. */
  numero: number;
  cuotaTomada: number;
  cierreTomado: number;
  cierreContrario: number;
  stake: number | null;
  deporte: string | null;
}

export interface ErrorFila {
  numero: number;
  contenido: string;
  motivo: string;
}

export interface ResultadoParseo {
  filas: FilaApuesta[];
  errores: ErrorFila[];
  delimitador: Delimitador;
  cabeceraOmitida: boolean;
}

/**
 * Divide una línea respetando las comillas: un separador dentro de comillas es
 * parte del valor, no un corte. Las comillas dobles duplicadas ("") son una
 * comilla literal, según la convención de CSV.
 */
export function dividirLinea(linea: string, caracter: string): string[] {
  const campos: string[] = [];
  let actual = '';
  let dentro = false;

  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (c === '"') {
      if (dentro && linea[i + 1] === '"') {
        actual += '"';
        i++;
      } else {
        dentro = !dentro;
      }
    } else if (c === caracter && !dentro) {
      campos.push(actual);
      actual = '';
    } else {
      actual += c;
    }
  }
  campos.push(actual);
  return campos.map((c) => c.trim());
}

const lineasDe = (texto: string): Array<{ numero: number; contenido: string }> =>
  texto
    .split(/\r?\n/)
    .map((contenido, i) => ({ numero: i + 1, contenido: contenido.trim() }))
    .filter((l) => l.contenido !== '');

/** Cuántas líneas rinden tres cuotas válidas con este separador. */
function puntuar(lineas: ReadonlyArray<{ contenido: string }>, caracter: string): number {
  let aciertos = 0;
  for (const { contenido } of lineas) {
    const campos = dividirLinea(contenido, caracter);
    if (campos.length < 3) continue;
    try {
      parsearCuota(campos[0] ?? '');
      parsearCuota(campos[1] ?? '');
      parsearCuota(campos[2] ?? '');
      aciertos++;
    } catch {
      // Esta línea no cuadra con este separador; puede ser cabecera o error.
    }
  }
  return aciertos;
}

export function detectarDelimitador(texto: string): Delimitador {
  const lineas = lineasDe(texto);
  let mejor: { nombre: Delimitador; aciertos: number } = { nombre: 'tabulador', aciertos: -1 };
  for (const { nombre, caracter } of CANDIDATOS) {
    const aciertos = puntuar(lineas, caracter);
    // El orden de CANDIDATOS desempata: ante la duda, el separador menos ambiguo.
    if (aciertos > mejor.aciertos) mejor = { nombre, aciertos };
  }
  return mejor.nombre;
}

const caracterDe = (d: Delimitador): string =>
  CANDIDATOS.find((c) => c.nombre === d)?.caracter ?? '\t';

/**
 * Interpreta un importe tal y como lo escribe una hoja de cálculo: con símbolo
 * de moneda, con separador de miles y en cualquiera de las dos convenciones.
 *
 * Es deliberadamente más permisivo que `parsearCuota`. Una cuota va entre 1,01
 * y 1000 y jamás lleva separador de miles, así que allí conviene ser estricto y
 * rechazar lo raro. Un importe sí puede ser 1.234,56 € y hay que entenderlo.
 */
export function parsearImporte(valor: string): number | null {
  // Fuera moneda, letras y cualquier clase de espacio (incluido el no separable).
  const limpio = valor.replace(/[^\d.,-]/g, '');
  if (limpio === '') return null;

  const ultimaComa = limpio.lastIndexOf(',');
  const ultimoPunto = limpio.lastIndexOf('.');
  let normalizado: string;

  if (ultimaComa !== -1 && ultimoPunto !== -1) {
    // Están los dos: el que va más a la derecha es el decimal.
    const decimal = ultimaComa > ultimoPunto ? ',' : '.';
    const miles = decimal === ',' ? '.' : ',';
    normalizado = limpio.split(miles).join('').replace(decimal, '.');
  } else {
    const separador = ultimaComa !== -1 ? ',' : ultimoPunto !== -1 ? '.' : null;
    if (separador === null) {
      normalizado = limpio;
    } else {
      const partes = limpio.split(separador);
      const ultima = partes.at(-1) ?? '';
      /*
       * Un solo separador seguido de exactamente tres cifras es ambiguo: 1.500
       * puede ser mil quinientos o uno coma cinco. Se resuelve como millar, que
       * es lo que significa en las dos convenciones cuando hay grupos de tres.
       */
      const esMillar = partes.length > 2 || (partes.length === 2 && ultima.length === 3);
      normalizado = esMillar ? partes.join('') : partes.join('.');
    }
  }

  const n = Number(normalizado);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parsearTabla(texto: string): ResultadoParseo {
  const lineas = lineasDe(texto);
  const delimitador = detectarDelimitador(texto);
  const caracter = caracterDe(delimitador);

  const filas: FilaApuesta[] = [];
  const errores: ErrorFila[] = [];
  let cabeceraOmitida = false;

  for (const [indice, { numero, contenido }] of lineas.entries()) {
    const campos = dividirLinea(contenido, caracter);

    if (campos.length < 3) {
      errores.push({
        numero,
        contenido,
        motivo: `Se esperaban al menos 3 columnas separadas por ${delimitador} y hay ${campos.length}.`,
      });
      continue;
    }

    try {
      const cuotaTomada = parsearCuota(campos[0] ?? '');
      const cierreTomado = parsearCuota(campos[1] ?? '');
      const cierreContrario = parsearCuota(campos[2] ?? '');
      const stake = campos[3] !== undefined ? parsearImporte(campos[3]) : null;
      const deporte = campos[4]?.trim() || null;
      filas.push({ numero, cuotaTomada, cierreTomado, cierreContrario, stake, deporte });
    } catch (fallo) {
      // La primera línea que no cuadra es casi siempre la cabecera: se omite en silencio.
      if (indice === 0 && !cabeceraOmitida) {
        cabeceraOmitida = true;
        continue;
      }
      errores.push({
        numero,
        contenido,
        motivo: fallo instanceof ErrorCuota ? fallo.message : String(fallo),
      });
    }
  }

  return { filas, errores, delimitador, cabeceraOmitida };
}
