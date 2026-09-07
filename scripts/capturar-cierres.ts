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
import { OddsPapi } from '../lib/cuotas/oddspapi';
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
import {
  escaleraDe,
  precioEnLinea,
  contrarioEnLinea,
  parDeLaLinea,
} from '../lib/apuestas/escalera';

/*
 * DOS proveedores, y cada pick se cierra con el suyo.
 *
 * El `eventoId` de un pick pertenece a quien lo emitió: un partido de OddsPapi
 * no existe en The Odds API ni al revés, y los nombres de equipo tampoco
 * coinciden («Real Sociedad San Sebastian» frente a «Real Sociedad»).
 * Emparejarlos por aproximación daría cierres creíbles y falsos, así que no se
 * cruzan: si falta el proveedor que abrió un pick, ese pick se queda pendiente.
 *
 * Basta con que haya UNO configurado. Cuando la clave de The Odds API se
 * desactivó, los cincuenta picks viejos se quedaron esperando mientras los
 * quince nuevos seguían capturándose con normalidad — que es exactamente el
 * comportamiento que se quiere.
 */
const claveOdds = process.env.THE_ODDS_API_KEY;
const clavePapi = process.env.ODDSPAPI_KEY;
if (!claveOdds && !clavePapi) {
  console.error('Falta THE_ODDS_API_KEY y ODDSPAPI_KEY: sin ninguna no hay nada que capturar.');
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

const api = claveOdds ? new TheOddsApi({ claveApi: claveOdds }) : null;
const papi = clavePapi ? new OddsPapi({ claveApi: clavePapi }) : null;
console.log(
  `Proveedores: the-odds-api ${api ? 'sí' : 'NO'} · oddspapi ${papi ? 'sí' : 'NO'}`,
);
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
  /**
   * Quién abrió el pick. Los publicados antes de que esto existiera no lo
   * traen, y se deducen por la FORMA del identificador — los de OddsPapi
   * empiezan por «id» y dígitos; los de The Odds API son hexadecimales.
   * Comprobado sobre los 65 picks reales: separación limpia, cero solapes.
   */
  proveedor: string;
}

/** Deduce el proveedor de un pick antiguo por la forma de su identificador. */
const proveedorDe = (eventoId: string, declarado?: string): string =>
  declarado ?? (/^id\d+$/.test(eventoId) ? 'oddspapi' : 'the-odds-api');

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
  proveedor: proveedorDe(p.eventoId, p.proveedor),
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
        /* La tabla de usuarios aún no guarda proveedor: se deduce del id. */
        proveedor: proveedorDe(p.evento_id as string),
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

/*
 * Los dos proveedores se agrupan distinto porque cobran distinto.
 *
 * The Odds API vende INSTANTANEAS: una peticion de 20 trae todos los partidos
 * de una competicion a una hora, asi que agrupar por (competicion, hora,
 * mercado) reparte ese coste entre todos los picks del grupo.
 *
 * OddsPapi vende SERIES por partido y resultado: no existe la instantanea de
 * competicion, asi que agrupar no ahorra nada y se va pick a pick.
 */
const dePapi = pendientes.filter((p) => p.proveedor === 'oddspapi');
const deOdds = pendientes.filter((p) => p.proveedor !== 'oddspapi');

const grupos = new Map<string, Pendiente[]>();
for (const p of deOdds) {
  // La hora de comienzo entra entera en la clave: la instantánea que sirve a
  // un partido de las 23:06 no es la del de las 23:10.
  const clave = `${p.deporte}|${p.comienzo.toISOString()}|${p.mercado}`;
  grupos.set(clave, [...(grupos.get(clave) ?? []), p]);
}

