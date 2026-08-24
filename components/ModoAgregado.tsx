'use client';

import { useId, useState, type FormEvent } from 'react';
import {
  analizarApuesta,
  agregar,
  claveVeredicto,
  agregarPorGrupo,
  N_MINIMO,
  type GrupoAgregado,
  type ResumenAgregado,
  type MetodoDevig,
} from '@/lib/clv';
import { parsearTabla, type ErrorFila, type Delimitador } from '@/lib/tabla';
import type { Locale } from '@/i18n/config';
import type { TextosAgregado } from '@/i18n/textos-agregado';
import type { TextosMarco } from '@/i18n/textos-marco';
import { porcentaje, porcentajeSinSigno, decimal, entero } from './formato';
import { Medidor } from './Medidor';
import { Dispersion } from './Dispersion';
import { TablaGrupos } from './TablaGrupos';

/** El tipo de la librería usa nombres de dominio en español; aquí se muestran traducidos. */
const NOMBRE_DELIMITADOR: Record<Locale, Record<Delimitador, string>> = {
  pt: { tabulador: 'tabulação', 'punto y coma': 'ponto e vírgula', coma: 'vírgula' },
  es: { tabulador: 'tabulador', 'punto y coma': 'punto y coma', coma: 'coma' },
  en: { tabulador: 'tab', 'punto y coma': 'semicolon', coma: 'comma' },
};

interface Analisis {
  resumen: ResumenAgregado;
  porDeporte: GrupoAgregado[];
  /** CLV bruto de cada apuesta: lo mismo que juzga el veredicto. */
  ventajas: number[];
  errores: ErrorFila[];
  delimitador: Delimitador;
  cabeceraOmitida: boolean;
}

