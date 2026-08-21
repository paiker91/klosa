'use client';

import { useId, useState, type FormEvent } from 'react';
import { analizarApuesta, ErrorCuota, type AnalisisApuesta, type MetodoDevig } from '@/lib/clv';
import type { Locale } from '@/i18n/config';
import type { Textos } from '@/i18n/textos';
import { porcentaje, porcentajeSinSigno, decimal } from './formato';

const METODOS: readonly MetodoDevig[] = ['multiplicativo', 'power', 'aditivo'];

export function ModoSimple({ locale, textos: t }: { locale: Locale; textos: Textos }) {
  const [tomada, setTomada] = useState('');
  const [cierreA, setCierreA] = useState('');
  const [cierreB, setCierreB] = useState('');
  const [metodo, setMetodo] = useState<MetodoDevig>('multiplicativo');
  const [resultado, setResultado] = useState<AnalisisApuesta | null>(null);
  const [error, setError] = useState<string | null>(null);

  const id = useId();

  function calcular(e: FormEvent) {
    e.preventDefault();
    try {
      setResultado(analizarApuesta(tomada, cierreA, cierreB, metodo));
      setError(null);
    } catch (fallo) {
      setError(fallo instanceof ErrorCuota ? fallo.message : String(fallo));
      setResultado(null);
    }
  }

  const campo = (
    clave: string,
    etiqueta: string,
    ayuda: string,
    valor: string,
    set: (v: string) => void,
  ) => (
    <div>
      <label htmlFor={`${id}-${clave}`} className="block text-sm font-medium">
        {etiqueta}
      </label>
      <input
        id={`${id}-${clave}`}
        name={clave}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        required
        value={valor}
        onChange={(e) => set(e.target.value)}
        aria-describedby={`${id}-${clave}-ayuda`}
        className="mt-1.5 w-full rounded border border-borde bg-superficie px-3 py-2.5 font-mono text-lg tabular-nums"
      />
      <p id={`${id}-${clave}-ayuda`} className="mt-1 text-xs text-tenue">
        {ayuda}
      </p>
    </div>
  );

  return (
    <div>
      <form onSubmit={calcular} className="space-y-5">
        {campo('tomada', t.campos.cuotaTomada, t.campos.cuotaTomadaAyuda, tomada, setTomada)}
        {campo('cierre-a', t.campos.cierreTomado, t.campos.cierreTomadoAyuda, cierreA, setCierreA)}
        {campo(
          'cierre-b',
          t.campos.cierreContrario,
          t.campos.cierreContrarioAyuda,
          cierreB,
          setCierreB,
        )}

        <details className="rounded border border-borde bg-superficie px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium">{t.campos.metodo}</summary>
          <fieldset className="mt-2 border-0 p-0">
            <legend className="sr-only">{t.campos.metodo}</legend>
            {/*
              La etiqueta ocupa toda la fila y llega a 44 px de alto: el círculo
              del radio mide 13 px y por sí solo es un objetivo imposible en un
              móvil, que es desde donde va a llegar la mayoría del tráfico.
            */}
            {METODOS.map((m) => (
              <label key={m} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
                <input
                  type="radio"
                  name="metodo"
                  value={m}
                  checked={metodo === m}
                  onChange={() => setMetodo(m)}
                  className="h-4 w-4"
                />
                {t.metodos[m]}
              </label>
            ))}
          </fieldset>
        </details>

        <button type="submit" className="w-full rounded bg-acento px-4 py-3 font-semibold text-fondo">
          {t.campos.calcular}
        </button>
      </form>

      {error !== null && (
        <div role="alert" className="mt-6 rounded border border-negativo bg-superficie px-4 py-3 text-sm">
          <p className="font-semibold text-negativo">{t.errores.titulo}</p>
          <p className="mt-1 text-tenue">{error}</p>
        </div>
      )}

      {resultado !== null && (
        <section aria-live="polite" className="mt-8 rounded border border-borde bg-superficie p-5">
          <p
            className={`text-2xl font-semibold ${
              resultado.cogioValor ? 'text-positivo' : 'text-negativo'
            }`}
          >
            {resultado.cogioValor ? t.resultado.cogioValor : t.resultado.noCogioValor}
          </p>

          <dl className="mt-5 space-y-4">
            <div>
              <dt className="text-sm text-tenue">{t.resultado.ventaja}</dt>
              <dd className="font-mono text-3xl tabular-nums">
                {porcentaje(resultado.ventaja, locale)}
              </dd>
              <p className="mt-1 text-xs text-tenue">{t.resultado.ventajaExplicacion}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-borde pt-4">
              <div>
                <dt className="text-sm text-tenue">{t.resultado.clvBruto}</dt>
                <dd className="font-mono text-lg tabular-nums">
                  {porcentaje(resultado.clvBruto, locale)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-tenue">{t.resultado.cuotaJusta}</dt>
                <dd className="font-mono text-lg tabular-nums">
                  {decimal(resultado.cuotaJustaCierre, locale)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-tenue">{t.resultado.margen}</dt>
                <dd className="font-mono text-lg tabular-nums">
                  {porcentajeSinSigno(resultado.justas.margen, locale)}
                </dd>
              </div>
            </div>
          </dl>

          <p className="mt-4 border-t border-borde pt-4 text-xs text-tenue">
            {t.resultado.clvBrutoExplicacion}
          </p>
          <p className="mt-2 text-xs text-tenue">{t.resultado.supuesto}</p>

          {resultado.justas.aviso !== undefined && (
            <p className="mt-3 text-xs text-negativo">{resultado.justas.aviso}</p>
          )}
        </section>
      )}
    </div>
  );
}
