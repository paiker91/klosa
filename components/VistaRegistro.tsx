import type { Locale } from '@/i18n/config';
import type { TextosRegistro } from '@/i18n/textos-registro';
import type { RegistroPublico } from '@/lib/picks/remoto';
import { porcentaje, porcentajeSinSigno, decimal, entero } from './formato';

/**
 * Vista del registro público. Componente de servidor: no hay nada que
 * interactuar, solo datos que enseñar.
 *
 * Regla de la página: ninguna cifra sin su contexto de significancia, y el
 * veredicto siempre antes que los números. Mientras la muestra sea pequeña,
 * las cifras se atenúan a propósito.
 */
export function VistaRegistro({
  locale,
  textos: t,
  registro,
  urlRepo,
}: {
  locale: Locale;
  textos: TextosRegistro;
  /** `null` cuando no se pudo leer, que NO es lo mismo que estar vacío. */
  registro: RegistroPublico | null;
  urlRepo: string;
}) {
  if (registro === null) {
    return (
      <>
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{t.h1}</h1>
        <section role="alert" className="mt-8 rounded border border-negativo bg-superficie p-6">
          <h2 className="text-lg font-semibold text-negativo">{t.noDisponible.titulo}</h2>
          <p className="mt-2 text-tenue">{t.noDisponible.texto}</p>
          <p className="mt-4">
            <a
              href={urlRepo}
              className="rounded border border-acento px-3 py-2 text-sm text-acento hover:bg-fondo"
            >
              {t.verificar.enlaceRepo}
            </a>
          </p>
        </section>
      </>
    );
  }

  const { resumen, conteos, entradas, urls } = registro;
  const insuficiente = resumen.veredicto === 'muestra_insuficiente';

  const claveVeredicto =
    resumen.veredicto === 'significativo' && resumen.signo === 'contra'
      ? 'contra'
      : resumen.veredicto;

  const colorVeredicto =
    claveVeredicto === 'significativo'
      ? 'border-positivo text-positivo'
      : claveVeredicto === 'contra'
        ? 'border-negativo text-negativo'
        : 'border-borde text-tinta';

  const fecha = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es-ES' : 'en-US', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{t.h1}</h1>
      <p className="mt-4 text-tenue">{t.entradilla}</p>

      {conteos.total === 0 ? (
        <section className="mt-10 rounded border border-borde bg-superficie p-6">
          <h2 className="text-lg font-semibold">{t.vacio.titulo}</h2>
          <p className="mt-2 text-tenue">{t.vacio.texto}</p>
        </section>
      ) : (
        <>
          {/* El veredicto va primero, siempre. */}
          <div className={`mt-10 rounded border-l-4 bg-superficie p-5 ${colorVeredicto}`}>
            <p className="font-medium">{t.veredictos[claveVeredicto]}</p>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-5 rounded border border-borde bg-superficie p-5 sm:grid-cols-4">
            {(
              [
                [t.etiquetas.n, entero(resumen.n, locale)],
                [t.etiquetas.ventajaMedia, porcentaje(resumen.ventajaMedia, locale)],
                [t.etiquetas.tasaAcierto, porcentajeSinSigno(resumen.tasaDeAcierto, locale)],
                [t.etiquetas.t, resumen.t === null ? '—' : decimal(resumen.t, locale, 2)],
              ] as const
            ).map(([etiqueta, valor]) => (
              <div key={etiqueta}>
                <dt className="text-sm text-tenue">{etiqueta}</dt>
                <dd
                  className={`font-mono text-xl tabular-nums ${insuficiente ? 'text-tenue opacity-60' : ''}`}
                >
                  {valor}
                </dd>
              </div>
            ))}
          </dl>

          {conteos.pendientes > 0 && (
            <p className="mt-3 text-sm text-tenue">
              {t.etiquetas.pendientes}: {conteos.pendientes}
            </p>
          )}

          {registro.porDeporte.length > 0 && (
            <section className="mt-10">
              <h2 className="text-xl font-semibold">{t.desglose.titulo}</h2>
              {/*
                El aviso va ANTES de la tabla. El desglose es lo que destapa un
                deporte que pierde mientras el agregado lo tapa, pero también
                fabrica patrones falsos: cuantos más grupos, más probable que
                alguno parezca significativo por puro azar.
              */}
              <p className="mt-2 text-sm text-tenue">{t.desglose.aviso}</p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-borde text-left text-tenue">
                      <th scope="col" className="py-2 pr-4 font-medium">
                        {t.desglose.grupo}
                      </th>
                      <th scope="col" className="py-2 pr-4 text-right font-medium">
                        {t.etiquetas.n}
                      </th>
                      <th scope="col" className="py-2 pr-4 text-right font-medium">
                        {t.etiquetas.ventajaMedia}
                      </th>
                      <th scope="col" className="py-2 text-right font-medium">
                        {t.etiquetas.t}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {registro.porDeporte.map((g) => {
                      const flojo = g.resumen.veredicto === 'muestra_insuficiente';
                      const color =
                        g.resumen.veredicto !== 'significativo'
                          ? 'text-tinta'
                          : g.resumen.signo === 'contra'
                            ? 'text-negativo'
                            : 'text-positivo';
                      const tono = flojo ? 'text-tenue opacity-60' : color;
                      return (
                        <tr key={g.clave} className="border-b border-borde/50">
                          <td className="py-2.5 pr-4">{g.clave}</td>
                          <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                            {entero(g.resumen.n, locale)}
                          </td>
                          <td className={`py-2.5 pr-4 text-right font-mono tabular-nums ${tono}`}>
                            {porcentaje(g.resumen.ventajaMedia, locale)}
                          </td>
                          <td className={`py-2.5 text-right font-mono tabular-nums ${tono}`}>
                            {g.resumen.t === null ? '—' : decimal(g.resumen.t, locale, 2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <div className="mt-8 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">{t.h1}</caption>
              <thead>
                <tr className="border-b border-borde text-left text-tenue">
                  <th scope="col" className="py-2 pr-4 font-medium">{t.tabla.fecha}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t.tabla.partido}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t.tabla.lado}</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">{t.tabla.tomada}</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">{t.tabla.cierre}</th>
                  <th scope="col" className="py-2 text-right font-medium">{t.tabla.ventaja}</th>
                </tr>
              </thead>
              <tbody>
                {entradas.map(({ pick, auditoria, cierre, analisis }) => (
                  <tr key={pick.id} className="border-b border-borde/50">
                    <td className="py-2.5 pr-4 whitespace-nowrap font-mono text-xs text-tenue">
                      {fecha(pick.registradoEn)}
                    </td>
                    <td className="py-2.5 pr-4">
                      {pick.visitante} @ {pick.local}
                      {/*
                        La procedencia de la cuota se enseña siempre. Un 2,20 sin
                        decir si fue un precio real de una casa o una mediana
                        calculada no se puede auditar, y auditar es el punto.
                      */}
                      {(pick.casa || pick.nota) && (
                        <span className="block text-xs text-tenue">
                          {[pick.casa, pick.stake ? `stake ${pick.stake}` : null, pick.nota].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4">{pick.lado}</td>
                    <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                      {decimal(pick.cuotaTomada, locale, 2)}
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-tenue">
                      {cierre ? decimal(cierre.cuotaLadoTomado, locale, 2) : '—'}
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums">
                      {!auditoria.valido ? (
                        <span className="text-negativo">{t.tabla.invalido}</span>
                      ) : analisis ? (
                        <span className={analisis.ventaja >= 0 ? 'text-positivo' : 'text-negativo'}>
                          {porcentaje(analisis.ventaja, locale)}
                        </span>
                      ) : (
                        <span className="text-tenue">{t.tabla.esperando}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <section className="mt-12 rounded border border-borde bg-superficie p-5">
        <h2 className="text-lg font-semibold">{t.verificar.titulo}</h2>
        <p className="mt-2 text-sm text-tenue">{t.verificar.texto}</p>
        <p className="mt-4 flex flex-wrap gap-3">
          <a
            href={urls.repo}
            className="rounded border border-acento px-3 py-2 text-sm text-acento hover:bg-fondo"
          >
            {t.verificar.enlaceRepo}
          </a>
          <a
            href={urls.picks}
            className="rounded border border-borde px-3 py-2 text-sm text-tenue hover:bg-fondo"
          >
            {t.verificar.enlacePicks}
          </a>
        </p>
      </section>

      <p className="mt-6 text-xs text-tenue">{t.aviso}</p>
    </>
  );
}
