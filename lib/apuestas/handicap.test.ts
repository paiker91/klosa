import { describe, it, expect } from 'vitest';
import { separarLinea, resolverHandicap, resolverTotal } from './handicap';

/** Boston gana de 6: 110 a 104. Margen +6 para Boston, −6 para Detroit. */
const PARTIDO = [
  { equipo: 'Boston Celtics', puntos: 110 },
  { equipo: 'Detroit Pistons', puntos: 104 },
];

describe('separar la línea de la etiqueta', () => {
  it('lee lo que produce el adaptador', () => {
    expect(separarLinea('Boston Celtics -1.5')).toEqual({ equipo: 'Boston Celtics', linea: -1.5 });
    expect(separarLinea('Detroit Pistons +2')).toEqual({ equipo: 'Detroit Pistons', linea: 2 });
  });

  it('aguanta nombres de varias palabras', () => {
    expect(separarLinea('Los Angeles Lakers -7.5')?.equipo).toBe('Los Angeles Lakers');
  });

  it('devuelve null cuando no hay línea que leer', () => {
    expect(separarLinea('Boston Celtics')).toBeNull();
    expect(separarLinea('')).toBeNull();
    expect(separarLinea('-1.5')).toBeNull();
  });
});

describe('hándicap de línea media: nunca empata', () => {
  it('el favorito cubre si gana por más que la línea', () => {
    expect(resolverHandicap('Boston Celtics', -5.5, PARTIDO)).toBe('ganada');
  });

  it('el favorito no cubre si gana por menos', () => {
    expect(resolverHandicap('Boston Celtics', -6.5, PARTIDO)).toBe('perdida');
  });

  it('el que recibe puntos gana si la derrota es menor que la línea', () => {
    expect(resolverHandicap('Detroit Pistons', 6.5, PARTIDO)).toBe('ganada');
    expect(resolverHandicap('Detroit Pistons', 5.5, PARTIDO)).toBe('perdida');
  });
});

describe('hándicap de línea entera: aquí sí hay push', () => {
  /*
   * El caso que más fácil se falsea. Ganar de 6 con −6 NO es ganar: es
   * empate a efectos de apuesta y se devuelve el dinero. Contarlo como
   * ganada infla el acierto y el yield a la vez.
   */
  it('ganar exactamente por la línea anula la apuesta', () => {
    expect(resolverHandicap('Boston Celtics', -6, PARTIDO)).toBe('anulada');
    expect(resolverHandicap('Detroit Pistons', 6, PARTIDO)).toBe('anulada');
  });

  it('por encima y por debajo resuelve normal', () => {
    expect(resolverHandicap('Boston Celtics', -5, PARTIDO)).toBe('ganada');
    expect(resolverHandicap('Boston Celtics', -7, PARTIDO)).toBe('perdida');
  });
});

describe('hándicap de cuarto: la apuesta se parte', () => {
  /*
   * −6,25 son dos mitades: −6 y −6,5. Con margen de 6, la de −6 empata y la de
   * −6,5 pierde. Media perdida: se devuelve la mitad del dinero.
   */
  it('media perdida cuando una mitad empata y la otra pierde', () => {
    expect(resolverHandicap('Boston Celtics', -6.25, PARTIDO)).toBe('media_perdida');
  });

  it('media ganada cuando una mitad empata y la otra gana', () => {
    // −5,75 son −5,5 y −6. Con margen 6: −5,5 gana, −6 empata.
    expect(resolverHandicap('Boston Celtics', -5.75, PARTIDO)).toBe('media_ganada');
  });

  it('las dos mitades del mismo lado dan un desenlace entero', () => {
    expect(resolverHandicap('Boston Celtics', -4.75, PARTIDO)).toBe('ganada');
    expect(resolverHandicap('Boston Celtics', -7.25, PARTIDO)).toBe('perdida');
  });
});

describe('lo que no se puede decidir, no se decide', () => {
  it('un equipo que no juega este partido', () => {
    expect(resolverHandicap('Miami Heat', -1.5, PARTIDO)).toBeNull();
  });

  it('un marcador incompleto', () => {
    expect(resolverHandicap('Boston Celtics', -1.5, [PARTIDO[0]!])).toBeNull();
  });

  it('una línea que no es un número', () => {
    expect(resolverHandicap('Boston Celtics', Number.NaN, PARTIDO)).toBeNull();
  });
});

describe('totales', () => {
  // 110 + 104 = 214 puntos.
  it('el Más gana por encima de la línea y pierde por debajo', () => {
    expect(resolverTotal('Over', 213.5, PARTIDO)).toBe('ganada');
    expect(resolverTotal('Over', 214.5, PARTIDO)).toBe('perdida');
  });

  it('el Menos es el espejo exacto', () => {
    expect(resolverTotal('Under', 214.5, PARTIDO)).toBe('ganada');
    expect(resolverTotal('Under', 213.5, PARTIDO)).toBe('perdida');
  });

  it('clavar la línea entera anula, no gana', () => {
    expect(resolverTotal('Over', 214, PARTIDO)).toBe('anulada');
    expect(resolverTotal('Under', 214, PARTIDO)).toBe('anulada');
  });

  it('las líneas de cuarto se parten también en los totales', () => {
    // 214,25 son 214 y 214,5. Con 214 exactos: la de 214 empata, la de 214,5 pierde.
    expect(resolverTotal('Over', 214.25, PARTIDO)).toBe('media_perdida');
    // 213,75 son 213,5 y 214: la primera gana, la segunda empata.
    expect(resolverTotal('Over', 213.75, PARTIDO)).toBe('media_ganada');
  });
});
