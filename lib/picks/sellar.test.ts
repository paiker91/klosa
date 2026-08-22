import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sellarEnGit } from './sellar';

const git = (dir: string, ...args: string[]) =>
  execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

describe('sellado en git', () => {
  let repo: string;
  let remoto: string;

  beforeEach(() => {
    // Un remoto desnudo local hace que el push sea real, no simulado.
    remoto = mkdtempSync(join(tmpdir(), 'klosa-remoto-'));
    git(remoto, 'init', '--bare', '-q', '-b', 'main');

    repo = mkdtempSync(join(tmpdir(), 'klosa-repo-'));
    git(repo, 'init', '-q', '-b', 'main');
    git(repo, 'config', 'user.name', 'Prueba');
    git(repo, 'config', 'user.email', 'prueba@ejemplo.es');
    writeFileSync(join(repo, 'picks.jsonl'), '');
    writeFileSync(join(repo, 'cierres.jsonl'), '');
    git(repo, 'add', '-A');
    git(repo, 'commit', '-q', '-m', 'inicial');
    git(repo, 'remote', 'add', 'origin', remoto);
    git(repo, 'push', '-q', '-u', 'origin', 'main');
  });

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
    rmSync(remoto, { recursive: true, force: true });
  });

  it('confirma y empuja cuando hay un pick nuevo', () => {
    appendFileSync(join(repo, 'picks.jsonl'), '{"id":"abc"}\n');
    const r = sellarEnGit(repo, 'pick: prueba');

    expect(r.sellado).toBe(true);
    expect(r.commit).toMatch(/^[0-9a-f]{7,}$/);
    // Y está de verdad en el remoto, no solo en local.
    expect(git(remoto, 'log', '--format=%s', '-1')).toContain('pick: prueba');
  });

  it('no crea un commit vacío cuando no hay nada nuevo', () => {
    const r = sellarEnGit(repo, 'pick: nada');
    expect(r.sellado).toBe(false);
    expect(r.motivo).toMatch(/No hay cambios/i);
  });

  it('avisa cuando la carpeta no es un repositorio', () => {
    const suelta = mkdtempSync(join(tmpdir(), 'klosa-suelta-'));
    try {
      const r = sellarEnGit(suelta, 'pick: x');
      expect(r.sellado).toBe(false);
      expect(r.motivo).toMatch(/no es un repositorio git/i);
    } finally {
      rmSync(suelta, { recursive: true, force: true });
    }
  });

  /*
   * Si el push falla, el commit local se CONSERVA. Deshacerlo dejaría el pick
   * anotado en el fichero pero sin rastro en git, que es exactamente lo
   * contrario de lo que busca este registro.
   */
  it('conserva el commit local aunque el push falle', () => {
    git(repo, 'remote', 'set-url', 'origin', join(tmpdir(), 'remoto-que-no-existe'));
    appendFileSync(join(repo, 'picks.jsonl'), '{"id":"def"}\n');

    const r = sellarEnGit(repo, 'pick: sin remoto');
    expect(r.sellado).toBe(false);
    expect(r.commit).toBeDefined();
    expect(r.motivo).toMatch(/push falló/i);
    expect(git(repo, 'log', '--format=%s', '-1')).toContain('pick: sin remoto');
  });
});
