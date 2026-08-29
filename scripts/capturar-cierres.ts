/**
 * Captura la línea de cierre y el resultado de los picks cuyo partido ya empezó.
 *
 *   npm run capturar
 *
 * El pick lo pone una persona; el cierre lo pone el proveedor. Nadie toca las
 * dos cosas, y por eso el CLV que sale de ahí significa algo.
 *
 * Atiende a la vez dos orígenes: el registro público en ficheros (los picks
 * propios, que se publican en GitHub) y la base de datos (los picks de los
 * usuarios). Van juntos por una razón de dinero, no de elegancia: el histórico
 * cuesta 20 peticiones por consulta y una instantánea trae TODOS los partidos
 * de esa competición a esa hora. Pidiendo pick a pick, tres apuestas al mismo
 * partido costarían 60; agrupadas, 20. Con un usuario da igual; con cien es la
 * diferencia entre que esto se sostenga y que no.
 *
 * Si un lado no se puede emparejar con las etiquetas del proveedor, NO se
 * inventa: se renuncia y se avisa. Adivinar produciría un CLV plausible y
 * falso, que es peor que no tener dato.
 *
 * Y se renuncia de verdad, no se deja pendiente. La instantánea histórica de
 * un partido terminado es inmutable: reintentarla mañana devuelve exactamente
 * los mismos datos. Dejarlo pendiente costaba 20 peticiones cada dos horas
 * indefinidamente por un cierre que nunca iba a llegar.
 */
import { appendFileSync } from 'node:fs';
import { TheOddsApi } from '../lib/cuotas/the-odds-api';
import {
  ErrorCuotaAgotada,
  esFutbol,
  type Deporte,
  type Mercado,
  type CuotasDeCierre,
} from '../lib/cuotas/dominio';
import {
  estadoDelRegistro,
  anadirCierre,
  anadirRenuncia,
  anadirResultado,
  leerResultados,
  resolverMoneyline,
} from '../lib/picks/registro';
import {
  ESPERA_ANTES_DE_RENUNCIAR,
  type SinCierre,
  type Cierre,
} from '../lib/picks/dominio';

type EstimacionCierre = NonNullable<Cierre['estimacion']>;
import { clienteDeServicio } from '../lib/tracker/servicio';
import { analizarApuestaN, analizarConReferencia } from '../lib/clv';
import {
  separarLinea,
  resolverHandicap,
  resolverTotal,
  ladoConservador,
  type Desenlace,
} from '../lib/apuestas/handicap';
import { escaleraDe, precioEnLinea, contrarioEnLinea } from '../lib/apuestas/escalera';

const claveApi = process.env.THE_ODDS_API_KEY;
if (!claveApi) {
  console.error('Falta THE_ODDS_API_KEY. Cárgala desde .env.local antes de ejecutar.');
  process.exit(1);
}

/**
 * Peticiones que no se gastan aquí. Deja margen para que la calculadora
 * pública siga respondiendo entre una ejecución y la siguiente.
 *
 * Es DELIBERADAMENTE menor que la reserva de la web (`RESERVA` en
 * lib/cuotas/publico.ts, hoy 2.000): el registro puede meterse donde la
 * calculadora ya no llega. Es la misma asimetría de siempre — un cierre
 * perdido no se recupera nunca, una consulta denegada se repite mañana.
 */
const RESERVA = 300;
/**
 * El histórico cuesta esto por consulta. Medido contra la API, no supuesto.
 *
 * Y consultarlo NO es gratis aunque el dato sea inmutable: el 2026-08-28 se
 * vació `cierres.jsonl` entero para corregir 2 referencias mal elegidas de 47,
 * y rehacer las 39 instantáneas se llevó la clave de 1.900 a 935 en una sola
 * pasada. Si hay que recapturar, se borran LAS LÍNEAS AFECTADAS, nunca el
 * fichero.
 */
const COSTE = 20;
/**
 * Tope de instantáneas por pasada. Existe para que un día raro —muchos
 * usuarios, muchas horas de comienzo distintas— no vacíe la clave de una vez.
 * Lo que se quede fuera se dice en voz alta y se coge en la pasada siguiente.
 */
