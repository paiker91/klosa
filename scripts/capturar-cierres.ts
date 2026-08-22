/**
 * Captura la línea de cierre de los picks cuyo partido ya empezó.
 *
 *   npm run capturar
 *
 * Pensado para ejecutarse periódicamente. El pick lo pone una persona; el
 * cierre lo pone el proveedor. Nadie toca las dos cosas, y por eso el CLV que
 * sale de ahí significa algo.
 *
 * Si un lado no se puede emparejar con las etiquetas del proveedor, NO se
 * inventa: se deja pendiente y se avisa. Adivinar produciría un CLV plausible
 * y falso, que es peor que no tener dato.
 */
import { TheOddsApi } from '../lib/cuotas/the-odds-api';
import { ErrorCuotaAgotada, esFutbol } from '../lib/cuotas/dominio';
import {
  estadoDelRegistro,
  anadirCierre,
  anadirResultado,
  leerResultados,
  resolverMoneyline,
} from '../lib/picks/registro';
import type { Pick } from '../lib/picks/dominio';
import type { Deporte } from '../lib/cuotas/dominio';
import { analizarApuestaN } from '../lib/clv';

const claveApi = process.env.THE_ODDS_API_KEY;
if (!claveApi) {
  console.error('Falta THE_ODDS_API_KEY. Cárgala desde .env.local antes de ejecutar.');
  process.exit(1);
}

const api = new TheOddsApi({ claveApi });
const estado = estadoDelRegistro();

console.log(`Registro: ${estado.resumen.total} picks · ${estado.resumen.validos} válidos · ` +
  `${estado.resumen.conCierre} con cierre · ${estado.resumen.pendientes} pendientes`);

if (estado.resumen.invalidos > 0) {
  console.log(`\n⚠ ${estado.resumen.invalidos} pick(s) no pasan la auditoría y no se van a cerrar:`);
  for (const a of estado.auditorias.filter((x) => !x.valido)) {
    console.log(`  ${a.pick.id}  ${a.motivos.join(', ')}`);
  }
}

if (estado.pendientesDeCierre.length === 0) {
  console.log('\nNada que capturar.');
  process.exit(0);
}

let capturados = 0;
const sinEmparejar: string[] = [];

for (const pick of estado.pendientesDeCierre) {
  try {
    const cierre = await api.cuotasDeCierre({ id: pick.eventoId, deporte: pick.deporte, comienzo: new Date(pick.comienzo) }, pick.mercado);
    if (cierre === null) {
      console.log(`  ${pick.id}  sin datos de cierre todavía`);
      continue;
    }

    /*
     * Emparejamiento estricto por etiqueta. El proveedor devuelve todos los
     * lados; hay que saber cuál es el apostado para no invertir el cálculo.
     * En fútbol son tres, así que buscarlo por posición sería adivinar.
     */
    const normal = (s: string) => s.trim().toLowerCase();
    const indiceTomado = cierre.lados.findIndex((l) => normal(l.etiqueta) === normal(pick.lado));

    if (indiceTomado === -1) {
      sinEmparejar.push(
        `${pick.id}: el lado "${pick.lado}" no está entre ${cierre.lados
          .map((l) => `"${l.etiqueta}"`)
          .join(', ')}`,
      );
      continue;
    }

    const tomado = cierre.lados[indiceTomado] as { etiqueta: string; cuota: number };

    anadirCierre({
      pickId: pick.id,
      capturadoEn: cierre.capturadoEn.toISOString(),
      lados: cierre.lados.map((l) => l.etiqueta),
      cuotas: cierre.lados.map((l) => l.cuota),
      indiceTomado,
      casa: cierre.casa,
      proveedor: api.nombre,
    });
    capturados++;

    const analisis = analizarApuestaN(
      pick.cuotaTomada,
      cierre.lados.map((l) => l.cuota),
      indiceTomado,
    );
    const signo = analisis.ventaja >= 0 ? '+' : '';
    console.log(
      `  ${pick.id}  ${pick.lado} @ ${pick.cuotaTomada} → cierre ${tomado.cuota} · ` +
        `ventaja ${signo}${(analisis.ventaja * 100).toFixed(2)} %`,
    );
  } catch (fallo) {
    if (fallo instanceof ErrorCuotaAgotada) {
      console.error('\nCuota del proveedor agotada. Se para aquí y se retoma en la próxima pasada.');
      break;
    }
    console.error(`  ${pick.id}  error: ${fallo instanceof Error ? fallo.message : String(fallo)}`);
  }
}

