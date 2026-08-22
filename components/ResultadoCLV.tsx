import type { AnalisisApuesta } from '@/lib/clv';
import type { Locale } from '@/i18n/config';
import type { Textos } from '@/i18n/textos';
import { porcentaje, porcentajeSinSigno, decimal } from './formato';
import { ComparadorCuotas } from './ComparadorCuotas';

/**
 * Tarjeta de resultado de una apuesta.
 *
 * Vive aparte porque la usan los dos modos de una sola apuesta: el manual y el
 * automático. Que enseñen exactamente lo mismo no es casualidad — el cálculo
 * es el mismo y la única diferencia es de dónde salió la cuota de cierre.
 */
export function ResultadoCLV({
  analisis: r,
  locale,
  textos: t,
  procedencia,
}: {
  analisis: AnalisisApuesta;
  locale: Locale;
  textos: Textos;
  /** De dónde salió el cierre. Solo cuando no lo escribió el usuario. */
  procedencia?: string;
}) {
  const bien = r.cogioValor;

  return (
    <section className="tarjeta overflow-hidden">
      {/* El veredicto arriba y en color: es lo único que mucha gente va a leer. */}
      <div
        className={`flex items-center gap-3 border-b px-5 py-4 ${
          bien ? 'border-positivo/25 bg-positivo/10' : 'border-negativo/25 bg-negativo/10'
        }`}
      >
        <span
          aria-hidden="true"
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg ${
            bien ? 'bg-positivo/15 text-positivo' : 'bg-negativo/15 text-negativo'
          }`}
        >
          {bien ? '↑' : '↓'}
        </span>
        <p className={`text-base font-semibold ${bien ? 'text-positivo' : 'text-negativo'}`}>
          {bien ? t.resultado.cogioValor : t.resultado.noCogioValor}
        </p>
      </div>

      <div className="p-5 sm:p-6">
        <p className="etiqueta-dato">{t.resultado.ventaja}</p>
        <p
          className={`cifra mt-1 text-5xl font-semibold ${bien ? 'text-positivo' : 'text-negativo'}`}
        >
          {porcentaje(r.ventaja, locale)}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-apagado">{t.resultado.ventajaExplicacion}</p>

        <ComparadorCuotas
          tomada={r.cuotaTomada}
          justa={r.cuotaJustaCierre}
          etiquetaTomada={t.campos.cuotaTomada}
          etiquetaJusta={t.resultado.cuotaJusta}
          locale={locale}
        />

        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 border-t border-borde pt-5 sm:grid-cols-3">
          {(
            [
              [t.resultado.clvBruto, porcentaje(r.clvBruto, locale), 'text-tinta'],
              [t.resultado.cuotaJusta, decimal(r.cuotaJustaCierre, locale), 'text-tinta'],
              /* El margen es de la casa, no una ganancia: nunca en verde. */
              [t.resultado.margen, porcentajeSinSigno(r.justas.margen, locale), 'text-tenue'],
            ] as const
          ).map(([etiqueta, valor, tono]) => (
            <div key={etiqueta}>
              <dt className="etiqueta-dato">{etiqueta}</dt>
              <dd className={`cifra mt-1 text-lg ${tono}`}>{valor}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-5 space-y-2 border-t border-borde pt-4">
          {procedencia !== undefined && (
            <p className="text-xs leading-relaxed text-tenue">{procedencia}</p>
          )}
          <p className="text-xs leading-relaxed text-apagado">{t.resultado.clvBrutoExplicacion}</p>
          <p className="text-xs leading-relaxed text-apagado">{t.resultado.supuesto}</p>
          {r.justas.aviso !== undefined && (
            <p className="text-xs leading-relaxed text-negativo">{r.justas.aviso}</p>
          )}
        </div>
      </div>
    </section>
  );
}
