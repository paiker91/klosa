/**
 * Comprueba que producción NO está bloqueando la indexación.
 *
 *   npm run comprobar-indexacion -- https://klosa.app/pt/calculadora-clv
 *
 * Existe por un fallo real: en un proyecto anterior, un `noindex` heredado del
 * entorno de preview se coló en producción y bloqueó Google durante meses. No
 * da ningún síntoma visible — la web funciona, simplemente no aparece.
 *
 * Ejecutar después de CADA despliegue a producción. Sale con código 1 si algo
 * bloquea, para que se pueda encadenar en CI.
 */

const url = process.argv[2];
if (!url) {
  console.error('Uso: npm run comprobar-indexacion -- <url de producción>');
  process.exit(1);
}

const problemas = [];
const bien = [];

let res;
try {
  res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(30_000) });
} catch (e) {
  console.error(`No se pudo acceder a ${url}: ${e.message}`);
  process.exit(1);
}

if (!res.ok) problemas.push(`La página responde HTTP ${res.status}.`);
else bien.push(`HTTP ${res.status}`);

// 1. Cabecera X-Robots-Tag
const cabecera = res.headers.get('x-robots-tag');
if (cabecera && /noindex|none/i.test(cabecera)) {
  problemas.push(`Cabecera X-Robots-Tag bloquea la indexación: "${cabecera}"`);
} else {
  bien.push(`X-Robots-Tag: ${cabecera ?? '(ausente, correcto)'}`);
}

const html = await res.text();

// 2. Meta robots en el HTML
const metas = [...html.matchAll(/<meta[^>]+name=["']robots["'][^>]*>/gi)].map((m) => m[0]);
const metaMala = metas.find((m) => /noindex|none/i.test(m));
if (metaMala) problemas.push(`Meta robots bloquea la indexación: ${metaMala.trim()}`);
else bien.push(`meta robots: ${metas.length ? metas.join(' ') : '(ausente, correcto)'}`);

// 3. Canonical y hreflang, que es la otra forma de tirar el SEO sin enterarse
const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1];
if (!canonical) problemas.push('Falta la etiqueta canonical.');
else bien.push(`canonical: ${canonical}`);

const hreflangs = [...html.matchAll(/hreflang=["']([^"']+)["']/gi)].map((m) => m[1]);
if (hreflangs.length < 3) {
  problemas.push(`Solo ${hreflangs.length} hreflang; se esperaban 3 (pt-BR, es, en).`);
} else {
  bien.push(`hreflang: ${[...new Set(hreflangs)].join(', ')}`);
}

// 4. Que el contenido esté en el HTML servido, no solo tras ejecutar JavaScript
const textoVisible = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ');
if (textoVisible.replace(/\s+/g, ' ').trim().length < 1000) {
  problemas.push('El HTML servido apenas trae texto: el contenido depende de JavaScript.');
} else {
  bien.push(`texto en el HTML servido: ${textoVisible.replace(/\s+/g, ' ').trim().length} caracteres`);
}

console.log(`\nComprobando ${url}\n${'─'.repeat(58)}`);
for (const b of bien) console.log(`  ok   ${b}`);
for (const p of problemas) console.log(`  MAL  ${p}`);
console.log('─'.repeat(58));

if (problemas.length) {
  console.log(`\n${problemas.length} problema(s). Esta página no se va a indexar bien.`);
  process.exit(1);
}
console.log('\nNada bloquea la indexación.');