const MAX_INSTANTANEAS = 12;
/**
 * Cuánta cuota tiene que quedar para no dar la voz de alarma.
 *
 * Por debajo de `ALARMA` quedan pocos días de capturas: el workflow falla a
 * propósito para que GitHub mande un correo. La vez anterior el gasto se
 * descubrió de casualidad, mirando otra cosa, y ya se había ido media clave.
 */
const AVISO = 2500;
const ALARMA = 1200;

const api = new TheOddsApi({ claveApi });
const supabase = clienteDeServicio();

// ---------------------------------------------------------------------------
// Qué hay pendiente, de los dos orígenes
// ---------------------------------------------------------------------------

interface Pendiente {
  origen: 'registro' | 'usuario';
  /** Identificador en su propio origen: el sello, o el uuid de la fila. */
  id: string;
  deporte: Deporte;
  eventoId: string;
  comienzo: Date;
  mercado: Mercado;
  lado: string;
  cuotaTomada: number;
  /** Casa donde se cogió. Si la hay, el cierre se busca en ESA casa. */
  casa: string | null;
}

const estado = estadoDelRegistro();
const pendientes: Pendiente[] = estado.pendientesDeCierre.map((p) => ({
  origen: 'registro',
  id: p.id,
  deporte: p.deporte,
  eventoId: p.eventoId,
  comienzo: new Date(p.comienzo),
  mercado: p.mercado,
  lado: p.lado,
  cuotaTomada: p.cuotaTomada,
  casa: p.casa,
}));

console.log(
  `Registro público: ${estado.resumen.total} picks · ${estado.resumen.validos} válidos · ` +
    `${estado.resumen.conCierre} con cierre · ${estado.resumen.pendientes} pendientes`,
);

if (estado.resumen.invalidos > 0) {
  console.log(`\n⚠ ${estado.resumen.invalidos} pick(s) no pasan la auditoría y no se van a cerrar:`);
  for (const a of estado.auditorias.filter((x) => !x.valido)) {
    console.log(`  ${a.pick.id}  ${a.motivos.join(', ')}`);
  }
}

if (supabase === null) {
  console.log('\nSin SUPABASE_SERVICE_KEY: no se tocan los picks de usuarios.');
} else {
  /*
   * Picks de usuario con el partido empezado y sin cierre. El filtro de "sin
   * cierre" se hace aquí y no en SQL porque Postgrest no tiene un anti-join
   * directo: se piden los que ya empezaron y se descartan los que traen cierre.
   */
  const { data, error } = await supabase
    .from('picks')
    // prettier-ignore — Postgrest infiere los tipos del literal, así que
    // partirlo en dos con `+` deja `data` como GenericStringError.
    .select('id, deporte, evento_id, comienzo, mercado, lado, cuota_tomada, casa, cierres(pick_id), renuncias(pick_id)')
    .lte('comienzo', new Date().toISOString())
    .order('comienzo', { ascending: true })
    .limit(500);

  if (error) {
    console.error(`\nNo se pudieron leer los picks de usuarios: ${error.message}`);
  } else {
    // Ni cierre capturado ni renuncia anotada: solo eso sigue costando dinero.
    const sinCierre = (data ?? []).filter(
      (p) =>
        (p.cierres as unknown[] | null)?.length !== 1 &&
        (p.renuncias as unknown[] | null)?.length !== 1,
    );
    console.log(
      `Picks de usuarios: ${data?.length ?? 0} empezados · ${sinCierre.length} pendientes`,
    );
    for (const p of sinCierre) {
      pendientes.push({
        origen: 'usuario',
        id: p.id as string,
        deporte: p.deporte as Deporte,
        eventoId: p.evento_id as string,
        comienzo: new Date(p.comienzo as string),
        mercado: p.mercado as Mercado,
        lado: p.lado as string,
        cuotaTomada: Number(p.cuota_tomada),
        casa: (p.casa as string | null) ?? null,
      });
    }
  }
}

