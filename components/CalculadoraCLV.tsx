'use client';

import { useId, useRef, useState, type KeyboardEvent } from 'react';
import type { Locale } from '@/i18n/config';
import type { Textos } from '@/i18n/textos';
import { TEXTOS_AGREGADO } from '@/i18n/textos-agregado';
import type { TextosMarco } from '@/i18n/textos-marco';
import { ModoSimple } from './ModoSimple';
import { ModoAgregado } from './ModoAgregado';
import { ModoBuscar } from './ModoBuscar';

type Modo = 'buscar' | 'simple' | 'agregado';

/*
 * «Buscar» va primero porque es la única de las tres que resuelve el problema
 * de verdad: quien quiere saber su CLV casi nunca apuntó la cuota de cierre en
 * su momento, y ese es justo el dato que le falta. Las otras dos siguen ahí
 * porque solo cubrimos tres competiciones y el fútbol no está entre ellas.
 */
const MODOS: readonly Modo[] = ['buscar', 'simple', 'agregado'];

export function CalculadoraCLV({
  locale,
  textos: t,
  marco,
}: {
  locale: Locale;
  textos: Textos;
  marco: TextosMarco;
}) {
  const [modo, setModo] = useState<Modo>('buscar');
  const refs = useRef<Record<Modo, HTMLButtonElement | null>>({
    buscar: null,
    simple: null,
    agregado: null,
  });
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
        className={`min-h-10 flex-1 rounded-lg px-4 text-sm font-medium transition-all ${
          activa
            ? 'bg-superficie-alta text-tinta shadow-[inset_0_0_0_1px_var(--color-borde-fuerte),0_2px_8px_-4px_rgb(16_20_44/0.25)]'
            : 'text-tenue hover:bg-superficie-alta/40 hover:text-tinta'
        }`}
      >
        {etiqueta}
      </button>
    );
  };

  return (
    <div className="relative mt-10">
      {/*
        Halo detrás de la calculadora. Es el objeto principal de la página y
        antes competía en peso visual con el texto que la rodea; esto la separa
        del fondo sin necesidad de encerrarla en otra caja.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-x-6 -top-8 -bottom-4 -z-10 rounded-[2rem] bg-[radial-gradient(62%_52%_at_30%_0%,rgb(68_87_216/0.07),transparent_70%)]"
      />
      <div
        role="tablist"
        aria-label={t.h1}
        className="flex max-w-xl gap-1 rounded-xl border border-borde bg-superficie/80 p-1 backdrop-blur-sm"
      >
        {pestana('buscar', t.buscar.pestana)}
        {pestana('simple', ta.pestanaSimple)}
        {pestana('agregado', ta.pestanaAgregado)}
      </div>

      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${modo}`} className="pt-6">
        {modo === 'buscar' && <ModoBuscar locale={locale} textos={t} />}
        {modo === 'simple' && <ModoSimple locale={locale} textos={t} />}
        {modo === 'agregado' && <ModoAgregado locale={locale} textos={ta} marco={marco} />}
      </div>
    </div>
  );
}
