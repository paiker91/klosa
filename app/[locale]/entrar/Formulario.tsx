'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { crearCuenta, entrar, type Resultado } from './acciones';
import type { Locale } from '@/i18n/config';
import type { TextosCuenta } from '@/i18n/textos-cuenta';

const CAMPO =
  'mt-2 w-full rounded-xl border border-borde bg-superficie px-3.5 py-3 text-tinta transition-colors hover:border-borde-fuerte focus:border-acento';

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

function Aviso({ resultado }: { resultado: Resultado | null }) {
  if (!resultado || resultado.mensaje === '') return null;
  return (
    <p
      role="alert"
      className={`rounded-xl border p-3.5 text-sm leading-relaxed ${
        resultado.ok
          ? 'border-positivo/30 bg-positivo/10 text-positivo'
          : 'border-negativo/30 bg-negativo/10 text-negativo'
      }`}
    >
      {resultado.mensaje}
    </p>
  );
}

export function FormularioCuenta({
  locale,
  textos: t,
}: {
  locale: Locale;
  textos: TextosCuenta;
}) {
  const [modo, setModo] = useState<'entrar' | 'crear'>('entrar');
  const [estadoEntrar, accionEntrar] = useActionState(entrar, null);
  const [estadoCrear, accionCrear] = useActionState(crearCuenta, null);

  const crear = modo === 'crear';
  const estado = crear ? estadoCrear : estadoEntrar;

  const pestana = (valor: 'entrar' | 'crear', etiqueta: string) => (
    <button
      type="button"
      onClick={() => setModo(valor)}
      aria-pressed={modo === valor}
      className={`min-h-10 flex-1 rounded-lg px-4 text-sm font-medium transition-colors ${
        modo === valor
          ? 'bg-superficie-alta text-tinta shadow-[inset_0_0_0_1px_var(--color-borde-fuerte)]'
          : 'text-tenue hover:text-tinta'
      }`}
    >
      {etiqueta}
    </button>
  );

  return (
    <div className="tarjeta mt-8 p-5 sm:p-6">
      <div className="flex gap-1 rounded-xl border border-borde bg-superficie p-1">
        {pestana('entrar', t.entrar.pestanaEntrar)}
        {pestana('crear', t.entrar.pestanaCrear)}
      </div>

      {/*
        Dos formularios distintos y no uno con un interruptor: cada acción
        tiene su propio estado, así que un error al crear cuenta no se queda
        pegado en la pantalla de entrar.
      */}
      <form
        key={modo}
        action={crear ? accionCrear : accionEntrar}
        className="mt-5 flex flex-col gap-4"
      >
        <Aviso resultado={estado} />
        <input type="hidden" name="locale" value={locale} />

        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            {t.entrar.email}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            autoCapitalize="off"
            spellCheck={false}
            className={CAMPO}
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium">
            {t.entrar.password}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={crear ? 8 : undefined}
            autoComplete={crear ? 'new-password' : 'current-password'}
            className={CAMPO}
          />
          {crear && <p className="mt-1.5 text-xs text-apagado">{t.entrar.passwordAyuda}</p>}
        </div>

        <Boton>{crear ? t.entrar.botonCrear : t.entrar.botonEntrar}</Boton>
      </form>

      {crear && (
        <p className="mt-4 rounded-xl border border-aviso/30 bg-aviso/10 p-3.5 text-xs leading-relaxed text-aviso">
          {t.entrar.enPruebas}
        </p>
      )}

      <p className="mt-5 border-t border-borde pt-4 text-xs leading-relaxed text-apagado">
        {t.entrar.privacidad}
      </p>
    </div>
  );
}
