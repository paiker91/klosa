/**
 * Anota en lote los no favoritos de todos los partidos abiertos de un deporte.
 *
 *   KLOSA_PICKS_DIR=... tsx scripts/anotar-lote.ts --deporte MLB
 *
 * La cuota registrada es la MEDIANA de las casas, no la mejor. La mejor de
 * treinta y una casas es casi siempre superior al cierre de cualquiera de
 * ellas, así que registrarla produciría CLV positivo por construcción — un
 * artefacto de medición, no habilidad. La mediana representa el precio del
 * mercado en ese momento y no arrastra ese sesgo.
 *
 * Cada pick queda anotado con ese origen para que quien audite lo sepa.
 */
import { TheOddsApi } from '../lib/cuotas/the-odds-api';
import { DEPORTES, type Deporte } from '../lib/cuotas/dominio';
import { dirname } from 'node:path';
import { crearPick } from '../lib/picks/dominio';
import { anadirPick, RUTA_PICKS } from '../lib/picks/registro';
import { sellarEnGit } from '../lib/picks/sellar';

const args = process.argv.slice(2);
const opcion = (n: string) => args[args.indexOf(`--${n}`) + 1];

const deporte = (opcion('deporte') ?? 'MLB') as Deporte;
if (!DEPORTES.includes(deporte)) {
  console.error(`Deporte inválido. Opciones: ${DEPORTES.join(', ')}`);
  process.exit(1);
}

const claveApi = process.env.THE_ODDS_API_KEY;
if (!claveApi) {
  console.error('Falta THE_ODDS_API_KEY.');
  process.exit(1);
}

/* Solo los deportes que este script sabe anotar en lote. */
const SPORT_KEY: Partial<Record<Deporte, string>> = {
  NBA: 'basketball_nba',
  Euroliga: 'basketball_euroleague',
  MLB: 'baseball_mlb',
};

interface Salida {
  name: string;
  price: number;
}
interface Casa {
  title: string;
  markets: Array<{ key: string; outcomes: Salida[] }>;
}
interface EventoAPI {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers?: Casa[];
}

const url = new URL(`https://api.the-odds-api.com/v4/sports/${SPORT_KEY[deporte]}/odds/`);
url.searchParams.set('apiKey', claveApi);
url.searchParams.set('regions', 'us,eu');
url.searchParams.set('markets', 'h2h');
url.searchParams.set('oddsFormat', 'decimal');

const respuesta = await fetch(url);
if (!respuesta.ok) {
  console.error(`La API respondió HTTP ${respuesta.status}.`);
  process.exit(1);
}
const eventos = (await respuesta.json()) as EventoAPI[];

const mediana = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] as number) : (((s[m - 1] as number) + (s[m] as number)) / 2);
};

const ahora = new Date();
let anotados = 0;
const omitidos: string[] = [];

console.log(`Registro: ${RUTA_PICKS}\n`);

for (const e of eventos) {
  const comienzo = new Date(e.commence_time);

  // La misma regla que el CLI: nada de partidos ya empezados.
  if (comienzo <= ahora) {
    omitidos.push(`${e.away_team} @ ${e.home_team}: ya empezó`);
    continue;
  }

  const preciosDe = (nombre: string): number[] =>
    (e.bookmakers ?? []).flatMap(
      (b) =>
        b.markets
          .find((m) => m.key === 'h2h')
          ?.outcomes.filter((o) => o.name === nombre)
          .map((o) => o.price) ?? [],
    );

  const visitante = preciosDe(e.away_team);
  const local = preciosDe(e.home_team);
  if (visitante.length < 3 || local.length < 3) {
    omitidos.push(`${e.away_team} @ ${e.home_team}: pocas casas para una mediana fiable`);
    continue;
  }

  const medV = mediana(visitante);
  const medL = mediana(local);
  // El no favorito es el de cuota más alta.
  const esVisitante = medV > medL;
  const lado = esVisitante ? e.away_team : e.home_team;
  const cuota = Math.round((esVisitante ? medV : medL) * 100) / 100;
  const casas = esVisitante ? visitante.length : local.length;

  const pick = crearPick({
    registradoEn: new Date().toISOString(),
    deporte,
    eventoId: e.id,
    local: e.home_team,
    visitante: e.away_team,
    comienzo: comienzo.toISOString(),
    mercado: 'moneyline',
    lado,
    cuotaTomada: cuota,
    stake: null,
    casa: null,
    nota: `cuota mediana de ${casas} casas · estrategia: no favorito`,
  });

  try {
    anadirPick(pick);
    anotados++;
    const h = ((comienzo.getTime() - ahora.getTime()) / 3_600_000).toFixed(1);
    console.log(`  ${pick.id}  ${lado.padEnd(24)} @ ${String(cuota).padEnd(5)}  en ${h} h`);
  } catch (fallo) {
    omitidos.push(`${lado}: ${fallo instanceof Error ? fallo.message : String(fallo)}`);
  }
}

console.log(`\n${anotados} pick(s) anotados.`);
if (omitidos.length) {
  console.log(`\n${omitidos.length} omitido(s):`);
  for (const o of omitidos) console.log(`  ${o}`);
}
if (anotados > 0 && !args.includes('--sin-sellar')) {
  const r = sellarEnGit(dirname(RUTA_PICKS), `picks: ${anotados} no favoritos (${deporte})`);
  console.log(r.sellado ? `Sellado y empujado · commit ${r.commit}` : `NO sellado: ${r.motivo}`);
}
