import { gramosATexto, msATexto, textoAGramos, textoAMs } from '@/datos/unidades';

describe('El peso', () => {
  it.each([
    ['62,5', 62500],
    ['62.5', 62500],
    ['100', 100000],
    [' 7,25 ', 7250],
    ['4,35', 4350],
    ['0,001', 1],
    ['1,1', 1100],
  ])('«%s» kg son %i g', (texto, gramos) => {
    expect(textoAGramos(texto)).toBe(gramos);
  });

  it.each(['', 'abc', '1,2345', '-5', '1e3', '62,', ',5', '1.000,5'])('«%s» no es un peso', (texto) => {
    expect(textoAGramos(texto)).toBeNull();
  });

  it.each([
    [62500, '62,5'],
    [100000, '100'],
    [7250, '7,25'],
    [1, '0,001'],
    [1100, '1,1'],
  ])('%i g se escriben «%s»', (gramos, texto) => {
    expect(gramosATexto(gramos)).toBe(texto);
  });

  it('todos los pesos hasta 300 kg, gramo a gramo, van y vuelven sin cambiar', () => {
    for (let gramos = 1; gramos <= 300_000; gramos++) {
      if (textoAGramos(gramosATexto(gramos)) !== gramos) {
        throw new Error(`${gramos} g no vuelve igual: ${gramosATexto(gramos)}`);
      }
    }
  });
});

describe('El tiempo', () => {
  it.each([
    ['1:28,4', 88400],
    ['1:28.4', 88400],
    ['45:00', 2_700_000],
    ['1:05:30', 3_930_000],
    ['90', 90_000],
    ['0:59', 59_000],
    ['75:00', 4_500_000],
  ])('«%s» son %i ms', (texto, ms) => {
    expect(textoAMs(texto)).toBe(ms);
  });

  it.each(['', 'abc', '1:60', '1:5', '1:00:60', '1:60:00', '1:28,45', ':30'])('«%s» no es un tiempo', (texto) => {
    expect(textoAMs(texto)).toBeNull();
  });

  it.each([
    [88400, '1:28,4'],
    [2_700_000, '45:00'],
    [3_930_000, '1:05:30'],
    [59_000, '0:59'],
    [0, '0:00'],
    [88449, '1:28,4'],
    [88450, '1:28,5'],
  ])('%i ms se escriben «%s»', (ms, texto) => {
    expect(msATexto(ms)).toBe(texto);
  });

  it('todos los tiempos hasta 3 horas, décima a décima, van y vuelven sin cambiar', () => {
    for (let ms = 0; ms <= 10_800_000; ms += 100) {
      if (textoAMs(msATexto(ms)) !== ms) {
        throw new Error(`${ms} ms no vuelve igual: ${msATexto(ms)}`);
      }
    }
  });
});
