import { describe, it, expect } from 'vitest';
import {
  americanaADecimal,
  parsearCuota,
  validarCuota,
  overroundDe,
  resolverK,
  devig,
  cuotaJusta,
  clvBruto,
  ventajaSobreCierre,
  analizarApuesta,
  analizarApuestaN,
  agregar,
  agregarPorGrupo,
  desviacionMuestral,
  estadisticoT,
  claveVeredicto,
  ErrorCuota,
  T_CRITICO,
  type AnalisisApuesta,
} from './clv';

describe('overround y margen', () => {
  it('calcula el overround de un mercado conocido', () => {
    const o = overroundDe(1.9, 1.9);
    expect(o).toBeCloseTo(1.0526, 4);
    expect(o - 1).toBeCloseTo(0.0526, 4);
  });

  it('un mercado sin margen suma exactamente 1', () => {
    expect(overroundDe(2, 2)).toBe(1);
  });
});

describe('de-vig multiplicativo', () => {
  it('reparte proporcionalmente en un mercado simétrico', () => {
    const r = devig(1.9, 1.9, 'multiplicativo');
    expect(r.pA).toBeCloseTo(0.5, 10);
    expect(r.pB).toBeCloseTo(0.5, 10);
    expect(cuotaJusta(r.pA)).toBeCloseTo(2.0, 10);
  });

  it('las probabilidades justas suman 1', () => {
    const r = devig(1.55, 2.65, 'multiplicativo');
    expect(r.pA + r.pB).toBeCloseTo(1, 12);
  });

  it('es el método por defecto', () => {
    expect(devig(1.9, 1.9).metodo).toBe('multiplicativo');
  });
});

describe('de-vig power', () => {
  it('converge y las probabilidades suman 1', () => {
    const r = devig(1.9, 1.9, 'power');
    expect(r.pA + r.pB).toBeCloseTo(1, 9);
    expect(r.k).toBeGreaterThan(1);
  });

  /*
   * La spec proponía buscar k por bisección en [0.5, 1.5]. Este mercado tiene
   * un margen del 33 % y su k ≈ 1.71, así que con aquel techo la bisección no
   * habría encontrado la raíz. El test existe para que no se reintroduzca.
   */
  it('encuentra k por encima de 1.5 en mercados de margen alto', () => {
    const k = resolverK(1.5, 1.5);
    expect(k).toBeGreaterThan(1.5);
    expect(k).toBeCloseTo(1.7095, 3);

    const r = devig(1.5, 1.5, 'power');
    expect(r.pA + r.pB).toBeCloseTo(1, 9);
  });

  it('difiere del multiplicativo en mercados asimétricos', () => {
    const mult = devig(1.2, 5.5, 'multiplicativo');
    const pow = devig(1.2, 5.5, 'power');
    expect(pow.pA).not.toBeCloseTo(mult.pA, 4);
    expect(pow.pA + pow.pB).toBeCloseTo(1, 9);
  });
});

describe('de-vig aditivo', () => {
  it('resta la mitad del margen a cada lado', () => {
    const r = devig(1.9, 1.9, 'aditivo');
    expect(r.pA).toBeCloseTo(0.5, 10);
    expect(r.aviso).toBeUndefined();
  });

  it('no produce probabilidades negativas en cuotas extremas', () => {
    const r = devig(1.05, 15.0, 'aditivo');
    expect(r.pA).toBeGreaterThan(0);
    expect(r.pB).toBeGreaterThan(0);
    expect(r.aviso).toBeUndefined();
  });

  /*
   * Propiedad, no ejemplo: en un mercado de dos vías con ambas cuotas > 1 el
   * método aditivo NUNCA puede dar una probabilidad negativa, porque exigiría
   * 1/oA - 1 > 1/oB y el lado izquierdo siempre es negativo. Se comprueba sobre
   * un barrido en vez de con un caso suelto.
   */
  it('nunca da probabilidades negativas en ningún mercado de dos vías válido', () => {
    for (let a = 1.05; a <= 4; a += 0.05) {
      for (let b = 1.05; b <= 20; b += 0.25) {
        if (overroundDe(a, b) < 1) continue; // arbitraje: se rechaza aparte
        const r = devig(a, b, 'aditivo');
        expect(r.pA).toBeGreaterThan(0);
        expect(r.pB).toBeGreaterThan(0);
      }
    }
  });
});

