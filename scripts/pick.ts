/**
 * Anota un pronóstico en el registro público.
 *
 *   npm run pick -- --deporte NBA --equipo "Boston Celtics" --cuota 2,10
 *   npm run pick -- --deporte MLB --evento abc123 --mercado totales --lado "Over 5.5" --cuota 1,81
 *
 * Después: `git add picks/picks.jsonl && git commit -m "pick: ..."` y push.
 * El commit es la marca de tiempo que no controlamos nosotros.
 *
 * Se NIEGA a registrar un pick de un partido ya empezado. Esa negativa es lo
 * que sostiene todo el registro: sin ella, cualquiera podría anotar a toro
 * pasado y el histórico no valdría nada.
 */
import { parsearCuota } from '../lib/clv';
import { TheOddsApi } from '../lib/cuotas/the-odds-api';
import { DEPORTES, MERCADOS, type Deporte, type Mercado } from '../lib/cuotas/dominio';
import { crearPick } from '../lib/picks/dominio';
import { anadirPick } from '../lib/picks/registro';

const args = process.argv.slice(2);
const opcion = (nombre: string): string | undefined => {
  const i = args.indexOf(`--${nombre}`);
  return i >= 0 ? args[i + 1] : undefined;
};

function morir(mensaje: string): never {
  console.error(`\n${mensaje}\n`);
  console.error('Uso: npm run pick -- --deporte <NBA|Euroliga|MLB> --equipo "<nombre>" --cuota <c>');
  console.error('     [--evento <id>] [--mercado moneyline|handicap|totales] [--lado "<etiqueta>"]');
  console.error('     [--casa "<nombre>"] [--nota "<texto>"]');
  process.exit(1);
}

const deporte = opcion('deporte') as Deporte | undefined;
if (!deporte || !DEPORTES.includes(deporte)) morir(`Deporte inválido. Opciones: ${DEPORTES.join(', ')}`);

const mercado = (opcion('mercado') ?? 'moneyline') as Mercado;
if (!MERCADOS.includes(mercado)) morir(`Mercado inválido. Opciones: ${MERCADOS.join(', ')}`);

const textoCuota = opcion('cuota');
if (!textoCuota) morir('Falta --cuota.');

let cuotaTomada: number;
try {
  cuotaTomada = parsearCuota(textoCuota);
} catch (fallo) {
  morir(fallo instanceof Error ? fallo.message : String(fallo));
}

const claveApi = process.env.THE_ODDS_API_KEY;
if (!claveApi) morir('Falta THE_ODDS_API_KEY. Cárgala desde .env.local antes de ejecutar.');

const api = new TheOddsApi({ claveApi });
const eventos = await api.buscarEventos({ deporte });
if (eventos.length === 0) morir(`No hay eventos abiertos de ${deporte} ahora mismo.`);

const idPedido = opcion('evento');
const equipo = opcion('equipo');
const candidatos = idPedido
  ? eventos.filter((e) => e.id === idPedido)
  : equipo
    ? eventos.filter((e) =>
        [e.local, e.visitante].some((n) => n.toLowerCase().includes(equipo.toLowerCase())),
      )
    : [];

if (candidatos.length === 0) {
  console.error(`\nNo se encontró el evento. Los ${Math.min(eventos.length, 12)} más próximos:\n`);
  for (const e of eventos.slice(0, 12)) {
    console.error(`  ${e.id}  ${e.comienzo.toISOString()}  ${e.visitante} @ ${e.local}`);
  }
  morir('Use --evento con uno de esos identificadores, o afine --equipo.');
}
if (candidatos.length > 1) {
  console.error('\nHay más de un evento que encaja:\n');
  for (const e of candidatos) {
    console.error(`  ${e.id}  ${e.comienzo.toISOString()}  ${e.visitante} @ ${e.local}`);
  }
  morir('Concrete con --evento.');
}

const evento = candidatos[0];
if (!evento) morir('Evento no resuelto.');

const ahora = new Date();
if (evento.comienzo <= ahora) {
  morir(
    `Ese partido empezó el ${evento.comienzo.toISOString()}.\n` +
      'No se registran picks de partidos ya comenzados: el registro dejaría de ser verificable.',
  );
}

/* Para moneyline el lado es el equipo; en los demás hay que decirlo explícitamente. */
const lado =
  opcion('lado') ??
  (mercado === 'moneyline'
    ? [evento.local, evento.visitante].find((n) =>
        n.toLowerCase().includes((equipo ?? '').toLowerCase()),
      )
    : undefined);

if (!lado) morir(`Falta --lado. En ${mercado} hay que indicar la etiqueta exacta del lado apostado.`);

const pick = crearPick({
  registradoEn: ahora.toISOString(),
  deporte,
  eventoId: evento.id,
  local: evento.local,
  visitante: evento.visitante,
  comienzo: evento.comienzo.toISOString(),
  mercado,
  lado,
  cuotaTomada,
  casa: opcion('casa') ?? null,
  nota: opcion('nota') ?? null,
});

anadirPick(pick);

const horas = ((evento.comienzo.getTime() - ahora.getTime()) / 3_600_000).toFixed(1);
console.log(`\nPick anotado · sello ${pick.id}`);
console.log(`  ${pick.visitante} @ ${pick.local}`);
console.log(`  ${pick.mercado} · ${pick.lado} @ ${pick.cuotaTomada}`);
console.log(`  Comienza en ${horas} h (${pick.comienzo})`);
console.log(`\nAhora consolide la marca de tiempo:`);
console.log(`  git add picks/picks.jsonl`);
console.log(`  git commit -m "pick: ${pick.lado} @ ${pick.cuotaTomada}"`);
console.log(`  git push`);
