'use client';

import { useId, useMemo, useState } from 'react';
import { analizarApuesta, ErrorCuota, type AnalisisApuesta, type MetodoDevig } from '@/lib/clv';
import type { Locale } from '@/i18n/config';
import type { Textos } from '@/i18n/textos';
import { porcentaje, porcentajeSinSigno, decimal } from './formato';
import { ComparadorCuotas } from './ComparadorCuotas';

const METODOS: readonly MetodoDevig[] = ['multiplicativo', 'power', 'aditivo'];

/** Ejemplo real: 1,95 tomada contra un cierre de 1,87 / 2,02. Ventaja pequeña y positiva. */
const EJEMPLO = { tomada: '1,95', cierreA: '1,87', cierreB: '2,02' };

type Estado =
  | { tipo: 'incompleto' }
  | { tipo: 'error'; mensaje: string }
  | { tipo: 'listo'; analisis: AnalisisApuesta };

export function ModoSimple({ locale, textos: t }: { locale: Locale; textos: Textos }) {
  const [tomada, setTomada] = useState('');
  const [cierreA, setCierreA] = useState('');
  const [cierreB, setCierreB] = useState('');
  const [metodo, setMetodo] = useState<MetodoDevig>('multiplicativo');

  const id = useId();

  /*
   * Se calcula al escribir, sin botón. Con botón, quien llega sin saber qué es
   * el CLV tiene que rellenar tres campos a ciegas antes de ver nada; así el
   * resultado aparece en cuanto los tres son válidos y se puede mover un
   * número para ver qué cambia. La calculadora se explica sola.
   */
  const estado: Estado = useMemo(() => {
    if ([tomada, cierreA, cierreB].some((v) => v.trim() === '')) return { tipo: 'incompleto' };
    try {
      return { tipo: 'listo', analisis: analizarApuesta(tomada, cierreA, cierreB, metodo) };
    } catch (fallo) {
      return { tipo: 'error', mensaje: fallo instanceof ErrorCuota ? fallo.message : String(fallo) };
    }
  }, [tomada, cierreA, cierreB, metodo]);

  const vacio = tomada === '' && cierreA === '' && cierreB === '';

  const campo = (
    clave: string,
    etiqueta: string,
    ayuda: string,
    valor: string,
    set: (v: string) => void,
  ) => (
    <div>
      <label htmlFor={`${id}-${clave}`} className="block text-sm font-medium text-tinta">
        {etiqueta}
      </label>
      <input
        id={`${id}-${clave}`}
        name={clave}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="—"
        value={valor}
        onChange={(e) => set(e.target.value)}
        aria-describedby={`${id}-${clave}-ayuda`}
        className="cifra mt-2 w-full rounded-xl border border-borde bg-fondo/60 px-3.5 py-3 text-lg text-tinta transition-colors placeholder:text-apagado hover:border-borde-fuerte focus:border-acento"
      />
      <p id={`${id}-${clave}-ayuda`} className="mt-1.5 text-xs leading-relaxed text-apagado">
        {ayuda}
      </p>
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start">
      <form
        onSubmit={(e) => e.preventDefault()}
        className="tarjeta space-y-5 p-5 sm:p-6"
        aria-label={t.h1}
      >
        {campo('tomada', t.campos.cuotaTomada, t.campos.cuotaTomadaAyuda, tomada, setTomada)}
        {campo('cierre-a', t.campos.cierreTomado, t.campos.cierreTomadoAyuda, cierreA, setCierreA)}
        {campo(
          'cierre-b',
          t.campos.cierreContrario,
          t.campos.cierreContrarioAyuda,
          cierreB,
          setCierreB,
        )}

        <details className="rounded-xl border border-borde bg-fondo/40 px-3.5 py-2.5">
          <summary className="cursor-pointer text-sm font-medium text-tenue">
            {t.campos.metodo}
          </summary>
          <fieldset className="mt-1 border-0 p-0">
            <legend className="sr-only">{t.campos.metodo}</legend>
            {/*
              La etiqueta ocupa toda la fila y llega a 44 px de alto: el círculo
              del radio mide 13 px y por sí solo es un objetivo imposible en un
              móvil, que es desde donde va a llegar la mayoría del tráfico.
            */}
            {METODOS.map((m) => (
              <label
                key={m}
                className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-tenue"
              >
                <input
                  type="radio"
                  name={`${id}-metodo`}
                  value={m}
                  checked={metodo === m}
                  onChange={() => setMetodo(m)}
                  className="h-4 w-4 accent-[var(--color-acento)]"
                />
                {t.metodos[m]}
              </label>
            ))}
          </fieldset>
        </details>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setTomada(EJEMPLO.tomada);
              setCierreA(EJEMPLO.cierreA);
              setCierreB(EJEMPLO.cierreB);
            }}
            className="min-h-11 flex-1 rounded-xl bg-acento px-4 text-sm font-semibold text-fondo transition-opacity hover:opacity-90"
          >
            {t.campos.ejemplo}
          </button>
          {!vacio && (
            <button
              type="button"
              onClick={() => {
                setTomada('');
                setCierreA('');
                setCierreB('');
              }}
              className="min-h-11 rounded-xl border border-borde px-4 text-sm font-medium text-tenue transition-colors hover:border-borde-fuerte hover:text-tinta"
            >
              {t.campos.limpiar}
            </button>
          )}
        </div>
      </form>

      <div aria-live="polite" className="lg:sticky lg:top-24">
        {estado.tipo === 'incompleto' && (
          <div className="tarjeta flex min-h-[19rem] items-center justify-center p-8 text-center">
            <p className="max-w-xs text-sm leading-relaxed text-apagado">{t.campos.incompleto}</p>
          </div>
        )}

        {estado.tipo === 'error' && (
          <div role="alert" className="tarjeta border-negativo/60 p-5">
            <p className="text-sm font-semibold text-negativo">{t.errores.titulo}</p>
            <p className="mt-1.5 text-sm text-tenue">{estado.mensaje}</p>
          </div>
        )}

        {estado.tipo === 'listo' && (
          <Resultado analisis={estado.analisis} locale={locale} textos={t} />
        )}
      </div>
    </div>
  );
}

function Resultado({
  analisis: r,
  locale,
  textos: t,
}: {
  analisis: AnalisisApuesta;
  locale: Locale;
  textos: Textos;
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