describe('entrada de cuotas', () => {
  it('convierte cuota americana positiva', () => {
    expect(americanaADecimal(150)).toBeCloseTo(2.5, 10);
    expect(parsearCuota('+150')).toBeCloseTo(2.5, 10);
  });

  it('convierte cuota americana negativa', () => {
    expect(americanaADecimal(-200)).toBeCloseTo(1.5, 10);
    expect(parsearCuota('-200')).toBeCloseTo(1.5, 10);
  });

  it('rechaza cuotas americanas imposibles', () => {
    expect(() => americanaADecimal(50)).toThrow(ErrorCuota);
    expect(() => americanaADecimal(-99)).toThrow(ErrorCuota);
  });

  it('acepta coma decimal', () => {
    expect(parsearCuota('1,90')).toBeCloseTo(1.9, 10);
    expect(parsearCuota('1.90')).toBeCloseTo(1.9, 10);
    expect(parsearCuota(' 2,05 ')).toBeCloseTo(2.05, 10);
  });

  it('rechaza cuotas fuera de rango', () => {
    expect(() => validarCuota(1.0)).toThrow(ErrorCuota);
    expect(() => validarCuota(1001)).toThrow(ErrorCuota);
    expect(() => parsearCuota('')).toThrow(ErrorCuota);
    expect(() => parsearCuota('hola')).toThrow(ErrorCuota);
  });
});

describe('rechazo de overround imposible', () => {
  it('rechaza un mercado que suma menos del 100 %', () => {
    expect(() => devig(2.1, 2.1)).toThrow(ErrorCuota);
  });

  it('el mensaje explica qué hacer, no solo que falla', () => {
    expect(() => devig(2.1, 2.1)).toThrow(/arbitraje|error al copiarlas/i);
  });
});

describe('las dos métricas', () => {
  it('el CLV bruto compara contra la cuota de cierre sin tocar', () => {
    expect(clvBruto(2.0, 1.9)).toBeCloseTo(0.0526, 4);
  });

  it('la ventaja vale exactamente 0 cuando se toma la cuota justa de cierre', () => {
    const r = analizarApuesta(2.0, 1.9, 1.9);
    expect(r.cuotaJustaCierre).toBeCloseTo(2.0, 10);
    expect(r.ventaja).toBeCloseTo(0, 12);
    expect(r.cogioValor).toBe(false);
  });

  it('el CLV bruto exagera respecto a la ventaja real', () => {
    const r = analizarApuesta(2.0, 1.9, 1.9);
    expect(r.clvBruto).toBeGreaterThan(r.ventaja);
  });

  it('detecta que se cogió valor por encima de la línea justa', () => {
    const r = analizarApuesta(2.1, 1.9, 1.9);
    expect(r.ventaja).toBeCloseTo(0.05, 10);
    expect(r.cogioValor).toBe(true);
  });

  it('ventajaSobreCierre es el valor esperado', () => {
    expect(ventajaSobreCierre(2.2, 0.5)).toBeCloseTo(0.1, 12);
  });
});

describe('estadística agregada', () => {
  it('calcula la desviación muestral con denominador n-1', () => {
    expect(desviacionMuestral([1, 2, 3, 4, 5])).toBeCloseTo(Math.sqrt(2.5), 12);
  });

  it('calcula el estadístico t sobre un conjunto sintético conocido', () => {
    // media 3, desviación muestral sqrt(2.5), n 5 → t = 3 / (sqrt(2.5)/sqrt(5)) = sqrt(18)
    expect(estadisticoT([1, 2, 3, 4, 5])).toBeCloseTo(Math.sqrt(18), 10);
  });

  it('no calcula t con menos de dos observaciones', () => {
    expect(estadisticoT([0.05])).toBeNull();
  });

  const apuestasSinteticas = (n: number, ventaja: number): AnalisisApuesta[] =>
    Array.from({ length: n }, (_, i) => ({
      cuotaTomada: 2,
      cuotaCierreTomada: 1.9,
      cierres: [1.9, 1.9],
      indiceTomado: 0,
      justas: { p: [0.5, 0.5], overround: 1.0526, margen: 0.0526, metodo: 'multiplicativo' },
      cogioValor: ventaja > 0,
      cuotaJustaCierre: 2,
      clvBruto: 0.05,
      // Alternar el signo del ruido mantiene la media exacta y la desviación estable.
      ventaja: ventaja + (i % 2 === 0 ? 0.01 : -0.01),
    })) as AnalisisApuesta[];

  it('no concluye nada por debajo de 100 apuestas, aunque el resultado sea enorme', () => {
    const r = agregar(apuestasSinteticas(58, 0.187));
    expect(r.n).toBe(58);
    expect(r.ventajaMedia).toBeCloseTo(0.187, 10);
    expect(r.veredicto).toBe('muestra_insuficiente');
    
  });

  it('detecta señal significativa con muestra suficiente', () => {
    const r = agregar(apuestasSinteticas(200, 0.03));
    expect(r.veredicto).toBe('significativo');
    expect(r.t).not.toBeNull();
    expect(Math.abs(r.t as number)).toBeGreaterThan(1.96);
  });

  it('avisa cuando la señal es significativa pero negativa', () => {
    const r = agregar(apuestasSinteticas(200, -0.03));
    expect(r.veredicto).toBe('significativo');
    expect(r.signo).toBe('contra');
  });

  it('calcula la tasa de apuestas que baten el cierre', () => {
    const mitad = [...apuestasSinteticas(100, 0.05), ...apuestasSinteticas(100, -0.05)];
    expect(agregar(mitad).tasaDeAcierto).toBeCloseTo(0.5, 10);
  });

  it('no revienta con la lista vacía', () => {
    const r = agregar([]);
    expect(r.n).toBe(0);
    expect(r.t).toBeNull();
    expect(r.veredicto).toBe('muestra_insuficiente');
  });
});

