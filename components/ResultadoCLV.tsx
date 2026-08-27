import type { AnalisisApuesta } from '@/lib/clv';
import type { Locale } from '@/i18n/config';
import type { Textos } from '@/i18n/textos';
import { porcentaje, porcentajeSinSigno, decimal } from './formato';
import { CifraAnimada } from './CifraAnimada';
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
  /*
   * El veredicto y la cifra grande los manda el CLV BRUTO, no la ventaja.
   *
   * `ventaja` descuenta el margen del mercado de referencia, así que ponerse
   * en positivo exige batir el cierre POR MÁS que el margen. Eso es el listón
   * del beneficio y está bien medirlo — pero encabezar con él convierte
   * «cogiste mejor precio que el mercado» en un rojo de «no cogiste valor», y
   * el usuario lee que lo hizo mal cuando lo hizo bien.
   *
   * Medido sobre el registro propio (19 picks, mercado de referencia al
   * 0,72 % de margen): 47 % batieron el cierre y 42 % tuvieron ventaja
   * positiva. Solo un pick de diecinueve caía en la grieta — pero ese pick es
   * justo el que se llevaba un rojo inmerecido.
   *
   * La ventaja NO se esconde: sigue en la rejilla de abajo, con su
   * explicación. Cambia cuál es el titular, no qué se enseña. Y así la
   * calculadora dice lo mismo que el registro, que ya juzgaba por el bruto.
   */
  const bien = r.clvBruto > 0;

  return (
    <section className="tarjeta aparece overflow-hidden">
      {/* El veredicto arriba y en color: es lo único que mucha gente va a leer. */}
      <div
        className={`flex items-center gap-3 border-b px-5 py-4 ${
          bien
            ? 'border-positivo/30 bg-gradient-to-r from-positivo/18 via-positivo/10 to-transparent'
            : 'border-negativo/30 bg-gradient-to-r from-negativo/18 via-negativo/10 to-transparent'
        }`}
      >
        <span
          aria-hidden="true"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg ring-1 ${
            bien
              ? 'bg-positivo/15 text-positivo ring-positivo/30'
              : 'bg-negativo/15 text-negativo ring-negativo/30'
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
        {/*
          Esta cifra es a lo que ha venido el visitante. Se le da el tamaño que
          le corresponde y un halo de su propio color — verde o rojo, según el
          signo, que aquí es la información y no decoración.
        */}
        <p
          className={`cifra destello mt-1 text-6xl leading-none font-bold sm:text-7xl ${
            bien ? 'text-positivo' : 'text-negativo'
          }`}
        >
          <CifraAnimada valor={r.clvBruto} formato={(v) => porcentaje(v, locale)} />
        </p>
        <p className="mt-3 texto-ayuda">{t.resultado.ventajaExplicacion}</p>

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
              [
                t.resultado.clvBruto,
                porcentaje(r.ventaja, locale),
                r.ventaja >= 0 ? 'text-positivo' : 'text-tinta',
              ],
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
            <p className="texto-ayuda">{procedencia}</p>
          )}
          <p className="texto-ayuda">{t.resultado.clvBrutoExplicacion}</p>
          <p className="texto-ayuda">{t.resultado.supuesto}</p>
          {r.justas.aviso !== undefined && (
            <p className="text-xs leading-relaxed text-negativo">{r.justas.aviso}</p>
          )}
        </div>
      </div>
    </section>
  );
}
