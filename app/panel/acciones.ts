'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { parsearCuota } from '@/lib/clv';
import { TheOddsApi } from '@/lib/cuotas/the-odds-api';
import { DEPORTES, type Deporte } from '@/lib/cuotas/dominio';
import { crearPick } from '@/lib/picks/dominio';
import { anadirLinea } from '@/lib/github';
import { COOKIE_SESION, configuracionPanel, crearToken, iguales, tokenValido } from '@/lib/sesion';

export interface Resultado {
  ok: boolean;
  mensaje: string;
}

export async function entrar(_previo: Resultado | null, datos: FormData): Promise<Resultado> {
  const { config } = configuracionPanel();
  if (!config) return { ok: false, mensaje: 'El panel no está configurado.' };

  const intento = String(datos.get('password') ?? '');
  if (!iguales(intento, config.password)) {
    return { ok: false, mensaje: 'Contraseña incorrecta.' };
  }

  const tarro = await cookies();
  tarro.set(COOKIE_SESION, crearToken(config.secreto), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/panel',
    maxAge: 30 * 24 * 3600,
  });
  revalidatePath('/panel');
  return { ok: true, mensaje: '' };
}

export async function salir(): Promise<void> {
  const tarro = await cookies();
  tarro.delete({ name: COOKIE_SESION, path: '/panel' });
  revalidatePath('/panel');
}

export async function anotarPick(_previo: Resultado | null, datos: FormData): Promise<Resultado> {
  const { config } = configuracionPanel();
  if (!config) return { ok: false, mensaje: 'El panel no está configurado.' };

  const tarro = await cookies();
  if (!tokenValido(config.secreto, tarro.get(COOKIE_SESION)?.value)) {
    return { ok: false, mensaje: 'La sesión ha caducado. Vuelva a entrar.' };
  }

  try {
    const deporte = String(datos.get('deporte') ?? '') as Deporte;
    if (!DEPORTES.includes(deporte)) throw new Error('Deporte no válido.');

    const seleccion = JSON.parse(String(datos.get('seleccion') ?? '{}')) as {
      id?: string;
      lado?: string;
    };
    if (!seleccion.id || !seleccion.lado) throw new Error('Elija un partido y un lado.');

    /*
     * El evento se vuelve a pedir al proveedor en vez de fiarse de lo que
     * venga del formulario: así la hora de comienzo la pone la API y nadie
     * puede falsearla manipulando el campo oculto.
     */
    const api = new TheOddsApi({ claveApi: config.claveOdds });
    const evento = (await api.buscarEventos({ deporte })).find((e) => e.id === seleccion.id);
    if (!evento) throw new Error('Ese partido ya no está en el mercado.');
    if (evento.comienzo <= new Date()) {
      throw new Error('Ese partido ya ha empezado. No se anotan picks a toro pasado.');
    }

    const pick = crearPick({
      registradoEn: new Date().toISOString(),
      deporte,
      eventoId: evento.id,
      local: evento.local,
      visitante: evento.visitante,
      comienzo: evento.comienzo.toISOString(),
      mercado: 'moneyline',
      lado: seleccion.lado,
      cuotaTomada: parsearCuota(String(datos.get('cuota') ?? '')),
      casa: String(datos.get('casa') ?? '').trim() || null,
      nota: String(datos.get('nota') ?? '').trim() || null,
    });

    const commit = await anadirLinea(
      { token: config.tokenGitHub, repo: config.repo },
      'picks.jsonl',
      JSON.stringify(pick),
      `pick: ${pick.lado} @ ${pick.cuotaTomada}`,
    );

    revalidatePath('/panel');
    return {
      ok: true,
      mensaje: `Anotado y empujado · ${pick.lado} @ ${pick.cuotaTomada} · commit ${commit}`,
    };
  } catch (fallo) {
    return { ok: false, mensaje: fallo instanceof Error ? fallo.message : String(fallo) };
  }
}