/*
 * Sin cierres pendientes NO se sale: todavía puede haber picks con el cierre
 * ya capturado esperando su resultado, y los marcadores son baratos.
 *
 * Aquí había un `process.exit(0)` que se llevaba por delante la fase entera
 * de resultados. Nunca se notó porque siempre quedaba algún cierre pendiente
 * que mantenía viva la ejecución — en concreto el pick al que ahora se
 * renuncia. Al arreglar aquello, esto habría dejado de resolver picks para
 * siempre y en silencio, que es la peor forma de romperse.
 *
 * No hace falta condición: con la lista vacía no hay grupos, el bucle de
 * abajo no da ni una vuelta y no se gasta una sola petición.
 */
if (pendientes.length === 0) console.log('\nNingún cierre pendiente.');

// ---------------------------------------------------------------------------
// Agrupar: una instantánea por competición, hora y mercado
// ---------------------------------------------------------------------------

const grupos = new Map<string, Pendiente[]>();
for (const p of pendientes) {
  // La hora de comienzo entra entera en la clave: la instantánea que sirve a
  // un partido de las 23:06 no es la del de las 23:10.
  const clave = `${p.deporte}|${p.comienzo.toISOString()}|${p.mercado}`;
  grupos.set(clave, [...(grupos.get(clave) ?? []), p]);
}

console.log(
  `\n${pendientes.length} pick(s) pendientes en ${grupos.size} instantánea(s). ` +
    `Coste máximo: ${Math.min(grupos.size, MAX_INSTANTANEAS) * COSTE} peticiones.`,
);

const normal = (s: string) => s.trim().toLowerCase();

/**
 * Resuelve qué lado del cierre corresponde al apostado, y cómo.
 *
 * Devuelve el índice dentro de `lados` y, si hubo que deducir el precio,
 * cómo se dedujo. Cuando la línea exacta no está, la escalera se construye
 * con TODAS las casas del mercado —no solo con la que se use para el precio—
 * porque cada casa suele colgar una sola línea y la escalera solo existe al
 * juntarlas.
 *
 * Si el precio se deduce, se DEVUELVE un lado sintético que el llamante
 * inserta: por eso `lados` se recibe como array mutable.
 */
function resolverLado(
  ladoApostado: string,
  lados: readonly { etiqueta: string; cuota: number }[],
  porCasa: readonly { lados: readonly { etiqueta: string; cuota: number }[] }[],
): {
  lados: { etiqueta: string; cuota: number }[];
  indice: number;
  estimacion?: EstimacionCierre;
} | null {
  const copia = lados.map((l) => ({ ...l }));
  const exacto = copia.findIndex((l) => normal(l.etiqueta) === normal(ladoApostado));
  if (exacto !== -1) return { lados: copia, indice: exacto };

  const partes = separarLinea(ladoApostado);
  const contrario = contrarioEnLinea(ladoApostado, lados);
  if (partes !== null && contrario !== null) {
    /*
     * Se deducen las DOS patas y se sustituye el par entero. Deducir solo la
     * apostada y dejarla junto al par original dejaba un mercado de tres
     * salidas: el de-vig repartía sobre un margen del 60 % y devolvía una
     * cuota «justa» de 2,68 donde el cierre bruto era 1,67. Un mercado de
     * hándicap tiene dos salidas o no es un mercado.
     */
    const todos = porCasa.flatMap((c) => c.lados);
    const mio = precioEnLinea(escaleraDe(todos, partes.equipo), partes.linea);
    const suyo = precioEnLinea(escaleraDe(todos, contrario.equipo), contrario.linea);

    if (mio !== null && suyo !== null && mio.metodo !== 'exacto') {
      const signo = contrario.linea >= 0 ? '+' : '';
      const par = [
        { etiqueta: ladoApostado, cuota: mio.cuota },
        { etiqueta: `${contrario.equipo} ${signo}${contrario.linea}`, cuota: suyo.cuota },
      ];
      /* Un margen imposible delata que la deducción no vale. */
      const margen = par.reduce((s, l) => s + 1 / l.cuota, 0) - 1;
      if (margen > 0.001 && margen < 0.25) {
        return {
          lados: par,
          indice: 0,
          estimacion: { pedida: ladoApostado, metodo: mio.metodo, vecinas: mio.vecinas },
        };
      }
    }
  }

  /* Último recurso: una línea igual o más difícil, que subestima el CLV. */
  const cota = ladoConservador(
    ladoApostado,
    copia.map((l) => l.etiqueta),
  );
  if (cota === null) return null;
  const indice = copia.findIndex((l) => l.etiqueta === cota.lado);
  if (indice === -1) return null;
  return {
    lados: copia,
    indice,
    estimacion: { pedida: ladoApostado, metodo: 'cota', vecinas: [] },
  };
}

