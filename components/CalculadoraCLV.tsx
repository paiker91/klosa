'use client';

import { useId, useRef, useState, type KeyboardEvent } from 'react';
import type { Locale } from '@/i18n/config';
import type { Textos } from '@/i18n/textos';
import { TEXTOS_AGREGADO } from '@/i18n/textos-agregado';
import type { TextosMarco } from '@/i18n/textos-marco';
import { ModoSimple } from './ModoSimple';
import { ModoAgregado } from './ModoAgregado';

type Modo = 'simple' | 'agregado';
const MODOS: readonly Modo[] = ['simple', 'agregado'];

export function CalculadoraCLV({
  locale,
  textos: t,
  marco,
}: {
  locale: Locale;
  textos: Textos;
  marco: TextosMarco;
}) {
  const [modo, setModo] = useState<Modo>('simple');
  const refs = useRef<Record<Modo, HTMLButtonElement | null>>({ simple: null, agregado: null });
  const ta = TEXTOS_AGREGADO[locale];
  const id = useId();

  /*
   * El patrón ARIA de pestañas exige teclado: flechas para cambiar, Inicio y
   * Fin para los extremos, y solo la pestaña activa dentro del orden de
   * tabulación (tabindex móvil). Declarar role="tab" sin esto le promete al
   * lector de pantalla un comportamiento que luego no existe.
   */
  function alPulsarTecla(e: KeyboardEvent<HTMLButtonElement>) {
    const indice = MODOS.indexOf(modo);
    let destino: Modo | null = null;

    if (e.key === 'ArrowRight') destino = MODOS[(indice + 1) % MODOS.length] ?? null;
    else if (e.key === 'ArrowLeft') destino = MODOS[(indice - 1 + MODOS.length) % MODOS.length] ?? null;
    else if (e.key === 'Home') destino = MODOS[0] ?? null;
    else if (e.key === 'End') destino = MODOS[MODOS.length - 1] ?? null;

    if (destino === null) return;
    e.preventDefault();
    setModo(destino);
    refs.current[destino]?.focus();
  }

  const pestana = (valor: Modo, etiqueta: string) => {
    const activa = modo === valor;
    return (
      <button
        type="button"
        role="tab"
        id={`${id}-${valor}`}
        ref={(el) => {
          refs.current[valor] = el;
        }}
        aria-selected={activa}
        aria-controls={`${id}-panel`}
        tabIndex={activa ? 0 : -1}
        onClick={() => setModo(valor)}
        onKeyDown={alPulsarTecla}
        className={`min-h-10 flex-1 rounded-lg px-4 text-sm font-medium transition-colors ${
          activa
            ? 'bg-superficie-alta text-tinta shadow-[inset_0_0_0_1px_var(--color-borde-fuerte)]'
            : 'text-tenue hover:text-tinta'
        }`}
      >
        {etiqueta}
      </button>
    );
  };

  return (
    <div className="mt-8">
      <div
        role="tablist"
        aria-label={t.h1}
        className="flex max-w-md gap-1 rounded-xl border border-borde bg-superficie p-1"
      >
        {pestana('simple', ta.pestanaSimple)}
        {pestana('agregado', ta.pestanaAgregado)}
      </div>

      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${modo}`} className="pt-6">
        {modo === 'simple' ? (
          <ModoSimple locale={locale} textos={t} />
        ) : (
          <ModoAgregado locale={locale} textos={ta} marco={marco} />
        )}
      </div>
    </div>
  );
}
