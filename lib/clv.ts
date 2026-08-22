/**
 * Cálculo de CLV (Closing Line Value) para mercados de dos vías.
 *
 * Sin React, sin red, sin estado. Todo lo que hay aquí es determinista y está
 * cubierto por tests, porque si el de-vig está mal todo lo demás da igual.
 *
 * La idea de fondo: comparar la cuota tomada contra la cuota de cierre en bruto
 * exagera el CLV, porque la cuota de cierre lleva dentro el margen de la casa.
 * Primero se quita el margen; después se compara.
 */

export type MetodoDevig = 'multiplicativo' | 'power' | 'aditivo';

/** Límites de cordura. Fuera de aquí, o es un error de entrada o no es una cuota. */
export const CUOTA_MINIMA = 1.01;
export const CUOTA_MAXIMA = 1000;

/** Umbral de significancia al 95 % para una distribución normal. */
export const T_CRITICO = 1.96;

/** Por debajo de esto no se concluye nada, salga lo que salga el estadístico. */
export const N_MINIMO = 100;

export class ErrorCuota extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorCuota';
  }
}

// ---------------------------------------------------------------------------
// Entrada: cuotas americanas y coma decimal
// ---------------------------------------------------------------------------

/**
 * Convierte cuota americana a decimal.
 *   +150 → 2.50   (ganas 150 por cada 100 apostados)
 *   -200 → 1.50   (apuestas 200 para ganar 100)
 * Entre -100 y +100 no existe cuota americana válida.
 */
export function americanaADecimal(americana: number): number {
  if (!Number.isFinite(americana)) throw new ErrorCuota('La cuota americana no es un número.');
  if (americana >= 100) return 1 + americana / 100;
  if (americana <= -100) return 1 + 100 / Math.abs(americana);
  throw new ErrorCuota(
    `Cuota americana inválida: ${americana}. No existen valores entre -100 y +100.`,
  );
}

/**
 * Normaliza una cuota escrita por una persona.
 *
 * Acepta coma decimal (Brasil y España escriben 1,90) y formato americano,
 * que se detecta por el signo explícito: "+150" y "-200" son americanas,
 * "150" es decimal y se rechazará por estar fuera de rango.
 */
export function parsearCuota(entrada: string | number): number {
  if (typeof entrada === 'number') return validarCuota(entrada);

  /*
   * Solo se recortan los extremos, nunca el espacio interior. Quitarlo todo
   * convertía "10\t1" en "101": una cuota perfectamente válida fabricada a
   * partir de dos columnas mal separadas. El parser de tablas se lo tragaba y
   * analizaba datos inventados sin dar ningún aviso.
   */
  const limpio = entrada.trim();
  if (limpio === '') throw new ErrorCuota('Cuota vacía.');
  if (/\s/.test(limpio)) throw new ErrorCuota(`"${entrada}" no es una sola cuota.`);

  const esAmericana = limpio.startsWith('+') || limpio.startsWith('-');
  const numero = Number(limpio.replace(',', '.'));
  if (!Number.isFinite(numero)) throw new ErrorCuota(`No se entiende la cuota "${entrada}".`);

  return validarCuota(esAmericana ? americanaADecimal(numero) : numero);
}

export function validarCuota(cuota: number): number {
  if (!Number.isFinite(cuota)) throw new ErrorCuota('La cuota no es un número.');
  if (cuota < CUOTA_MINIMA) {
    throw new ErrorCuota(`Cuota demasiado baja: ${cuota}. El mínimo aceptado es ${CUOTA_MINIMA}.`);
  }
  if (cuota > CUOTA_MAXIMA) {
    throw new ErrorCuota(`Cuota demasiado alta: ${cuota}. El máximo aceptado es ${CUOTA_MAXIMA}.`);
  }
  return cuota;
}

// ---------------------------------------------------------------------------
// De-vig
// ---------------------------------------------------------------------------

/**
 * Probabilidades justas de un mercado de cualquier número de salidas.
 *
 * Se generalizó a N para el fútbol, que es de tres vías y es lo que más se
 * apuesta en Brasil. Los tres métodos generalizan de forma natural; el que
 * cambia de comportamiento es el aditivo, y por eso lleva aviso.
 */