console.log(
  `\n${pendientes.length} pick(s) pendientes: ` +
    `${deOdds.length} de the-odds-api en ${grupos.size} instantánea(s), ` +
    `${dePapi.length} de oddspapi pick a pick.`,
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
  if (exacto !== -1) {
    /*
     * La línea está, pero puede venir acompañada de sus vecinas. Se recorta a
     * su propio par: lo que se mide es una apuesta, no un puñado de líneas.
     * Si el par no está entero se sigue bajando por los escalones en vez de
     * devolver un mercado a medias.
     */
    const par = parDeLaLinea(copia, exacto);
    if (par !== null) return par;
  }

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
  /* También aquí: el par de la línea de la cota, no todas las que vinieran. */
  const par = parDeLaLinea(copia, indice);
  if (par === null) return null;
  return {
    ...par,
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
    proveedor: p.proveedor,
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

/**
 * Analiza un cierre ya descargado y lo guarda. Devuelve si se guardó.
 *
 * Vive aparte porque los dos proveedores llegan hasta aquí por caminos
 * distintos —The Odds API con una instantánea de toda la competición, OddsPapi
 * partido a partido— pero lo que se hace con el cierre es idéntico: elegir el
 * mercado propio y la referencia, deducir la línea si se movió, calcular el
 * margen y escribir. Duplicar esto habría garantizado que las dos copias se
 * separaran a la primera corrección.
 */
async function guardarCierre(p: Pendiente, cierre: CuotasDeCierre): Promise<boolean> {
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
      return false;
    }
    const { lados: usados, indice, estimacion } = resuelto;
    /* Sobre el mercado RESUELTO: si se dedujo el par, el margen es el suyo. */
    const margen = usados.reduce((s, l) => s + 1 / l.cuota, 0) - 1;

    /*
     * Un margen fuera de lo que cobra cualquier casa del mundo no es un
     * mercado caro: es un fallo de este código. Se para aquí y NO se escribe
     * —ni se renuncia, que es permanente— porque lo que hay que arreglar es
     * el programa, y el pick tiene que seguir pendiente para volver a
     * intentarlo cuando esté arreglado.
     *
     * Existe porque ya pasó: al traer la línea apostada junto a sus vecinas,
     * el margen se sumaba sobre los seis lados y salía un 202 %, con una
     * ventaja de −72 %. Los precios eran todos correctos. Nada saltó, y se
     * escribieron cuatro cierres al registro antes de verlo en el log.
     */
    if (!(margen > -0.001 && margen < 0.3)) {
      console.error(
        `  ${p.id}: margen de cierre del ${(margen * 100).toFixed(1)} % sobre ` +
          `${usados.length} lado(s) [${usados.map((l) => l.etiqueta).join(', ')}]. ` +
          'Eso es un fallo del capturador, no del mercado: no se escribe nada.',
      );
      return false;
    }

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
    /*
     * Y la referencia se recorta igual que el mercado propio. Un cierre con
     * la línea apostada y sus vecinas trae seis lados; sumarlos daba un
     * margen del 200 % y una ventaja de −72 % con precios todos correctos.
     */
    const afiladaPar = afilada
      ? parDeLaLinea(
          afilada.lados.map((l) => ({ ...l })),
          afilada.lados.findIndex((l) => normal(l.etiqueta) === normal(p.lado)),
        )
      : null;

    const refDeducida = afiladaPar ? null : resolverLado(p.lado, cierre.lados, cierre.porCasa);
    const refLados = afiladaPar ? afiladaPar.lados : (refDeducida?.lados ?? []);
    const refIndice = afiladaPar ? afiladaPar.indice : (refDeducida?.indice ?? -1);

    const referencia =
      refIndice !== -1 && refLados.length > 0
        ? {
            casa: afiladaPar ? (afilada as { casa: string }).casa : cierre.casa,
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
        proveedor: p.proveedor,
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
        proveedor: p.proveedor,
      });
      if (error) {
        console.error(`  ${p.id}: no se pudo guardar el cierre — ${error.message}`);
        return false;
      }
    }

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
  return true;
}

for (const [clave, delGrupo] of grupos) {
  if (api === null) {
    console.error('  the-odds-api no configurada: sus picks se quedan pendientes.');
    break;
  }
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

    if (await guardarCierre(p, cierre)) capturados++;
  }
}

