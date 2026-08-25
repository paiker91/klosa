'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { analizarApuestaN, ErrorCuota, type AnalisisApuesta } from '@/lib/clv';
import {
  DEPORTES,
  MERCADOS,
  NOMBRE_DEPORTE,
  type Deporte,
  type Mercado,
} from '@/lib/cuotas/dominio';
import { etiquetaLado } from '@/i18n/lados';
import type { Locale } from '@/i18n/config';
import type { Textos } from '@/i18n/textos';
import { decimal } from './formato';
import { ResultadoCLV } from './ResultadoCLV';

interface Partido {
  id: string;
  local: string;
  visitante: string;
  comienzo: string;
  terminado: boolean;
}

interface Cierre {
  /** Dos lados, o tres si hay empate. */
  lados: { etiqueta: string; cuota: number }[];
  casas: number;
  capturadoEn: string;
}

type Carga<T> =
  | { estado: 'vacio' }
  | { estado: 'cargando' }
  | { estado: 'ok'; datos: T }
  | { estado: 'fallo'; motivo: 'sinCierre' | 'sinCuota' | 'fallo' };

/**
 * Modo automático: la línea de cierre la ponemos nosotros.
 *
 * Es la diferencia entre una calculadora y una herramienta. Pedirle al usuario
 * las dos cuotas de cierre presupone que las apuntó en su momento, y casi
 * nadie lo hace: cuando quiere calcular su CLV, el dato que le falta es justo
 * ese. Aquí solo tiene que decir qué apostó.
 */
