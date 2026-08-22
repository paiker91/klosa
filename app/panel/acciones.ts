'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { parsearCuota } from '@/lib/clv';
import { TheOddsApi } from '@/lib/cuotas/the-odds-api';
import { DEPORTES, type Deporte } from '@/lib/cuotas/dominio';
import { crearPick } from '@/lib/picks/dominio';
import { anadirLinea } from '@/lib/github';
import { COOKIE_VISIBLE } from '@/lib/panel-visible';
import {
  COOKIE_SESION,
  configuracionPanel,
  crearToken,
  contrasenaCorrecta,
  tokenValido,
  segundosDeBloqueo,
  trasFallo,
  SIN_INTENTOS,
  type Intentos,
} from '@/lib/sesion';

/*
 * Contador en memoria del proceso. No sobrevive a un despliegue ni se comparte
 * entre instancias, así que no es una defensa perfecta — pero no hay base de
 * datos en v1 y sí encarece muchísimo probar contraseñas a mano o con un
 * script simple, que es contra lo que hay que protegerse aquí.
 */
let intentos: Intentos = SIN_INTENTOS;

export interface Resultado {
  ok: boolean;
  mensaje: string;
}

/** Unidades arriesgadas. Acepta coma decimal; vacío significa "sin declarar". */
function parsearStake(valor: string): number | null {
  const limpio = valor.trim().replace(',', '.');
  if (limpio === '') return null;
  const n = Number(limpio);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`Stake no válido: "${valor}".`);
  return n;
}

export async function entrar(_previo: Resultado | null, datos: FormData): Promise<Resultado> {
  const { config } = configuracionPanel();
  if (!config) return { ok: false, mensaje: 'El panel no está configurado.' };

  const ahora = Date.now();
  const espera = segundosDeBloqueo(intentos, ahora);
  if (espera > 0) {
    return { ok: false, mensaje: `Demasiados intentos. Prueba otra vez en ${espera} s.` };
  }

  const intento = String(datos.get('password') ?? '');
  if (!contrasenaCorrecta(intento, config.password)) {
    intentos = trasFallo(intentos, ahora);
    const nuevaEspera = segundosDeBloqueo(intentos, ahora);
    return {
      ok: false,
      mensaje:
        nuevaEspera > 0
          ? `Contraseña incorrecta. Demasiados intentos: espera ${nuevaEspera} s.`
          : 'Contraseña incorrecta.',
    };
  }

  intentos = SIN_INTENTOS;

  const tarro = await cookies();
  const duracion = 30 * 24 * 3600;
  tarro.set(COOKIE_SESION, crearToken(config.secreto), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/panel',
    maxAge: duracion,
  });

  /*
   * Pista para que el botón de publicar aparezca en el registro. No es una
   * credencial: no lleva firma, la lee el navegador y quien se la ponga a mano
   * solo consigue ver un enlace que desemboca en esta misma contraseña.
   */
  tarro.set(COOKIE_VISIBLE, '1', {
    httpOnly: false,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: duracion,
  });

  revalidatePath('/panel');
  return { ok: true, mensaje: '' };
}

export async function salir(): Promise<void> {
  const tarro = await cookies();
  tarro.delete({ name: COOKIE_SESION, path: '/panel' });
  tarro.delete({ name: COOKIE_VISIBLE, path: '/' });
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

    /*
     * La referencia de mercado se toma del servidor, no del formulario, y se
     * guarda SIEMPRE. Así quien audite ve la cuota registrada y el precio que
     * había en ese momento: si coinciden, es la mediana; si no, se ve cuánto
     * se apartó y puede juzgarlo. Un precio sin referencia no es auditable.
     */
    const precio = evento.mercado?.find((m) => m.lado === seleccion.lado);
    const referencia = precio
      ? `mercado ${precio.mediana.toFixed(2)} (mediana de ${precio.casas} casas)`
      : 'sin referencia de mercado';

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
      stake: parsearStake(String(datos.get('stake') ?? '')),
      /*
       * Con precio de mercado no hay una casa concreta: la cuota es la mediana
       * de treinta. Inventarse una sería falsear la procedencia.
       */
      casa: null,
      nota: [referencia, String(datos.get('nota') ?? '').trim()].filter(Boolean).join(' · ') || null,
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
