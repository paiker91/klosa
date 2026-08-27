import type { Locale } from '@/i18n/config';
import type { TextosRegistro } from '@/i18n/textos-registro';
import type { TextosMarco } from '@/i18n/textos-marco';
import type { RegistroPublico } from '@/lib/picks/remoto';
import { cuotaTomadaDelCierre } from '@/lib/picks/dominio';
import { etiquetaLado } from '@/i18n/lados';
import type { Desenlace } from '@/lib/apuestas/handicap';
import type { ClaveVeredicto } from '@/lib/clv';
import { N_MINIMO, claveVeredicto } from '@/lib/clv';
import { porcentaje, porcentajeSinSigno, decimal, entero } from './formato';
import { Medidor, CosteDeLaMuestra } from './Medidor';
import { Dispersion } from './Dispersion';
import { TablaGrupos } from './TablaGrupos';
import { AccesoPanel } from './AccesoPanel';

/*
 * Sin datos no se escribe un cero. Un 0,00 % se lee como una medición que dio
 * cero, y aquí significa que no hay ninguna medición todavía.
 */
const SIN_DATO = '—';

/**
 * Vista del registro público. Componente de servidor: no hay nada que
 * interactuar, solo datos que enseñar.
 *
 * Regla de la página: ninguna cifra sin su contexto de significancia, y el
 * veredicto siempre antes que los números. Mientras la muestra sea pequeña,
 * las cifras se atenúan a propósito y el medidor lo dice antes de que nadie
 * llegue a leer una sola frase.
 */