export function ModoAgregado({
  locale,
  textos: t,
  marco,
  metodo = 'multiplicativo',
}: {
  locale: Locale;
  textos: TextosAgregado;
  marco: TextosMarco;
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
    const conDeporte: { grupo: string; analisis: ReturnType<typeof analizarApuesta> }[] = [];
    const errores = [...parseo.errores];
    for (const fila of parseo.filas) {
      try {
        const analisis = analizarApuesta(
          fila.cuotaTomada,
          fila.cierreTomado,
          fila.cierreContrario,
          metodo,
        );
        analizadas.push(analisis);
        if (fila.deporte) conDeporte.push({ grupo: fila.deporte, analisis });
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
    /* Solo tiene sentido desglosar si hay más de un grupo: con uno solo, la
       tabla repetiría el agregado y sugeriría una precisión que no existe. */
    const porDeporte = agregarPorGrupo(conDeporte);

    setAnalisis({
      resumen: agregar(analizadas),
      porDeporte: porDeporte.length > 1 ? porDeporte : [],
      ventajas: analizadas.map((a) => a.clvBruto),
      errores,
      delimitador: parseo.delimitador,
      cabeceraOmitida: parseo.cabeceraOmitida,
    });
  }

  const resumen = analisis?.resumen;
  /*
   * El veredicto lo manda el CLV BRUTO, igual que en el registro publico. La
   * ventaja descuenta el margen, que es una comision constante de las casas:
   * encabezar con ella haria que "las casas cobran" pareciera "tus apuestas
   * son malas", y eso le pasaria a cualquiera que pegue aqui su historico.
   */
  const clave =
    resumen === undefined ? null : claveVeredicto({ n: resumen.n, ...resumen.bruto });
  const insuficiente = resumen?.bruto.veredicto === 'muestra_insuficiente';

  const tonoVeredicto =
    clave === 'significativo' || clave === 'temprano_favor'
      ? 'border-positivo/30 bg-positivo/10 text-positivo'
      : clave === 'contra' || clave === 'temprano_contra'
        ? 'border-negativo/30 bg-negativo/10 text-negativo'
        : clave === 'no_distinguible'
          ? 'border-borde bg-fondo/40 text-tenue'
          : 'border-aviso/30 bg-aviso/10 text-aviso';

  const metrica = (etiqueta: string, valor: string) => (
    <div>
      <dt className="etiqueta-dato">{etiqueta}</dt>
      {/*
        Cuando la muestra no da para concluir, las cifras se atenúan a propósito.
        Enseñar un +18,7 % con el mismo peso visual que un resultado sólido es
        justo la ilusión que este producto existe para desmontar.
      */}
      <dd className={`cifra mt-1 text-xl ${insuficiente ? 'text-tenue opacity-70' : 'text-tinta'}`}>
        {valor}
      </dd>
    </div>
  );

  return (
    <div>
      <form onSubmit={analizar} className="tarjeta space-y-4 p-5 sm:p-6">
        <div>
          <label htmlFor={`${id}-tabla`} className="block text-sm font-medium text-tinta">
            {t.instrucciones}
          </label>
          <p id={`${id}-formato`} className="mt-1.5 font-mono text-xs text-apagado">
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
            className="cifra mt-2.5 w-full resize-y rounded-xl border border-borde bg-fondo/60 px-3.5 py-3 text-sm text-tinta transition-colors placeholder:text-apagado hover:border-borde-fuerte focus:border-acento"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="min-h-11 flex-1 rounded-xl bg-acento px-4 text-sm font-semibold text-fondo transition-opacity hover:opacity-90"
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
            className="min-h-11 rounded-xl border border-borde px-4 text-sm font-medium text-tenue transition-colors hover:border-borde-fuerte hover:text-tinta"
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

      {resumen !== undefined && analisis !== null && clave !== null && (
        <section aria-live="polite" className="mt-6 space-y-5">
          {/* El veredicto va PRIMERO y a propósito: ninguna cifra sin su contexto. */}
          <div className={`rounded-2xl border p-5 ${tonoVeredicto}`}>
            <p className="text-sm leading-relaxed font-medium">{t.veredictos[clave]}</p>
          </div>

          <div className="tarjeta p-5 sm:p-6">
            <Medidor n={resumen.n} total={N_MINIMO} locale={locale} textos={marco} />

            <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
              {metrica(t.etiquetas.n, entero(resumen.n, locale))}
              {metrica(t.etiquetas.clvMedio, porcentaje(resumen.clvMedio, locale))}
              {metrica(t.etiquetas.ventajaMedia, porcentaje(resumen.ventajaMedia, locale))}
              {metrica(t.margen, porcentajeSinSigno(resumen.margenMedio, locale))}
              {metrica(t.etiquetas.tasaAcierto, porcentajeSinSigno(resumen.bruto.tasa, locale))}
              {metrica(
                t.etiquetas.t,
                resumen.bruto.t === null ? '—' : decimal(resumen.bruto.t, locale, 2),
              )}
            </dl>
          </div>

          <div className="tarjeta p-5 sm:p-6">
            <h3 className="text-sm font-semibold text-tinta">{marco.grafico.titulo}</h3>
            <Dispersion
              valores={analisis.ventajas}
              media={resumen.ventajaMedia}
              locale={locale}
              textos={marco}
            />
          </div>

          {analisis.porDeporte.length > 0 && (
            <div className="tarjeta p-5 sm:p-6">
              <h3 className="text-base font-semibold text-tinta">{t.desglose.titulo}</h3>
              {/*
                El aviso va ANTES de la tabla. Separar por deporte es justo lo
                que destapa un problema que el agregado esconde, pero cada
                subgrupo tiene su propia muestra y casi siempre es demasiado
                pequeña. Enseñar la tabla sin decirlo invita a leer patrones en
                el ruido — que es lo contrario de lo que hace este producto.
              */}
              <p className="mt-2 text-xs leading-relaxed text-apagado">{t.desglose.aviso}</p>
              <TablaGrupos
                grupos={analisis.porDeporte}
                locale={locale}
                encabezados={{
                  grupo: t.desglose.grupo,
                  n: t.etiquetas.n,
                  ventaja: t.etiquetas.ventajaMedia,
                  t: t.etiquetas.t,
                }}
              />
            </div>
          )}

          <div className="space-y-1 text-xs text-apagado">
            <p>{t.detectado(NOMBRE_DELIMITADOR[locale][analisis.delimitador])}</p>
            {analisis.cabeceraOmitida && <p>{t.cabeceraOmitida}</p>}
          </div>

          {analisis.errores.length > 0 && (
            <div className="tarjeta border-negativo/50 p-5 text-sm">
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
