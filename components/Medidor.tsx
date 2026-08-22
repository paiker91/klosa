import type { TextosMarco } from '@/i18n/textos-marco';
import type { Locale } from '@/i18n/config';
import { entero } from './formato';

/**
 * Medidor de tamaño de muestra.
 *
 * Es la pieza visual más importante del sitio. El `CLAUDE.md` prohíbe enseñar
 * un porcentaje sin contexto de significancia, y una frase de aviso se lee por
 * encima; una barra a un 15 % no. Convierte «muestra insuficiente» de nota al
 * pie en el primer objeto que ve el ojo.
 */
export function Medidor({
  n,
  total,
  locale,
  textos: t,
}: {
  n: number;
  total: number;
  locale: Locale;
  textos: TextosMarco;
}) {
  const suficiente = n >= total;
  const porcentaje = Math.min(100, (n / total) * 100);

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="etiqueta-dato">{t.medidor.titulo}</span>
        <span className={`text-xs ${suficiente ? 'text-positivo' : 'text-aviso'}`}>
          {suficiente
            ? t.medidor.listo
            : t.medidor.progreso
                .replace('{n}', entero(n, locale))
                .replace('{total}', entero(total, locale))}
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={Math.min(n, total)}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={t.medidor.titulo}
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-borde"
      >
        <div
          className={`h-full rounded-full ${suficiente ? 'bg-positivo' : 'bg-aviso'}`}
          /* Un mínimo visible: una barra de 0,2 px se lee como "cero picks". */
          style={{ width: `${n === 0 ? 0 : Math.max(2, porcentaje)}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Cuántas apuestas necesita cada métrica, en dos barras a la misma escala.
 *
 * Es la tesis del producto en una figura: la barra del CLV apenas se ve al
 * lado de la del yield. Escala lineal a propósito — una logarítmica sería más
 * cómoda de dibujar y escondería justo la diferencia que hay que enseñar.
 */
export function CosteDeLaMuestra({
  necesariasClv,
  necesariasYield,
  locale,
  textos: t,
}: {
  necesariasClv: number;
  necesariasYield: number;
  locale: Locale;
  textos: TextosMarco;
}) {
  const maximo = Math.max(necesariasClv, necesariasYield);
  const veces = Math.round(necesariasYield / necesariasClv);

  const barra = (etiqueta: string, valor: number, color: string) => (
    <div className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3">
      <span className="text-xs font-medium text-tenue">{etiqueta}</span>
      <div className="h-2.5 overflow-hidden rounded-full bg-borde">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.max(1.5, (valor / maximo) * 100)}%` }}
        />
      </div>
      <span className="cifra text-xs text-tenue">{entero(valor, locale)}</span>
    </div>
  );

  return (
    <div className="rounded-xl border border-borde bg-fondo/40 p-4">
      <p className="etiqueta-dato">{t.coste.titulo}</p>
      <div className="mt-3 space-y-2.5">
        {barra(t.coste.clv, necesariasClv, 'bg-dato')}
        {barra(t.coste.yield, necesariasYield, 'bg-aviso')}
      </div>
      {Number.isFinite(veces) && veces > 1 && (
        <p className="mt-3 text-xs text-tenue">
          {t.coste.conclusion.replace('{veces}', entero(veces, locale))}
        </p>
      )}
    </div>
  );
}