export interface ProbabilidadesJustasN {
  /** Probabilidad justa de cada lado, en el mismo orden que las cuotas. */
  p: readonly number[];
  /** Suma de las probabilidades implícitas brutas. Mayor que 1 cuando hay margen. */
  overround: number;
  /** El margen de la casa: overround - 1. */
  margen: number;
  metodo: MetodoDevig;
  /** Exponente hallado por el método power. Solo presente en ese método. */
  k?: number;
  aviso?: string;
}

/** Atajo para el caso de dos vías, que es la mayoría de lo que se calcula. */
export interface ProbabilidadesJustas extends ProbabilidadesJustasN {
  /** Probabilidad justa del lado A, ya sin margen. */
  pA: number;
  pB: number;
}

export function overroundN(cuotas: readonly number[]): number {
  return cuotas.reduce((s, c) => s + 1 / c, 0);
}

export function overroundDe(cuotaA: number, cuotaB: number): number {
  return overroundN([cuotaA, cuotaB]);
}

/**
 * Resuelve el exponente k del método power: (1/oA)^k + (1/oB)^k = 1
 *
 * f(k) decrece de forma monótona, y f(1) = overround - 1 > 0 siempre que haya
 * margen, así que la raíz está por encima de 1. La spec proponía buscar en
 * [0.5, 1.5], pero ese techo se queda corto: un mercado 1.50/1.50 (margen del
 * 33 %) tiene k ≈ 1.71 y la bisección no encontraría la raíz. Por eso aquí se
 * arranca en [1, 2] y se amplía el techo hasta encontrar el cambio de signo.
 */
export function resolverKN(cuotas: readonly number[], tolerancia = 1e-10): number {
  const f = (k: number): number => cuotas.reduce((s, c) => s + (1 / c) ** k, 0) - 1;

  let bajo = 1;
  let alto = 2;
  let intentos = 0;
  while (f(alto) > 0) {
    alto *= 2;
    if (++intentos > 20) {
      throw new ErrorCuota('El método power no converge con estas cuotas.');
    }
  }

  for (let i = 0; i < 200; i++) {
    const medio = (bajo + alto) / 2;
    const valor = f(medio);
    if (Math.abs(valor) < tolerancia || (alto - bajo) / 2 < tolerancia) return medio;
    if (valor > 0) bajo = medio;
    else alto = medio;
  }
  return (bajo + alto) / 2;
}

export function resolverK(cuotaA: number, cuotaB: number, tolerancia = 1e-10): number {
  return resolverKN([cuotaA, cuotaB], tolerancia);
}

/**
 * Quita el margen de un mercado de N salidas.
 *
 * Dos o más: dos vías para baloncesto y béisbol, tres para el fútbol
 * (local, empate, visitante). El orden de las cuotas se conserva, y es
 * responsabilidad de quien llama saber qué lado es cada una.
 */
export function devigN(
  cuotas: readonly number[],
  metodo: MetodoDevig = 'multiplicativo',
): ProbabilidadesJustasN {
  if (cuotas.length < 2) {
    throw new ErrorCuota('Hacen falta al menos dos cuotas para quitar el margen.');
  }
  for (const c of cuotas) validarCuota(c);

  const overround = overroundN(cuotas);
  const margen = overround - 1;

  if (overround < 1) {
    throw new ErrorCuota(
      `Estas cuotas suman menos del 100 % (${(overround * 100).toFixed(2)} %). ` +
        'O son una oportunidad de arbitraje, o hay un error al copiarlas. ' +
        'Revise que las cuotas sean del mismo mercado y del mismo momento.',
    );
  }

  const brutas = cuotas.map((c) => 1 / c);

  switch (metodo) {
    case 'multiplicativo':
      return { p: brutas.map((b) => b / overround), overround, margen, metodo };

    case 'power': {
      const k = resolverKN(cuotas);
      return { p: brutas.map((b) => b ** k), overround, margen, metodo, k };
    }

    case 'aditivo': {
      const parte = margen / cuotas.length;
      const p = brutas.map((b) => b - parte);
      /*
       * Con dos vías esto no puede salir negativo. Con tres sí, y de hecho
       * pasa a menudo: en un partido con un favorito claro el empate y la
       * sorpresa quedan cerca del reparto del margen. Repartir a partes
       * iguales le quita a un lado del 6 % lo mismo que a uno del 66 %, que
       * es lo que hace inservible al método aquí.
       */
      if (p.some((x) => x <= 0)) {
        return {
          p: p.map((x) => Math.max(x, Number.EPSILON)),
          overround,
          margen,
          metodo,
          aviso:
            'El método aditivo no es aplicable a estas cuotas: reparte el margen a partes ' +
            'iguales y aquí eso deja una probabilidad en cero o negativa. Use el multiplicativo.',
        };
      }
      return { p, overround, margen, metodo };
    }
  }
}