if (sinEmparejar.length > 0) {
  console.log(`\n⚠ ${sinEmparejar.length} pick(s) sin emparejar. Se dejan pendientes a propósito:`);
  for (const s of sinEmparejar) console.log(`  ${s}`);
  console.log('  Corrija la etiqueta del lado o capture ese cierre a mano.');
}

console.log(`\n${capturados} cierre(s) capturados. Cuota restante: ${api.cuotaRestante() ?? '?'}`);
if (capturados > 0) {
  console.log('\nConsolide el registro:');
  console.log('  git add picks/cierres.jsonl && git commit -m "cierres" && git push');
}

// ---------------------------------------------------------------------------
// Resultados: quién ganó el partido
// ---------------------------------------------------------------------------

/*
 * El desenlace se captura aparte del cierre y a otro ritmo: un partido puede
 * tener línea de cierre mucho antes de tener marcador final. Van en ficheros
 * distintos por lo mismo de siempre — cada uno solo crece, y el pick original
 * no se toca nunca.
 */
const conResultado = new Set(leerResultados().map((r) => r.pickId));
const sinResolver = estado.auditorias
  .filter((a) => a.valido && !conResultado.has(a.pick.id))
  .map((a) => a.pick)
  .filter((p) => new Date(p.comienzo) <= new Date());

if (sinResolver.length > 0) {
  console.log(`\n${sinResolver.length} pick(s) sin resultado. Consultando marcadores...`);
  let resueltos = 0;
  const porDeporte = new Map<Deporte, Pick[]>();
  for (const p of sinResolver) {
    porDeporte.set(p.deporte, [...(porDeporte.get(p.deporte) ?? []), p]);
  }

  for (const [deporte, picks] of porDeporte) {
    try {
      const marcadores = new Map(
        (await api.resultados(deporte, 3)).map((r) => [r.eventoId, r]),
      );
      for (const pick of picks) {
        const m = marcadores.get(pick.eventoId);
        if (!m || !m.terminado) continue;

        // Solo moneyline por ahora: hándicap y totales necesitan la línea.
        if (pick.mercado !== 'moneyline') {
          console.log(`  ${pick.id}  ${pick.mercado} aún no se resuelve automáticamente`);
          continue;
        }

        const desenlace = resolverMoneyline(pick.lado, m.marcador, esFutbol(pick.deporte));
        if (desenlace === null) {
          console.log(`  ${pick.id}  marcador no concluyente, se deja sin resolver`);
          continue;
        }

        const marcador = m.marcador.map((x) => `${x.equipo} ${x.puntos}`).join(' — ');
        anadirResultado({
          pickId: pick.id,
          desenlace,
          marcador,
          capturadoEn: m.actualizadoEn.toISOString(),
          proveedor: api.nombre,
        });
        resueltos++;
        console.log(`  ${pick.id}  ${desenlace.toUpperCase()}  ${marcador}`);
      }
    } catch (fallo) {
      if (fallo instanceof ErrorCuotaAgotada) {
        console.error('\nCuota agotada al pedir marcadores. Se retoma en la próxima pasada.');
        break;
      }
      console.error(`  ${deporte}: ${fallo instanceof Error ? fallo.message : String(fallo)}`);
    }
  }
  console.log(`\n${resueltos} resultado(s) capturados.`);
}
