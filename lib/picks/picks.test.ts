import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crearPick, auditar, sellar, esperandoCierre, type Pick } from './dominio';
import {
  anadirPick,
  anadirCierre,
  leerPicks,
  estadoDelRegistro,
  resolverMoneyline,
} from './registro';

const base = (extra: Partial<Omit<Pick, 'id'>> = {}) => ({
  registradoEn: '2026-10-20T12:00:00.000Z',
  deporte: 'NBA' as const,
  eventoId: 'evt-1',
  local: 'Detroit Pistons',
  visitante: 'Boston Celtics',
  comienzo: '2026-10-20T19:00:00.000Z',
  mercado: 'moneyline' as const,
  lado: 'Boston Celtics',
  cuotaTomada: 2.1,
  stake: null,
  casa: null,
  nota: null,
  ...extra,
});

describe('sello de contenido', () => {
  it('el mismo contenido da el mismo sello', () => {
    expect(sellar(base())).toBe(sellar(base()));
  });

  /*
   * El punto entero del sello: retocar una cuota a posteriori lo rompe, así que
   * la auditoría lo detecta aunque el fichero se haya editado a mano.
   */
  it('cambiar la cuota rompe el sello', () => {
    const pick = crearPick(base());
    const retocado: Pick = { ...pick, cuotaTomada: 3.5 };
    expect(auditar(retocado).motivos).toContain('sello_roto');
    expect(auditar(retocado).valido).toBe(false);
  });

  it('cambiar el lado también lo rompe', () => {
    const pick = crearPick(base());
    expect(auditar({ ...pick, lado: 'Detroit Pistons' }).motivos).toContain('sello_roto');
  });

  it('un pick recién creado pasa la auditoría', () => {
    expect(auditar(crearPick(base())).valido).toBe(true);
  });
});

describe('la regla que sostiene el registro', () => {
  it('rechaza un pick registrado después del comienzo', () => {
    const tarde = crearPick(base({ registradoEn: '2026-10-20T20:00:00.000Z' }));
    expect(auditar(tarde).motivos).toContain('registrado_despues_del_comienzo');
  });

  it('rechaza un pick registrado exactamente al comienzo', () => {
    const justo = crearPick(base({ registradoEn: '2026-10-20T19:00:00.000Z' }));
    expect(auditar(justo).motivos).toContain('registrado_despues_del_comienzo');
  });

  it('acepta un pick registrado un minuto antes', () => {
    expect(auditar(crearPick(base({ registradoEn: '2026-10-20T18:59:00.000Z' }))).valido).toBe(true);
  });

  it('rechaza fechas ilegibles en vez de darlas por buenas', () => {
    expect(auditar(crearPick(base({ comienzo: 'mañana' }))).motivos).toContain(
      'registrado_despues_del_comienzo',
    );
  });
});

describe('otras invalideces', () => {
  it('detecta una cuota imposible', () => {
    expect(auditar(crearPick(base({ cuotaTomada: 0.5 }))).motivos).toContain('cuota_invalida');
  });

  it('detecta campos vacíos', () => {
    expect(auditar(crearPick(base({ lado: '   ' }))).motivos).toContain('campos_incompletos');
  });

  it('acumula todos los motivos, no solo el primero', () => {
    const roto: Pick = { ...crearPick(base()), cuotaTomada: 0.5, lado: '' };
    const a = auditar(roto);
    expect(a.motivos.length).toBeGreaterThan(1);
  });
});

describe('cuándo toca capturar', () => {
  it('no antes del comienzo', () => {
    expect(esperandoCierre(crearPick(base()), new Date('2026-10-20T18:00:00Z'))).toBe(false);
  });
  it('sí después', () => {
    expect(esperandoCierre(crearPick(base()), new Date('2026-10-20T22:00:00Z'))).toBe(true);
  });
});

