/**
 * Sella el registro en git: añade, confirma y empuja.
 *
 * No es comodidad, es integridad. La marca de tiempo que vale no es la del
 * fichero local —esa la controla quien escribe— sino la del momento en que
 * GitHub recibe el push. Cuanto menos tiempo pase entre anotar el pick y
 * empujarlo, más estrecha es la ventana que un escéptico puede cuestionar.
 *
 * Hacerlo a mano significa, en la práctica, hacerlo tarde o no hacerlo.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

export interface ResultadoSellado {
  sellado: boolean;
  motivo?: string;
  commit?: string;
}

const git = (dir: string, ...args: string[]): string =>
  execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/**
 * @param directorio Carpeta del registro (la que contiene picks.jsonl).
 * @param mensaje    Mensaje del commit.
 */
export function sellarEnGit(directorio: string, mensaje: string): ResultadoSellado {
  const raiz = existsSync(join(directorio, '.git')) ? directorio : dirname(directorio);
  if (!existsSync(join(raiz, '.git'))) {
    return { sellado: false, motivo: `${raiz} no es un repositorio git.` };
  }

  try {
    git(raiz, 'add', 'picks.jsonl', 'cierres.jsonl');
    if (git(raiz, 'diff', '--cached', '--name-only') === '') {
      return { sellado: false, motivo: 'No hay cambios que sellar.' };
    }
    git(raiz, 'commit', '-m', mensaje);
    const commit = git(raiz, 'rev-parse', '--short', 'HEAD');

    try {
      git(raiz, 'push');
    } catch (fallo) {
      /*
       * El commit ya existe: se avisa pero no se deshace. Deshacerlo dejaría
       * el pick anotado sin rastro en git, que es lo contrario de lo que se
       * busca. Basta con empujar más tarde.
       */
      return {
        sellado: false,
        commit,
        motivo: `Confirmado en local (${commit}) pero el push falló: ${
          fallo instanceof Error ? fallo.message.split('\n')[0] : String(fallo)
        }. Ejecute "git push" cuando pueda.`,
      };
    }
    return { sellado: true, commit };
  } catch (fallo) {
    return {
      sellado: false,
      motivo: fallo instanceof Error ? fallo.message.split('\n')[0] : String(fallo),
    };
  }
}