/*
 * OddsPapi, pick a pick.
 *
 * Su histórico va por partido y resultado, así que no hay instantánea de
 * competición que repartir: cada pick cuesta sus dos o tres llamadas y no se
 * ahorra agrupando. A cambio devuelve la serie temporal entera, y el cierre es
 * el último precio ANTES del saque en vez de una foto del instante.
 *
 * El tope se aplica por pick: con cien mil peticiones al mes sobra, pero un
 * día con cincuenta pendientes no debe tardar diez minutos con el freno
 * puesto. Lo que se queda fuera se dice y se coge en la pasada siguiente.
 */
if (dePapi.length > 0) {
  if (papi === null) {
    console.error('  oddspapi no configurada: sus picks se quedan pendientes.');
  } else {
    let hechos = 0;
    for (const p of dePapi) {
      if (hechos >= MAX_INSTANTANEAS) {
        console.log(
          `
⚠ Tope de ${MAX_INSTANTANEAS} picks de oddspapi por pasada. ` +
            `Quedan ${dePapi.length - hechos} para la siguiente.`,
        );
        break;
      }
      hechos++;
      try {
        /*
         * La línea del pick va como pista: OddsPapi pide el histórico línea a
         * línea, así que sin decirle cuál interesa devolvía la principal del
         * mercado —el 0.5 de los totales— y todos los picks a Over 2.5 salían
         * como «línea movida». No lo estaban.
         */
        const cierre = await papi.cuotasDeCierre(
          { id: p.eventoId, deporte: p.deporte, comienzo: p.comienzo },
          p.mercado,
          separarLinea(p.lado)?.linea ?? null,
        );
        if (cierre === null) {
          const antiguedad = Date.now() - p.comienzo.getTime();
          if (antiguedad > ESPERA_ANTES_DE_RENUNCIAR) {
            await renunciar(p, 'evento_ausente', `sin cierre en oddspapi para ${p.eventoId}`);
            renunciados.push(`${p.id} (${p.eventoId}): sin cierre tras 3 días`);
          } else {
            sinDatos.push(`${p.id} (${p.eventoId})`);
          }
          continue;
        }
        if (await guardarCierre(p, cierre)) capturados++;
      } catch (fallo) {
        if (fallo instanceof ErrorCuotaAgotada) {
          console.error('\nLimite de oddspapi alcanzado. Se retoma en la proxima pasada.');
          break;
        }
        console.error(`  ${p.id}: ${fallo instanceof Error ? fallo.message : String(fallo)}`);
      }
    }
  }
}

console.log(`
${capturados} cierre(s) capturados.`);
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
  /** Los equipos, para poder etiquetar el marcador sin volver a preguntarlos. */
  local: string;
  visitante: string;
  proveedor: string;
}

const porResolver: PorResolver[] = porResolverRegistro.map((p) => ({
  origen: 'registro',
  id: p.id,
  deporte: p.deporte,
  eventoId: p.eventoId,
  mercado: p.mercado,
  lado: p.lado,
  local: p.local,
  visitante: p.visitante,
  proveedor: proveedorDe(p.eventoId, p.proveedor),
}));