/*
 * El desglose por grupo es la función que motiva el producto: el caso real que
 * lo inspira es un tipster cuyo beneficio agregado tapaba un deporte que perdía
 * de forma significativa.
 */
describe('desglose por grupo', () => {
  const sintetico = (n: number, ventaja: number): AnalisisApuesta[] =>
    Array.from({ length: n }, (_, i) => ({
      cuotaTomada: 2,
      cuotaCierreTomada: 1.9,
      cierres: [1.9, 1.9],
      indiceTomado: 0,
      justas: { p: [0.5, 0.5], overround: 1.0526, margen: 0.0526, metodo: 'multiplicativo' },
      cogioValor: ventaja > 0,
      cuotaJustaCierre: 2,
      clvBruto: 0.05,
      ventaja: ventaja + (i % 2 === 0 ? 0.01 : -0.01),
    })) as AnalisisApuesta[];

  const con = (grupos: Array<[string, number, number]>) =>
    agregarPorGrupo(
      grupos.flatMap(([g, n, v]) => sintetico(n, v).map((analisis) => ({ grupo: g, analisis }))),
    );

  it('separa los grupos y los ordena por tamaño de muestra', () => {
    const r = con([['NBA', 120, 0.03], ['MLB', 300, -0.04]]);
    expect(r.map((g) => g.clave)).toEqual(['MLB', 'NBA']);
  });

  /*
   * El caso del tipster, reproducido: en agregado la señal se diluye, y solo
   * al separar aparece un deporte que pierde de forma significativa.
   */
  it('destapa un grupo que pierde y el agregado escondía', () => {
    const entradas = [
      ...sintetico(300, -0.04).map((analisis) => ({ grupo: 'futbol', analisis })),
      ...sintetico(300, 0.038).map((analisis) => ({ grupo: 'basket', analisis })),
    ];
    const global = agregar(entradas.map((e) => e.analisis));
    const grupos = agregarPorGrupo(entradas);

    // En conjunto casi se cancelan; por separado, los dos son significativos.
    expect(Math.abs(global.ventajaMedia)).toBeLessThan(0.005);
    const futbol = grupos.find((g) => g.clave === 'futbol');
    expect(futbol?.resumen.veredicto).toBe('significativo');
    expect(futbol?.resumen.signo).toBe('contra');
  });

  /*
   * El aviso que hay que dar en la interfaz: partir la muestra debilita cada
   * conclusión. 150 apuestas concluyen; repartidas en tres, ninguna concluye.
   */
  it('partir una muestra concluyente deja subgrupos que no concluyen', () => {
    const juntas = agregar(sintetico(150, 0.03));
    expect(juntas.veredicto).toBe('significativo');

    const partidas = con([['a', 50, 0.03], ['b', 50, 0.03], ['c', 50, 0.03]]);
    for (const g of partidas) expect(g.resumen.veredicto).toBe('muestra_insuficiente');
  });

  it('agrupa lo que no trae etiqueta bajo un guion', () => {
    const r = con([['', 10, 0.02]]);
    expect(r[0]?.clave).toBe('—');
  });
});

describe('cómo se le cuenta el veredicto a una persona', () => {
  const base = { n: 33, t: -3.36, veredicto: 'muestra_insuficiente' as const, signo: null };

  it('muestra corta con señal fuerte no es «no prueba nada»', () => {
    /*
     * El caso real: 33 picks, t = -3,36. La pantalla decía «con menos de 100
     * picks esto no prueba nada» justo al lado de un estadístico que sí dice
     * algo. Contradictorio, y en la dirección cómoda.
     */
    expect(claveVeredicto(base)).toBe('temprano_contra');
    expect(claveVeredicto({ ...base, t: 3.36 })).toBe('temprano_favor');
  });

  it('muestra corta y señal débil sigue siendo muestra insuficiente', () => {
    expect(claveVeredicto({ ...base, t: -1.2 })).toBe('muestra_insuficiente');
    expect(claveVeredicto({ ...base, t: null })).toBe('muestra_insuficiente');
  });

  it('con muestra suficiente manda el veredicto de siempre', () => {
    expect(
      claveVeredicto({ n: 200, t: 3.5, veredicto: 'significativo', signo: 'favor' }),
    ).toBe('significativo');
    expect(
      claveVeredicto({ n: 200, t: -3.5, veredicto: 'significativo', signo: 'contra' }),
    ).toBe('contra');
    expect(claveVeredicto({ n: 200, t: 0.4, veredicto: 'no_distinguible', signo: null })).toBe(
      'no_distinguible',
    );
  });
});