/**
 * Da por perdido el cierre de un pick, en el origen que le toque.
 *
 * Devuelve si ha escrito algo, para no contar dos veces la misma renuncia
 * cuando el job vuelva a pasar antes de que el pick salga de la lista.
 */
async function renunciar(
  p: Pendiente,
  motivo: SinCierre['motivo'],
  detalle: string,
): Promise<void> {
  const fila = {
    pickId: p.id,
    motivo,
    detalle,
    renunciadoEn: new Date().toISOString(),
    proveedor: api.nombre,
  };
  if (p.origen === 'registro') {
    anadirRenuncia(fila);
  } else if (supabase) {
    const { error } = await supabase.from('renuncias').upsert(
      {
        pick_id: fila.pickId,
        motivo,
        detalle,
        renunciado_en: fila.renunciadoEn,
        proveedor: fila.proveedor,
      },
      { onConflict: 'pick_id', ignoreDuplicates: true },
    );
    if (error) console.error(`  ${p.id}: no se pudo anotar la renuncia — ${error.message}`);
  }
}

let capturados = 0;
let instantaneas = 0;
const sinDatos: string[] = [];
/** Lo que se ha dado por perdido en esta pasada, para decirlo en voz alta. */
const renunciados: string[] = [];

for (const [clave, delGrupo] of grupos) {
  if (instantaneas >= MAX_INSTANTANEAS) {
    console.log(`\n⚠ Tope de ${MAX_INSTANTANEAS} instantáneas por pasada. ` +
      `Quedan ${grupos.size - instantaneas} para la siguiente.`);
    break;
  }

  const restante = api.cuotaRestante();
  if (restante !== null && restante - COSTE < RESERVA) {
    console.log(`\n⚠ Quedan ${restante} peticiones y la reserva es ${RESERVA}. Se para aquí.`);
    break;
  }

  const primero = delGrupo[0] as Pendiente;
  let cierres: Map<string, CuotasDeCierre>;
  try {
    cierres = await api.cierresDelMomento(primero.deporte, primero.comienzo, primero.mercado);
    instantaneas++;
  } catch (fallo) {
    if (fallo instanceof ErrorCuotaAgotada) {
      console.error('\nCuota del proveedor agotada. Se para aquí y se retoma en la próxima pasada.');
      break;
    }
    console.error(`  ${clave}: ${fallo instanceof Error ? fallo.message : String(fallo)}`);
    continue;
  }

  for (const p of delGrupo) {
    const cierre = cierres.get(p.eventoId);
    if (!cierre) {
      /*
       * Un fallo transitorio del proveedor y un partido que de verdad no está
       * se ven igual desde aquí, así que este caso NO se abandona al primer
       * intento: se le dan tres días de reintentos y solo entonces se cierra.
       */
      const antiguedad = Date.now() - p.comienzo.getTime();
      if (antiguedad > ESPERA_ANTES_DE_RENUNCIAR) {
        await renunciar(p, 'evento_ausente', `el evento ${p.eventoId} no está en la instantánea`);
        renunciados.push(`${p.id} (${p.eventoId}): el partido no aparece tras 3 días`);
      } else {
        sinDatos.push(`${p.id} (${p.eventoId})`);
      }
      continue;
    }

    /*
     * DOS mercados, cada uno para lo que sirve.
     *
     * Para el CLV bruto, el mismo mercado donde se apostó: la casa del pick si
     * la declara, y si no la mediana, que es lo que se registró. Comparar el
     * precio de una casa contra el cierre de otra mete dentro la diferencia de
     * nivel entre las dos y no mide el momento de entrada, que es lo único que
     * el bruto pretende medir.
     *
     * Para la ventaja, la casa de menor margen del corte: su precio sin
     * comisión es el mejor estimador disponible de la probabilidad real, y ahí
     * usar otro mercado sí es legítimo porque no se compara con su precio, se
     * compara con la verdad.
     */
    const suCasa = p.casa
      ? cierre.porCasa.find((c) => normal(c.casa) === normal(p.casa as string))
      : undefined;
    const original = suCasa ? suCasa.lados : cierre.lados;
    const fuente: 'casa' | 'consenso' = suCasa ? 'casa' : 'consenso';

    const porMargen = cierre.porCasa
      .map((c) => ({ ...c, margen: c.lados.reduce((s, l) => s + 1 / l.cuota, 0) - 1 }))
      /* Un margen nulo o negativo no es una casa barata: es un dato roto o dos
         momentos mezclados, y como referencia daría probabilidades imposibles. */
      .filter((c) => c.margen > 0.001)
      .sort((a, b) => a.margen - b.margen);

    /*
     * La referencia tiene que ser LA MISMA APUESTA, sin excepción.
     *
     * Antes bastaba con que la casa tuviera una línea igual o más difícil, y
     * eso colaba referencias de otra línea: un pick a «Over 2.5» acabó
     * midiéndose contra el «Over 2.75» de Pinnacle. El CLV comparaba 2.5 con
     * 2.5 y la ventaja comparaba 2.5 con 2.75, así que salía un +14,37 % de
     * CLV junto a un -0,50 % de ventaja — dos números que no se pueden
     * conciliar porque no hablaban de la misma apuesta.
     *
     * La cota conservadora vale para el CLV, donde subestimar es la dirección
     * segura del error. Para la ventaja no vale: cambiar la línea cambia la
     * probabilidad, no solo el precio.
     */
    const afilada = porMargen.find((c) =>
      c.lados.some((l) => normal(l.etiqueta) === normal(p.lado)),
    );

    /*
     * Emparejamiento estricto por etiqueta, nunca por posición: en fútbol son
     * tres lados y las casas no los devuelven en un orden fijo.
     *
     * Y si la línea exacta no sobrevivió al cierre —el mercado se movió— se
     * cae a la COTA CONSERVADORA: una línea igual o más difícil, cuyo precio
     * es mayor y por tanto produce un CLV que se queda corto antes que
     * pasarse. Ver `ladoConservador`. Si no hay ninguna, se renuncia como
     * siempre: la regla no se estira para salvar un pick.
     */
    /*
     * Cuatro escalones, del más sólido al más frágil, y se para en el primero
     * que sirva:
     *
     *   1. la línea exacta está en el cierre  -> medición
     *   2. se interpola entre dos que la abrazan
     *   3. se extrapola media línea como mucho
     *   4. cota conservadora contra una línea igual o más difícil
     *
     * Y si ninguno sirve, se renuncia. El orden no es negociable ni depende
     * del pick: se fija aquí, en el código, antes de ver ningún resultado.
     */
    const resuelto = resolverLado(p.lado, original, cierre.porCasa);
    if (resuelto === null) {
      const detalle = `"${p.lado}" no está entre ${original.map((l) => `"${l.etiqueta}"`).join(', ')}`;
      await renunciar(p, 'linea_movida', detalle);
      renunciados.push(`${p.id}: ${detalle}`);
      continue;
    }
    const { lados: usados, indice, estimacion } = resuelto;
    /* Sobre el mercado RESUELTO: si se dedujo el par, el margen es el suyo. */
    const margen = usados.reduce((s, l) => s + 1 / l.cuota, 0) - 1;

    /*
     * La referencia se resuelve con el MISMO criterio: si el bruto se mide
     * contra −2, la ventaja también, o se estarían comparando dos apuestas
     * distintas y el par dejaría de tener sentido.
     */
    /*
     * Si ninguna casa cuelga la línea exacta, la referencia se DEDUCE del
     * mercado entero en esa misma línea — nunca se toma prestada la de otra.
     * Es el caso del hándicap cuya línea se movió: la referencia entonces no
     * es de una casa, es del consenso, y así se etiqueta.
     */
    const refDeducida = afilada ? null : resolverLado(p.lado, cierre.lados, cierre.porCasa);
    const refLados = afilada ? afilada.lados : (refDeducida?.lados ?? []);
    const refIndice = afilada
      ? afilada.lados.findIndex((l) => normal(l.etiqueta) === normal(p.lado))
      : (refDeducida?.indice ?? -1);

    const referencia =
      refIndice !== -1 && refLados.length > 0
        ? {
            casa: afilada ? afilada.casa : cierre.casa,
            lados: refLados.map((l) => l.etiqueta),
            cuotas: refLados.map((l) => l.cuota),
            indiceTomado: refIndice,
            margen: refLados.reduce((s, l) => s + 1 / l.cuota, 0) - 1,
          }
        : null;

    const cuotas = usados.map((l) => l.cuota);
    const lados = usados.map((l) => l.etiqueta);

    if (p.origen === 'registro') {
      anadirCierre({
        pickId: p.id,
        capturadoEn: cierre.capturadoEn.toISOString(),
        lados,
        cuotas,
        indiceTomado: indice,
        casa: suCasa ? suCasa.casa : cierre.casa,
        fuente,
        margen,
        ...(estimacion ? { estimacion } : {}),
        referencia,
        proveedor: api.nombre,
      });
    } else if (supabase) {
      const { error } = await supabase.from('cierres').insert({
        pick_id: p.id,
        capturado_en: cierre.capturadoEn.toISOString(),
        lados,
        cuotas,
        indice_tomado: indice,
        casa: suCasa ? suCasa.casa : cierre.casa,
        fuente,
        margen,
        estimacion: estimacion ?? null,
        referencia,
        proveedor: api.nombre,
      });
      if (error) {
        console.error(`  ${p.id}: no se pudo guardar el cierre — ${error.message}`);
        continue;
      }
    }

    capturados++;
    const analisis = referencia
      ? analizarConReferencia(
          p.cuotaTomada, cuotas, indice, referencia.cuotas, referencia.indiceTomado,
        )
      : analizarApuestaN(p.cuotaTomada, cuotas, indice);
    const signo = analisis.ventaja >= 0 ? '+' : '';
    console.log(
      `  ${p.origen === 'registro' ? '📄' : '👤'} ${p.lado} @ ${p.cuotaTomada} → ` +
        `cierre ${cuotas[indice]} (${fuente === 'casa' ? suCasa?.casa : 'consenso'})` +
        `${referencia ? ` · ref ${referencia.casa} ${(referencia.margen * 100).toFixed(1)}%` : ''} · ` +
        `ventaja ${signo}${(analisis.ventaja * 100).toFixed(2)} %`,
    );
  }
}

