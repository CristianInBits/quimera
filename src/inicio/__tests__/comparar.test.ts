import type { Semana } from '@/datos/carga';
import { cifra, compararConLaPasada } from '@/inicio/comparar';

const semana = (carga: number): Semana => ({ lunes: '2026-11-09', carga, minutos: 0, entrenos: carga > 0 ? 1 : 0, porDisciplina: [] });

describe('La comparación con la semana pasada', () => {
  it.each([
    [0, 0, 'Todavía sin entrenos esta semana.'],
    [0, 980, 'Todavía sin entrenos esta semana. La pasada sumó 980 de carga.'],
    [500, 0, 'La semana pasada no hubo entrenos con los que comparar.'],
    [980, 980, 'Igual que la semana pasada (980).'],
    [1254, 980, 'Un 28 % más que la semana pasada (980).'],
    [588, 980, 'Un 40 % menos que la semana pasada (980).'],
    // Con cargas distintas nunca dice igual, aunque no llegue al 1 %.
    [984, 980, 'Casi igual que la semana pasada (980).'],
    // Con carga esta semana nunca dice un 100 % menos, que sería cero.
    [10, 2100, 'Un 99 % menos que la semana pasada (2100).'],
    // Los medios se redondean igual hacia arriba y hacia abajo.
    [199, 200, 'Un 1 % menos que la semana pasada (200).'],
    [201, 200, 'Un 1 % más que la semana pasada (200).'],
    // 57,5 % exacto, sin que la coma flotante lo deje en 57.
    [63, 40, 'Un 58 % más que la semana pasada (40).'],
    [12_540, 10_000, 'Un 25 % más que la semana pasada (10 000).'],
  ])('con %i esta semana y %i la pasada: «%s»', (esta, pasada, frase) => {
    expect(compararConLaPasada(semana(esta), semana(pasada))).toBe(frase);
  });

  it('las cifras desde 10 000 llevan un espacio entre los millares', () => {
    expect([0, 980, 9999, 10_000, 12_540, 1_234_567].map(cifra)).toEqual([
      '0',
      '980',
      '9999',
      '10 000',
      '12 540',
      '1 234 567',
    ]);
  });
});