describe('las dos métricas y sus significancias por separado', () => {
  /*
   * El error que este bloque fija: encabezar el registro con la ventaja hacía
   * que una comisión constante de las casas —el margen— apareciera como un
   * hallazgo sobre el apostante. Con precios de mercado la ventaja sale
   * negativa siempre, apueste bien o mal.
   */
  const cogiendoElCierre = (n: number): AnalisisApuesta[] =>
    Array.from({ length: n }, (_, i) =>
      // Cuota tomada exactamente igual a la de cierre, alternando el mercado
      // para que la desviación no sea cero.
      analizarApuesta(i % 2 === 0 ? 1.9 : 2.1, i % 2 === 0 ? 1.9 : 2.1, i % 2 === 0 ? 2.1 : 1.9),
    );

  it('coger justo el cierre da CLV bruto cero y ventaja negativa', () => {
    const r = agregar(cogiendoElCierre(40));
    expect(r.bruto.media).toBeCloseTo(0, 10);
    expect(r.ventaja.media).toBeLessThan(0);
    // Y la distancia entre ambas es el margen del mercado.
    expect(r.bruto.media - r.ventaja.media).toBeCloseTo(r.margenMedio / (1 + r.margenMedio), 2);
  });

  it('coger siempre el cierre exacto no da estadístico: no hay variación', () => {
    // Todas las observaciones valen cero, así que la desviación es cero y el
    // estadístico no existe. Devolver un número aquí sería inventarlo.
    expect(agregar(cogiendoElCierre(40)).bruto.t).toBeNull();
  });

  it('con variación real, cada métrica trae su propio estadístico', () => {
    /*
     * Precios alrededor del cierre: unos algo mejores, otros algo peores. El
     * bruto oscila en torno a cero y no distingue; la ventaja, desplazada por
     * el margen, sí — y ese desplazamiento no dice nada de quien apuesta.
     */
    // Cierre 1,90 / 1,90: un mercado con 5,26 % de margen, como los reales.
    const mezcla = Array.from({ length: 60 }, (_, i) =>
      analizarApuesta(i % 2 === 0 ? 1.94 : 1.86, 1.9, 1.9),
    );
    const r = agregar(mezcla);
    expect(r.bruto.t).not.toBeNull();
    expect(r.ventaja.t).not.toBeNull();
    expect(Math.abs(r.bruto.t as number)).toBeLessThan(T_CRITICO);
    expect(r.ventaja.t as number).toBeLessThan(-T_CRITICO);
  });

  it('batir el cierre sube las dos, pero la ventaja arranca por debajo', () => {
    const mejores = Array.from({ length: 40 }, () => analizarApuesta(2.0, 1.9, 2.1));
    const r = agregar(mejores);
    expect(r.bruto.media).toBeGreaterThan(0);
    expect(r.bruto.media).toBeGreaterThan(r.ventaja.media);
  });
});

/*
 * La identidad que sostiene el listón del registro: la ventaja es el CLV
 * menos el margen, salvo un residuo de segundo orden. Si esto dejara de
 * cumplirse, la frase «te faltan X puntos» estaría mintiendo.
 */
describe('ventaja ≈ CLV − margen', () => {
  it('se cumple sobre un mercado real con margen bajo', () => {
    // Cierre 1.91 / 2.06: margen 1,90 %. Cuota tomada 1.97.
    const r = analizarApuestaN(1.97, [1.91, 2.06], 0);
    const residuo = Math.abs(r.ventaja - (r.clvBruto - r.justas.margen));
    expect(residuo).toBeLessThan(0.005);
  });

  it('con margen cero, ventaja y CLV coinciden', () => {
    // Un mercado sin comisión: 2.00 / 2.00 suma exactamente 1.
    const r = analizarApuestaN(2.2, [2, 2], 0);
    expect(r.justas.margen).toBeCloseTo(0, 6);
    expect(r.ventaja).toBeCloseTo(r.clvBruto, 6);
  });

  it('batir el cierre justo por el margen deja la ventaja en cero', () => {
    const cierres = [1.91, 2.06];
    const margen = cierres.reduce((s, x) => s + 1 / x, 0) - 1;
    const cierre = cierres[0] as number;
    // Tomar exactamente `cierre * (1 + margen)` es el punto de equilibrio.
    const r = analizarApuestaN(cierre * (1 + margen), cierres, 0);
    expect(Math.abs(r.ventaja)).toBeLessThan(0.005);
  });
});