export function devig(
  cuotaA: number,
  cuotaB: number,
  metodo: MetodoDevig = 'multiplicativo',
): ProbabilidadesJustas {
  const r = devigN([cuotaA, cuotaB], metodo);
  return { ...r, pA: r.p[0] as number, pB: r.p[1] as number };
}

export const cuotaJusta = (probabilidad: number): number => 1 / probabilidad;

// ---------------------------------------------------------------------------
// Las dos métricas
// ---------------------------------------------------------------------------

/** Lo que la gente conoce como CLV: comparación contra la cuota de cierre en bruto. */
export const clvBruto = (cuotaTomada: number, cuotaCierre: number): number =>
  cuotaTomada / cuotaCierre - 1;

/**
 * La métrica buena: valor esperado usando la probabilidad justa del cierre.
 *
 * Asume que la línea de cierre, una vez quitado el margen, es la mejor
 * estimación disponible de la probabilidad real. Es el supuesto estándar del
 * sector y es razonable, pero es un supuesto: conviene decirlo en la interfaz.
 */
export const ventajaSobreCierre = (cuotaTomada: number, probabilidadJusta: number): number =>
  cuotaTomada * probabilidadJusta - 1;

export interface AnalisisApuesta {
  cuotaTomada: number;
  /** Cierres de todos los lados del mercado, en orden. Dos o tres. */
  cierres: readonly number[];
  /** Cuál de esos lados se apostó. */
  indiceTomado: number;
  cuotaCierreTomada: number;
  justas: ProbabilidadesJustasN;
  /** Cuota de cierre una vez quitado el margen de la casa. */
  cuotaJustaCierre: number;
  clvBruto: number;
  ventaja: number;
  cogioValor: boolean;
}

/**
 * Analiza una apuesta sobre un mercado de cualquier número de salidas.
 *
 * Hacen falta TODOS los lados del mercado, no solo el apostado: sin ellos no
 * se conoce el margen, y sin margen la comparación contra el cierre exagera el
 * CLV. En fútbol eso significa las tres: local, empate y visitante.
 */
export function analizarApuestaN(
  cuotaTomada: number | string,
  cierresDeCierre: readonly (number | string)[],
  indiceTomado: number,
  metodo: MetodoDevig = 'multiplicativo',
): AnalisisApuesta {
  const tomada = parsearCuota(cuotaTomada);
  const cierres = cierresDeCierre.map(parsearCuota);

  const tomadaCierre = cierres[indiceTomado];
  if (tomadaCierre === undefined) {
    throw new ErrorCuota('El lado apostado no está entre las cuotas de cierre.');
  }

  const justas = devigN(cierres, metodo);
  const justaTomada = justas.p[indiceTomado] as number;
  const ventaja = ventajaSobreCierre(tomada, justaTomada);

  return {
    cuotaTomada: tomada,
    cierres,
    indiceTomado,
    cuotaCierreTomada: tomadaCierre,
    justas,
    cuotaJustaCierre: cuotaJusta(justaTomada),
    clvBruto: clvBruto(tomada, tomadaCierre),
    ventaja,
    cogioValor: ventaja > 0,
  };
}

/**
 * Analiza una apuesta de dos vías. `cuotaCierreTomada` es el cierre del lado
 * que se apostó; `cuotaCierreContraria`, el del otro, necesario para el margen.
 */
export function analizarApuesta(
  cuotaTomada: number | string,
  cuotaCierreTomada: number | string,
  cuotaCierreContraria: number | string,
  metodo: MetodoDevig = 'multiplicativo',
): AnalisisApuesta {
  return analizarApuestaN(cuotaTomada, [cuotaCierreTomada, cuotaCierreContraria], 0, metodo);
}

// ---------------------------------------------------------------------------
// Modo agregado
// ---------------------------------------------------------------------------

export type Veredicto = 'muestra_insuficiente' | 'no_distinguible' | 'significativo';

