'use client';

import { useId, useMemo, useState } from 'react';
import { analizarApuestaN, ErrorCuota, type AnalisisApuesta, type MetodoDevig } from '@/lib/clv';
import type { Locale } from '@/i18n/config';
import type { Textos } from '@/i18n/textos';
import { ResultadoCLV } from './ResultadoCLV';

const METODOS: readonly MetodoDevig[] = ['multiplicativo', 'power', 'aditivo'];

/** Ejemplo real: 1,95 tomada contra un cierre de 1,87 / 2,02. Ventaja pequeña y positiva. */
const EJEMPLO = { tomada: '1,95', cierreA: '1,87', cierreB: '2,02' };

/** Ejemplo de fútbol: Remo @ Fluminense, Brasileirão. Empate cogido a 4,60. */
const EJEMPLO_FUTBOL = { tomada: '4,60', cierreA: '4,27', cierreB: '1,50', empate: '7,04' };

type Estado =
  | { tipo: 'incompleto' }
  | { tipo: 'error'; mensaje: string }
  | { tipo: 'listo'; analisis: AnalisisApuesta };

export function ModoSimple({ locale, textos: t }: { locale: Locale; textos: Textos }) {
  const [tomada, setTomada] = useState('');
  const [cierreA, setCierreA] = useState('');
  const [cierreB, setCierreB] = useState('');
  const [empate, setEmpate] = useState('');
  const [tresVias, setTresVias] = useState(false);
  const [metodo, setMetodo] = useState<MetodoDevig>('multiplicativo');

  const id = useId();

  /*
   * Se calcula al escribir, sin botón. Con botón, quien llega sin saber qué es
   * el CLV tiene que rellenar tres campos a ciegas antes de ver nada; así el
   * resultado aparece en cuanto los tres son válidos y se puede mover un
   * número para ver qué cambia. La calculadora se explica sola.
   */
  const estado: Estado = useMemo(() => {
    /*
     * El empate cuenta como campo obligatorio en cuanto se marca fútbol. Sin
     * él el mercado suma mucho menos de lo que vale y saldría un margen
     * ridículo y una ventaja inflada: mejor no enseñar nada que enseñar eso.
     */
    const cierres = tresVias ? [cierreA, cierreB, empate] : [cierreA, cierreB];
    if ([tomada, ...cierres].some((v) => v.trim() === '')) return { tipo: 'incompleto' };
    try {
      return { tipo: 'listo', analisis: analizarApuestaN(tomada, cierres, 0, metodo) };
    } catch (fallo) {
      return { tipo: 'error', mensaje: fallo instanceof ErrorCuota ? fallo.message : String(fallo) };
    }
  }, [tomada, cierreA, cierreB, empate, tresVias, metodo]);

  const vacio = tomada === '' && cierreA === '' && cierreB === '' && empate === '';

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
        className="campo campo-cifra mt-2"
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
        {tresVias &&
          campo(
            'empate',
            t.campos.cierreEmpate,
            t.campos.cierreEmpateAyuda,
            empate,
            setEmpate,
          )}

        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-tenue">
          <input
            type="checkbox"
            checked={tresVias}
            onChange={(e) => {
              setTresVias(e.target.checked);
              if (!e.target.checked) setEmpate('');
            }}
            className="h-4 w-4 accent-[var(--color-acento)]"
          />
          {t.campos.tresVias}
        </label>

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
              const e = tresVias ? EJEMPLO_FUTBOL : EJEMPLO;
              setTomada(e.tomada);
              setCierreA(e.cierreA);
              setCierreB(e.cierreB);
              setEmpate(tresVias ? EJEMPLO_FUTBOL.empate : '');
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
                setEmpate('');
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
          <ResultadoCLV analisis={estado.analisis} locale={locale} textos={t} />
        )}
      </div>
    </div>
  );
}
