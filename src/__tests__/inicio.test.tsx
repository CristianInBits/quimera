import { act } from '@testing-library/react-native';
import { renderRouter, screen } from 'expo-router/testing-library';

import Historial from '@/app/(pestanas)/historial';
import Pestanas from '@/app/(pestanas)/_layout';
import Inicio from '@/app/(pestanas)/index';
import Raiz from '@/app/_layout';
import { puertaDe } from '@/datos/base';
import { guardarEntrenoEn, type Entreno } from '@/datos/entrenos';
import { fechaLocal, sumarDias } from '@/datos/fechas';
import type { BaseDePrueba } from '@/pruebas/baseDePrueba';
import { abrirBasePreparada, generadorDeIds, gimnasioConCalentamiento, hyroxConDescansos } from '@/pruebas/datos';
import { PALETAS } from '@/tema/colores';

// Inicio de verdad sobre la base de prueba. Cada gimnasio de ejemplo dura 52
// minutos y medio, que en las sumas son 53; con esfuerzo 7 son 371 de carga y
// con esfuerzo 5, 265.
let mockBase: BaseDePrueba;
jest.mock('expo-sqlite', () => ({
  SQLiteProvider: ({ children }: { children: unknown }) => children,
  useSQLiteContext: () => mockBase,
}));

const RUTAS = {
  _layout: Raiz,
  '(pestanas)/_layout': Pestanas,
  '(pestanas)/index': Inicio,
  '(pestanas)/historial': Historial,
};

const VACIO = 'Cuando apuntes tu primer entreno, aquí verás la carga de la semana y cómo va respecto a la pasada.';

/**
 * Para el reloj en una hora fija, solo para Date: la base de prueba cede el
 * turno con setImmediate, que tiene que seguir siendo de verdad hasta
 * renderRouter, que pone todos los temporizadores falsos desde esa hora.
 */
const pararElReloj = (ahora: Date) =>
  jest.useFakeTimers({
    now: ahora,
    doNotFake: [
      'hrtime',
      'nextTick',
      'performance',
      'queueMicrotask',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'requestIdleCallback',
      'cancelIdleCallback',
      'setImmediate',
      'clearImmediate',
      'setInterval',
      'clearInterval',
      'setTimeout',
      'clearTimeout',
    ],
  });

