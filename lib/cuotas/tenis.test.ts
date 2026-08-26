import { describe, it, expect } from 'vitest';
import { torneosActivos, idCompuesto, separarId, esCircuito } from './tenis';

const LISTADO = [
  { key: 'tennis_atp_us_open', active: true },
  { key: 'tennis_atp_wimbledon', active: false },
  { key: 'tennis_wta_monterrey_open', active: true },
  { key: 'tennis_wta_us_open', active: true },
  { key: 'soccer_epl', active: true },
  { key: 'basketball_nba', active: true },
];

describe('torneos activos de un circuito', () => {
  it('filtra por circuito Y por actividad a la vez', () => {
    expect(torneosActivos(LISTADO, 'ATP')).toEqual(['tennis_atp_us_open']);
    expect(torneosActivos(LISTADO, 'WTA')).toEqual([
      'tennis_wta_monterrey_open',
      'tennis_wta_us_open',
    ]);
  });

  it('no confunde otros deportes con torneos de tenis', () => {
    // Un fallo aquí mandaría la Premier League al desplegable de tenis.
    expect(torneosActivos(LISTADO, 'ATP')).not.toContain('soccer_epl');
  });

  it('con el listado vacío devuelve vacío, no revienta', () => {
    expect(torneosActivos([], 'ATP')).toEqual([]);
  });
});

describe('identificador compuesto', () => {
  it('va y vuelve sin perder nada', () => {
    const id = idCompuesto('tennis_wta_monterrey_open', 'abc123def4567890');
    expect(separarId(id)).toEqual({
      torneo: 'tennis_wta_monterrey_open',
      eventoId: 'abc123def4567890',
    });
  });

  /*
   * `separarId` es una frontera de entrada: lo que llega ahí viene de la URL
   * y puede ser cualquier cosa. Rechazar en vez de adivinar.
   */
  it('rechaza lo que no es un identificador de tenis', () => {
    expect(separarId('abc123def4567890')).toBeNull();
    expect(separarId('~abc123')).toBeNull();
    expect(separarId('tennis_atp_us_open~')).toBeNull();
    expect(separarId('soccer_epl~abc123def4567890')).toBeNull();
  });
});

describe('circuitos', () => {
  it('reconoce los dos y nada más', () => {
    expect(esCircuito('ATP')).toBe(true);
    expect(esCircuito('WTA')).toBe(true);
    expect(esCircuito('NBA')).toBe(false);
    expect(esCircuito('')).toBe(false);
  });
});
