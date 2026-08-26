import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { esLocale, type Locale } from '@/i18n/config';
import { TEXTOS_CUENTA } from '@/i18n/textos-cuenta';
import { TEXTOS_MARCO } from '@/i18n/textos-marco';
import { TEXTOS_REGISTRO } from '@/i18n/textos-registro';
import { Cabecera } from '@/components/Cabecera';
import { PiePagina } from '@/components/PiePagina';
import { Medidor } from '@/components/Medidor';
import { Dispersion } from '@/components/Dispersion';
import { porcentaje, decimal, entero } from '@/components/formato';
import { etiquetaLado } from '@/i18n/lados';
import { URL_REPO } from '@/lib/picks/remoto';
import { NOMBRE_DEPORTE, type Deporte } from '@/lib/cuotas/dominio';
import {
  agregar,
  analizarApuestaN,
  analizarConReferencia,
  claveVeredicto,
  N_MINIMO,
  type AnalisisApuesta,
} from '@/lib/clv';
import { clienteServidor, usuarioActual } from '@/lib/supabase/servidor';
import { FormularioPick } from './Formulario';
import { borrarPick, salir, borrarCuenta } from './acciones';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false } };

interface FilaPick {
  id: string;
  registrado_en: string;
  comienzo: string;
  deporte: Deporte;
  local: string;
  visitante: string;
  lado: string;
  cuota_tomada: number;
  stake: number | null;
  nota: string | null;
  cierres: { cuotas: number[]; indice_tomado: number; referencia: { cuotas: number[]; indiceTomado: number } | null }[] | null;
}

