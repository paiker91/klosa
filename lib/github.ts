/**
 * Escribe en el repositorio del registro a través de la API de GitHub.
 *
 * Es lo que permite anotar un pick desde el móvil sin terminal. El commit sigue
 * quedando en el historial público con su fecha, que es la marca de tiempo que
 * de verdad importa.
 *
 * La API de contenidos no sabe añadir al final: hay que leer el fichero con su
 * `sha` y volver a escribirlo entero. Eso abre una carrera si dos escrituras
 * coinciden — por ejemplo con el workflow que captura cierres — y por eso se
 * reintenta ante el 409 en vez de perder el pick.
 */
const API = 'https://api.github.com';

export class ErrorGitHub extends Error {
  constructor(
    mensaje: string,
    readonly estado?: number,
  ) {
    super(mensaje);
    this.name = 'ErrorGitHub';
  }
}

export interface OpcionesGitHub {
  token: string;
  /** `usuario/repositorio` */
  repo: string;
  rama?: string;
}

interface RespuestaContenido {
  content: string;
  sha: string;
}

async function pedir<T>(
  { token }: OpcionesGitHub,
  ruta: string,
  init: RequestInit = {},
): Promise<{ datos: T | null; estado: number }> {
  const res = await fetch(`${API}${ruta}`, {
    ...init,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  if (res.status === 404 || res.status === 409) return { datos: null, estado: res.status };
  if (!res.ok) {
    const cuerpo = await res.text();
    throw new ErrorGitHub(`GitHub respondió ${res.status}: ${cuerpo.slice(0, 200)}`, res.status);
  }
  return { datos: (await res.json()) as T, estado: res.status };
}

/**
 * Añade una línea al final de un fichero y lo confirma.
 * Devuelve el sha corto del commit.
 */
export async function anadirLinea(
  opciones: OpcionesGitHub,
  fichero: string,
  linea: string,
  mensaje: string,
  intentos = 3,
): Promise<string> {
  const rama = opciones.rama ?? 'main';
  const base = `/repos/${opciones.repo}/contents/${fichero}`;

  for (let i = 0; i < intentos; i++) {
    const { datos } = await pedir<RespuestaContenido>(opciones, `${base}?ref=${rama}`);

    const actual = datos ? Buffer.from(datos.content, 'base64').toString('utf8') : '';
    // Un registro por línea: se respeta el salto final y nunca se pisa lo anterior.
    const nuevo = actual.trim() === '' ? `${linea}\n` : `${actual.replace(/\n*$/, '\n')}${linea}\n`;

    const cuerpo: Record<string, string> = {
      message: mensaje,
      content: Buffer.from(nuevo, 'utf8').toString('base64'),
      branch: rama,
    };
    if (datos) cuerpo.sha = datos.sha;

    const respuesta = await pedir<{ commit: { sha: string } }>(opciones, base, {
      method: 'PUT',
      body: JSON.stringify(cuerpo),
    });

    if (respuesta.estado === 409) continue; // otra escritura ganó la carrera
    const sha = respuesta.datos?.commit.sha;
    if (sha) return sha.slice(0, 7);
  }

  throw new ErrorGitHub('No se pudo escribir tras varios intentos: hay escrituras simultáneas.');
}
