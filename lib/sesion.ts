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

// ---------------------------------------------------------------------------
// Freno a la fuerza bruta
// ---------------------------------------------------------------------------

/**
 * La entrada del panel es una sola contraseña, y ahora hay un enlace público
 * hacia ella. Sin freno, probar contraseñas sale gratis.
 *
 * El contador es global y no por IP a propósito: el panel tiene un solo
 * usuario, así que un contador global es más estricto que uno por dirección,
 * que se esquiva rotando IPs. La contrapartida es que alguien puede dejarme
 * fuera un rato fallando adrede; por eso el bloqueo es corto, se dobla solo
 * hasta un techo y desaparece con un acierto.
 */
export const INTENTOS_LIBRES = 5;
export const ESPERA_INICIAL_MS = 60_000;
export const ESPERA_MAXIMA_MS = 15 * 60_000;

export interface Intentos {
  fallos: number;
  /** Instante hasta el que no se admite ni un intento más. */
  bloqueadoHasta: number;
}

export const SIN_INTENTOS: Intentos = { fallos: 0, bloqueadoHasta: 0 };

/** Segundos que faltan para poder volver a probar. 0 si se puede ya. */
export function segundosDeBloqueo(intentos: Intentos, ahora: number): number {
  return Math.max(0, Math.ceil((intentos.bloqueadoHasta - ahora) / 1000));
}

export function trasFallo(intentos: Intentos, ahora: number): Intentos {
  const fallos = intentos.fallos + 1;
  if (fallos < INTENTOS_LIBRES) return { fallos, bloqueadoHasta: intentos.bloqueadoHasta };

  /*
   * El primer bloqueo es de un minuto y se dobla en cada fallo posterior. Un
   * minuto no molesta a quien se equivoca tecleando, y basta para que probar
   * el diccionario deje de ser viable.
   */
  const espera = Math.min(
    ESPERA_MAXIMA_MS,
    ESPERA_INICIAL_MS * 2 ** (fallos - INTENTOS_LIBRES),
  );
  return { fallos, bloqueadoHasta: ahora + espera };
}