export interface ResumenAgregado {
  n: number;
  clvMedio: number;
  ventajaMedia: number;
  /** Proporción de apuestas que baten la línea de cierre justa. */
  tasaDeAcierto: number;
  desviacion: number;
  /** media / (desviación / raíz de n). Null si n < 2. */
  t: number | null;
  /**
   * Solo el veredicto, sin texto. La redacción vive en la capa de idiomas:
   * esta librería la consumen tres locales y no puede hablar ninguno.
   */
  veredicto: Veredicto;
  /** El veredicto significativo apunta a favor o en contra. Null si no aplica. */
  signo: 'favor' | 'contra' | null;
}

/** Desviación típica muestral (denominador n-1), que es la que corresponde al estadístico t. */
export function desviacionMuestral(valores: readonly number[]): number {
  const n = valores.length;
  if (n < 2) return Number.NaN;
  const media = valores.reduce((a, b) => a + b, 0) / n;
  const suma = valores.reduce((acc, v) => acc + (v - media) ** 2, 0);
  return Math.sqrt(suma / (n - 1));
}

export function estadisticoT(valores: readonly number[]): number | null {
  const n = valores.length;
  if (n < 2) return null;
  const media = valores.reduce((a, b) => a + b, 0) / n;
  const desviacion = desviacionMuestral(valores);
  if (desviacion === 0) return null;
  return media / (desviacion / Math.sqrt(n));
}

/**
 * El orden importa: la muestra insuficiente manda sobre cualquier estadístico.
 * Un t de 4 sobre 30 apuestas sigue sin concluir nada.
 */
function interpretar(n: number, t: number | null): {
  veredicto: Veredicto;
  signo: 'favor' | 'contra' | null;
} {
  if (n < N_MINIMO) return { veredicto: 'muestra_insuficiente', signo: null };
  if (t === null || Math.abs(t) < T_CRITICO) return { veredicto: 'no_distinguible', signo: null };
  return { veredicto: 'significativo', signo: t > 0 ? 'favor' : 'contra' };
}

export interface GrupoAgregado {
  clave: string;
  resumen: ResumenAgregado;
}

/**
 * Desglosa el agregado por grupos: deporte, mercado, mes…
 *
 * Es la función que motiva el producto entero. El tipster del caso real
 * acumulaba beneficio aparente mientras un deporte perdía de forma
 * significativa y otro lo tapaba; sin separarlos, esa pérdida era invisible.
 *
 * Cada grupo se evalúa con su propio tamaño de muestra, y ahí está el aviso
 * que hay que dar: partir los datos hace que cada conclusión sea MÁS débil,
 * no más precisa. Un conjunto de 150 apuestas concluye algo; repartido en
 * tres deportes, ninguno de los tres concluye nada.
 */
export function agregarPorGrupo(
  entradas: readonly { grupo: string; analisis: AnalisisApuesta }[],
): GrupoAgregado[] {
  const porGrupo = new Map<string, AnalisisApuesta[]>();
  for (const { grupo, analisis } of entradas) {
    const clave = grupo.trim() || '—';
    const lista = porGrupo.get(clave);
    if (lista) lista.push(analisis);
    else porGrupo.set(clave, [analisis]);
  }

  return [...porGrupo.entries()]
    .map(([clave, lista]) => ({ clave, resumen: agregar(lista) }))
    // De más a menos apuestas: los grupos con muestra grande primero, que son
    // los únicos de los que se puede decir algo.
    .sort((a, b) => b.resumen.n - a.resumen.n);
}

export function agregar(analisis: readonly AnalisisApuesta[]): ResumenAgregado {
  const n = analisis.length;
  if (n === 0) {
    return {
      n: 0,
      clvMedio: 0,
      ventajaMedia: 0,
      tasaDeAcierto: 0,
      desviacion: Number.NaN,
      t: null,
      veredicto: 'muestra_insuficiente',
      signo: null,
    };
  }

  const ventajas = analisis.map((a) => a.ventaja);
  const media = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
  const t = estadisticoT(ventajas);
  const { veredicto, signo } = interpretar(n, t);

  return {
    n,
    clvMedio: media(analisis.map((a) => a.clvBruto)),
    ventajaMedia: media(ventajas),
    tasaDeAcierto: analisis.filter((a) => a.ventaja > 0).length / n,
    desviacion: desviacionMuestral(ventajas),
    t,
    veredicto,
    signo,
  };
}
