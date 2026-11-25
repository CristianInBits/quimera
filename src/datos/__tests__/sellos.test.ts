import { SELLO_MAXIMO, SELLO_MINIMO, nuevoSello } from '@/datos/sellos';
import { T0 } from '@/pruebas/datos';

describe('Los sellos de modificación', () => {
  it('son la hora actual en milisegundos enteros', () => {
    expect(nuevoSello(T0)).toBe(T0);
    expect(nuevoSello(T0 + 0.7)).toBe(T0);
  });

  it('siempre son mayores que el anterior, aunque el reloj vaya hacia atrás', () => {
    expect(nuevoSello(T0, T0)).toBe(T0 + 1);
    expect(nuevoSello(T0 - 3_600_000, T0)).toBe(T0 + 1);
    expect(nuevoSello(T0 + 5, T0)).toBe(T0 + 5);
  });

  it('nunca bajan del mínimo que acepta la base, aunque el reloj diga 1970', () => {
    expect(nuevoSello(1000)).toBe(SELLO_MINIMO);
    expect(nuevoSello(1000, SELLO_MINIMO)).toBe(SELLO_MINIMO + 1);
  });

  it('nunca pasan del máximo que cabe en una copia: allí se quedan', () => {
    expect(nuevoSello(T0, SELLO_MAXIMO - 1)).toBe(SELLO_MAXIMO);
    expect(nuevoSello(T0, SELLO_MAXIMO)).toBe(SELLO_MAXIMO);
    expect(SELLO_MAXIMO).toBe(Number.MAX_SAFE_INTEGER);
  });
});
