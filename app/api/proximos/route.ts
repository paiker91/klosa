import { NextResponse } from 'next/server';
import { DEPORTES, type Deporte } from '@/lib/cuotas/dominio';
import { proximosPartidos } from '@/lib/cuotas/publico';

/**
 * Partidos que aún no han empezado, para poder anotar un pick sobre ellos.
 *
 * Cacheado: la lista es la misma para todo el mundo. Sin esto cada usuario
 * gastaría cuota del proveedor para ver exactamente los mismos partidos.
 */
export const revalidate = 300;

const esDeporte = (v: string | null): v is Deporte => DEPORTES.includes(v as Deporte);

export async function GET(peticion: Request) {
  const deporte = new URL(peticion.url).searchParams.get('deporte');
  if (!esDeporte(deporte)) {
    return NextResponse.json({ error: 'deporte no soportado' }, { status: 400 });
  }

  try {
    return NextResponse.json(
      { partidos: await proximosPartidos(deporte) },
      { headers: { 'cache-control': 'public, s-maxage=300, stale-while-revalidate=900' } },
    );
  } catch {
    return NextResponse.json({ error: 'proveedor no disponible' }, { status: 503 });
  }
}