describe('ficheros de solo-añadir', () => {
  let dir: string;
  let rutaPicks: string;
  let rutaCierres: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'klosa-'));
    rutaPicks = join(dir, 'picks.jsonl');
    rutaCierres = join(dir, 'cierres.jsonl');
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('escribe y relee un pick', () => {
    const pick = crearPick(base());
    anadirPick(pick, rutaPicks);
    expect(leerPicks(rutaPicks)).toEqual([pick]);
  });

  it('conserva el orden de escritura', () => {
    const a = crearPick(base({ eventoId: 'a' }));
    const b = crearPick(base({ eventoId: 'b' }));
    anadirPick(a, rutaPicks);
    anadirPick(b, rutaPicks);
    expect(leerPicks(rutaPicks).map((p) => p.eventoId)).toEqual(['a', 'b']);
  });

  it('rechaza el mismo pick dos veces', () => {
    const pick = crearPick(base());
    anadirPick(pick, rutaPicks);
    expect(() => anadirPick(pick, rutaPicks)).toThrow(/Ya existe/);
  });

  it('rechaza capturar dos veces el mismo cierre', () => {
    const cierre = {
      pickId: 'x',
      capturadoEn: '2026-10-20T19:00:00.000Z',
      lados: ['Visitante', 'Local'],
      cuotas: [2.0, 1.9],
      indiceTomado: 0,
      casa: 'FanDuel',
      proveedor: 'the-odds-api',
    };
    anadirCierre(cierre, rutaCierres);
    expect(() => anadirCierre(cierre, rutaCierres)).toThrow(/ya tiene cierre/);
  });

  it('devuelve vacío cuando el fichero no existe', () => {
    expect(leerPicks(join(dir, 'no-existe.jsonl'))).toEqual([]);
  });

  it('señala la línea concreta cuando el JSON está corrupto', () => {
    anadirPick(crearPick(base()), rutaPicks);
    require('node:fs').appendFileSync(rutaPicks, 'esto no es json\n');
    expect(() => leerPicks(rutaPicks)).toThrow(/línea 2/);
  });
});

describe('estado del registro', () => {
  let dir: string;
  let rutaPicks: string;
  let rutaCierres: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'klosa-'));
    rutaPicks = join(dir, 'picks.jsonl');
    rutaCierres = join(dir, 'cierres.jsonl');
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('marca como pendiente lo que ya empezó y no tiene cierre', () => {
    anadirPick(crearPick(base()), rutaPicks);
    const e = estadoDelRegistro(new Date('2026-10-20T22:00:00Z'), rutaPicks, rutaCierres);
    expect(e.resumen.pendientes).toBe(1);
  });

  it('no considera pendiente lo que aún no ha empezado', () => {
    anadirPick(crearPick(base()), rutaPicks);
    const e = estadoDelRegistro(new Date('2026-10-20T15:00:00Z'), rutaPicks, rutaCierres);
    expect(e.resumen.pendientes).toBe(0);
  });

  /*
   * Capturar el cierre de un pick con el sello roto le daría apariencia de
   * legitimidad a un dato que ya sabemos que no es de fiar.
   */
  it('nunca intenta cerrar un pick que no pasa la auditoría', () => {
    const pick = crearPick(base());
    anadirPick({ ...pick, cuotaTomada: 9.9 }, rutaPicks);
    const e = estadoDelRegistro(new Date('2026-10-20T22:00:00Z'), rutaPicks, rutaCierres);
    expect(e.resumen.invalidos).toBe(1);
    expect(e.resumen.pendientes).toBe(0);
  });

  it('cuenta los que ya tienen cierre', () => {
    const pick = crearPick(base());
    anadirPick(pick, rutaPicks);
    anadirCierre(
      {
        pickId: pick.id,
        capturadoEn: '2026-10-20T19:00:00.000Z',
        lados: ['Visitante', 'Local'],
        cuotas: [2.0, 1.9],
        indiceTomado: 0,
        casa: 'FanDuel',
        proveedor: 'the-odds-api',
      },
      rutaCierres,
    );
    const e = estadoDelRegistro(new Date('2026-10-20T22:00:00Z'), rutaPicks, rutaCierres);
    expect(e.resumen.conCierre).toBe(1);
    expect(e.resumen.pendientes).toBe(0);
  });
});

