'use client';

import { useId, useRef, useState, type KeyboardEvent } from 'react';
import type { Locale } from '@/i18n/config';
import type { Textos } from '@/i18n/textos';
import { TEXTOS_AGREGADO } from '@/i18n/textos-agregado';
import { ModoSimple } from './ModoSimple';
import { ModoAgregado } from './ModoAgregado';

type Modo = 'simple' | 'agregado';
const MODOS: readonly Modo[] = ['simple', 'agregado'];

export function CalculadoraCLV({ locale, textos: t }: { locale: Locale; textos: Textos }) {
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
        className={`flex-1 border-b-2 px-4 py-3.5 text-sm font-medium ${
          activa ? 'border-acento text-tinta' : 'border-borde text-tenue'
        }`}
      >
        {etiqueta}
      </button>
    );
  };

  return (
    <div className="mt-10">
      <div role="tablist" aria-label={t.h1} className="flex">
        {pestana('simple', ta.pestanaSimple)}
        {pestana('agregado', ta.pestanaAgregado)}
      </div>

      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${modo}`} className="pt-7">
        {modo === 'simple' ? (
          <ModoSimple locale={locale} textos={t} />
        ) : (
          <ModoAgregado locale={locale} textos={ta} />
        )}
      </div>
    </div>
  );
}
