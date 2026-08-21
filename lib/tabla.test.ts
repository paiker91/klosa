import { describe, it, expect } from 'vitest';
import { parsearTabla, detectarDelimitador } from './tabla';

describe('detección del separador', () => {
  it('reconoce el pegado desde una hoja de cálculo (tabuladores)', () => {
    expect(detectarDelimitador('2,10\t1,90\t1,90\n2,05\t2,00\t1,85')).toBe('tabulador');
  });

  /*
   * El caso que más importa: Excel en portugués y en español exporta con punto
   * y coma justamente porque la coma ya está ocupada como separador decimal.
   */
  it('reconoce el CSV brasileño y español (punto y coma con coma decimal)', () => {
    expect(detectarDelimitador('2,10;1,90;1,90\n2,05;2,00;1,85')).toBe('punto y coma');
  });

  it('reconoce el CSV anglosajón (coma con punto decimal)', () => {
    expect(detectarDelimitador('2.10,1.90,1.90\n2.05,2.00,1.85')).toBe('coma');
  });

  it('no parte 2,10 en dos columnas cuando el separador es punto y coma', () => {
    const r = parsearTabla('2,10;1,90;1,90');
    expect(r.filas).toHaveLength(1);
    expect(r.filas[0]?.cuotaTomada).toBeCloseTo(2.1, 10);
    expect(r.filas[0]?.cierreTomado).toBeCloseTo(1.9, 10);
  });
});

describe('lectura de filas', () => {
  it('lee varias filas con tabuladores', () => {
    const r = parsearTabla('2,10\t1,90\t1,90\n1,95\t1,85\t2,00\n3,40\t3,10\t1,38');
    expect(r.filas).toHaveLength(3);
    expect(r.errores).toHaveLength(0);
    expect(r.filas[2]?.cuotaTomada).toBeCloseTo(3.4, 10);
  });

  it('omite la cabecera sin protestar', () => {
    const r = parsearTabla('Odd\tFechamento\tOutro lado\n2,10\t1,90\t1,90');
    expect(r.cabeceraOmitida).toBe(true);
    expect(r.filas).toHaveLength(1);
    expect(r.errores).toHaveLength(0);
  });

  it('acepta columnas opcionales de stake y deporte', () => {
    const r = parsearTabla('2,10\t1,90\t1,90\t50\tNBA');
    expect(r.filas[0]?.stake).toBe(50);
    expect(r.filas[0]?.deporte).toBe('NBA');
  });

  it('deja stake y deporte en null cuando no vienen', () => {
    const r = parsearTabla('2,10\t1,90\t1,90');
    expect(r.filas[0]?.stake).toBeNull();
    expect(r.filas[0]?.deporte).toBeNull();
  });

  it('ignora líneas en blanco y espacios sobrantes', () => {
    const r = parsearTabla('\n  2,10\t1,90\t1,90  \n\n  1,95\t1,85\t2,00\n\n');
    expect(r.filas).toHaveLength(2);
    expect(r.errores).toHaveLength(0);
  });

  it('acepta el formato americano mezclado', () => {
    const r = parsearTabla('+110\t-105\t-115');
    expect(r.filas).toHaveLength(1);
    expect(r.filas[0]?.cuotaTomada).toBeCloseTo(2.1, 10);
  });
});

describe('errores por fila', () => {
  it('señala la línea concreta que falla y sigue con las demás', () => {
    const r = parsearTabla('2,10\t1,90\t1,90\nesto no vale\n1,95\t1,85\t2,00');
    expect(r.filas).toHaveLength(2);
    expect(r.errores).toHaveLength(1);
    expect(r.errores[0]?.numero).toBe(2);
  });

  it('avisa cuando faltan columnas', () => {
    const r = parsearTabla('2,10\t1,90\t1,90\n2,05\t1,95');
    expect(r.errores).toHaveLength(1);
    expect(r.errores[0]?.motivo).toMatch(/al menos 3 columnas/i);
  });

  /*
   * Solo la PRIMERA línea ilegible se toma por cabecera. Si se descartaran
   * todas en silencio, un fichero mal separado se analizaría con la mitad de
   * las filas y el usuario vería un resultado que no corresponde a sus datos.
   */
  it('no confunde con cabecera una línea mala que no es la primera', () => {
    const r = parsearTabla('2,10\t1,90\t1,90\nbasura\tbasura\tbasura');
    expect(r.cabeceraOmitida).toBe(false);
    expect(r.errores).toHaveLength(1);
  });

  it('devuelve vacío ante texto vacío', () => {
    const r = parsearTabla('   \n\n  ');
    expect(r.filas).toHaveLength(0);
    expect(r.errores).toHaveLength(0);
  });
});

/*
 * Lo que de verdad llega al portapapeles desde una hoja de cálculo. Reproduce
 * los formatos reales de Excel y Google Sheets: no es lo mismo que pegar de
 * verdad, pero cubre las rarezas que ningún dato sintético limpio reproduce.
 */
describe('pegado real desde hoja de cálculo', () => {
  it('Excel en Windows: tabuladores y saltos CRLF', () => {
    const r = parsearTabla('2,10\t1,90\t1,90\r\n1,95\t1,85\t2,00\r\n');
    expect(r.filas).toHaveLength(2);
    expect(r.errores).toHaveLength(0);
  });

  it('CSV exportado por Excel en español o portugués: punto y coma CON comillas', () => {
    const r = parsearTabla('"2,10";"1,90";"1,90"\n"1,95";"1,85";"2,00"');
    expect(r.errores).toHaveLength(0);
    expect(r.filas).toHaveLength(2);
    expect(r.filas[0]?.cuotaTomada).toBeCloseTo(2.1, 10);
  });

  it('CSV anglosajón con comillas', () => {
    const r = parsearTabla('"2.10","1.90","1.90"');
    expect(r.filas).toHaveLength(1);
    expect(r.filas[0]?.cuotaTomada).toBeCloseTo(2.1, 10);
  });

  it('Google Sheets: celda de texto entrecomillada porque lleva una coma', () => {
    const r = parsearTabla('2,10\t1,90\t1,90\t50\t"Basquete, NBA"');
    expect(r.filas[0]?.deporte).toBe('Basquete, NBA');
  });

  it('BOM al principio del fichero', () => {
    const r = parsearTabla('\uFEFF2,10\t1,90\t1,90');
    expect(r.filas).toHaveLength(1);
    expect(r.errores).toHaveLength(0);
  });

  it('stake con separador de miles español: 1.500 son mil quinientos, no 1,5', () => {
    const r = parsearTabla('2,10\t1,90\t1,90\t1.500');
    expect(r.filas[0]?.stake).toBe(1500);
  });

  it('stake con separador de miles y decimales: 1.234,56', () => {
    const r = parsearTabla('2,10\t1,90\t1,90\t1.234,56');
    expect(r.filas[0]?.stake).toBeCloseTo(1234.56, 6);
  });

  it('stake anglosajón: 1,234.56', () => {
    const r = parsearTabla('2.10\t1.90\t1.90\t1,234.56');
    expect(r.filas[0]?.stake).toBeCloseTo(1234.56, 6);
  });

  it('stake con símbolo de moneda, como lo formatea Excel', () => {
    const r = parsearTabla('2,10\t1,90\t1,90\tR$ 50,00');
    expect(r.filas[0]?.stake).toBeCloseTo(50, 6);
  });

  it('espacio no separable como separador de miles', () => {
    const r = parsearTabla('2,10\t1,90\t1,90\t1\u00a0500');
    expect(r.filas[0]?.stake).toBe(1500);
  });
});
