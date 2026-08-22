import { NextResponse } from 'next/server';
import { DEPORTES, type Deporte } from '@/lib/cuotas/dominio';
import { partidosCerrables } from '@/lib/cuotas/publico';

/**
 * Partidos con línea de cierre disponible.
 *
 * Cacheado en el CDN: la lista es la misma para todo el mundo y no depende de
 * quién pregunte. Sin esto, cada visitante gastaría cuota del proveedor por su
 * cuenta para ver exactamente los mismos partidos.
 */
export const revalidate = 300;

const esDeporte = (v: string | null): v is Deporte => DEPORTES.includes(v as Deporte);

export async function GET(peticion: Request) {
  const deporte = new URL(peticion.url).searchParams.get('deporte');
  if (!esDeporte(deporte)) {
    return NextResponse.json({ error: 'deporte no soportado' }, { status: 400 });
  }

  try {
    const { partidos, proximo } = await partidosCerrables(deporte);
    return NextResponse.json(
      { partidos, proximo },
      { headers: { 'cache-control': 'public, s-maxage=300, stale-while-revalidate=1800' } },
    );
  } catch {
    /*
     * Sin detalles. Un fallo del proveedor es cosa nuestra, y el mensaje
     * interno puede llevar la ruta de la API con parámetros dentro.
     */
    return NextResponse.json({ error: 'proveedor no disponible' }, { status: 503 });
  }
}