console.log(`\n${capturados} cierre(s) capturados en ${instantaneas} instantánea(s).`);
if (sinDatos.length > 0) {
  console.log(`${sinDatos.length} sin datos de cierre todavía: ${sinDatos.slice(0, 5).join(', ')}`);
}
if (renunciados.length > 0) {
  console.log('\n⚠ Sin cierre medible (se renuncia, no se adivina ni se reintenta):');
  for (const s of renunciados) console.log(`  ${s}`);
}

// ---------------------------------------------------------------------------
// Resultados
// ---------------------------------------------------------------------------

/*
 * Los marcadores son baratos —2 peticiones por competición— y una llamada trae
 * todos los partidos de los últimos días, así que se pide una vez por deporte
 * y sirve a los dos orígenes.
 */
const yaResueltos = new Set(leerResultados().map((r) => r.pickId));
const porResolverRegistro = estado.auditorias
  .filter((a) => a.valido && new Date(a.pick.comienzo) <= new Date() && !yaResueltos.has(a.pick.id))
  .map((a) => a.pick);

interface PorResolver {
  origen: 'registro' | 'usuario';
  id: string;
  deporte: Deporte;
  eventoId: string;
  mercado: Mercado;
  lado: string;
}

const porResolver: PorResolver[] = porResolverRegistro.map((p) => ({
  origen: 'registro',
  id: p.id,
  deporte: p.deporte,
  eventoId: p.eventoId,
  mercado: p.mercado,
  lado: p.lado,
}));

