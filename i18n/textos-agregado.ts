/**
 * Textos del modo agregado.
 *
 * Aparte de `textos.ts` porque este bloque es donde vive el argumento del
 * producto: es el único sitio de toda la web donde se le dice al usuario que
 * sus datos no significan nada. La redacción de esos veredictos importa tanto
 * como el cálculo, y conviene poder revisarla sin abrir el resto.
 */
import type { Locale } from './config';
import type { Veredicto } from '@/lib/clv';

export interface TextosAgregado {
  pestanaSimple: string;
  pestanaAgregado: string;
  instrucciones: string;
  formato: string;
  ejemplo: string;
  analizar: string;
  limpiar: string;
  etiquetas: {
    n: string;
    ventajaMedia: string;
    clvMedio: string;
    tasaAcierto: string;
    desviacion: string;
    t: string;
  };
  veredictos: Record<Veredicto, string> & { contra: string };
  detectado: (separador: string) => string;
  cabeceraOmitida: string;
  errores: (cuantos: number) => string;
  linea: string;
  sinDatos: string;
}

const pt: TextosAgregado = {
  pestanaSimple: 'Uma aposta',
  pestanaAgregado: 'Várias apostas',
  instrucciones:
    'Cole suas apostas direto da planilha. Uma por linha, com a odd que você pegou e as duas odds de fechamento.',
  formato: 'sua odd · fechamento do seu lado · fechamento do outro lado · [stake] · [esporte]',
  ejemplo: '2,10\t1,90\t1,90\t50\tNBA\n1,95\t1,85\t2,00\t50\tNBA\n3,40\t3,10\t1,38\t25\tEuroliga',
  analizar: 'Analisar',
  limpiar: 'Limpar',
  etiquetas: {
    n: 'Apostas analisadas',
    ventajaMedia: 'Vantagem média',
    clvMedio: 'CLV bruto médio',
    tasaAcierto: 'Apostas que batem o fechamento',
    desviacion: 'Desvio padrão',
    t: 'Estatística t',
  },
  veredictos: {
    muestra_insuficiente:
      'Amostra insuficiente. Com menos de 100 apostas, nenhum desses números prova nada — por maior que ele pareça. Não é pessimismo: é o tamanho da amostra.',
    no_distinguible:
      'Não dá para distinguir de zero. Não há evidência de que exista vantagem, nem de que não exista. Com esses dados, simplesmente não dá para afirmar.',
    significativo: 'Sinal estatisticamente significativo de vantagem sobre a linha de fechamento.',
    contra:
      'Sinal estatisticamente significativo, mas contra você: essas apostas perdem valor em relação ao fechamento.',
  },
  detectado: (s) => `Separador detectado: ${s}.`,
  cabeceraOmitida: 'A primeira linha foi tratada como cabeçalho.',
  errores: (n) => `${n} linha(s) não puderam ser lidas:`,
  linea: 'linha',
  sinDatos: 'Cole pelo menos uma aposta para analisar.',
};

const es: TextosAgregado = {
  pestanaSimple: 'Una apuesta',
  pestanaAgregado: 'Varias apuestas',
  instrucciones:
    'Pega tus apuestas directamente desde la hoja de cálculo. Una por línea, con la cuota que cogiste y las dos cuotas de cierre.',
  formato: 'cuota cogida · cierre de tu lado · cierre del otro lado · [stake] · [deporte]',
  ejemplo: '2,10\t1,90\t1,90\t50\tNBA\n1,95\t1,85\t2,00\t50\tNBA\n3,40\t3,10\t1,38\t25\tEuroliga',
  analizar: 'Analizar',
  limpiar: 'Limpiar',
  etiquetas: {
    n: 'Apuestas analizadas',
    ventajaMedia: 'Ventaja media',
    clvMedio: 'CLV bruto medio',
    tasaAcierto: 'Apuestas que baten el cierre',
    desviacion: 'Desviación típica',
    t: 'Estadístico t',
  },
  veredictos: {
    muestra_insuficiente:
      'Muestra insuficiente. Por debajo de 100 apuestas esto no concluye nada, por grande que parezca el número. No es pesimismo: es el tamaño de la muestra.',
    no_distinguible:
      'No se distingue de cero. No hay evidencia de que exista ventaja, ni tampoco de que no exista. Con estos datos sencillamente no se puede afirmar.',
    significativo: 'Señal estadísticamente significativa de ventaja sobre la línea de cierre.',
    contra:
      'Señal estadísticamente significativa, pero en contra: estas apuestas pierden valor frente al cierre.',
  },
  detectado: (s) => `Separador detectado: ${s}.`,
  cabeceraOmitida: 'La primera línea se ha tratado como cabecera.',
  errores: (n) => `${n} línea(s) no se han podido leer:`,
  linea: 'línea',
  sinDatos: 'Pega al menos una apuesta para analizar.',
};

const en: TextosAgregado = {
  pestanaSimple: 'One bet',
  pestanaAgregado: 'Multiple bets',
  instrucciones:
    'Paste your bets straight from a spreadsheet. One per line, with the odds you took and both closing odds.',
  formato: 'odds taken · closing, your side · closing, other side · [stake] · [sport]',
  ejemplo: '2.10\t1.90\t1.90\t50\tNBA\n1.95\t1.85\t2.00\t50\tNBA\n3.40\t3.10\t1.38\t25\tEuroleague',
  analizar: 'Analyse',
  limpiar: 'Clear',
  etiquetas: {
    n: 'Bets analysed',
    ventajaMedia: 'Mean edge',
    clvMedio: 'Mean raw CLV',
    tasaAcierto: 'Bets beating the close',
    desviacion: 'Standard deviation',
    t: 't statistic',
  },
  veredictos: {
    muestra_insuficiente:
      'Sample too small. Below 100 bets none of this concludes anything, however big the number looks. That is not pessimism, it is the sample size.',
    no_distinguible:
      'Not distinguishable from zero. There is no evidence of an edge — nor of its absence. With this data you simply cannot say.',
    significativo: 'Statistically significant signal of an edge over the closing line.',
    contra:
      'Statistically significant, but against you: these bets lose value relative to the close.',
  },
  detectado: (s) => `Detected separator: ${s}.`,
  cabeceraOmitida: 'The first line was treated as a header.',
  errores: (n) => `${n} line(s) could not be read:`,
  linea: 'line',
  sinDatos: 'Paste at least one bet to analyse.',
};

export const TEXTOS_AGREGADO: Record<Locale, TextosAgregado> = { pt, es, en };
