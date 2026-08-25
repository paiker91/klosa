'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { parsearCuota } from '@/lib/clv';
import { DEPORTES, type Deporte } from '@/lib/cuotas/dominio';
import { clienteCacheado } from '@/lib/cuotas/publico';
import { sellarPick } from '@/lib/tracker/dominio';
import { clienteServidor } from '@/lib/supabase/servidor';
import { esLocale, type Locale } from '@/i18n/config';
import { TEXTOS_CUENTA } from '@/i18n/textos-cuenta';

export interface Resultado {
  ok: boolean;
  mensaje: string;
}

function idioma(valor: FormDataEntryValue | null): Locale {
  const v = String(valor ?? 'pt');
  return esLocale(v) ? v : 'pt';
}

/** Unidades arriesgadas. Acepta coma decimal; vacío significa «sin declarar». */
function parsearStake(valor: string): number | null {
  const limpio = valor.trim().replace(',', '.');
  if (limpio === '') return null;
  const n = Number(limpio);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`Stake no válido: "${valor}".`);
  return n;
}

export async function anotarPick(_previo: Resultado | null, datos: FormData): Promise<Resultado> {
  const locale = idioma(datos.get('locale'));
  const t = TEXTOS_CUENTA[locale];

  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/entrar`);

  try {
    const deporte = String(datos.get('deporte') ?? '') as Deporte;
    if (!DEPORTES.includes(deporte)) throw new Error('Competición no válida.');

    const seleccion = JSON.parse(String(datos.get('seleccion') ?? '{}')) as {
      id?: string;
      lado?: string;
    };
    if (!seleccion.id || !seleccion.lado) throw new Error('Elige un partido y un lado.');

    /*
     * El partido se vuelve a pedir al proveedor en vez de fiarse del
     * formulario: así la hora de comienzo la pone la API y nadie puede
     * falsearla tocando un campo oculto. La base de datos rechazaría igualmente
     * un pick con el partido empezado, pero es mejor decirlo con claridad aquí
     * que dejar que reviente una restricción tres capas más abajo.
     */
    const claveApi = process.env.THE_ODDS_API_KEY;
    if (!claveApi) throw new Error('Falta la clave del proveedor de cuotas.');

    // Cacheado, como el panel: con muchos usuarios publicando a la vez, cada
    // uno pagando su propia petición, esto es lo primero que agota la clave.
    const api = clienteCacheado(claveApi, 60);
    const evento = (await api.buscarEventos({ deporte })).find((e) => e.id === seleccion.id);
    if (!evento) throw new Error('Ese partido ya no está abierto.');
    if (evento.comienzo <= new Date()) {
      throw new Error('Ese partido ya ha empezado. No se anotan picks a toro pasado.');
    }

    const precio = evento.mercado?.find((m) => m.lado === seleccion.lado);
    const referencia = precio
      ? `mercado ${precio.mediana.toFixed(2)} (mediana de ${precio.casas} casas)`
      : 'sin referencia de mercado';

    const campos = {
      evento_id: evento.id,
      comienzo: evento.comienzo.toISOString(),
      mercado: 'moneyline' as const,
      linea: null,
      lado: seleccion.lado,
      cuota_tomada: parsearCuota(String(datos.get('cuota') ?? '')),
      stake: parsearStake(String(datos.get('stake') ?? '')),
    };

    const { error } = await supabase.from('picks').insert({
      ...campos,
      sello: sellarPick(campos),
      deporte,
      local: evento.local,
      visitante: evento.visitante,
      casa: null,
      nota: [referencia, String(datos.get('nota') ?? '').trim()].filter(Boolean).join(' · '),
    });

    if (error) {
      // 23505 es el sello duplicado: el mismo pick dos veces.
      if (error.code === '23505') throw new Error('Ese pick ya está registrado.');
      throw new Error(error.message);
    }

    revalidatePath(`/${locale}/mis-picks`);
    return { ok: true, mensaje: t.panel.guardado };
  } catch (fallo) {
    return { ok: false, mensaje: fallo instanceof Error ? fallo.message : String(fallo) };
  }
}

/**
 * Borra un pick. La base de datos solo lo permite antes del comienzo: después,
 * el histórico lo escribiría el resultado y dejaría de medir nada.
 */
export async function borrarPick(datos: FormData): Promise<void> {
  const locale = idioma(datos.get('locale'));
  const supabase = await clienteServidor();
  await supabase.from('picks').delete().eq('id', String(datos.get('id') ?? ''));
  revalidatePath(`/${locale}/mis-picks`);
}

export async function salir(datos: FormData): Promise<void> {
  const locale = idioma(datos.get('locale'));
  const supabase = await clienteServidor();
  await supabase.auth.signOut();
  redirect(`/${locale}/entrar`);
}

/**
 * Borrado de cuenta. Obligatorio bajo LGPD y, además, lo correcto: si alguien
 * quiere irse, se va con todo. El borrado en cascada se lleva picks, cierres y
 * resultados.
 */
export async function borrarCuenta(datos: FormData): Promise<void> {
  const locale = idioma(datos.get('locale'));
  const supabase = await clienteServidor();
  const { error } = await supabase.rpc('borrar_mi_cuenta');
  if (error) throw new Error(error.message);
  await supabase.auth.signOut();
  redirect(`/${locale}/entrar`);
}
