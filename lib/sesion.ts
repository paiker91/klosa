/**
 * Sesión del panel privado.
 *
 * Un solo usuario, así que no hay cuentas ni base de datos: una contraseña
 * comparada en tiempo constante y una cookie firmada con HMAC que el servidor
 * puede validar sin guardar estado. En Vercel cada petición puede caer en una
 * instancia distinta, así que la cookie tiene que valerse por sí misma.
 *
 * Lo que protege esto no es información privada: es la capacidad de escribir
 * en un registro público. Un pick falso ahí valdría más que cualquier dato
 * que se pudiera leer.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

const DURACION_MS = 30 * 24 * 3600 * 1000;
export const COOKIE_SESION = 'klosa_panel';

/** Compara sin filtrar por tiempo cuántos caracteres coincidían. */
export function iguales(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

const firmar = (secreto: string, dato: string): string =>
  createHmac('sha256', secreto).update(dato).digest('hex');

/** Token autovalidable: caducidad + firma. */
export function crearToken(secreto: string, ahora = Date.now()): string {
  const caduca = String(ahora + DURACION_MS);
  return `${caduca}.${firmar(secreto, caduca)}`;
}

export function tokenValido(secreto: string, token: string | undefined, ahora = Date.now()): boolean {
  if (!token) return false;
  const [caduca, firma] = token.split('.');
  if (!caduca || !firma) return false;
  if (!iguales(firma, firmar(secreto, caduca))) return false;
  const limite = Number(caduca);
  return Number.isFinite(limite) && limite > ahora;
}

export interface ConfiguracionPanel {
  password: string;
  secreto: string;
  tokenGitHub: string;
  repo: string;
  claveOdds: string;
}

/**
 * Lee la configuración del entorno. Devuelve `null` si falta algo, para que la
 * página lo diga con claridad en vez de fallar a medias.
 */
export function configuracionPanel(): { config: ConfiguracionPanel | null; faltan: string[] } {
  const requeridas = {
    PANEL_PASSWORD: process.env.PANEL_PASSWORD,
    PANEL_SECRETO: process.env.PANEL_SECRETO,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    THE_ODDS_API_KEY: process.env.THE_ODDS_API_KEY,
  };
  const faltan = Object.entries(requeridas)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (faltan.length > 0) return { config: null, faltan };

  return {
    config: {
      password: requeridas.PANEL_PASSWORD as string,
      secreto: requeridas.PANEL_SECRETO as string,
      tokenGitHub: requeridas.GITHUB_TOKEN as string,
      repo: process.env.NEXT_PUBLIC_REPO_PICKS ?? 'paiker91/klosa-picks',
      claveOdds: requeridas.THE_ODDS_API_KEY as string,
    },
    faltan: [],
  };
}
