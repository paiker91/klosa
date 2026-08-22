import { cookies } from 'next/headers';
import Link from 'next/link';
import { COOKIE_SESION, configuracionPanel, tokenValido } from '@/lib/sesion';
import { TheOddsApi } from '@/lib/cuotas/the-odds-api';
import { DEPORTES, NOMBRE_DEPORTE, EMPATE, esFutbol, type Deporte } from '@/lib/cuotas/dominio';
import { FormularioEntrada, FormularioPick, type OpcionEvento } from './Formularios';
import { salir } from './acciones';

/** Nunca se cachea: enseña partidos abiertos y depende de la sesión. */
export const dynamic = 'force-dynamic';

const esDeporte = (v: string | undefined): v is Deporte => DEPORTES.includes(v as Deporte);

async function opcionesDe(claveApi: string, deporte: Deporte): Promise<{
  opciones: OpcionEvento[];
  error: string | null;
}> {
  try {
    const eventos = (await new TheOddsApi({ claveApi }).buscarEventos({ deporte }))
      .filter((e) => e.comienzo > new Date())
      .sort((a, b) => a.comienzo.getTime() - b.comienzo.getTime());

    if (eventos.length === 0) {
      return {
        opciones: [],
        error: `No hay partidos abiertos de ${NOMBRE_DEPORTE[deporte]} ahora mismo.`,
      };
    }

    // Una opción por lado: elegir partido y lado en un solo gesto.
    // En fútbol son tres, porque el empate también se apuesta.
    const opciones = eventos.flatMap((e) => {
      const horas = ((e.comienzo.getTime() - Date.now()) / 3_600_000).toFixed(1);
      return (esFutbol(deporte) ? [e.visitante, EMPATE, e.local] : [e.visitante, e.local]).map((lado) => {
        const precio = e.mercado?.find((m) => m.lado === lado);
        return {
          valor: JSON.stringify({ id: e.id, lado }),
          etiqueta: `${lado === EMPATE ? 'Empate' : lado} ${precio ? `· ${precio.mediana.toFixed(2)} ` : ''}— ${e.visitante} @ ${e.local} (en ${horas} h)`,
          // Rellena la casilla de la cuota al elegir, para no teclear a mano.
          cuota: precio ? precio.mediana.toFixed(2).replace('.', ',') : '',
        };
      });
    });
    return { opciones, error: null };
  } catch (fallo) {
    return {
      opciones: [],
      error: `No se pudieron cargar los partidos: ${
        fallo instanceof Error ? fallo.message : String(fallo)
      }`,
    };
  }
}

export default async function Panel({
  searchParams,
}: {
  searchParams: Promise<{ deporte?: string }>;
}) {
  const { config, faltan } = configuracionPanel();

  const marco = (contenido: React.ReactNode) => (
    <main className="mx-auto max-w-lg px-5 py-10">
      <h1 className="text-2xl font-semibold">Panel de picks</h1>
      {contenido}
    </main>
  );

  if (!config) {
    return marco(
      <div className="mt-6 rounded border border-negativo bg-superficie p-4 text-sm">
        <p className="font-semibold text-negativo">El panel no está configurado.</p>
        <p className="mt-2 text-tenue">Faltan estas variables de entorno en Vercel:</p>
        <ul className="mt-2 font-mono text-xs text-tenue">
          {faltan.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </div>,
    );
  }

  const tarro = await cookies();
  if (!tokenValido(config.secreto, tarro.get(COOKIE_SESION)?.value)) {
    return marco(
      <>
        <p className="mt-2 text-sm text-tenue">Zona privada.</p>
        <FormularioEntrada />
      </>,
    );
  }

  const { deporte: pedido } = await searchParams;
  const deporte: Deporte = esDeporte(pedido) ? pedido : 'Brasileirao';
  const { opciones, error } = await opcionesDe(config.claveOdds, deporte);

  return marco(
    <>
      <p className="mt-2 text-sm text-tenue">
        El pick se publica en{' '}
        <a
          href={`https://github.com/${config.repo}`}
          className="text-acento hover:underline"
        >
          {config.repo}
        </a>{' '}
        al instante. El cierre lo captura el robot cada dos horas.
      </p>

      {/* Trece competiciones no caben en una fila: se envuelven. */}
      <nav aria-label="Competición" className="mt-6 flex flex-wrap gap-2">
        {DEPORTES.map((d) => (
          <Link
            key={d}
            href={`/panel?deporte=${d}`}
            aria-current={d === deporte ? 'page' : undefined}
            className={`flex min-h-11 items-center justify-center rounded-xl border px-3 text-sm ${
              d === deporte ? 'border-acento text-tinta' : 'border-borde text-tenue'
            }`}
          >
            {NOMBRE_DEPORTE[d]}
          </Link>
        ))}
      </nav>

      {error ? (
        <p className="mt-6 rounded border border-borde bg-superficie p-4 text-sm text-tenue">
          {error}
        </p>
      ) : (
        <FormularioPick deporte={deporte} opciones={opciones} />
      )}

      <form action={salir} className="mt-10 border-t border-borde pt-4">
        <button type="submit" className="text-sm text-tenue hover:underline">
          Cerrar sesión
        </button>
      </form>
    </>,
  );
}
