import { act, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
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

// La escala de la letra del sistema. La de Jest es 2, la de la letra grande;
// las pruebas la ponen a 1 cuando miran la pantalla con la letra normal.
let mockEscala = 2;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 844, scale: 2, fontScale: mockEscala }),
}));

const RUTAS = {
  _layout: Raiz,
  '(pestanas)/_layout': Pestanas,
  '(pestanas)/index': Inicio,
  '(pestanas)/historial': Historial,
};

/**
 * Si en la pantalla está el escenario de Inicio con el rinoceronte de
 * presentación encima: los dos círculos de escenarioDeInicio y el dibujo.
 */
function rinoceronteSobreSuEscenario(): boolean {
  const ocultos = { includeHiddenElements: true } as const;
  const escenario = screen.getByTestId('escenario', ocultos);
  const [fuera, dentro] = escenario.children.map((hijo) => (typeof hijo === 'string' ? {} : StyleSheet.flatten(hijo.props.style)));
  const dibujo = within(escenario).getByTestId('mascota', ocultos);
  return (
    fuera.backgroundColor === PALETAS.claro.escenarioDeInicio[0] &&
    dentro.backgroundColor === PALETAS.claro.escenarioDeInicio[1] &&
    /rinoceronte.png$/.test(dibujo.props.source.testUri)
  );
}

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

  it('la marca de cada disciplina lleva su color, no el rosa de las acciones', async () => {
    // El hyrox, porque su marca no es ni el rosa ni su color de texto.
    const nuevoId = generadorDeIds();
    const hoy = fechaLocal(new Date());
    await guardar(gimnasioConCalentamiento(nuevoId, hoy));
    await guardar({ ...hyroxConDescansos(nuevoId), fecha: hoy });
    await renderRouter(RUTAS, { initialUrl: '/' });
    const gimnasio = await screen.findByLabelText('Gimnasio, 53 minutos');
    const hyrox = screen.getByLabelText('Hyrox, 45 minutos');
    expect(within(gimnasio).getByTestId('marca-de-disciplina')).toHaveStyle({
      backgroundColor: PALETAS.claro.disciplina.gimnasio.marca,
    });
    expect(within(hyrox).getByTestId('marca-de-disciplina')).toHaveStyle({
      backgroundColor: PALETAS.claro.disciplina.hyrox.marca,
    });
    // Cada ficha va teñida de su disciplina.
    expect(hyrox).toHaveStyle({ backgroundColor: PALETAS.claro.disciplina.hyrox.tinte });
  });

  it('el rinoceronte acompaña la carga sobre su escenario y cuenta en su bocadillo cómo va, con la diferencia en negrita', async () => {
    const nuevoId = generadorDeIds();
    const hoy = fechaLocal(new Date());
    await guardar(gimnasioConCalentamiento(nuevoId, hoy));
    await guardar({ ...hyroxConDescansos(nuevoId), fecha: sumarDias(hoy, -7) });
    await renderRouter(RUTAS, { initialUrl: '/' });
    await screen.findByLabelText('Carga de esta semana: 371');
    expect(rinoceronteSobreSuEscenario()).toBe(true);
    const frase = screen.getByText('Un 3 % más que la semana pasada (360).');
    expect(screen.getByTestId('bocadillo')).toContainElement(frase);
    expect(screen.getByText('Un 3 % más')).toHaveStyle({ fontWeight: '700' });
    // La negrita es solo de la diferencia: el resto de la frase va sin ella.
    expect(frase).not.toHaveStyle({ fontWeight: '700' });
  });

  it('con la letra grande, el rinoceronte va encima de la cifra y el pico del bocadillo, al centro', async () => {
    await guardar(gimnasioConCalentamiento(generadorDeIds(), fechaLocal(new Date())));
    await renderRouter(RUTAS, { initialUrl: '/' });
    expect(await screen.findByTestId('fila-de-la-carga')).toHaveStyle({ flexDirection: 'column-reverse' });
    expect(screen.getByTestId('pico', { includeHiddenElements: true })).toHaveStyle({ left: '50%', marginLeft: -7 });
  });

  it('con la letra al 130 % de Android, que llega como 1,2999999, también apila', async () => {
    mockEscala = Math.fround(1.3);
    try {
      await guardar(gimnasioConCalentamiento(generadorDeIds(), fechaLocal(new Date())));
      await renderRouter(RUTAS, { initialUrl: '/' });
      expect(await screen.findByTestId('fila-de-la-carga')).toHaveStyle({ flexDirection: 'column-reverse' });
    } finally {
      mockEscala = 2;
    }
  });

  it('con la letra normal, la cifra va al lado del rinoceronte y el pico apunta a él', async () => {
    mockEscala = 1;
    try {
      await guardar(gimnasioConCalentamiento(generadorDeIds(), fechaLocal(new Date())));
      await renderRouter(RUTAS, { initialUrl: '/' });
      expect(await screen.findByTestId('fila-de-la-carga')).toHaveStyle({ flexDirection: 'row' });
      // A la mitad del escenario de 156 desde la derecha: el centro del pico, 7 más allá de su borde.
      expect(screen.getByTestId('pico', { includeHiddenElements: true })).toHaveStyle({ right: 71 });
    } finally {
      mockEscala = 2;
    }
  });

  it('la gráfica de las ocho últimas semanas es, para el lector de pantalla, una imagen con todas las cifras', async () => {
    const nuevoId = generadorDeIds();
    const hoy = fechaLocal(new Date());
    await guardar(gimnasioConCalentamiento(nuevoId, hoy));
    await guardar({ ...hyroxConDescansos(nuevoId), fecha: sumarDias(hoy, -7) });
    await guardar({ ...gimnasioConCalentamiento(nuevoId, sumarDias(hoy, -49)), esfuerzo: 5 });
    await renderRouter(RUTAS, { initialUrl: '/' });
    expect(
      await screen.findByRole('image', {
        name: 'Carga de las 8 últimas semanas, de la más antigua a esta: 265, 0, 0, 0, 0, 0, 360 y 371.',
      }),
    ).toBeOnTheScreen();
  });

  it('con la letra normal, las cifras van encima de sus barras y los nombres debajo', async () => {
    mockEscala = 1;
    try {
      const nuevoId = generadorDeIds();
      const hoy = fechaLocal(new Date());
      await guardar(gimnasioConCalentamiento(nuevoId, hoy));
      await guardar({ ...hyroxConDescansos(nuevoId), fecha: sumarDias(hoy, -7) });
      await renderRouter(RUTAS, { initialUrl: '/' });
      const grafica = await screen.findByRole('image', { name: /^Carga de las 8 últimas semanas/ });
      expect(within(grafica).getByText('Pasada')).toBeOnTheScreen();
      expect(within(grafica).getByText('Esta')).toBeOnTheScreen();
      expect(within(grafica).getByText('360')).toBeOnTheScreen();
      expect(within(grafica).queryByText(/^Pasada: /)).toBeNull();
    } finally {
      mockEscala = 2;
    }
  });

  it('con la letra grande, las cifras de la gráfica van en una línea debajo', async () => {
    const nuevoId = generadorDeIds();
    const hoy = fechaLocal(new Date());
    await guardar(gimnasioConCalentamiento(nuevoId, hoy));
    await guardar({ ...hyroxConDescansos(nuevoId), fecha: sumarDias(hoy, -7) });
    await renderRouter(RUTAS, { initialUrl: '/' });
    const grafica = await screen.findByRole('image', { name: /^Carga de las 8 últimas semanas/ });
    expect(within(grafica).getByText('Pasada: 360 · Esta: 371')).toBeOnTheScreen();
    expect(within(grafica).queryByText('Pasada')).toBeNull();
  });

  it('sin ningún entreno, el rinoceronte da la bienvenida con el texto en su bocadillo, sin gráfica', async () => {
    await renderRouter(RUTAS, { initialUrl: '/' });
    const texto = await screen.findByText(VACIO);
    expect(screen.getByTestId('bocadillo')).toContainElement(texto);
    expect(rinoceronteSobreSuEscenario()).toBe(true);
    expect(screen.queryByRole('image', { name: /^Carga de las/ })).toBeNull();
  });
});
