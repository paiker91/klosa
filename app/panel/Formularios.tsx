'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { anotarPick, entrar, type Resultado } from './acciones';
import type { Deporte } from '@/lib/cuotas/dominio';

function Boton({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded bg-acento px-4 py-3.5 font-semibold text-fondo disabled:opacity-60"
    >
      {pending ? '…' : children}
    </button>
  );
}

function Aviso({ resultado }: { resultado: Resultado | null }) {
  if (!resultado || (resultado.ok && !resultado.mensaje)) return null;
  return (
    <p
      role="alert"
      className={`rounded border-l-4 bg-superficie p-3 text-sm ${
        resultado.ok ? 'border-positivo text-positivo' : 'border-negativo text-negativo'
      }`}
    >
      {resultado.mensaje}
    </p>
  );
}

export function FormularioEntrada() {
  const [estado, accion] = useActionState(entrar, null);
  return (
    <form action={accion} className="mt-8 flex flex-col gap-4">
      <Aviso resultado={estado} />
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded border border-borde bg-superficie px-3 py-3 text-lg"
        />
      </div>
      <Boton>Entrar</Boton>
    </form>
  );
}

export interface OpcionEvento {
  valor: string;
  etiqueta: string;
  /** Mediana del mercado, para rellenar la casilla al elegir. */
  cuota: string;
}

export function FormularioPick({
  deporte,
  opciones,
}: {
  deporte: Deporte;
  opciones: OpcionEvento[];
}) {
  const [estado, accion] = useActionState(anotarPick, null);
  const [cuota, setCuota] = useState(opciones[0]?.cuota ?? '');

  return (
    <form action={accion} className="mt-6 flex flex-col gap-4">
      <Aviso resultado={estado} />
      <input type="hidden" name="deporte" value={deporte} />

      <div>
        <label htmlFor="seleccion" className="mb-1.5 block text-sm font-medium">
          Partido y lado que apuestas
        </label>
        <select
          id="seleccion"
          name="seleccion"
          required
          onChange={(e) =>
            setCuota(opciones.find((o) => o.valor === e.target.value)?.cuota ?? '')
          }
          className="w-full rounded border border-borde bg-superficie px-3 py-3"
        >
          {opciones.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="cuota" className="mb-1.5 block text-sm font-medium">
          Cuota
        </label>
        <input
          id="cuota"
          name="cuota"
          inputMode="decimal"
          placeholder="2,10"
          required
          autoComplete="off"
          value={cuota}
          onChange={(e) => setCuota(e.target.value)}
          className="w-full rounded border border-borde bg-superficie px-3 py-3 font-mono text-lg tabular-nums"
        />
        <p className="mt-1 text-xs text-tenue">
          Se rellena con la mediana del mercado. Cámbiala si cogiste otra —
          el pick guardará las dos, para que se pueda auditar.
        </p>
      </div>

      <div>
        <label htmlFor="stake" className="mb-1.5 block text-sm font-medium">
          Stake <span className="font-normal text-tenue">(unidades, opcional)</span>
        </label>
        <input
          id="stake"
          name="stake"
          inputMode="decimal"
          placeholder="1"
          autoComplete="off"
          className="w-full rounded border border-borde bg-superficie px-3 py-3 font-mono text-lg tabular-nums"
        />
        <p className="mt-1 text-xs text-tenue">
          Queda registrado y sellado, pero el CLV no se pondera por stake: mide
          la ventaja por apuesta, no por unidad arriesgada.
        </p>
      </div>

      <div>
        <label htmlFor="nota" className="mb-1.5 block text-sm font-medium">
          Nota <span className="font-normal text-tenue">(opcional, queda pública)</span>
        </label>
        <input
          id="nota"
          name="nota"
          autoComplete="off"
          className="w-full rounded border border-borde bg-superficie px-3 py-3"
        />
      </div>

      <Boton>Anotar y publicar</Boton>
    </form>
  );
}
