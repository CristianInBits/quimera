import type { Serie } from '@/datos/entrenos';
import {
  resumenDeSerieGuardada,
  resumenDelContenido,
  textoDelDescansoGuardado,
  textoDelTiempoGuardado,
} from '@/historial/textos';

const serie: Serie = {
  id: 's',
  ronda: 1,
  orden: 1,
  ejercicioId: 'x',
  repeticiones: null,
  pesoG: null,
  tiempoMs: null,
  distanciaM: null,
  calorias: null,
  descansoMs: null,
};

describe('Los textos de lo guardado', () => {
  it('el contenido de un entreno nombra hasta tres ejercicios, y de ahí resume', () => {
    expect(resumenDelContenido([], 0)).toBeNull();
    expect(resumenDelContenido(['A'], 0)).toBe('A');
    expect(resumenDelContenido(['A', 'B', 'C'], 0)).toBe('A, B y C');
    expect(resumenDelContenido(['A', 'B', 'C', 'D', 'E'], 0)).toBe('A, B y 3 más');
    expect(resumenDelContenido(['A'], 2350)).toBe('A · 2,35 km');
    expect(resumenDelContenido([], 2000)).toBe('2 km');
  });

  it('una serie dice lo que se midió', () => {
    expect(resumenDeSerieGuardada({ ...serie, repeticiones: 8, pesoG: 62_500 })).toBe('62,5 kg × 8');
    expect(resumenDeSerieGuardada({ ...serie, repeticiones: 12 })).toBe('12 reps');
    expect(resumenDeSerieGuardada({ ...serie, pesoG: 20_000 })).toBe('20 kg');
    expect(resumenDeSerieGuardada({ ...serie, tiempoMs: 90_000 })).toBe('1:30');
    expect(resumenDeSerieGuardada({ ...serie, calorias: 20, tiempoMs: 82_000 })).toBe('20 cal · 1:22');
    expect(resumenDeSerieGuardada({ ...serie, distanciaM: 1000, tiempoMs: 262_000 })).toBe('1 km · 4:22');
  });

  it('los descansos y los tiempos guardados', () => {
    expect(textoDelDescansoGuardado(0)).toBe('sin parar');
    expect(textoDelDescansoGuardado(90_000)).toBe('1:30');
    expect(textoDelDescansoGuardado(90_500)).toBe('1:30,5');
    expect(textoDelTiempoGuardado(720_000)).toBe('12 minutos');
    expect(textoDelTiempoGuardado(60_000)).toBe('1 minuto');
    expect(textoDelTiempoGuardado(2_730_000)).toBe('45:30');
  });
});