export function VistaRegistro({
  locale,
  textos: t,
  marco: tm,
  registro,
  urlRepo,
}: {
  locale: Locale;
  textos: TextosRegistro;
  marco: TextosMarco;
  /** `null` cuando no se pudo leer, que NO es lo mismo que estar vacío. */
  registro: RegistroPublico | null;
  urlRepo: string;
}) {
  if (registro === null) {
    return (
      <>
        <Titulo t={t} publicar={tm.nav.publicar} />
        <section role="alert" className="tarjeta mt-8 border-negativo/50 p-6">
          <h2 className="text-lg font-semibold text-negativo">{t.noDisponible.titulo}</h2>
          <p className="mt-2 text-tenue">{t.noDisponible.texto}</p>
          <p className="mt-5">
            <a
              href={urlRepo}
              className="inline-flex min-h-10 items-center rounded-xl border border-borde bg-superficie px-4 text-sm font-medium text-tinta hover:border-borde-fuerte"
            >
              {t.verificar.enlaceRepo}
            </a>
          </p>
        </section>
      </>
    );
  }

  const { resumen, resultados, conteos, entradas, urls } = registro;
  const insuficiente = resumen.veredicto === 'muestra_insuficiente';

  /*
   * La clave la calcula `lib/clv.ts` para que no se repita en cada pantalla.
   * Distingue el caso que antes se contaba mal: muestra corta pero estadístico
   * que ya pasa el umbral. Decir «no prueba nada» junto a un t de -3,36 es una
   * contradicción, y encima en la dirección cómoda.
   */
  /*
   * El veredicto lo manda el CLV BRUTO, no la ventaja.
   *
   * La ventaja descuenta el margen, que es una comisión constante de las casas
   * y no dice nada de quien apuesta: con precios de mercado sale negativa
   * siempre. Encabezar con ella convertía «las casas cobran» en «tus picks son
   * malos». La ventaja sigue estando, porque es la que decide si se gana
   * dinero, pero no es la que juzga la habilidad.
   */
  const clave = claveVeredicto({ n: resumen.n, ...resumen.bruto });
  const flojoResultados = resultados.veredicto === 'muestra_insuficiente';
  const claveResultados = claveVeredicto(resultados);

  /* La nube dibuja el CLV bruto: lo mismo que juzga el veredicto. */
  const ventajas = entradas
    .map((e) => e.analisis?.clvBruto)
    .filter((v): v is number => v !== undefined);

  /*
   * Escala de las barras de la tabla. Es común a las dos columnas de
   * porcentaje: con una escala por columna, un -0,5 % del bruto y un -0,5 % de
   * la ventaja dibujarían barras de distinto tamaño y la comparación entre
   * columnas —que es justo la que hay que hacer— saldría falseada.
   */
  const extremo = Math.max(
    0.01,
    ...entradas.flatMap((e) =>
      e.analisis ? [Math.abs(e.analisis.clvBruto), Math.abs(e.analisis.ventaja)] : [],
    ),
  );
  const peso = (v: number) => Math.round((Math.abs(v) / extremo) * 100);

  const fecha = (iso: string) =>
    new Date(iso).toLocaleDateString(
      locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es-ES' : 'en-US',
      { day: '2-digit', month: '2-digit', year: '2-digit' },
    );

  return (
    <>
      <Titulo t={t} publicar={tm.nav.publicar} />

      {conteos.total === 0 ? (
        /*
         * El registro vacío no es una página de error, es la portada del
         * producto durante sus primeras semanas: mientras no haya cien picks,
         * esto es lo que ve todo el que entre. Así que enseña la forma que va
         * a tener —el medidor a cero y las cuatro cifras en blanco— en vez de
         * una línea de texto pidiendo que vuelvas.
         *
         * El medidor a 0 de 100 dice desde el primer día lo mismo que dirá con
         * cuarenta picks: que no hay muestra. Empezar enseñándolo es coherente
         * con el resto, y además fija la expectativa antes de que haya ningún
         * número que presumir.
         */
        <section className="tarjeta mt-10 overflow-hidden">
          <div className="p-5 sm:p-6">
            <h2 className="text-xl font-semibold">{t.vacio.titulo}</h2>
            <p className="mt-2 leading-relaxed text-tenue">{t.vacio.texto}</p>
            <div className="mt-5">
              <Medidor n={0} total={N_MINIMO} locale={locale} textos={tm} />
            </div>
          </div>

          <div className="grid grid-cols-2 divide-borde border-t border-borde sm:grid-cols-4 sm:divide-x">
            {[t.vistazo.picks, t.etiquetas.clvBruto, t.etiquetas.ventajaMedia, t.resultados.yield].map(
              (etiqueta) => (
                <div key={etiqueta} className="px-5 py-5 sm:px-6">
                  <p className="etiqueta-dato">{etiqueta}</p>
                  <p className="cifra mt-1.5 text-3xl leading-none font-bold text-apagado sm:text-4xl">
                    {SIN_DATO}
                  </p>
                </div>
              ),
            )}
          </div>

          <div className="border-t border-borde px-5 py-4 sm:px-6">
            <a href={urlRepo} className="texto-ayuda text-acento hover:underline">
              {t.verificar.enlaceRepo} →
            </a>
          </div>
        </section>
      ) : (
        <>
          {/*
            Cabecera de cifras. La página abría con dos párrafos y una caja de
            texto: había que LEER para saber qué dice el registro. Estas cuatro
            cifras lo dicen de un vistazo.

            El veredicto va dentro del mismo bloque a propósito. Un panel de
            números grandes es justo lo que este producto critica cuando se
            enseña suelto, así que aquí no se puede separar del aviso de que la
            muestra todavía no prueba nada.
          */}
          <section className="tarjeta mt-10 overflow-hidden">
            <Veredicto clave={clave} texto={t.veredictos[clave]} destacado />

            <div className="grid grid-cols-2 divide-borde border-t border-borde sm:grid-cols-4 sm:divide-x">
              <Vistazo
                etiqueta={t.vistazo.picks}
                valor={entero(conteos.conCierre, locale)}
                pie={`${entero(resultados.n, locale)} ${t.vistazo.resueltos}`}
              />
              <Vistazo
                etiqueta={t.etiquetas.clvBruto}
                valor={resumen.n === 0 ? SIN_DATO : porcentaje(resumen.clvMedio, locale)}
                signo={resumen.n === 0 ? undefined : resumen.clvMedio}
                atenuado={insuficiente}
              />
              <Vistazo
                etiqueta={t.etiquetas.ventajaMedia}
                valor={resumen.n === 0 ? SIN_DATO : porcentaje(resumen.ventajaMedia, locale)}
                signo={resumen.n === 0 ? undefined : resumen.ventajaMedia}
                atenuado={insuficiente}
              />
              <Vistazo
                etiqueta={t.resultados.yield}
                valor={resultados.n === 0 ? SIN_DATO : porcentaje(resultados.yield, locale)}
                signo={resultados.n === 0 ? undefined : resultados.yield}
                atenuado={flojoResultados}
              />
            </div>

            <div className="border-t border-borde px-5 py-4 sm:px-6">
              <Medidor n={resumen.n} total={N_MINIMO} locale={locale} textos={tm} />
            </div>
          </section>

          <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
            {/* Bloque de CLV: las dos preguntas y las cifras que las responden. */}
            <div className="tarjeta p-5 sm:p-6">

              {/* Las dos preguntas, ANTES de los números que las responden. */}
              <div className="rounded-xl border border-borde bg-superficie p-4">
                <p className="etiqueta-dato">{t.dosPreguntas.titulo}</p>
                <p className="mt-2 texto-ayuda">
                  <strong className="text-tinta">{t.etiquetas.clvBruto}.</strong>{' '}
                  {t.dosPreguntas.bruto}
                </p>
                <p className="mt-2 texto-ayuda">
                  <strong className="text-tinta">{t.etiquetas.ventajaMedia}.</strong>{' '}
                  {t.dosPreguntas.ventaja}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-aviso">
                  {t.dosPreguntas.conclusion}
                </p>
              </div>

              {/*
                Cada cifra con lo que significa debajo. Sin eso, «Estadístico t»
                no le dice nada a quien no vive de esto — y el producto entero
                existe porque la gente lee mal estos números.
              */}
              <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-2">
                {(
                  [
                    [t.etiquetas.n, entero(resumen.n, locale), t.ayudas.n],
                    [
                      t.etiquetas.clvBruto,
                      resumen.n === 0 ? SIN_DATO : porcentaje(resumen.clvMedio, locale),
                      t.ayudas.clvBruto,
                    ],
                    [
                      t.etiquetas.ventajaMedia,
                      resumen.n === 0 ? SIN_DATO : porcentaje(resumen.ventajaMedia, locale),
                      t.ayudas.ventajaMedia,
                    ],
                    [
                      t.etiquetas.margen,
                      resumen.n === 0 ? SIN_DATO : porcentajeSinSigno(resumen.margenMedio, locale),
                      t.ayudas.margen,
                    ],
                    [
                      t.etiquetas.tasaAcierto,
                      resumen.n === 0 ? SIN_DATO : porcentajeSinSigno(resumen.bruto.tasa, locale),
                      t.ayudas.tasaAcierto,
                    ],
                    [
                      t.etiquetas.t,
                      resumen.bruto.t === null ? SIN_DATO : decimal(resumen.bruto.t, locale, 2),
                      t.ayudas.t,
                    ],
                  ] as const
                ).map(([etiqueta, valor, ayuda]) => (
                  /*
                    Cada métrica en su propia caja. Antes eran celdas sueltas de
                    una rejilla y con seis seguidas costaba ver dónde acababa un
                    dato y empezaba el siguiente; el borde hace ese trabajo.
                  */
                  <div
                    key={etiqueta}
                    className="rounded-xl border border-borde bg-superficie p-3.5 transition-colors hover:border-borde-fuerte"
                  >
                    <dt className="etiqueta-dato">{etiqueta}</dt>
                    <dd
                      className={`cifra mt-1.5 text-3xl ${insuficiente ? 'text-tenue opacity-70' : 'text-tinta'}`}
                    >
                      {valor}
                    </dd>
                    <p className="mt-2 texto-ayuda">{ayuda}</p>
                  </div>
                ))}
              </dl>

              {conteos.pendientes > 0 && (
                <p className="mt-5 border-t border-borde pt-4 texto-ayuda">
                  {t.etiquetas.pendientes}: {entero(conteos.pendientes, locale)}
                </p>
              )}
            </div>

            {/* La dispersión: lo que explica por qué hacen falta tantos picks. */}
            <div className="tarjeta p-5 sm:p-6">
              <h2 className="text-sm font-semibold text-tinta">{tm.grafico.titulo}</h2>
              {ventajas.length > 0 ? (
                <Dispersion
                  valores={ventajas}
                  media={resumen.clvMedio}
                  locale={locale}
                  textos={tm}
                />
              ) : (
                <p className="mt-4 text-sm leading-relaxed text-apagado">{tm.grafico.vacio}</p>
              )}
            </div>
          </section>

          {/*
            Yield, cuota media y acierto. Van DESPUÉS del CLV y con su propia
            cuenta de apuestas necesarias: enseñados así, el registro demuestra
            sobre sus propios datos por qué el CLV es la métrica y el yield no.
          */}
          <section className="mt-6">
            <h2 className="text-xl font-semibold tracking-tight">{t.resultados.titulo}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-tenue">
              {t.resultados.entradilla}
            </p>

            {resultados.n === 0 ? (
              <p className="tarjeta mt-4 p-5 text-sm leading-relaxed text-apagado">
                {t.resultados.vacio}
              </p>
            ) : (
              <div className="tarjeta mt-4 p-5 sm:p-6">
                {/* Veredicto propio: el del CLV habla de 100 picks y aquí engañaría. */}
                <Veredicto clave={claveResultados} texto={t.resultados.veredictos[claveResultados]} />

                <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-5">
                  {(
                    [
                      [t.resultados.resueltas, entero(resultados.n, locale), false],
                      [t.resultados.yield, porcentaje(resultados.yield, locale), true],
                      [t.resultados.cuotaMedia, decimal(resultados.cuotaMedia, locale, 2), false],
                      [
                        t.resultados.acierto,
                        porcentajeSinSigno(resultados.tasaAcierto, locale),
                        true,
                      ],
                      [t.resultados.beneficio, decimal(resultados.beneficio, locale, 2), true],
                    ] as const
                  ).map(([etiqueta, valor, atenuable]) => (
                    <div key={etiqueta}>
                      <dt className="etiqueta-dato">{etiqueta}</dt>
                      <dd
                        className={`cifra mt-1 text-2xl ${
                          atenuable && flojoResultados ? 'text-tenue opacity-70' : 'text-tinta'
                        }`}
                      >
                        {valor}
                      </dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-6 border-t border-borde pt-5">
                  {resultados.apuestasNecesarias === null ? (
                    <p className="text-sm text-apagado">{t.resultados.sinDato}</p>
                  ) : (
                    <>
                      <CosteDeLaMuestra
                        necesariasClv={N_MINIMO}
                        necesariasYield={resultados.apuestasNecesarias}
                        locale={locale}
                        textos={tm}
                      />
                      <p className="mt-3 texto-ayuda">
                        {t.resultados.necesarias
                          .replace('{n}', entero(resultados.apuestasNecesarias, locale))
                          .replace('{clv}', entero(N_MINIMO, locale))}
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}
          </section>

          {registro.porDeporte.length > 0 && (
            <section className="mt-6">
              <h2 className="text-xl font-semibold tracking-tight">{t.desglose.titulo}</h2>
              {/*
                El aviso va ANTES de la tabla. El desglose es lo que destapa un
                deporte que pierde mientras el agregado lo tapa, pero también
                fabrica patrones falsos: cuantos más grupos, más probable que
                alguno parezca significativo por puro azar.
              */}
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-tenue">
                {t.desglose.aviso}
              </p>
              <div className="tarjeta mt-4 p-5 sm:p-6">
                <TablaGrupos
                  grupos={registro.porDeporte}
                  locale={locale}
                  encabezados={{
                    grupo: t.desglose.grupo,
                    n: t.etiquetas.n,
                    ventaja: t.etiquetas.ventajaMedia,
                    t: t.etiquetas.t,
                  }}
                />
              </div>
            </section>
          )}

          {/*
            `max-h` y cabecera pegajosa. Con más de cincuenta filas, al llegar
            abajo ya no se sabe qué columna es cuál y hay que subir a mirar.
          */}
          <section className="tarjeta mt-6 max-h-[38rem] overflow-auto p-1.5 sm:p-2">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">{t.h1}</caption>
              <thead className="sticky top-0 z-10 bg-superficie-alta/95 backdrop-blur-sm">
                <tr className="border-b border-borde text-left">
                  <th scope="col" className="etiqueta-dato hidden px-3 py-3 md:table-cell">
                    {t.tabla.fecha}
                  </th>
                  <th scope="col" className="etiqueta-dato px-3 py-3">
                    {t.tabla.partido}
                  </th>
                  <th scope="col" className="etiqueta-dato px-3 py-3">
                    {t.tabla.lado}
                  </th>
                  <th scope="col" className="etiqueta-dato px-3 py-3 text-right">
                    {t.tabla.tomada}
                  </th>
                  <th scope="col" className="etiqueta-dato hidden px-3 py-3 text-right sm:table-cell">
                    {t.tabla.cierre}
                  </th>
                  {/*
                    La justa va JUNTO a la ventaja, no escondida.
                    Antes la tabla enseñaba la cuota de cierre y, al lado, un
                    porcentaje calculado contra la justa —que no aparecía por
                    ninguna parte—. Quien leía «1,94 · 1,95 · −4,46 %» hacía la
                    resta evidente, le salía −0,5 % y concluía, con razón, que
                    algo estaba mal. El número era correcto; la columna que lo
                    explicaba faltaba.
                  */}
                  <th scope="col" className="etiqueta-dato hidden px-3 py-3 text-right md:table-cell">
                    {t.tabla.justa}
                  </th>
                  <th scope="col" className="etiqueta-dato hidden px-3 py-3 text-right sm:table-cell">
                    {t.tabla.bruto}
                  </th>
                  <th scope="col" className="etiqueta-dato px-3 py-3 text-right">
                    {t.tabla.ventaja}
                  </th>
                  <th scope="col" className="etiqueta-dato px-3 py-3 text-right">
                    {t.tabla.resultado}
                  </th>
                </tr>
              </thead>
              <tbody>
                {entradas.map(({ pick, auditoria, cierre, sinCierre, resultado, analisis }) => {
                  const cerrada = cierre ? cuotaTomadaDelCierre(cierre) : undefined;
                  return (
                  <tr
                    key={pick.id}
                    className="border-b border-borde transition-colors last:border-0 hover:bg-superficie"
                  >
                    <td className="cifra hidden px-3 py-3.5 text-xs whitespace-nowrap text-apagado md:table-cell">
                      {fecha(pick.registradoEn)}
                    </td>
                    <td className="px-3 py-3.5">
                      <span className="font-medium">{pick.visitante}</span>
                      <span className="text-apagado"> @ </span>
                      <span className="font-medium">{pick.local}</span>
                      {/*
                        La procedencia de la cuota se enseña siempre. Un 2,20 sin
                        decir si fue un precio real de una casa o una mediana
                        calculada no se puede auditar, y auditar es el punto.
                      */}
                      {(pick.casa || pick.nota || pick.stake) && (
                        <span className="mt-0.5 block texto-ayuda">
                          {[pick.casa, pick.stake ? `stake ${pick.stake}` : null, pick.nota]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      )}
                      {/*
                        Un CLV medido contra una línea distinta se declara en
                        la propia fila. Es una cota inferior, no una medición
                        exacta, y quien lea la tabla tiene que saberlo sin
                        buscar en ninguna nota al pie.
                      */}
                      {cierre?.estimacion && (
                        <span className="mt-0.5 block text-xs text-aviso">
                          {t.tabla[cierre.estimacion.metodo]}
                          {cierre.estimacion.vecinas.length > 0 &&
                            ` (${cierre.estimacion.vecinas
                              .map((v) => `${decimal(v.linea, locale, 2)} → ${decimal(v.cuota, locale, 2)}`)
                              .join(' · ')})`}
                        </span>
                      )}
                      {/* Un sello que no se puede recalcular se declara, no se esconde. */}
                      {auditoria.reparos.includes('sello_no_verificable') && (
                        <span className="mt-0.5 block text-xs text-aviso">
                          {t.tabla.selloIlegible}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3.5 text-tenue">{etiquetaLado(pick.lado, locale)}</td>
                    <td className="cifra px-3 py-3.5 text-right">
                      {decimal(pick.cuotaTomada, locale, 2)}
                    </td>
                    <td className="cifra hidden px-3 py-3.5 text-right text-tenue sm:table-cell">
                      {cerrada === undefined ? '—' : decimal(cerrada, locale, 2)}
                    </td>
                    {/*
                      La cuota justa: el cierre sin el margen de la casa. Es
                      contra ESTE número contra el que se calcula la ventaja, y
                      por eso va en la fila y no en una nota al pie.
                    */}
                    <td className="cifra hidden px-3 py-3.5 text-right text-dato md:table-cell">
                      {analisis ? decimal(analisis.cuotaJustaCierre, locale, 2) : '—'}
                    </td>
                    <td
                      className={`cifra celda-barra hidden px-3 py-3.5 text-right sm:table-cell ${
                        analisis
                          ? analisis.clvBruto >= 0
                            ? 'text-positivo'
                            : 'text-negativo'
                          : 'text-apagado'
                      }`}
                      style={
                        analisis
                          ? ({ '--peso': peso(analisis.clvBruto) } as React.CSSProperties)
                          : undefined
                      }
                    >
                      {analisis ? porcentaje(analisis.clvBruto, locale) : '—'}
                    </td>
                    <td
                      className={`cifra px-3 py-3.5 text-right font-semibold ${
                        analisis
                          ? `celda-barra ${analisis.ventaja >= 0 ? 'text-positivo' : 'text-negativo'}`
                          : ''
                      }`}
                      style={
                        analisis
                          ? ({ '--peso': peso(analisis.ventaja) } as React.CSSProperties)
                          : undefined
                      }
                    >
                      {!auditoria.valido ? (
                        <span className="text-xs font-normal text-negativo">{t.tabla.invalido}</span>
                      ) : analisis ? (
                        porcentaje(analisis.ventaja, locale)
                      ) : sinCierre ? (
                        /*
                         * «Sin cierre medible», no «esperando». El pick existe
                         * y el resultado está, pero su línea se movió fuera del
                         * mercado y ese CLV no se puede calcular. Dejarlo en
                         * «esperando» prometía un dato que no iba a llegar.
                         */
                        <span className="text-xs font-normal text-aviso" title={sinCierre.detalle}>
                          {t.tabla.sinCierre}
                        </span>
                      ) : (
                        <span className="text-xs font-normal text-apagado">{t.tabla.esperando}</span>
                      )}
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      {resultado === null ? (
                        <span className="text-apagado">—</span>
                      ) : (
                        <Insignia desenlace={resultado.desenlace} textos={t} />
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </>
      )}

      <section className="tarjeta mt-10 p-5 sm:p-6">
        <h2 className="text-lg font-semibold">{t.verificar.titulo}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-tenue">{t.verificar.texto}</p>
        <p className="mt-5 flex flex-wrap gap-2.5">
          <a
            href={urls.repo}
            rel="noopener"
            className="inline-flex min-h-10 items-center rounded-xl bg-acento px-4 text-sm font-semibold text-superficie-alta shadow-[0_4px_12px_-6px_var(--color-acento)] transition-all hover:brightness-110"
          >
            {t.verificar.enlaceRepo}
          </a>
          <a
            href={urls.picks}
            rel="noopener"
            className="inline-flex min-h-10 items-center rounded-xl border border-borde px-4 text-sm font-medium text-tenue transition-colors hover:border-borde-fuerte hover:text-tinta"
          >
            {t.verificar.enlacePicks}
          </a>
        </p>
      </section>

      <p className="mt-6 texto-ayuda">{t.aviso}</p>
    </>
  );
}

function Titulo({ t, publicar }: { t: TextosRegistro; publicar: string }) {
  return (
    <section className="flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-3xl">
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">{t.h1}</h1>
        <p className="mt-4 leading-relaxed text-tenue">{t.entradilla}</p>
        {/*
          Va arriba y no en una nota al pie. Quien lee un histórico de picks da
          por hecho que son apuestas reales de quien lo publica; decirle que no
          después de que se haya formado esa idea es corregirle, y decírselo
          antes es informarle.
        */}
        <div className="mt-5 rounded-xl border border-borde bg-superficie p-4">
          <p className="etiqueta-dato">{t.naturaleza.titulo}</p>
          <p className="mt-2 texto-ayuda">{t.naturaleza.texto}</p>
        </div>
      </div>
      {/* Solo lo ve quien ya entró al panel; publicar sigue pidiendo contraseña. */}
      <AccesoPanel etiqueta={publicar} />
    </section>
  );
}

/**
 * Una cifra de la cabecera.
 *
 * `atenuado` no es un detalle de estilo: cuando la muestra no da para
 * concluir, el número se apaga y pierde el verde o el rojo. Un panel de cifras
 * grandes y de colores es exactamente lo que este producto critica cuando se
 * enseña sin contexto, así que aquí el contexto entra en el color.
 */
function Vistazo({
  etiqueta,
  valor,
  pie,
  signo,
  atenuado = false,
}: {
  etiqueta: string;
  valor: string;
  pie?: string;
  signo?: number;
  atenuado?: boolean;
}) {
  const tono =
    atenuado || signo === undefined
      ? 'text-tinta'
      : signo >= 0
        ? 'text-positivo'
        : 'text-negativo';

  return (
    <div className="px-5 py-5 sm:px-6">
      <p className="etiqueta-dato">{etiqueta}</p>
      <p
        className={`cifra mt-1.5 text-3xl leading-none font-bold sm:text-4xl ${tono} ${
          atenuado ? 'opacity-60' : ''
        }`}
      >
        {valor}
      </p>
      {pie !== undefined && <p className="mt-2 texto-ayuda">{pie}</p>}
    </div>
  );
}

/** Franja de veredicto. Un color por estado, y el ámbar significa "todavía no se sabe". */
function Veredicto({
  clave,
  texto,
  destacado = false,
}: {
  clave: ClaveVeredicto;
  texto: string;
  /** En la cabecera ocupa el ancho entero y se lee grande; en el resto, no. */
  destacado?: boolean;
}) {
  const favor = clave === 'significativo' || clave === 'temprano_favor';
  const contra = clave === 'contra' || clave === 'temprano_contra';
  const neutro = clave === 'no_distinguible';

  const tono = favor
    ? 'border-positivo/30 bg-positivo/10 text-positivo'
    : contra
      ? 'border-negativo/30 bg-negativo/10 text-negativo'
      : neutro
        ? 'border-borde bg-superficie text-tenue'
        : 'border-aviso/30 bg-aviso/10 text-aviso';

  if (!destacado) {
    return (
      <div className={`rounded-xl border p-4 ${tono}`}>
        <p className="text-sm leading-relaxed font-medium">{texto}</p>
      </div>
    );
  }

  /*
   * El icono repite lo que ya dice el color, y eso es deliberado: con
   * daltonismo rojo-verde —cerca del 8 % de los hombres— el color solo no
   * distingue «tienes ventaja» de «la estás perdiendo».
   */
  const icono = favor ? '↑' : contra ? '↓' : neutro ? '=' : '!';
  const franja = favor
    ? 'from-positivo/18'
    : contra
      ? 'from-negativo/18'
      : neutro
        ? 'from-borde/40'
        : 'from-aviso/18';

  return (
    <div
      className={`flex items-start gap-4 bg-gradient-to-r via-transparent to-transparent px-5 py-5 sm:px-6 ${franja}`}
    >
      <span
        aria-hidden="true"
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-semibold ring-1 ${
          favor
            ? 'bg-positivo/15 text-positivo ring-positivo/30'
            : contra
              ? 'bg-negativo/15 text-negativo ring-negativo/30'
              : neutro
                ? 'bg-superficie-alta text-tenue ring-borde'
                : 'bg-aviso/15 text-aviso ring-aviso/30'
        }`}
      >
        {icono}
      </span>
      <p
        className={`text-base leading-relaxed font-medium text-balance sm:text-lg ${
          favor
            ? 'text-positivo'
            : contra
              ? 'text-negativo'
              : neutro
                ? 'text-tenue'
                : 'text-aviso'
        }`}
      >
        {texto}
      </p>
    </div>
  );
}

function Insignia({ desenlace, textos: t }: { desenlace: Desenlace; textos: TextosRegistro }) {
  /*
   * Las medias se enseñan con su propio tono, más apagado: media ganada no es
   * ganada, y darles el mismo verde las convertiría en victorias a la vista.
   */
  /*
   * Las medias se distinguen por el RELLENO, no por diluir el texto.
   *
   * Antes llevaban el color al 80 % sobre un tinte del 10 %: sobre fondo
   * oscuro eso se leía como «lo mismo pero más flojo», y sobre blanco se
   * quedaba en un pastel casi ilegible. La distinción ya la lleva el prefijo ½
   * de la etiqueta, así que el texto va a plena intensidad.
   */
  const estilo =
    desenlace === 'ganada'
      ? 'bg-positivo/15 text-positivo'
      : desenlace === 'media_ganada'
        ? 'bg-positivo/8 text-positivo'
        : desenlace === 'perdida'
          ? 'bg-negativo/15 text-negativo'
          : desenlace === 'media_perdida'
            ? 'bg-negativo/8 text-negativo'
            : 'bg-borde text-tenue';

  const etiqueta =
    desenlace === 'media_ganada'
      ? `½ ${t.tabla.ganada}`
      : desenlace === 'media_perdida'
        ? `½ ${t.tabla.perdida}`
        : t.tabla[desenlace];

  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${estilo}`}
    >
      {etiqueta}
    </span>
  );
}
