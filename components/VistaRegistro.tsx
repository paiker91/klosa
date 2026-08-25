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

  const fecha = (iso: string) =>
    new Date(iso).toLocaleDateString(
      locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es-ES' : 'en-US',
      { day: '2-digit', month: '2-digit', year: '2-digit' },
    );

  return (
    <>
      <Titulo t={t} publicar={tm.nav.publicar} />

      {conteos.total === 0 ? (
        <section className="tarjeta mt-10 p-6">
          <h2 className="text-lg font-semibold">{t.vacio.titulo}</h2>
          <p className="mt-2 text-tenue">{t.vacio.texto}</p>
        </section>
      ) : (
        <>
          <section className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
            {/* Bloque de CLV: veredicto, medidor y cifras, en ese orden. */}
            <div className="tarjeta p-5 sm:p-6">
              <Veredicto clave={clave} texto={t.veredictos[clave]} />

              <div className="mt-5">
                <Medidor n={resumen.n} total={N_MINIMO} locale={locale} textos={tm} />
              </div>

              {/* Las dos preguntas, ANTES de los números que las responden. */}
              <div className="mt-6 rounded-xl border border-borde bg-fondo/40 p-4">
                <p className="etiqueta-dato">{t.dosPreguntas.titulo}</p>
                <p className="mt-2 text-xs leading-relaxed text-tenue">
                  <strong className="text-tinta">{t.etiquetas.clvBruto}.</strong>{' '}
                  {t.dosPreguntas.bruto}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-tenue">
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
                  <div key={etiqueta}>
                    <dt className="etiqueta-dato">{etiqueta}</dt>
                    <dd
                      className={`cifra mt-1 text-2xl ${insuficiente ? 'text-tenue opacity-70' : 'text-tinta'}`}
                    >
                      {valor}
                    </dd>
                    <p className="mt-1.5 text-xs leading-relaxed text-apagado">{ayuda}</p>
                  </div>
                ))}
              </dl>

              {conteos.pendientes > 0 && (
                <p className="mt-5 border-t border-borde pt-4 text-xs text-apagado">
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
                      <p className="mt-3 text-xs leading-relaxed text-apagado">
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

          <section className="tarjeta mt-6 overflow-x-auto p-1.5 sm:p-2">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">{t.h1}</caption>
              <thead>
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
                    className="border-b border-borde/40 transition-colors last:border-0 hover:bg-superficie-alta/60"
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
                        <span className="mt-0.5 block text-xs text-apagado">
                          {[pick.casa, pick.stake ? `stake ${pick.stake}` : null, pick.nota]
                            .filter(Boolean)
                            .join(' · ')}
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
                    <td className="cifra px-3 py-3.5 text-right">
                      {!auditoria.valido ? (
                        <span className="text-xs text-negativo">{t.tabla.invalido}</span>
                      ) : analisis ? (
                        <span className={analisis.ventaja >= 0 ? 'text-positivo' : 'text-negativo'}>
                          {porcentaje(analisis.ventaja, locale)}
                        </span>
                      ) : sinCierre ? (
                        /*
                         * «Sin cierre medible», no «esperando». El pick existe
                         * y el resultado está, pero su línea se movió fuera del
                         * mercado y ese CLV no se puede calcular. Dejarlo en
                         * «esperando» prometía un dato que no iba a llegar.
                         */
                        <span className="text-xs text-aviso" title={sinCierre.detalle}>
                          {t.tabla.sinCierre}
                        </span>
                      ) : (
                        <span className="text-xs text-apagado">{t.tabla.esperando}</span>
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
            className="inline-flex min-h-10 items-center rounded-xl bg-acento px-4 text-sm font-semibold text-fondo transition-opacity hover:opacity-90"
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

      <p className="mt-6 text-xs leading-relaxed text-apagado">{t.aviso}</p>
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
        <div className="mt-5 rounded-xl border border-borde bg-fondo/40 p-4">
          <p className="etiqueta-dato">{t.naturaleza.titulo}</p>
          <p className="mt-2 text-xs leading-relaxed text-tenue">{t.naturaleza.texto}</p>
        </div>
      </div>
      {/* Solo lo ve quien ya entró al panel; publicar sigue pidiendo contraseña. */}
      <AccesoPanel etiqueta={publicar} />
    </section>
  );
}

/** Franja de veredicto. Un color por estado, y el ámbar significa "todavía no se sabe". */
function Veredicto({ clave, texto }: { clave: ClaveVeredicto; texto: string }) {
  const tono =
    clave === 'significativo' || clave === 'temprano_favor'
      ? 'border-positivo/30 bg-positivo/10 text-positivo'
      : clave === 'contra' || clave === 'temprano_contra'
        ? 'border-negativo/30 bg-negativo/10 text-negativo'
        : clave === 'no_distinguible'
          ? 'border-borde bg-fondo/40 text-tenue'
          : 'border-aviso/30 bg-aviso/10 text-aviso';

  return (
    <div className={`rounded-xl border p-4 ${tono}`}>
      <p className="text-sm leading-relaxed font-medium">{texto}</p>
    </div>
  );
}

function Insignia({ desenlace, textos: t }: { desenlace: Desenlace; textos: TextosRegistro }) {
  /*
   * Las medias se enseñan con su propio tono, más apagado: media ganada no es
   * ganada, y darles el mismo verde las convertiría en victorias a la vista.
   */
  const estilo =
    desenlace === 'ganada'
      ? 'bg-positivo/15 text-positivo'
      : desenlace === 'media_ganada'
        ? 'bg-positivo/10 text-positivo/80'
        : desenlace === 'perdida'
          ? 'bg-negativo/15 text-negativo'
          : desenlace === 'media_perdida'
            ? 'bg-negativo/10 text-negativo/80'
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