if (supabase) {
  const { data } = await supabase
    .from('picks')
    .select('id, deporte, evento_id, lado, mercado, resultados(pick_id)')
    .lte('comienzo', new Date().toISOString())
    .limit(500);

  for (const p of data ?? []) {
    if ((p.resultados as unknown[] | null)?.length === 1) continue;
    porResolver.push({
      origen: 'usuario',
      id: p.id as string,
      deporte: p.deporte as Deporte,
      eventoId: p.evento_id as string,
      mercado: p.mercado as Mercado,
      lado: p.lado as string,
    });
  }
}

/**
 * Resuelve según el mercado.
 *
 * Cada uno tiene su aritmética y confundirlas produce un desenlace creíble y
 * falso. El caso más fácil de estropear es el hándicap de línea entera: ganar
 * exactamente por la línea NO es ganar, se devuelve el dinero. Si eso se
 * contara como victoria, subirían a la vez el acierto y el yield.
 */
function resolverPick(
  p: PorResolver,
  marcador: { equipo: string; puntos: number }[],
  deporte: Deporte,
): Desenlace | null {
  if (p.mercado === 'moneyline') {
    return resolverMoneyline(p.lado, marcador, esFutbol(deporte));
  }

  const partes = separarLinea(p.lado);
  if (partes === null) return null;

  if (p.mercado === 'handicap') {
    return resolverHandicap(partes.equipo, partes.linea, marcador);
  }

  // Totales: el lado es «Over» o «Under» seguido de la línea.
  const lado = partes.equipo.trim();
  if (lado !== 'Over' && lado !== 'Under') return null;
  return resolverTotal(lado, partes.linea, marcador);
}

