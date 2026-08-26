import { NextResponse } from 'next/server';
import { DEPORTES, MERCADOS, type Deporte, type Mercado } from '@/lib/cuotas/dominio';
import { esCircuito } from '@/lib/cuotas/tenis';
import { cierreDe, SinCuota, type DeporteCalculadora } from '@/lib/cuotas/publico';

/**
 * Línea de cierre de un partido ya empezado.
 *
 * El cierre de un partido terminado no cambia nunca, así que la respuesta se
 * marca como inmutable: la primera persona que pregunta por un partido paga
 * las 20 peticiones al proveedor y el resto lo lee del CDN.
 */
export const revalidate = 31536000;

const esDeporte = (v: string | null): v is DeporteCalculadora =>
  DEPORTES.includes(v as Deporte) || (v !== null && esCircuito(v));
const esMercado = (v: string | null): v is Mercado => MERCADOS.includes(v as Mercado);

/** Los identificadores del proveedor son hexadecimales de 32. Todo lo demás, fuera. */
const ID_VALIDO = /^[a-f0-9]{16,64}$/i;
/** El del tenis lleva el torneo delante, separado por virgulilla. */
const ID_TENIS = /^tennis_[a-z0-9_]{1,60}~[a-f0-9]{16,64}$/i;

export async function GET(peticion: Request) {
  const parametros = new URL(peticion.url).searchParams;
  const deporte = parametros.get('deporte');
  const evento = parametros.get('evento') ?? '';
  const mercado = parametros.get('mercado') ?? 'moneyline';

  const tenis = deporte !== null && esCircuito(deporte);
  const idValido = tenis ? ID_TENIS.test(evento) : ID_VALIDO.test(evento);
  /*
   * En tenis solo existe el mercado de ganador. Rechazar los otros dos en vez
   * de ignorarlos importa por el CDN: cada URL distinta se cachea aparte y
   * paga sus 20 peticiones de histórico, así que aceptar tres mercados sería
   * pagar tres veces la misma respuesta.
   */
  if (!esDeporte(deporte) || !idValido || !esMercado(mercado) || (tenis && mercado !== 'moneyline')) {
    return NextResponse.json({ error: 'parámetros inválidos' }, { status: 400 });
  }

  try {
    const cierre = await cierreDe(deporte, evento, mercado);
    if (cierre === null) {
      /*
       * Que no haya cierre NO se cachea para siempre: puede que el partido
       * acabe de empezar y la instantánea aún no exista. Cachear un "no hay"
       * como inmutable dejaría ese partido roto para siempre.
       */
      return NextResponse.json(
        { error: 'sin cierre' },
        { status: 404, headers: { 'cache-control': 'public, s-maxage=600' } },
      );
    }

    return NextResponse.json(cierre, {
      headers: { 'cache-control': 'public, s-maxage=31536000, immutable' },
    });
  } catch (fallo) {
    if (fallo instanceof SinCuota) {
      return NextResponse.json({ error: 'sin cuota' }, { status: 429 });
    }
    return NextResponse.json({ error: 'proveedor no disponible' }, { status: 503 });
  }
}
