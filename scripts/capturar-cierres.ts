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
import { ErrorCuotaAgotada } from '../lib/cuotas/dominio';
import { estadoDelRegistro, anadirCierre } from '../lib/picks/registro';
import { analizarApuesta } from '../lib/clv';

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
     * Emparejamiento estricto por etiqueta. El proveedor devuelve los dos
     * lados; hay que saber cuál es el apostado para no invertir el cálculo.
     */
    const normal = (s: string) => s.trim().toLowerCase();
    const esA = normal(cierre.ladoA.etiqueta) === normal(pick.lado);
    const esB = normal(cierre.ladoB.etiqueta) === normal(pick.lado);

    if (!esA && !esB) {
      sinEmparejar.push(
        `${pick.id}: el lado "${pick.lado}" no coincide con "${cierre.ladoA.etiqueta}" ni "${cierre.ladoB.etiqueta}"`,
      );
      continue;
    }

    const tomado = esA ? cierre.ladoA : cierre.ladoB;
    const contrario = esA ? cierre.ladoB : cierre.ladoA;

    anadirCierre({
      pickId: pick.id,
      capturadoEn: cierre.capturadoEn.toISOString(),
      cuotaLadoTomado: tomado.cuota,
      cuotaLadoContrario: contrario.cuota,
      casa: cierre.casa,
      proveedor: api.nombre,
    });
    capturados++;

    const analisis = analizarApuesta(pick.cuotaTomada, tomado.cuota, contrario.cuota);
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