describe('Inicio', () => {
  beforeEach(async () => {
    mockBase?.cerrar();
    mockBase = await abrirBasePreparada();
  });
  afterEach(() => {
    jest.useRealTimers();
  });
  afterAll(() => mockBase.cerrar());

  const guardar = (entreno: Entreno) =>
    puertaDe(mockBase).escribir((tx) => guardarEntrenoEn(tx, entreno, { ahora: Date.now() }));

  it('sin ningún entreno dice qué es Quimera y lo que saldrá, sin un cero enorme', async () => {
    await renderRouter(RUTAS, { initialUrl: '/' });
    expect(await screen.findByText(VACIO)).toBeOnTheScreen();
    expect(screen.getByText('Quimera')).toBeOnTheScreen();
    expect(screen.getByText('Tus entrenos, en tu móvil.')).toBeOnTheScreen();
    expect(screen.getByText('Apuntar un entreno')).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Carga de esta semana/)).toBeNull();
    expect(screen.queryByText('de carga')).toBeNull();
  });

  it('enseña la carga de esta semana, la compara con la pasada y da los minutos de cada disciplina de esta semana', async () => {
    const nuevoId = generadorDeIds();
    const hoy = fechaLocal(new Date());
    await guardar(gimnasioConCalentamiento(nuevoId, hoy));
    // La pasada, otra disciplina y otros minutos: un hyrox de 45 minutos con esfuerzo 8, 360 de carga.
    await guardar({ ...hyroxConDescansos(nuevoId), fecha: sumarDias(hoy, -7) });
    await renderRouter(RUTAS, { initialUrl: '/' });

    expect(await screen.findByLabelText('Carga de esta semana: 371')).toBeOnTheScreen();
    expect(screen.getByText('371')).toBeOnTheScreen();
    expect(screen.getByText('Un 3 % más que la semana pasada (360).')).toBeOnTheScreen();
    expect(screen.getByText('53 minutos')).toBeOnTheScreen();
    expect(screen.getByLabelText('Gimnasio, 53 minutos')).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Hyrox/)).toBeNull();
    expect(screen.getByText('Minutos por esfuerzo. Compara tus semanas entre sí, no unas disciplinas con otras.')).toBeOnTheScreen();
    expect(screen.queryByText(VACIO)).toBeNull();
  });

  it('con entrenos solo la semana pasada, cero de carga y lo que sumó la pasada, no el texto de bienvenida', async () => {
    const nuevoId = generadorDeIds();
    await guardar({ ...gimnasioConCalentamiento(nuevoId, sumarDias(fechaLocal(new Date()), -7)), esfuerzo: 5 });
    await renderRouter(RUTAS, { initialUrl: '/' });

    expect(await screen.findByLabelText('Carga de esta semana: 0')).toBeOnTheScreen();
    expect(screen.getByText('Todavía sin entrenos esta semana. La pasada sumó 265 de carga.')).toBeOnTheScreen();
    expect(screen.queryByText(VACIO)).toBeNull();
  });

  it('abierta el domingo a las 23:59:58, a medianoche pasa sola a la semana nueva', async () => {
    pararElReloj(new Date(2026, 10, 15, 23, 59, 58));
    await guardar(gimnasioConCalentamiento(generadorDeIds(), '2026-11-15'));
    await renderRouter(RUTAS, { initialUrl: '/' });
    expect(await screen.findByLabelText('Carga de esta semana: 371')).toBeOnTheScreen();

    await act(() => jest.advanceTimersByTimeAsync(5000));
    expect(await screen.findByLabelText('Carga de esta semana: 0')).toBeOnTheScreen();
    expect(screen.getByText('Todavía sin entrenos esta semana. La pasada sumó 371 de carga.')).toBeOnTheScreen();
  });

  it.each([
    ['un domingo', new Date(2026, 10, 15, 10, 0), '2026-11-09', '2026-11-08'],
    ['un lunes', new Date(2026, 10, 16, 10, 0), '2026-11-16', '2026-11-15'],
  ])('%s, la semana va del lunes al domingo', async (_, ahora, deEsta, deLaPasada) => {
    pararElReloj(ahora);
    const nuevoId = generadorDeIds();
    await guardar(gimnasioConCalentamiento(nuevoId, deEsta));
    await guardar({ ...gimnasioConCalentamiento(nuevoId, deLaPasada), esfuerzo: 5 });
    await renderRouter(RUTAS, { initialUrl: '/' });
    expect(await screen.findByLabelText('Carga de esta semana: 371')).toBeOnTheScreen();
    expect(screen.getByText('Un 40 % más que la semana pasada (265).')).toBeOnTheScreen();
  });

  it('si no se puede leer la carga, lo dice', async () => {
    const buena = mockBase;
    mockBase = {
      ...buena,
      getAllAsync: async () => {
        throw new Error('rota');
      },
    };
    try {
      await renderRouter(RUTAS, { initialUrl: '/' });
      expect(await screen.findByText(/^No se pudo leer la carga de la semana\./)).toBeOnTheScreen();
    } finally {
      mockBase = buena;
    }
  });

  it('la marca de cada disciplina lleva su color', async () => {
    await guardar(gimnasioConCalentamiento(generadorDeIds(), fechaLocal(new Date())));
    await renderRouter(RUTAS, { initialUrl: '/' });
    const fila = await screen.findByLabelText('Gimnasio, 53 minutos');
    expect(fila.children[0]).toHaveStyle({ backgroundColor: PALETAS.claro.disciplina.gimnasio });
  });
});