if (supabase) {
  const { data } = await supabase
    .from('picks')
    .select('id, deporte, evento_id, lado, mercado, local, visitante, resultados(pick_id)')
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
      local: (p.local as string | undefined) ?? '',
      visitante: (p.visitante as string | undefined) ?? '',
      proveedor: proveedorDe(p.evento_id as string),
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

  /**
   * Guarda un resultado ya resuelto. Común a los dos proveedores.
   */
  async function guardarResultado(
    p: PorResolver,
    marcadorLista: { equipo: string; puntos: number }[],
    cuando: Date,
  ): Promise<boolean> {
    const desenlace = resolverPick(p, marcadorLista, p.deporte);
    if (desenlace === null) return false;
    const marcador = marcadorLista.map((x) => `${x.equipo} ${x.puntos}`).join(' — ');
    if (p.origen === 'registro') {
      anadirResultado({
        pickId: p.id,
        desenlace,
        marcador,
        capturadoEn: cuando.toISOString(),
        proveedor: p.proveedor,
      });
    } else if (supabase) {
      const { error } = await supabase.from('resultados').insert({
        pick_id: p.id,
        desenlace,
        marcador,
        capturado_en: cuando.toISOString(),
        proveedor: p.proveedor,
      });
      if (error) return false;
    }
    console.log(`  ${p.lado} → ${desenlace} (${marcador})`);
    return true;
  }

  /*
   * The Odds API: una llamada de marcadores por competición sirve a todos sus
   * picks, así que se agrupa por deporte.
   */
  const porDeporte = porResolver.filter((p) => p.proveedor !== 'oddspapi');
  if (porDeporte.length > 0 && api === null) {
    console.error('  the-odds-api no configurada: sus resultados se quedan pendientes.');
  } else if (api !== null) {
    for (const deporte of [...new Set(porDeporte.map((p) => p.deporte))]) {
      let marcadores;
      try {
        marcadores = new Map((await api.resultados(deporte, 3)).map((r) => [r.eventoId, r]));
      } catch (fallo) {
        console.error(
          `  resultados de ${deporte}: ${fallo instanceof Error ? fallo.message : fallo}`,
        );
        continue;
      }
      for (const p of porDeporte.filter((x) => x.deporte === deporte)) {
        const m = marcadores.get(p.eventoId);
        if (!m || !m.terminado) continue;
        if (await guardarResultado(p, m.marcador, m.actualizadoEn)) resueltos++;
      }
    }
  }

  /*
   * OddsPapi: el marcador va por partido, así que una llamada por pick. Dos
   * picks del mismo partido comparten marcador y se cachea para no pedirlo
   * dos veces — pasa constantemente, porque de un partido se apuestan varios
   * mercados.
   */
  const porPartido = porResolver.filter((p) => p.proveedor === 'oddspapi');
  if (porPartido.length > 0 && papi === null) {
    console.error('  oddspapi no configurada: sus resultados se quedan pendientes.');
  } else if (papi !== null) {
    const cache = new Map<string, { equipo: string; puntos: number }[] | null>();
    for (const p of porPartido) {
      try {
        if (!cache.has(p.eventoId)) {
          cache.set(p.eventoId, await papi.marcadorDe(p.eventoId, p.local, p.visitante));
        }
        const marcadorLista = cache.get(p.eventoId) ?? null;
        /*
         * Sin marcador NO se liquida. Un partido sin datos todavía y un 0-0 se
         * verían igual si se rellenara con ceros, y el fichero es de
         * solo-añadir: una liquidación equivocada no se corrige después.
         */
        if (marcadorLista === null) continue;
        if (await guardarResultado(p, marcadorLista, new Date())) resueltos++;
      } catch (fallo) {
        if (fallo instanceof ErrorCuotaAgotada) {
          console.error('\nLimite de oddspapi alcanzado en resultados. Se retoma luego.');
          break;
        }
        console.error(`  ${p.id}: ${fallo instanceof Error ? fallo.message : String(fallo)}`);
      }
    }
  }

  console.log(`${resueltos} resultado(s) capturados de ${porResolver.length} pendiente(s).`);
}

/*
 * Si la pasada no ha llamado a la API —nada que capturar, nada que resolver—
 * no hay cabeceras de las que leer la cuota. Se sondea, que es gratis: sin
 * esto, precisamente las pasadas tranquilas se quedarían sin vigilancia.
 */
/*
 * La vigilancia de cuota es SOLO de The Odds API: es la que se agota y la que
 * tiene reserva. OddsPapi no expone cuota en cabeceras —cien mil al mes y un
 * contador en su panel— así que aquí no hay nada que mirar.
 */
const restante = api === null
  ? null
  : (api.cuotaRestante() ?? (await api.sondearCuota().catch(() => null)));
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