export default async function MisPicks({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!esLocale(locale)) notFound();

  const usuario = await usuarioActual();
  if (!usuario) redirect(`/${locale}/entrar`);

  const t = TEXTOS_CUENTA[locale];
  const tm = TEXTOS_MARCO[locale];
  const tr = TEXTOS_REGISTRO[locale];

  const supabase = await clienteServidor();
  /*
   * Sin filtro por usuario a propósito: lo aplica la política de fila de la
   * base de datos. Si estuviera aquí, un olvido en cualquier consulta futura
   * enseñaría los picks de otro; allí, es imposible.
   */
  const { data } = await supabase
    .from('picks')
    .select('id, registrado_en, comienzo, deporte, local, visitante, lado, cuota_tomada, stake, nota, cierres(cuotas, indice_tomado, referencia)')
    .order('registrado_en', { ascending: false });

  const picks = (data ?? []) as unknown as FilaPick[];

  const analisis = new Map<string, AnalisisApuesta>();
  for (const p of picks) {
    const cierre = p.cierres?.[0];
    if (!cierre) continue;
    try {
      analisis.set(
        p.id,
        cierre.referencia
          ? analizarConReferencia(
              p.cuota_tomada,
              cierre.cuotas,
              cierre.indice_tomado,
              cierre.referencia.cuotas,
              cierre.referencia.indiceTomado,
            )
          : analizarApuestaN(p.cuota_tomada, cierre.cuotas, cierre.indice_tomado),
      );
    } catch {
      // Un cierre corrupto no debe tumbar la página entera.
    }
  }

  const resumen = agregar([...analisis.values()]);
  const ahora = Date.now();

  const fecha = (iso: string) =>
    new Date(iso).toLocaleString(
      locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es-ES' : 'en-US',
      { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' },
    );

  return (
    <>
      <Cabecera locale={locale} pagina="registro" textos={tm} />

      <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {t.panel.titulo}
            </h1>
            <p className="mt-3 leading-relaxed text-tenue">{t.panel.entradilla}</p>
            <p className="mt-2 texto-ayuda">{usuario.email}</p>
          </div>
          <form action={salir}>
            <input type="hidden" name="locale" value={locale} />
            <button
              type="submit"
              className="min-h-10 rounded-xl border border-borde px-4 text-sm font-medium text-tenue transition-colors hover:border-borde-fuerte hover:text-tinta"
            >
              {t.panel.salir}
            </button>
          </form>
        </div>

        <div className="mt-8">
          <FormularioPick locale={locale} textos={t} />
        </div>

        {picks.length > 0 && (
          <section className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
            <div className="tarjeta p-5 sm:p-6">
              <Medidor n={resumen.n} total={N_MINIMO} locale={locale} textos={tm} />
              <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
                {(
                  [
                    [tr.etiquetas.n, entero(resumen.n, locale)],
                    [
                      tr.etiquetas.clvBruto,
                      resumen.n === 0 ? '—' : porcentaje(resumen.clvMedio, locale),
                    ],
                    [
                      tr.etiquetas.ventajaMedia,
                      resumen.n === 0 ? '—' : porcentaje(resumen.ventajaMedia, locale),
                    ],
                    [
                      tr.etiquetas.t,
                      resumen.bruto.t === null ? '—' : decimal(resumen.bruto.t, locale, 2),
                    ],
                  ] as const
                ).map(([etiqueta, valor]) => (
                  <div key={etiqueta}>
                    <dt className="etiqueta-dato">{etiqueta}</dt>
                    <dd
                      className={`cifra mt-1 text-2xl ${
                        resumen.bruto.veredicto === 'muestra_insuficiente'
                          ? 'text-tenue opacity-70'
                          : 'text-tinta'
                      }`}
                    >
                      {valor}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-5 border-t border-borde pt-4 text-sm leading-relaxed text-tenue">
                {tr.veredictos[claveVeredicto({ n: resumen.n, ...resumen.bruto })]}
              </p>
            </div>

            <div className="tarjeta p-5 sm:p-6">
              <h2 className="text-sm font-semibold">{tm.grafico.titulo}</h2>
              {analisis.size > 0 ? (
                <Dispersion
                  valores={[...analisis.values()].map((a) => a.clvBruto)}
                  media={resumen.clvMedio}
                  locale={locale}
                  textos={tm}
                />
              ) : (
                <p className="mt-4 text-sm leading-relaxed text-apagado">{tm.grafico.vacio}</p>
              )}
            </div>
          </section>
        )}

        <section className="tarjeta mt-6 overflow-x-auto p-1.5 sm:p-2">
          {picks.length === 0 ? (
            <p className="p-6 text-sm leading-relaxed text-apagado">{t.panel.vacio}</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">{t.panel.titulo}</caption>
              <thead>
                <tr className="border-b border-borde text-left">
                  <th scope="col" className="etiqueta-dato hidden px-3 py-3 md:table-cell">
                    {t.panel.fecha}
                  </th>
                  <th scope="col" className="etiqueta-dato px-3 py-3">
                    {tr.tabla.partido}
                  </th>
                  <th scope="col" className="etiqueta-dato px-3 py-3">
                    {t.panel.lado}
                  </th>
                  <th scope="col" className="etiqueta-dato px-3 py-3 text-right">
                    {tr.tabla.tomada}
                  </th>
                  <th scope="col" className="etiqueta-dato px-3 py-3 text-right">
                    {t.panel.ventaja}
                  </th>
                  <th scope="col" className="etiqueta-dato px-3 py-3 text-right">
                    <span className="sr-only">{t.panel.borrar}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {picks.map((p) => {
                  const a = analisis.get(p.id);
                  const empezado = new Date(p.comienzo).getTime() <= ahora;
                  return (
                    <tr key={p.id} className="border-b border-borde last:border-0">
                      <td className="cifra hidden px-3 py-3.5 text-xs whitespace-nowrap text-apagado md:table-cell">
                        {fecha(p.registrado_en)}
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="font-medium">{p.visitante}</span>
                        <span className="text-apagado"> @ </span>
                        <span className="font-medium">{p.local}</span>
                        <span className="mt-0.5 block texto-ayuda">
                          {[NOMBRE_DEPORTE[p.deporte], p.stake ? `stake ${p.stake}` : null, p.nota]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-tenue">{etiquetaLado(p.lado, locale)}</td>
                      <td className="cifra px-3 py-3.5 text-right">
                        {decimal(p.cuota_tomada, locale, 2)}
                      </td>
                      <td className="cifra px-3 py-3.5 text-right">
                        {a ? (
                          <span className={a.ventaja >= 0 ? 'text-positivo' : 'text-negativo'}>
                            {porcentaje(a.ventaja, locale)}
                          </span>
                        ) : (
                          <span className="texto-ayuda">
                            {empezado ? t.panel.esperando : t.panel.esperandoPartido}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        {/* Solo antes del comienzo. Después lo impide la base de datos. */}
                        {!empezado && (
                          <form action={borrarPick}>
                            <input type="hidden" name="locale" value={locale} />
                            <input type="hidden" name="id" value={p.id} />
                            <button
                              type="submit"
                              className="texto-ayuda transition-colors hover:text-negativo"
                            >
                              {t.panel.borrar}
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <section className="mt-10 border-t border-borde pt-5">
          <h2 className="etiqueta-dato">{t.panel.cuenta}</h2>
          <p className="mt-2 texto-ayuda">{t.panel.borrarCuentaAviso}</p>
          <form action={borrarCuenta} className="mt-3">
            <input type="hidden" name="locale" value={locale} />
            <button
              type="submit"
              className="text-sm text-apagado transition-colors hover:text-negativo"
            >
              {t.panel.borrarCuenta}
            </button>
          </form>
        </section>
      </main>

      <PiePagina locale={locale as Locale} textos={tm} urlRepoPicks={URL_REPO} />
    </>
  );
}
