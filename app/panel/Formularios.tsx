'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { anotarPick, entrar, type Resultado } from './acciones';
import { DEPORTES, NOMBRE_DEPORTE, type Deporte } from '@/lib/cuotas/dominio';

const CAMPO =
  'w-full rounded-xl border border-borde bg-fondo/60 px-3.5 py-3 text-tinta transition-colors hover:border-borde-fuerte focus:border-acento';

function Boton({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-12 w-full rounded-xl bg-acento px-4 font-semibold text-fondo transition-opacity hover:opacity-90 disabled:opacity-60"
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

export function FormularioEntrada() {
  const [estado, accion] = useActionState(entrar, null);
  return (
    <form action={accion} className="mt-6 flex flex-col gap-4">
      <Aviso resultado={estado} />
      <div>
        <label htmlFor="password" className="mb-2 block text-sm font-medium">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={`${CAMPO} text-lg`}
        />
      </div>
      <Boton>Entrar</Boton>
    </form>
  );
}

/**
 * Selector de competición.
 *
 * Antes eran pastillas, y con trece competiciones ocupaban media pantalla en
 * el móvil — que es desde donde se anota un pick de camino a cualquier sitio.
 * Un desplegable nativo es un toque y lo resuelve el sistema operativo.
 */
export function SelectorCompeticion({ deporte }: { deporte: Deporte }) {
  const router = useRouter();
  const [cambiando, setCambiando] = useState(false);

  return (
    <div>
      <label htmlFor="competicion" className="mb-2 block text-sm font-medium">
        Competición
      </label>
      <select
        id="competicion"
        value={deporte}
        disabled={cambiando}
        onChange={(e) => {
          setCambiando(true);
          router.push(`/panel?deporte=${e.target.value}`);
        }}
        className={`${CAMPO} min-h-12 disabled:opacity-60`}
      >
        {DEPORTES.map((d) => (
          <option key={d} value={d}>
            {NOMBRE_DEPORTE[d]}
          </option>
        ))}
      </select>
    </div>
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
  casas,
}: {
  deporte: Deporte;
  opciones: OpcionEvento[];
  casas: Record<string, { casa: string; cuota: number }[]>;
}) {
  const [estado, accion] = useActionState(anotarPick, null);
  const [seleccion, setSeleccion] = useState(opciones[0]?.valor ?? '');
  const [cuota, setCuota] = useState(opciones[0]?.cuota ?? '');
  const [casa, setCasa] = useState('');

  /*
   * Las casas que ofrecen ESTE lado, de mejor precio a peor. Elegir una es lo
   * que hace medible el CLV: el cierre se buscará en esa misma casa, así que
   * lo que salga será el movimiento de su línea y no lo cara que sea.
   */
  const clave = (() => {
    try {
      const { id, lado } = JSON.parse(seleccion || '{}') as { id?: string; lado?: string };
      return id && lado ? `${id}|${lado}` : '';
    } catch {
      return '';
    }
  })();
  const disponibles = casas[clave] ?? [];

  return (
    <form action={accion} className="mt-5 flex flex-col gap-5">
      <Aviso resultado={estado} />
      <input type="hidden" name="deporte" value={deporte} />

      <div>
        <label htmlFor="seleccion" className="mb-2 block text-sm font-medium">
          Partido y lado que apuestas
        </label>
        <select
          id="seleccion"
          name="seleccion"
          required
          value={seleccion}
          onChange={(e) => {
            setSeleccion(e.target.value);
            setCasa('');
            setCuota(opciones.find((o) => o.valor === e.target.value)?.cuota ?? '');
          }}
          className={`${CAMPO} min-h-12`}
        >
          {opciones.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="casa" className="mb-2 block text-sm font-medium">
          Casa <span className="font-normal text-tenue">(el cierre se mide contra ella)</span>
        </label>
        <select
          id="casa"
          name="casa"
          value={casa}
          onChange={(e) => {
            setCasa(e.target.value);
            const encontrada = disponibles.find((c) => c.casa === e.target.value);
            if (encontrada) setCuota(encontrada.cuota.toFixed(2).replace('.', ','));
          }}
          className={`${CAMPO} min-h-12`}
        >
          <option value="">Sin casa (mediana del mercado)</option>
          {disponibles.map((c) => (
            <option key={c.casa} value={c.casa}>
              {c.casa} · {c.cuota.toFixed(2)}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs leading-relaxed text-apagado">
          Sin casa, el cierre se compara contra la mediana del mercado y el CLV sale negativo por
          el margen, hagas lo que hagas. Elige donde apostaste de verdad.
        </p>
      </div>

      <div>
        <label htmlFor="cuota" className="mb-2 block text-sm font-medium">
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
          className={`${CAMPO} cifra text-lg`}
        />
        <p className="mt-1.5 text-xs leading-relaxed text-apagado">
          Se rellena con el precio de la casa elegida. Cámbiala si cogiste otra — el pick guarda
          las dos, la tuya y la referencia del mercado, para que se pueda auditar.
        </p>
      </div>

      <div>
        <label htmlFor="stake" className="mb-2 block text-sm font-medium">
          Stake <span className="font-normal text-tenue">(unidades, opcional)</span>
        </label>
        <input
          id="stake"
          name="stake"
          inputMode="decimal"
          placeholder="1"
          autoComplete="off"
          className={`${CAMPO} cifra text-lg`}
        />
        <p className="mt-1.5 text-xs leading-relaxed text-apagado">
          Queda registrado y sellado, pero el CLV no se pondera por stake: mide la ventaja por
          apuesta, no por unidad arriesgada.
        </p>
      </div>

      <div>
        <label htmlFor="nota" className="mb-2 block text-sm font-medium">
          Nota <span className="font-normal text-tenue">(opcional, queda pública)</span>
        </label>
        <input id="nota" name="nota" autoComplete="off" className={CAMPO} />
      </div>

      <Boton>Anotar y publicar</Boton>
    </form>
  );
}
