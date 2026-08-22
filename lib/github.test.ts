import { describe, it, expect } from 'vitest';
import { anadirLinea, ErrorGitHub } from './github';

const opciones = { token: 't', repo: 'usuario/repo' };

/** fetch falso que responde según el método de la petición. */
const conRespuestas = (
  respuestas: Partial<Record<'GET' | 'PUT', () => Response>>,
): typeof fetch =>
  (async (_url: string | URL, init?: RequestInit) => {
    const metodo = (init?.method ?? 'GET') as 'GET' | 'PUT';
    const r = respuestas[metodo];
    if (!r) throw new Error(`sin respuesta para ${metodo}`);
    return r();
  }) as typeof fetch;

const conFetch = async <T>(f: typeof fetch, accion: () => Promise<T>) => {
  const original = globalThis.fetch;
  globalThis.fetch = f;
  try {
    return await accion();
  } finally {
    globalThis.fetch = original;
  }
};

const contenido = (texto: string) =>
  new Response(JSON.stringify({ content: Buffer.from(texto).toString('base64'), sha: 'abc' }), {
    status: 200,
  });

const escrito = () =>
  new Response(JSON.stringify({ commit: { sha: '0123456789abcdef' } }), { status: 200 });

describe('escritura en GitHub', () => {
  it('añade al final sin pisar lo anterior', async () => {
    let enviado = '';
    const f = (async (_u: string | URL, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'GET') return contenido('{"id":"uno"}\n');
      enviado = Buffer.from(
        JSON.parse(String(init?.body)).content as string,
        'base64',
      ).toString('utf8');
      return escrito();
    }) as typeof fetch;

    const sha = await conFetch(f, () =>
      anadirLinea(opciones, 'picks.jsonl', '{"id":"dos"}', 'pick'),
    );
    expect(enviado).toBe('{"id":"uno"}\n{"id":"dos"}\n');
    expect(sha).toBe('0123456');
  });

  it('crea el fichero si aún no existe', async () => {
    let enviado = '';
    const f = (async (_u: string | URL, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'GET') return new Response('', { status: 404 });
      enviado = Buffer.from(
        JSON.parse(String(init?.body)).content as string,
        'base64',
      ).toString('utf8');
      return escrito();
    }) as typeof fetch;

    await conFetch(f, () => anadirLinea(opciones, 'picks.jsonl', '{"id":"uno"}', 'pick'));
    expect(enviado).toBe('{"id":"uno"}\n');
  });

  /*
   * El mensaje de un 403 tiene que decir qué arreglar. El texto crudo de
   * GitHub describe el síntoma y deja al usuario mirando un formulario de
   * treinta permisos sin saber cuál falta.
   */
  it('traduce el 403 a instrucciones accionables', async () => {
    const f = conRespuestas({ GET: () => new Response('{}', { status: 403 }) });
    await expect(
      conFetch(f, () => anadirLinea(opciones, 'picks.jsonl', 'x', 'm')),
    ).rejects.toThrow(/Contents con Read and write/);
  });

  it('distingue el token caducado del token sin permisos', async () => {
    const f = conRespuestas({ GET: () => new Response('{}', { status: 401 }) });
    await expect(
      conFetch(f, () => anadirLinea(opciones, 'picks.jsonl', 'x', 'm')),
    ).rejects.toThrow(/caducado o haberse revocado/);
  });

  it('reintenta cuando otra escritura gana la carrera', async () => {
    let intentos = 0;
    const f = (async (_u: string | URL, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'GET') return contenido('');
      return ++intentos < 2 ? new Response('', { status: 409 }) : escrito();
    }) as typeof fetch;

    expect(await conFetch(f, () => anadirLinea(opciones, 'picks.jsonl', 'x', 'm'))).toBe('0123456');
    expect(intentos).toBe(2);
  });

  it('se rinde con mensaje claro si la carrera no se resuelve', async () => {
    const f = conRespuestas({
      GET: () => contenido(''),
      PUT: () => new Response('', { status: 409 }),
    });
    await expect(
      conFetch(f, () => anadirLinea(opciones, 'picks.jsonl', 'x', 'm')),
    ).rejects.toThrow(ErrorGitHub);
  });
});
