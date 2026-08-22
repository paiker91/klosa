import { describe, it, expect } from 'vitest';
import {
  crearToken,
  tokenValido,
  iguales,
  COOKIE_SESION,
  SIN_INTENTOS,
  INTENTOS_LIBRES,
  ESPERA_MAXIMA_MS,
  trasFallo,
  segundosDeBloqueo,
} from './sesion';

const SECRETO = 'secreto-de-prueba';

describe('sesión del panel', () => {
  it('acepta un token recién creado', () => {
    expect(tokenValido(SECRETO, crearToken(SECRETO))).toBe(true);
  });

  it('rechaza un token caducado', () => {
    const hace40dias = Date.now() - 40 * 24 * 3600 * 1000;
    expect(tokenValido(SECRETO, crearToken(SECRETO, hace40dias))).toBe(false);
  });

  /*
   * Lo que protege esta firma no es información privada: es la capacidad de
   * escribir en un registro público. Un pick falso ahí valdría más que
   * cualquier dato que se pudiera leer.
   */
  it('rechaza un token firmado con otro secreto', () => {
    expect(tokenValido(SECRETO, crearToken('otro-secreto'))).toBe(false);
  });

  it('rechaza una firma manipulada', () => {
    const t = crearToken(SECRETO);
    const [caduca] = t.split('.');
    expect(tokenValido(SECRETO, `${caduca}.0000`)).toBe(false);
  });

  it('rechaza basura y ausencia', () => {
    expect(tokenValido(SECRETO, undefined)).toBe(false);
    expect(tokenValido(SECRETO, '')).toBe(false);
    expect(tokenValido(SECRETO, 'sin-punto')).toBe(false);
    expect(tokenValido(SECRETO, 'no-numero.abc')).toBe(false);
  });

  it('compara contraseñas sin filtrar por longitud parcial', () => {
    expect(iguales('abc', 'abc')).toBe(true);
    expect(iguales('abc', 'abd')).toBe(false);
    expect(iguales('abc', 'abcd')).toBe(false);
    expect(iguales('', '')).toBe(true);
  });

  it('la cookie tiene nombre estable', () => {
    expect(COOKIE_SESION).toBe('klosa_panel');
  });
});

describe('freno a la fuerza bruta', () => {
  const AHORA = 1_000_000;

  it('los primeros intentos no bloquean: quien teclea mal no se queda fuera', () => {
    let estado = SIN_INTENTOS;
    for (let i = 0; i < INTENTOS_LIBRES - 1; i++) estado = trasFallo(estado, AHORA);
    expect(segundosDeBloqueo(estado, AHORA)).toBe(0);
  });

  it('al quinto fallo bloquea un minuto', () => {
    let estado = SIN_INTENTOS;
    for (let i = 0; i < INTENTOS_LIBRES; i++) estado = trasFallo(estado, AHORA);
    expect(segundosDeBloqueo(estado, AHORA)).toBe(60);
  });

  it('cada fallo posterior dobla la espera, con techo', () => {
    let estado = SIN_INTENTOS;
    for (let i = 0; i < INTENTOS_LIBRES + 2; i++) estado = trasFallo(estado, AHORA);
    expect(segundosDeBloqueo(estado, AHORA)).toBe(240);

    for (let i = 0; i < 20; i++) estado = trasFallo(estado, AHORA);
    expect(segundosDeBloqueo(estado, AHORA)).toBe(ESPERA_MAXIMA_MS / 1000);
  });

  it('el bloqueo se agota solo con el tiempo', () => {
    let estado = SIN_INTENTOS;
    for (let i = 0; i < INTENTOS_LIBRES; i++) estado = trasFallo(estado, AHORA);
    expect(segundosDeBloqueo(estado, AHORA + 61_000)).toBe(0);
  });
});
