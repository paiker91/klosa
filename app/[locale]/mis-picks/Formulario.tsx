'use client';

import { useActionState, useEffect, useId, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { anotarPick, type Resultado } from './acciones';
import { DEPORTES, NOMBRE_DEPORTE, type Deporte } from '@/lib/cuotas/dominio';
import { etiquetaLado } from '@/i18n/lados';
import type { Locale } from '@/i18n/config';
import type { TextosCuenta } from '@/i18n/textos-cuenta';

interface Partido {
  id: string;
  local: string;
  visitante: string;
  comienzo: string;
  lados: { lado: string; mejor: number | null; mediana: number | null; casa: string | null }[];
}

const CAMPO =
  'campo mt-2';

function Boton({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-12 w-full rounded-xl bg-acento px-4 font-semibold text-superficie-alta shadow-[0_4px_12px_-6px_var(--color-acento)] transition-all hover:brightness-110 disabled:opacity-60"
    >
      {pending ? '…' : children}
    </button>
  );
}

export function FormularioPick({
  locale,
  textos: t,
}: {
  locale: Locale;
  textos: TextosCuenta;
}) {
  const [estado, accion] = useActionState(anotarPick, null);
  const [deporte, setDeporte] = useState<Deporte | ''>('');
  const [partidos, setPartidos] = useState<Partido[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [cuota, setCuota] = useState('');
  const id = useId();

  useEffect(() => {
    if (deporte === '') return;
    let vigente = true;
    setCargando(true);
    setPartidos(null);
    setCuota('');

    fetch(`/api/proximos?deporte=${deporte}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { partidos: Partido[] }) => {
        if (vigente) setPartidos(d.partidos);
      })
      .catch(() => {
        if (vigente) setPartidos([]);
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false;
    };
  }, [deporte]);

  const fechaCorta = (iso: string) =>
    new Date(iso).toLocaleString(
      locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es-ES' : 'en-US',
      { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' },
    );

  return (
    <form action={accion} className="tarjeta p-5 sm:p-6">
      <h2 className="text-lg font-semibold">{t.panel.anadir}</h2>

      {estado && (
        <p
          role="alert"
          className={`mt-4 rounded-xl border p-3.5 text-sm leading-relaxed ${
            estado.ok
              ? 'border-positivo/30 bg-positivo/10 text-positivo'
              : 'border-negativo/30 bg-negativo/10 text-negativo'
          }`}
        >
          {estado.mensaje}
        </p>
      )}

      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="deporte" value={deporte} />

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-comp`} className="block text-sm font-medium">
            {t.panel.competicion}
          </label>
          <select
            id={`${id}-comp`}
            value={deporte}
            onChange={(e) => setDeporte(e.target.value as Deporte | '')}
            className={CAMPO}
          >
            <option value="">{t.panel.elegir}</option>
            {DEPORTES.map((d) => (
              <option key={d} value={d}>
                {NOMBRE_DEPORTE[d]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`${id}-sel`} className="block text-sm font-medium">
            {t.panel.partido}
          </label>
          <select
            id={`${id}-sel`}
            name="seleccion"
            required
            disabled={partidos === null || partidos.length === 0}
            onChange={(e) => {
              const { lado } = JSON.parse(e.target.value || '{}') as { lado?: string };
              const p = partidos?.find((x) => e.target.value.includes(x.id));
              const m = p?.lados.find((l) => l.lado === lado)?.mejor;
              /*
               * Se rellena con el MEJOR precio del mercado, no con la mediana.
               * La mediana no la ofrece ninguna casa y registrarla deja el CLV
               * bruto en cero por construccion.
               */
              setCuota(m === null || m === undefined ? '' : m.toFixed(2).replace('.', ','));
            }}
            className={`${CAMPO} disabled:opacity-50`}
          >
            <option value="">{cargando ? t.panel.cargando : t.panel.elegir}</option>
            {partidos?.map((p) => (
              <optgroup
                key={p.id}
                label={`${p.visitante} @ ${p.local} — ${fechaCorta(p.comienzo)}`}
              >
                {p.lados.map((l) => (
                  <option key={l.lado} value={JSON.stringify({ id: p.id, lado: l.lado })}>
                    {etiquetaLado(l.lado, locale)}
                    {l.mejor !== null ? ` · ${l.mejor.toFixed(2)}${l.casa ? ` (${l.casa})` : ''}` : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {partidos?.length === 0 && !cargando && (
            <p className="mt-2 text-xs text-aviso">{t.panel.sinPartidos}</p>
          )}
        </div>

        <div>
          <label htmlFor={`${id}-cuota`} className="block text-sm font-medium">
            {t.panel.cuota}
          </label>
          <input
            id={`${id}-cuota`}
            name="cuota"
            inputMode="decimal"
            required
            autoComplete="off"
            placeholder="2,10"
            value={cuota}
            onChange={(e) => setCuota(e.target.value)}
            className={`${CAMPO} campo-cifra`}
          />
        </div>

        <div>
          <label htmlFor={`${id}-stake`} className="block text-sm font-medium">
            {t.panel.stake}
          </label>
          <input
            id={`${id}-stake`}
            name="stake"
            inputMode="decimal"
            autoComplete="off"
            placeholder="1"
            className={`${CAMPO} campo-cifra`}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor={`${id}-nota`} className="block text-sm font-medium">
            {t.panel.nota}
          </label>
          <input id={`${id}-nota`} name="nota" autoComplete="off" className={CAMPO} />
        </div>
      </div>

      <div className="mt-5">
        <Boton>{t.panel.guardar}</Boton>
      </div>
    </form>
  );
}
