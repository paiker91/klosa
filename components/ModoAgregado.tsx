'use client';

import { useId, useState, type FormEvent } from 'react';
import { analizarApuesta, agregar, type ResumenAgregado, type MetodoDevig } from '@/lib/clv';
import { parsearTabla, type ErrorFila, type Delimitador } from '@/lib/tabla';
import type { Locale } from '@/i18n/config';
import type { TextosAgregado } from '@/i18n/textos-agregado';
import { porcentaje, porcentajeSinSigno, decimal, entero } from './formato';

/** El tipo de la librería usa nombres de dominio en español; aquí se muestran traducidos. */
const NOMBRE_DELIMITADOR: Record<Locale, Record<Delimitador, string>> = {
  pt: { tabulador: 'tabulação', 'punto y coma': 'ponto e vírgula', coma: 'vírgula' },
  es: { tabulador: 'tabulador', 'punto y coma': 'punto y coma', coma: 'coma' },
  en: { tabulador: 'tab', 'punto y coma': 'semicolon', coma: 'comma' },
};

interface Analisis {
  resumen: ResumenAgregado;
  errores: ErrorFila[];
  delimitador: Delimitador;
  cabeceraOmitida: boolean;
}

export function ModoAgregado({
  locale,
  textos: t,
  metodo = 'multiplicativo',
}: {
  locale: Locale;
  textos: TextosAgregado;
  metodo?: MetodoDevig;
}) {
  const [texto, setTexto] = useState('');
  const [analisis, setAnalisis] = useState<Analisis | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const id = useId();

  function analizar(e: FormEvent) {
    e.preventDefault();
    const parseo = parsearTabla(texto);

    if (parseo.filas.length === 0) {
      setAnalisis(null);
      setAviso(t.sinDatos);
      return;
    }

    const analizadas = [];
    const errores = [...parseo.errores];
    for (const fila of parseo.filas) {
      try {
        analizadas.push(
          analizarApuesta(fila.cuotaTomada, fila.cierreTomado, fila.cierreContrario, metodo),
        );
      } catch (fallo) {
        // Una fila con cuotas imposibles (arbitraje) no debe tumbar el resto.
        errores.push({
          numero: fila.numero,
          contenido: `${fila.cuotaTomada} · ${fila.cierreTomado} · ${fila.cierreContrario}`,
          motivo: fallo instanceof Error ? fallo.message : String(fallo),
        });
      }
    }

    setAviso(null);
    setAnalisis({
      resumen: agregar(analizadas),
      errores,
      delimitador: parseo.delimitador,
      cabeceraOmitida: parseo.cabeceraOmitida,
    });
  }

  const resumen = analisis?.resumen;
  const insuficiente = resumen?.veredicto === 'muestra_insuficiente';
  const claveVeredicto =
    resumen === undefined
      ? null
      : resumen.veredicto === 'significativo' && resumen.signo === 'contra'
        ? 'contra'
        : resumen.veredicto;

  const colorVeredicto =
    claveVeredicto === 'significativo'
      ? 'border-positivo text-positivo'
      : claveVeredicto === 'contra'
        ? 'border-negativo text-negativo'
        : 'border-borde text-tinta';

  const metrica = (etiqueta: string, valor: string) => (
    <div>
      <dt className="text-sm text-tenue">{etiqueta}</dt>
      {/*
        Cuando la muestra no da para concluir, las cifras se atenúan a propósito.
        Enseñar un +18,7 % con el mismo peso visual que un resultado sólido es
        justo la ilusión que este producto existe para desmontar.
      */}
      <dd
        className={`font-mono text-xl tabular-nums ${insuficiente ? 'text-tenue opacity-60' : ''}`}
      >
        {valor}
      </dd>
    </div>
  );

  return (
    <div>
      <form onSubmit={analizar} className="space-y-4">
        <div>
          <label htmlFor={`${id}-tabla`} className="block text-sm font-medium">
            {t.instrucciones}
          </label>
          <p id={`${id}-formato`} className="mt-1 font-mono text-xs text-tenue">
            {t.formato}
          </p>
          <textarea
            id={`${id}-tabla`}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={t.ejemplo}
            rows={8}
            spellCheck={false}
            aria-describedby={`${id}-formato`}
            className="mt-2 w-full resize-y rounded border border-borde bg-superficie px-3 py-2.5 font-mono text-sm tabular-nums"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            className="flex-1 rounded bg-acento px-4 py-3 font-semibold text-fondo"
          >
            {t.analizar}
          </button>
          <button
            type="button"
            onClick={() => {
              setTexto('');
              setAnalisis(null);
              setAviso(null);
            }}
            className="rounded border border-borde px-4 py-3 font-medium text-tenue"
          >
            {t.limpiar}
          </button>
        </div>
      </form>

      {aviso !== null && (
        <p role="alert" className="mt-5 text-sm text-negativo">
          {aviso}
        </p>
      )}

      {resumen !== undefined && analisis !== null && claveVeredicto !== null && (
        <section aria-live="polite" className="mt-8 space-y-5">
          {/* El veredicto va PRIMERO y a propósito: ninguna cifra sin su contexto. */}
          <div className={`rounded border-l-4 bg-superficie p-5 ${colorVeredicto}`}>
            <p className="font-medium">{t.veredictos[claveVeredicto]}</p>
          </div>

          <dl className="grid grid-cols-2 gap-5 rounded border border-borde bg-superficie p-5 sm:grid-cols-3">
            {metrica(t.etiquetas.n, entero(resumen.n, locale))}
            {metrica(t.etiquetas.ventajaMedia, porcentaje(resumen.ventajaMedia, locale))}
            {metrica(t.etiquetas.clvMedio, porcentaje(resumen.clvMedio, locale))}
            {metrica(t.etiquetas.tasaAcierto, porcentajeSinSigno(resumen.tasaDeAcierto, locale))}
            {metrica(
              t.etiquetas.desviacion,
              Number.isNaN(resumen.desviacion) ? '—' : decimal(resumen.desviacion, locale, 4),
            )}
            {metrica(t.etiquetas.t, resumen.t === null ? '—' : decimal(resumen.t, locale, 2))}
          </dl>

          <div className="space-y-1 text-xs text-tenue">
            <p>{t.detectado(NOMBRE_DELIMITADOR[locale][analisis.delimitador])}</p>
            {analisis.cabeceraOmitida && <p>{t.cabeceraOmitida}</p>}
          </div>

          {analisis.errores.length > 0 && (
            <div className="rounded border border-negativo bg-superficie p-4 text-sm">
              <p className="font-semibold text-negativo">{t.errores(analisis.errores.length)}</p>
              <ul className="mt-2 space-y-1 text-tenue">
                {analisis.errores.slice(0, 10).map((e) => (
                  <li key={e.numero} className="font-mono text-xs">
                    {t.linea} {e.numero}: {e.motivo}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
