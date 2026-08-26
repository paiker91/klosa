import type { GrupoAgregado } from '@/lib/clv';
import type { Locale } from '@/i18n/config';
import { porcentaje, decimal, entero } from './formato';

/**
 * Desglose por grupo, con una barra por fila.
 *
 * La barra sale de un cero central: un grupo que pierde valor se va a la
 * izquierda y se ve de un vistazo. Ese es el caso real que motiva el proyecto
 * — un deporte perdiendo mientras el agregado parecía bueno — y en una tabla
 * de números pelados hay que buscarlo a mano.
 */
export function TablaGrupos({
  grupos,
  locale,
  encabezados,
}: {
  grupos: readonly GrupoAgregado[];
  locale: Locale;
  encabezados: { grupo: string; n: string; ventaja: string; t: string };
}) {
  /*
   * El desglose enseña el CLV bruto, igual que el veredicto. Con la ventaja,
   * todos los grupos salían a la izquierda por el margen y la tabla parecía
   * decir que todos los deportes son malos.
   */
  const extremo = Math.max(0.02, ...grupos.map((g) => Math.abs(g.resumen.clvMedio)));

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-borde text-left">
            <th scope="col" className="etiqueta-dato py-2 pr-4">
              {encabezados.grupo}
            </th>
            <th scope="col" className="etiqueta-dato py-2 pr-4 text-right">
              {encabezados.n}
            </th>
            <th scope="col" className="etiqueta-dato hidden py-2 pr-4 sm:table-cell">
              <span className="sr-only">{encabezados.ventaja}</span>
            </th>
            <th scope="col" className="etiqueta-dato py-2 pr-4 text-right">
              {encabezados.ventaja}
            </th>
            <th scope="col" className="etiqueta-dato py-2 text-right">
              {encabezados.t}
            </th>
          </tr>
        </thead>
        <tbody>
          {grupos.map((g) => {
            const r = g.resumen;
            const flojo = r.bruto.veredicto === 'muestra_insuficiente';
            const positivo = r.clvMedio >= 0;
            const color =
              r.bruto.veredicto !== 'significativo'
                ? 'text-tinta'
                : r.bruto.signo === 'contra'
                  ? 'text-negativo'
                  : 'text-positivo';
            const tono = flojo ? 'text-tenue opacity-70' : color;
            const ancho = (Math.abs(r.clvMedio) / extremo) * 50;

            return (
              <tr key={g.clave} className="border-b border-borde">
                <td className="py-3 pr-4 font-medium">{g.clave}</td>
                <td className="cifra py-3 pr-4 text-right text-tenue">{entero(r.n, locale)}</td>
                <td className="hidden w-40 py-3 pr-4 sm:table-cell">
                  <div className="relative h-1.5 rounded-full bg-borde">
                    <span className="absolute top-0 bottom-0 left-1/2 w-px bg-borde-fuerte" />
                    <span
                      className={`absolute top-0 h-full rounded-full ${
                        flojo
                          ? 'bg-tenue opacity-60'
                          : positivo
                            ? 'bg-positivo'
                            : 'bg-negativo'
                      }`}
                      style={
                        positivo
                          ? { left: '50%', width: `${ancho}%` }
                          : { right: '50%', width: `${ancho}%` }
                      }
                    />
                  </div>
                </td>
                <td className={`cifra py-3 pr-4 text-right ${tono}`}>
                  {porcentaje(r.clvMedio, locale)}
                </td>
                <td className={`cifra py-3 text-right ${tono}`}>
                  {r.bruto.t === null ? '—' : decimal(r.bruto.t, locale, 2)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
