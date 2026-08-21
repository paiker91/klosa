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
}: {
  locale: Locale;
  textos: TextosRegistro;
  registro: RegistroPublico;
}) {
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
