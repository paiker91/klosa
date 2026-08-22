import { cookies } from 'next/headers';
import Link from 'next/link';
import { COOKIE_SESION, configuracionPanel, tokenValido } from '@/lib/sesion';
import { TheOddsApi } from '@/lib/cuotas/the-odds-api';
import { DEPORTES, NOMBRE_DEPORTE, EMPATE, esFutbol, type Deporte } from '@/lib/cuotas/dominio';
import {
  FormularioEntrada,
  FormularioPick,
  SelectorCompeticion,
  type OpcionEvento,
} from './Formularios';
import { Simbolo } from '@/components/Marca';
import { urlRegistro } from '@/i18n/config';
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

  const marco = (contenido: React.ReactNode, subtitulo?: string) => (
    <main className="mx-auto w-full max-w-lg px-4 py-10 sm:px-6">
      <div className="flex items-center gap-2.5">
        <Simbolo className="h-8 w-8" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Panel de picks</h1>
          {subtitulo && <p className="text-xs text-apagado">{subtitulo}</p>}
        </div>
      </div>
      {contenido}
    </main>
  );

  if (!config) {
    return marco(
      <div className="tarjeta mt-6 border-negativo/50 p-5 text-sm">
        <p className="font-semibold text-negativo">El panel no está configurado.</p>
        <p className="mt-2 text-tenue">Faltan estas variables de entorno en Vercel:</p>
        <ul className="cifra mt-2 text-xs text-tenue">
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
      <div className="tarjeta mt-6 p-5 sm:p-6">
        <p className="text-sm text-tenue">Zona privada.</p>
        <FormularioEntrada />
      </div>,
      'Zona privada',
    );
  }

  const { deporte: pedido } = await searchParams;
  const deporte: Deporte = esDeporte(pedido) ? pedido : 'Brasileirao';
  const { opciones, error } = await opcionesDe(config.claveOdds, deporte);

  return marco(
    <>
      <p className="mt-5 text-sm leading-relaxed text-tenue">
        El pick se publica en{' '}
        <a href={`https://github.com/${config.repo}`} className="text-acento hover:underline">
          {config.repo}
        </a>{' '}
        al instante. El cierre lo captura el robot cada dos horas.
      </p>

      <div className="tarjeta mt-5 p-5 sm:p-6">
        <SelectorCompeticion deporte={deporte} />

        {error ? (
          <p className="mt-5 rounded-xl border border-aviso/30 bg-aviso/10 p-4 text-sm leading-relaxed text-aviso">
            {error}
          </p>
        ) : (
          <FormularioPick deporte={deporte} opciones={opciones} />
        )}
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-borde pt-4">
        <Link href={urlRegistro('pt')} className="text-sm text-tenue hover:text-tinta">
          Ver el registro público
        </Link>
        <form action={salir}>
          <button type="submit" className="text-sm text-apagado hover:text-tinta">
            Cerrar sesión
          </button>
        </form>
      </div>
    </>,
  );
}