export function ModoBuscar({ locale, textos: t }: { locale: Locale; textos: Textos }) {
  const [deporte, setDeporte] = useState<Deporte | ''>('');
  const [mercado, setMercado] = useState<Mercado>('moneyline');
  const [partidos, setPartidos] = useState<Carga<Partido[]>>({ estado: 'vacio' });
  const [eventoId, setEventoId] = useState('');
  const [lado, setLado] = useState('');
  const [tomada, setTomada] = useState('');
  const [cierre, setCierre] = useState<Carga<Cierre>>({ estado: 'vacio' });
  /** Cuándo juega la competición otra vez, si ahora mismo no hay nada cerrable. */
  const [proximo, setProximo] = useState<string | null>(null);

  const id = useId();

  useEffect(() => {
    if (deporte === '') return;
    let vigente = true;
    setPartidos({ estado: 'cargando' });
    setEventoId('');
    setLado('');
    setCierre({ estado: 'vacio' });

    fetch(`/api/partidos?deporte=${deporte}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { partidos: Partido[]; proximo: string | null }) => {
        if (!vigente) return;
        setPartidos({ estado: 'ok', datos: d.partidos });
        setProximo(d.proximo);
      })
      .catch(() => {
        if (vigente) setPartidos({ estado: 'fallo', motivo: 'fallo' });
      });

    // Si el usuario cambia de deporte antes de que llegue la respuesta, la
    // anterior ya no vale: sin esto, la lista vieja pisaría a la nueva.
    return () => {
      vigente = false;
    };
  }, [deporte]);

  useEffect(() => {
    if (deporte === '' || !eventoId) return;
    let vigente = true;
    setCierre({ estado: 'cargando' });
    setLado('');

    fetch(`/api/cierre?deporte=${deporte}&evento=${eventoId}&mercado=${mercado}`)
      .then(async (r) => {
        if (r.ok) return { ok: true as const, datos: (await r.json()) as Cierre };
        if (r.status === 404) return { ok: false as const, motivo: 'sinCierre' as const };
        if (r.status === 429) return { ok: false as const, motivo: 'sinCuota' as const };
        return { ok: false as const, motivo: 'fallo' as const };
      })
      .then((r) => {
        if (!vigente) return;
        setCierre(r.ok ? { estado: 'ok', datos: r.datos } : { estado: 'fallo', motivo: r.motivo });
      })
      .catch(() => {
        if (vigente) setCierre({ estado: 'fallo', motivo: 'fallo' });
      });

    return () => {
      vigente = false;
    };
  }, [deporte, eventoId, mercado]);

  /*
   * El de-vig necesita TODOS los lados: dos en baloncesto y béisbol, tres en
   * fútbol. Se busca por etiqueta y no por posición, porque las casas no
   * devuelven local, empate y visitante en un orden fijo. Si el lado apostado
   * no aparece, no se calcula nada: adivinar cuál era sería exactamente el
   * tipo de dato falso que este producto existe para denunciar.
   */
  const analisis = useMemo((): AnalisisApuesta | { error: string } | null => {
    if (cierre.estado !== 'ok' || tomada.trim() === '' || !lado) return null;
    const indice = cierre.datos.lados.findIndex((l) => l.etiqueta === lado);
    if (indice === -1) return { error: t.buscar.sinCierre };

    try {
      return analizarApuestaN(
        tomada,
        cierre.datos.lados.map((l) => l.cuota),
        indice,
      );
    } catch (fallo) {
      return { error: fallo instanceof ErrorCuota ? fallo.message : String(fallo) };
    }
  }, [cierre, tomada, lado, t.buscar.sinCierre]);

  const fechaCorta = (iso: string) =>
    new Date(iso).toLocaleString(
      locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es-ES' : 'en-US',
      { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' },
    );

  const claseCampo =
    'campo mt-2 text-sm';

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start">
      <form onSubmit={(e) => e.preventDefault()} className="tarjeta space-y-5 p-5 sm:p-6">
        <p className="text-sm leading-relaxed text-tenue">{t.buscar.intro}</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-deporte`} className="block text-sm font-medium text-tinta">
              {t.buscar.deporte}
            </label>
            <select
              id={`${id}-deporte`}
              value={deporte}
              onChange={(e) => setDeporte(e.target.value as Deporte | '')}
              className={claseCampo}
            >
              <option value="">{t.buscar.elegir}</option>
              {DEPORTES.map((d) => (
                <option key={d} value={d}>
                  {NOMBRE_DEPORTE[d]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={`${id}-mercado`} className="block text-sm font-medium text-tinta">
              {t.buscar.mercado}
            </label>
            <select
              id={`${id}-mercado`}
              value={mercado}
              onChange={(e) => setMercado(e.target.value as Mercado)}
              className={claseCampo}
            >
              {MERCADOS.map((m) => (
                <option key={m} value={m}>
                  {t.buscar.mercados[m]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor={`${id}-partido`} className="block text-sm font-medium text-tinta">
            {t.buscar.partido}
          </label>
          <select
            id={`${id}-partido`}
            value={eventoId}
            disabled={partidos.estado !== 'ok' || partidos.datos.length === 0}
            onChange={(e) => setEventoId(e.target.value)}
            className={`${claseCampo} disabled:opacity-50`}
          >
            <option value="">
              {partidos.estado === 'cargando' ? t.buscar.cargando : t.buscar.elegir}
            </option>
            {partidos.estado === 'ok' &&
              partidos.datos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.visitante} @ {p.local} — {fechaCorta(p.comienzo)}
                </option>
              ))}
          </select>
          {partidos.estado === 'ok' && partidos.datos.length === 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-xs text-aviso">{t.buscar.sinPartidos}</p>
              {proximo !== null && (
                <p className="text-xs leading-relaxed text-apagado">
                  {t.buscar.proximo.replace('{fecha}', fechaCorta(proximo))}
                </p>
              )}
            </div>
          )}
          {partidos.estado === 'fallo' && <p className="mt-2 text-xs text-negativo">{t.buscar.fallo}</p>}
        </div>

        {/*
          El lado se elige DESPUÉS de pedir el cierre, no antes. En hándicap y
          totales los lados llevan la línea dentro —«Boston Celtics -1.5»— y no
          se pueden deducir del nombre de los equipos: hay que verlos.
        */}
        <div>
          <label htmlFor={`${id}-lado`} className="block text-sm font-medium text-tinta">
            {t.buscar.lado}
          </label>
          <select
            id={`${id}-lado`}
            value={lado}
            disabled={cierre.estado !== 'ok'}
            onChange={(e) => setLado(e.target.value)}
            className={`${claseCampo} disabled:opacity-50`}
          >
            <option value="">
              {cierre.estado === 'cargando' ? t.buscar.cargando : t.buscar.elegir}
            </option>
            {cierre.estado === 'ok' &&
              cierre.datos.lados.map((l) => (
                <option key={l.etiqueta} value={l.etiqueta}>
                  {etiquetaLado(l.etiqueta, locale)} · {decimal(l.cuota, locale, 2)}
                </option>
              ))}
          </select>
        </div>

        <div>
          <label htmlFor={`${id}-tomada`} className="block text-sm font-medium text-tinta">
            {t.campos.cuotaTomada}
          </label>
          <input
            id={`${id}-tomada`}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="—"
            value={tomada}
            onChange={(e) => setTomada(e.target.value)}
            aria-describedby={`${id}-tomada-ayuda`}
            className="campo campo-cifra mt-2"
          />
          <p id={`${id}-tomada-ayuda`} className="mt-1.5 text-xs leading-relaxed text-apagado">
            {t.campos.cuotaTomadaAyuda}
          </p>
        </div>

        {/* La cobertura y la definición de cierre, siempre visibles y no en un desplegable. */}
        <p className="rounded-xl border border-borde bg-superficie p-3.5 text-xs leading-relaxed text-apagado">
          {t.buscar.cobertura}
        </p>
      </form>

      <div aria-live="polite" className="space-y-4 lg:sticky lg:top-24">
        {cierre.estado === 'ok' && (
          <div className="tarjeta p-4">
            <p className="etiqueta-dato">{t.buscar.fechamento}</p>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
              {cierre.datos.lados.map((l) => (
                <span key={l.etiqueta} className="text-sm">
                  <span className={l.etiqueta === lado ? 'text-tinta' : 'text-apagado'}>
                    {etiquetaLado(l.etiqueta, locale)}
                  </span>{' '}
                  <span className="cifra text-tinta">{decimal(l.cuota, locale, 2)}</span>
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-apagado">
              {t.buscar.fuente
                .replace('{n}', String(cierre.datos.casas))
                .replace('{fecha}', fechaCorta(cierre.datos.capturadoEn))}
            </p>
          </div>
        )}

        {cierre.estado === 'fallo' && (
          <div role="alert" className="tarjeta border-negativo/60 p-5">
            <p className="text-sm leading-relaxed text-tenue">{t.buscar[cierre.motivo]}</p>
          </div>
        )}

        {analisis === null ? (
          <div className="tarjeta flex min-h-[15rem] items-center justify-center p-8 text-center">
            <p className="max-w-xs text-sm leading-relaxed text-apagado">
              {cierre.estado === 'cargando' ? t.buscar.cargando : t.buscar.incompleto}
            </p>
          </div>
        ) : 'error' in analisis ? (
          <div role="alert" className="tarjeta border-negativo/60 p-5">
            <p className="text-sm font-semibold text-negativo">{t.errores.titulo}</p>
            <p className="mt-1.5 text-sm text-tenue">{analisis.error}</p>
          </div>
        ) : (
          <ResultadoCLV
            analisis={analisis}
            locale={locale}
            textos={t}
            procedencia={
              cierre.estado === 'ok'
                ? t.buscar.fuente
                    .replace('{n}', String(cierre.datos.casas))
                    .replace('{fecha}', fechaCorta(cierre.datos.capturadoEn))
                : undefined
            }
          />
        )}
      </div>
    </div>
  );
}
