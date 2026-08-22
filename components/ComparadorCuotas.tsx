import type { Locale } from '@/i18n/config';
import { decimal } from './formato';

/**
 * Las dos cuotas en la misma recta: la que se cogió y la justa del cierre.
 *
 * Un `+3,17 %` no dice de dónde sale. Esto sí: se ve el hueco entre lo que se
 * pagó y lo que valía, y de qué lado cae. Es la explicación del número sin una
 * sola palabra, que es lo que hace falta cuando el visitante llega sin saber
 * qué es el CLV.
 */
export function ComparadorCuotas({
  tomada,
  justa,
  etiquetaTomada,
  etiquetaJusta,
  locale,
}: {
  tomada: number;
  justa: number;
  etiquetaTomada: string;
  etiquetaJusta: string;
  locale: Locale;
}) {
  const menor = Math.min(tomada, justa);
  const mayor = Math.max(tomada, justa);
  /*
   * El margen del eje se calcula sobre el hueco, no sobre la cuota. Con un
   * ancho fijo, dos cuotas casi iguales saldrían pegadas y parecería que no
   * hay diferencia; con esto el hueco siempre ocupa la mitad de la recta.
   */
  const holgura = Math.max((mayor - menor) * 0.9, mayor * 0.02);
  const min = menor - holgura;
  const max = mayor + holgura;
  const pos = (v: number) => ((v - min) / (max - min)) * 100;

  const aFavor = tomada > justa;
  const color = aFavor ? 'bg-positivo' : 'bg-negativo';
  const texto = aFavor ? 'text-positivo' : 'text-negativo';

  const marcador = (valor: number, etiqueta: string, tono: string, arriba: boolean) => (
    <div
      className="absolute -translate-x-1/2"
      style={{ left: `${pos(valor)}%`, [arriba ? 'bottom' : 'top']: '100%' }}
    >
      <div className={`flex flex-col items-center ${arriba ? '' : 'flex-col-reverse'}`}>
        <span className="etiqueta-dato whitespace-nowrap">{etiqueta}</span>
        <span className={`cifra mt-0.5 mb-0.5 text-base font-semibold ${tono}`}>
          {decimal(valor, locale, 2)}
        </span>
      </div>
    </div>
  );

  return (
    <div className="px-2 pt-14 pb-14">
      <div className="relative h-1.5 rounded-full bg-borde">
        {/* El tramo entre las dos cuotas: es literalmente la ventaja. */}
        <div
          className={`absolute h-full rounded-full ${color}`}
          style={{ left: `${pos(menor)}%`, width: `${pos(mayor) - pos(menor)}%` }}
        />
        <span
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-fondo bg-tenue"
          style={{ left: `${pos(justa)}%` }}
        />
        <span
          className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-fondo ${color}`}
          style={{ left: `${pos(tomada)}%` }}
        />

        {marcador(tomada, etiquetaTomada, texto, true)}
        {marcador(justa, etiquetaJusta, 'text-tenue', false)}
      </div>
    </div>
  );
}