/*
 * El stake entra en el sello: cambiarlo a posteriori falsearía el registro
 * igual que cambiar una cuota. Se añadió el 2026-08-22, con el registro
 * vacío — tocar la lista de campos sellados invalida todos los sellos
 * anteriores, así que a partir del primer pick real ya no se puede.
 */
describe('el stake forma parte del sello', () => {
  it('cambiarlo rompe el sello', () => {
    const pick = crearPick(base({ stake: 1 }));
    expect(auditar({ ...pick, stake: 10 }).motivos).toContain('sello_roto');
  });

  it('distingue sin stake de stake cero declarado', () => {
    expect(sellar(base({ stake: null }))).not.toBe(sellar(base({ stake: 1 })));
  });

  it('un pick con stake pasa la auditoría', () => {
    expect(auditar(crearPick(base({ stake: 2.5 }))).valido).toBe(true);
  });
});

/*
 * Resolver mal una apuesta falsearía el registro tanto como editar una cuota.
 * Ante un marcador dudoso se deja sin resolver en vez de adivinar.
 */
describe('resolución del moneyline', () => {
  const m = (a: number, b: number) => [
    { equipo: 'Boston Celtics', puntos: a },
    { equipo: 'Detroit Pistons', puntos: b },
  ];

  it('gana quien marca más', () => {
    expect(resolverMoneyline('Boston Celtics', m(10, 9))).toBe('ganada');
    expect(resolverMoneyline('Boston Celtics', m(9, 10))).toBe('perdida');
  });

  it('no resuelve un empate', () => {
    expect(resolverMoneyline('Boston Celtics', m(10, 10))).toBeNull();
  });

  it('no resuelve un marcador incompleto', () => {
    expect(resolverMoneyline('Boston Celtics', [{ equipo: 'Boston Celtics', puntos: 10 }])).toBeNull();
  });

  it('no resuelve si el lado apostado no está en el marcador', () => {
    expect(resolverMoneyline('Los Angeles Lakers', m(10, 9))).toBeNull();
  });

  it('tolera diferencias de mayúsculas y espacios', () => {
    expect(resolverMoneyline('  boston celtics ', m(10, 9))).toBe('ganada');
  });
});

describe('resolución con empate: fútbol', () => {
  const m = (a: number, b: number) => [
    { equipo: 'Fluminense', puntos: a },
    { equipo: 'Remo', puntos: b },
  ];

  it('sin empate posible, un marcador igualado es partido sin terminar', () => {
    expect(resolverMoneyline('Fluminense', m(1, 1), false)).toBeNull();
  });

  it('con empate posible, un marcador igualado resuelve los tres lados', () => {
    expect(resolverMoneyline('Draw', m(1, 1), true)).toBe('ganada');
    expect(resolverMoneyline('Fluminense', m(1, 1), true)).toBe('perdida');
    expect(resolverMoneyline('Remo', m(1, 1), true)).toBe('perdida');
  });

  it('el empate apostado y no dado es perdida, gane quien gane', () => {
    expect(resolverMoneyline('Draw', m(2, 0), true)).toBe('perdida');
    expect(resolverMoneyline('Draw', m(0, 2), true)).toBe('perdida');
  });

  it('los equipos se resuelven igual que siempre cuando hay ganador', () => {
    expect(resolverMoneyline('Fluminense', m(2, 0), true)).toBe('ganada');
    expect(resolverMoneyline('Remo', m(2, 0), true)).toBe('perdida');
  });

  it('un lado que no es del partido sigue sin resolverse', () => {
    expect(resolverMoneyline('Palmeiras', m(2, 0), true)).toBeNull();
  });
});