if (porResolver.length > 0) {
  const deportes = [...new Set(porResolver.map((p) => p.deporte))];
  let resueltos = 0;

  for (const deporte of deportes) {
    let marcadores;
    try {
      marcadores = new Map(
        (await api.resultados(deporte, 3)).map((r) => [r.eventoId, r]),
      );
    } catch (fallo) {
      console.error(`  resultados de ${deporte}: ${fallo instanceof Error ? fallo.message : fallo}`);
      continue;
    }

    for (const p of porResolver.filter((x) => x.deporte === deporte)) {
      const m = marcadores.get(p.eventoId);
      if (!m || !m.terminado) continue;

      const desenlace = resolverPick(p, m.marcador, deporte);
      if (desenlace === null) continue;

      const marcador = m.marcador.map((x) => `${x.equipo} ${x.puntos}`).join(' — ');
      if (p.origen === 'registro') {
        anadirResultado({
          pickId: p.id,
          desenlace,
          marcador,
          capturadoEn: m.actualizadoEn.toISOString(),
          proveedor: api.nombre,
        });
      } else if (supabase) {
        const { error } = await supabase.from('resultados').insert({
          pick_id: p.id,
          desenlace,
          marcador,
          capturado_en: m.actualizadoEn.toISOString(),
          proveedor: api.nombre,
        });
        if (error) continue;
      }
      resueltos++;
    }
  }

  console.log(`${resueltos} resultado(s) capturados de ${porResolver.length} pendiente(s).`);
}

/*
 * Si la pasada no ha llamado a la API —nada que capturar, nada que resolver—
 * no hay cabeceras de las que leer la cuota. Se sondea, que es gratis: sin
 * esto, precisamente las pasadas tranquilas se quedarían sin vigilancia.
 */
const restante = api.cuotaRestante() ?? (await api.sondearCuota().catch(() => null));
if (restante !== null) {
  console.log(`\nCuota restante del proveedor: ${restante}`);

  /*
   * Se deja por escrito para que el workflow pueda fallar DESPUÉS de haber
   * empujado los cierres. Fallar aquí dentro abortaría el commit y se
   * perdería la captura de esta pasada, que es justo lo que se protege.
   */
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `restante=${restante}\nalarma=${ALARMA}\n`);
  }

  // ::warning:: y ::error:: las entiende GitHub Actions y las enseña en el
  // resumen de la ejecución. Fuera de Actions son una línea más.
  if (restante < ALARMA) {
    console.log(
      `::error::Quedan ${restante} peticiones del proveedor. Por debajo de ${ALARMA} el ` +
        'registro se queda sin cierres en pocos días: renueva la clave o baja la frecuencia.',
    );
  } else if (restante < AVISO) {
    console.log(`::warning::Quedan ${restante} peticiones (aviso por debajo de ${AVISO}).`);
  }
}
