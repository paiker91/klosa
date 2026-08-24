import { cookies } from 'next/headers';
import Link from 'next/link';
import { COOKIE_SESION, configuracionPanel, tokenValido } from '@/lib/sesion';
import { TheOddsApi } from '@/lib/cuotas/the-odds-api';
import {
  DEPORTES,
  MERCADOS,
  NOMBRE_DEPORTE,
  EMPATE,
  esFutbol,
  type Deporte,
  type Mercado,
} from '@/lib/cuotas/dominio';
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
const esMercado = (v: string | undefined): v is Mercado => MERCADOS.includes(v as Mercado);

async function opcionesDe(
  claveApi: string,
  deporte: Deporte,
  mercado: Mercado,
): Promise<{
  opciones: OpcionEvento[];
  /** Precio y margen de cada casa por lado. */
  casas: Record<string, { casa: string; cuota: number; margen: number }[]>;
  error: string | null;
}> {
  try {
    const eventos = (await new TheOddsApi({ claveApi }).buscarEventos({ deporte, mercado }))
      .filter((e) => e.comienzo > new Date())
      .sort((a, b) => a.comienzo.getTime() - b.comienzo.getTime());

    if (eventos.length === 0) {
      return {
        opciones: [],
        casas: {},
        error:
          `No hay partidos abiertos de ${NOMBRE_DEPORTE[deporte]} ahora mismo. ` +
          'Puede estar fuera de temporada: prueba otra en el selector de arriba.',
      };
    }

    /*
     * Precios por casa, con el margen de CADA casa calculado de sus propias
     * cuotas: la suma de las probabilidades implícitas de todos sus lados.
     * Medido, no supuesto por reputación — una casa puede ser afilada en la NBA
     * y blanda en la Série B, y el nombre no lo dice.
     *
     * Solo se enseñan las de margen bajo, porque el listón para ganar dinero es
     * exactamente ese: la ventaja sale positiva cuando el CLV bruto supera al
     * margen del mercado donde se apostó. En una casa del 6 % hay que batir el
     * cierre un 6 %; en una del 2 %, basta con un 2 %.
     */
    const todas: Record<string, { casa: string; cuota: number; margen: number }[]> = {};
    for (const e of eventos) {
      for (const c of e.porCasa ?? []) {
        const margen = c.lados.reduce((s, l) => s + 1 / l.cuota, 0) - 1;
        for (const l of c.lados) {
          const clave = `${e.id}|${l.lado}`;
          todas[clave] = [...(todas[clave] ?? []), { casa: c.casa, cuota: l.cuota, margen }];
        }
      }
    }

    /*
     * TODAS las casas, ordenadas por precio. Filtrarlas por margen fue un error
     * y está medido: el mejor precio de un lado concreto suele estar en una casa
     * blanda, precisamente porque es la lenta en mover la línea. Excluirla por
     * tener el margen ancho tiraba justo el precio que convenía.
     *
     * El margen se sigue enseñando, porque es información — pero como dato al
     * lado del precio, no como criterio para esconder opciones.
     */
    const casas = todas;
    for (const clave of Object.keys(casas)) {
      (casas[clave] as { casa: string; cuota: number; margen: number }[]).sort(
        (a, b) => b.cuota - a.cuota,
      );
    }

    /*
     * Una opción por lado. En moneyline son los equipos (y el empate en
     * fútbol); en hándicap y totales, los lados vienen ya con su línea dentro
     * de la etiqueta —«Boston Celtics -1.5»—, y esa etiqueta es lo que se
     * guarda: el cierre se empareja por ella, así que la línea no se puede
     * perder por el camino.
     */
    const opciones = eventos.flatMap((e) => {
      const horas = ((e.comienzo.getTime() - Date.now()) / 3_600_000).toFixed(1);
      const lados =
        mercado === 'moneyline'
          ? esFutbol(deporte)
            ? [e.visitante, EMPATE, e.local]
            : [e.visitante, e.local]
          : [...new Set((e.porCasa ?? []).flatMap((c) => c.lados.map((l) => l.lado)))];
      return lados.map((lado) => {
        const precio = e.mercado?.find((m) => m.lado === lado);
        /*
         * Se rellena con el mejor precio disponible, venga de donde venga.
         *
         * Medido sobre los primeros 34 picks: comprando el mejor precio, la
         * ventaja pasa de -4,8 % a -0,69 % contra la casa más afilada. Comprar
         * bien se come casi todo el margen; es lo más rentable que se puede
         * hacer sin acertar más.
         */
        const mejor = (casas[`${e.id}|${lado}`] ?? [])[0]?.cuota ?? null;
        const referencia = mejor ?? precio?.mediana ?? null;
        return {
          valor: JSON.stringify({ id: e.id, lado }),
          etiqueta: `${lado === EMPATE ? 'Empate' : lado} ${referencia ? `· ${referencia.toFixed(2)} ` : ''}— ${e.visitante} @ ${e.local} (en ${horas} h)`,
          cuota: referencia ? referencia.toFixed(2).replace('.', ',') : '',
        };
      });
    });
    return { opciones, casas, error: null };
  } catch (fallo) {
    return {
      opciones: [],
      casas: {},
      error: `No se pudieron cargar los partidos: ${
        fallo instanceof Error ? fallo.message : String(fallo)
      }`,
    };
  }
}

export default async function Panel({
  searchParams,
}: {
  searchParams: Promise<{ deporte?: string; mercado?: string }>;
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
        <p className="text-sm leading-relaxed text-tenue">
          Zona privada. La contraseña es el valor de{' '}
          <span className="cifra text-tinta">PANEL_PASSWORD</span> en las variables de entorno del
          proyecto en Vercel.
        </p>
        <FormularioEntrada />
        {/*
          Decir de dónde sale la contraseña no le regala nada a nadie: quien
          ataca prueba contraseñas igual. A quien sí ayuda es al único usuario
          legítimo, que puede estar mirando la pantalla sin recordar cuál puso.
        */}
      </div>,
      'Zona privada',
    );
  }

  const { deporte: pedido, mercado: mercadoPedido } = await searchParams;
  const deporte: Deporte = esDeporte(pedido) ? pedido : 'PremierLeague';
  const mercado: Mercado = esMercado(mercadoPedido) ? mercadoPedido : 'moneyline';
  const { opciones, casas, error } = await opcionesDe(config.claveOdds, deporte, mercado);

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
        <SelectorCompeticion deporte={deporte} mercado={mercado} />

        {error ? (
          <p className="mt-5 rounded-xl border border-aviso/30 bg-aviso/10 p-4 text-sm leading-relaxed text-aviso">
            {error}
          </p>
        ) : (
          /*
           * La clave fuerza a montar de nuevo al cambiar de competición o de
           * mercado. Sin ella React conserva el estado del formulario, el
           * partido elegido sigue siendo el de la lista anterior, y la lista
           * de casas sale vacía porque esa clave ya no existe en el mapa nuevo.
           */
          <FormularioPick
            key={`${deporte}-${mercado}`}
            deporte={deporte}
            mercado={mercado}
            opciones={opciones}
            casas={casas}
          />
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
