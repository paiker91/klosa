/**
 * ¿Cuánto CLV se pierde por registrar a la mediana en vez de a una casa?
 *
 * No se razona: se mide. Para cada pick se pide la instantánea del momento en
 * que se anotó y la del comienzo, y se compara cada casa consigo misma.
 *
 * Lo que se busca NO es el mejor número posible —elegir a posteriori la casa
 * que más conviene es hacer trampa— sino la distribución: qué salía con la
 * mediana, qué con la casa mediana, y qué con la mejor. La diferencia entre la
 * primera y la tercera es lo que cuesta no buscar precio.
 */
import { TheOddsApi } from '../../lib/cuotas/the-odds-api';
import { leerPicks } from '../../lib/picks/registro';
import { analizarApuestaN } from '../../lib/clv';

const claveApi = process.env.THE_ODDS_API_KEY;
if (!claveApi) { console.error('Falta THE_ODDS_API_KEY.'); process.exit(1); }
const api = new TheOddsApi({ claveApi });

const picks = leerPicks();
const normal = (s: string) => s.trim().toLowerCase();

/** Instantáneas ya pedidas, para no pagar dos veces por la misma. */
const cache = new Map<string, Awaited<ReturnType<typeof api.cierresDelMomento>>>();
async function instantanea(deporte: (typeof picks)[number]['deporte'], momento: Date) {
  const clave = `${deporte}|${momento.toISOString()}`;
  const guardada = cache.get(clave);
  if (guardada) return guardada;
  const nueva = await api.cierresDelMomento(deporte, momento, 'moneyline');
  cache.set(clave, nueva);
  return nueva;
}

interface Fila {
  lado: string;
  conMediana: number;
  casaMediana: number | null;
  mejorCasa: number | null;
  nombreMejor: string | null;
  porMejorPrecio: number | null;
  nombrePrecio: string | null;
  casas: number;
}

const filas: Fila[] = [];

for (const p of picks) {
  const abre = await instantanea(p.deporte, new Date(p.registradoEn));
  const cierra = await instantanea(p.deporte, new Date(p.comienzo));

  const a = abre.get(p.eventoId);
  const c = cierra.get(p.eventoId);
  if (!a || !c) { console.log(`  ${p.lado}: sin instantánea completa`); continue; }

  // Lo que se registró de verdad: mediana contra mediana.
  const iC = c.lados.findIndex((l) => normal(l.etiqueta) === normal(p.lado));
  if (iC === -1) continue;
  const conMediana = analizarApuestaN(p.cuotaTomada, c.lados.map((l) => l.cuota), iC).ventaja;

  /*
   * Cada casa contra sí misma: el precio que ESA casa ofrecía al anotar,
   * medido contra el cierre de ESA MISMA casa. Solo cuentan las casas que
   * estaban en los dos cortes; si faltó en uno, no hay comparación que hacer.
   */
  const porCasa: { casa: string; ventaja: number }[] = [];
  for (const casaAbre of a.porCasa) {
    const casaCierra = c.porCasa.find((x) => normal(x.casa) === normal(casaAbre.casa));
    if (!casaCierra) continue;

    const iA = casaAbre.lados.findIndex((l) => normal(l.etiqueta) === normal(p.lado));
    const iCc = casaCierra.lados.findIndex((l) => normal(l.etiqueta) === normal(p.lado));
    if (iA === -1 || iCc === -1) continue;

    try {
      porCasa.push({
        casa: casaAbre.casa,
        ventaja: analizarApuestaN(
          casaAbre.lados[iA]!.cuota,
          casaCierra.lados.map((l) => l.cuota),
          iCc,
        ).ventaja,
      });
    } catch {
      /* Una casa con datos imposibles no cuenta. */
    }
  }

  /*
   * DOS «mejores» que no son lo mismo, y confundirlas sería engañarse:
   *
   *   - mejorPrecio: la casa que ofrecía la cuota más alta AL ANOTAR. Se puede
   *     elegir en el momento, mirando la pantalla. Es una estrategia real.
   *   - mejorCLV: la casa cuyo resultado salió mejor. Solo se sabe después,
   *     así que no se puede elegir. Es un techo teórico, no una estrategia.
   */
  const conPrecio = porCasa.map((x) => {
    const ca = a.porCasa.find((y) => normal(y.casa) === normal(x.casa))!;
    const i = ca.lados.findIndex((l) => normal(l.etiqueta) === normal(p.lado));
    return { ...x, precio: ca.lados[i]!.cuota };
  });
  const mejorPrecio = [...conPrecio].sort((x, y) => y.precio - x.precio)[0] ?? null;

  porCasa.sort((x, y) => x.ventaja - y.ventaja);
  const mediana = porCasa[Math.floor(porCasa.length / 2)] ?? null;
  const mejor = porCasa[porCasa.length - 1] ?? null;

  filas.push({
    lado: p.lado,
    conMediana,
    casaMediana: mediana?.ventaja ?? null,
    mejorCasa: mejor?.ventaja ?? null,
    nombreMejor: mejor?.casa ?? null,
    porMejorPrecio: mejorPrecio?.ventaja ?? null,
    nombrePrecio: mejorPrecio?.casa ?? null,
    casas: porCasa.length,
  });
}

const pct = (x: number | null) => (x === null ? '    —  ' : `${x >= 0 ? '+' : ''}${(x * 100).toFixed(2)}%`);
console.log('\nlado                       mediana   casa mediana   mejor casa   (cuál)');
for (const f of filas) {
  console.log(
    `${f.lado.padEnd(24)} ${pct(f.conMediana).padStart(8)}  ${pct(f.casaMediana).padStart(11)}  ` +
      `${pct(f.mejorCasa).padStart(11)}   ${f.nombreMejor ?? ''} (${f.casas} casas)`,
  );
}

const media = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
};
console.log('\n--- media sobre', filas.length, 'picks ---');
console.log('  registrando a la mediana        :', pct(media(filas.map((f) => f.conMediana))));
console.log('  casa mediana contra sí misma    :', pct(media(filas.map((f) => f.casaMediana))));
console.log('  cogiendo el MEJOR PRECIO al anotar:', pct(media(filas.map((f) => f.porMejorPrecio))), '← elegible de verdad');
console.log('  techo teórico (mejor a posteriori):', pct(media(filas.map((f) => f.mejorCasa))), '← NO se puede elegir');
console.log('\nCuota restante:', api.cuotaRestante());
