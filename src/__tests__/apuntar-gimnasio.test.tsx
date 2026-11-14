import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { renderRouter, screen, testRouter } from 'expo-router/testing-library';
import { Alert } from 'react-native';

import Historial from '@/app/(pestanas)/historial';
import Pestanas from '@/app/(pestanas)/_layout';
import Inicio from '@/app/(pestanas)/index';
import Raiz from '@/app/_layout';
import Apuntar from '@/app/apuntar';
import ApuntarGimnasio from '@/app/apuntar/gimnasio';
import * as entrenos from '@/datos/entrenos';
import type { BaseDePrueba } from '@/pruebas/baseDePrueba';
import { abrirBasePreparada } from '@/pruebas/datos';

// La pantalla de verdad sobre la base de prueba: la base que daría
// expo-sqlite es la de node:sqlite, y los identificadores salen del generador
// de las pruebas. Todo lo demás es el código de la app.
//
// renderRouter pone los temporizadores falsos de Jest: el borrador (400 ms) y
// la base de prueba, que cede el turno con setImmediate, solo avanzan cuando
// se deja pasar el tiempo. Por eso, antes de comprobar que algo NO ha pasado,
// se deja pasar: si no, la comprobación no podría fallar.
let mockBase: BaseDePrueba;
jest.mock('expo-sqlite', () => ({
  SQLiteProvider: ({ children }: { children: unknown }) => children,
  useSQLiteContext: () => mockBase,
}));
jest.mock('@/datos/movil', () => {
  const { generadorDeIds } = jest.requireActual('@/pruebas/datos');
  return { nuevoId: generadorDeIds(), prepararBaseDelMovil: async () => undefined };
});

const RUTAS = {
  _layout: Raiz,
  '(pestanas)/_layout': Pestanas,
  '(pestanas)/index': Inicio,
  '(pestanas)/historial': Historial,
  'apuntar/index': Apuntar,
  'apuntar/gimnasio': ApuntarGimnasio,
};

// Los espías de cada prueba, que se quitan al acabar. jest.restoreAllMocks no
// sirve: quitaría también los que pone expo-router para sus pruebas.
const espias: jest.SpyInstance[] = [];
const espiar = <T extends jest.SpyInstance>(espia: T): T => {
  espias.push(espia);
  return espia;
};

const dejarPasar = (ms = 2000) => act(() => jest.advanceTimersByTimeAsync(ms));
const borrador = () =>
  mockBase.mirar<{ valor: string }>("SELECT valor FROM ajuste WHERE clave = 'local.borrador.gimnasio'");
const enElBorrador = () => JSON.parse(borrador()[0].valor);
const guardados = () => mockBase.mirar<{ n: number }>('SELECT COUNT(*) AS n FROM entreno')[0].n;

/** Abre la app en Inicio y llega al editor como en el móvil: Apuntar un entreno, Gimnasio. */
async function abrirElEditor() {
  const app = await renderRouter(RUTAS, { initialUrl: '/' });
  await fireEvent.press(await screen.findByText('Apuntar un entreno'));
  await fireEvent.press(await screen.findByLabelText('Gimnasio'));
  await screen.findByText('+ Añadir ejercicio');
  return app;
}

async function anadir(grupo: string | null, ejercicio: string) {
  await fireEvent.press(screen.getByText('+ Añadir ejercicio'));
  if (grupo !== null) await fireEvent.press(await screen.findByText(grupo));
  await fireEvent.press(await screen.findByText(ejercicio));
}

/** Añade un press banca y apunta 60 kg por 8 en su primera serie. */
async function apuntarUnPress() {
  await anadir(null, 'Press banca');
  await fireEvent.changeText(await screen.findByLabelText('Peso (kg)'), '60');
  await fireEvent.changeText(screen.getByLabelText('Repeticiones'), '8');
}

describe('Apuntar un entreno de gimnasio', () => {
  // Cada base se cierra al empezar la prueba siguiente, y no al acabar la
  // suya: la limpieza de la biblioteca de pruebas desmonta la pantalla después
  // de este afterEach, y al desmontarse el editor todavía escribe su borrador.
  beforeEach(async () => {
    mockBase?.cerrar();
    mockBase = await abrirBasePreparada();
  });
  afterEach(() => {
    jest.useRealTimers();
    espias.forEach((espia) => espia.mockRestore());
    espias.length = 0;
  });
  afterAll(() => mockBase.cerrar());

  it('guarda el entreno en la base, quita el borrador y vuelve a Inicio', async () => {
    const app = await abrirElEditor();
    await apuntarUnPress();
    await waitFor(() => expect(borrador()).toHaveLength(1));
    await fireEvent.press(screen.getByLabelText('7, duro'));
    await fireEvent.changeText(screen.getByLabelText('Duración en minutos'), '45');
    await fireEvent.press(screen.getByText('Guardar'));

    await waitFor(() => expect(app.getPathname()).toBe('/'));
    await dejarPasar();
    expect(
      mockBase.mirar(
        `SELECT e.disciplina, e.duracion_ms, e.esfuerzo, s.ejercicio_id, s.peso_g, s.repeticiones
         FROM entreno AS e JOIN bloque AS b ON b.entreno_id = e.id JOIN serie AS s ON s.bloque_id = b.id`,
      ),
    ).toEqual([
      { disciplina: 'gimnasio', duracion_ms: 2_700_000, esfuerzo: 7, ejercicio_id: 'press-banca', peso_g: 60_000, repeticiones: 8 },
    ]);
    expect(borrador()).toEqual([]);
  });

  it('dice lo que falta antes de guardar, y no guarda nada', async () => {
    await abrirElEditor();
    await apuntarUnPress();
    await fireEvent.press(screen.getByText('Guardar'));
    await dejarPasar();

    expect(screen.getByText('Falta el esfuerzo, del 1 al 10.')).toBeOnTheScreen();
    expect(screen.getByText('Falta la duración, en minutos.')).toBeOnTheScreen();
    expect(guardados()).toBe(0);
  });

  it('al salir enseguida, lo último tecleado llega igual al borrador', async () => {
    await abrirElEditor();
    await apuntarUnPress();
    await testRouter.back('/apuntar');
    await dejarPasar();
    expect(enElBorrador().bloques[0].series[0]).toMatchObject({ peso: '60', repeticiones: '8' });
  });

  it('al volver al editor, el borrador sigue ahí', async () => {
    await abrirElEditor();
    await apuntarUnPress();
    await dejarPasar();
    await testRouter.back('/apuntar');
    await fireEvent.press(await screen.findByLabelText('Gimnasio, tienes uno a medias'));
    expect(await screen.findByText('60 kg × 8')).toBeOnTheScreen();
  });

  it('dos toques seguidos en Gimnasio abren un solo editor', async () => {
    const app = await renderRouter(RUTAS, { initialUrl: '/apuntar' });
    const gimnasio = await screen.findByLabelText('Gimnasio');
    await fireEvent.press(gimnasio);
    await fireEvent.press(gimnasio);
    await dejarPasar();
    // La pila de pantallas de la raíz, que va dentro de la del router.
    const pila = app.getRouterState()?.routes[0]?.state?.routes.map((ruta) => ruta.name);
    expect(pila).toEqual(['apuntar/index', 'apuntar/gimnasio']);
  });

  it('descartar pide confirmación: con Cancelar no borra nada, y con Descartar borra y sale', async () => {
    const alerta = espiar(jest.spyOn(Alert, 'alert'));
    const app = await abrirElEditor();
    await apuntarUnPress();
    await dejarPasar();

    await fireEvent.press(screen.getByText('Descartar este entreno'));
    const botones = () => alerta.mock.calls[alerta.mock.calls.length - 1][2] ?? [];
    await act(async () => botones().find((b) => b.text === 'Cancelar')?.onPress?.());
    await dejarPasar();
    expect(borrador()).toHaveLength(1);

    await fireEvent.press(screen.getByText('Descartar este entreno'));
    await act(async () => botones().find((b) => b.text === 'Descartar')?.onPress?.());
    await dejarPasar();
    expect(borrador()).toEqual([]);
    expect(app.getPathname()).toBe('/apuntar');
  });

  it('descartar justo después de teclear no deja borrador', async () => {
    const alerta = espiar(jest.spyOn(Alert, 'alert'));
    await abrirElEditor();
    await apuntarUnPress();
    await fireEvent.press(screen.getByText('Descartar este entreno'));
    const botones = alerta.mock.calls[0][2] ?? [];
    await act(async () => botones.find((b) => b.text === 'Descartar')?.onPress?.());
    await dejarPasar();
    expect(borrador()).toEqual([]);
  });

  it('si guardar falla, lo tecleado justo antes se queda en el borrador', async () => {
    espiar(jest.spyOn(entrenos, 'guardarEntrenoEn')).mockRejectedValueOnce(new Error('disco lleno'));
    await abrirElEditor();
    await apuntarUnPress();
    await fireEvent.press(screen.getByLabelText('7, duro'));
    await fireEvent.changeText(screen.getByLabelText('Duración en minutos'), '45');
    await fireEvent.press(screen.getByText('Guardar'));
    await dejarPasar();

    expect(screen.getByText(/No se pudo guardar el entreno/)).toBeOnTheScreen();
    expect(enElBorrador()).toMatchObject({ esfuerzo: 7, minutos: '45' });
    expect(guardados()).toBe(0);
  });

  it('una plancha se apunta en segundos, sin peso ni repeticiones', async () => {
    await abrirElEditor();
    await anadir('Core', 'Plancha');
    expect(screen.queryByLabelText('Peso (kg)')).toBeNull();
    expect(screen.queryByLabelText('Repeticiones')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Subir Segundos'));
    await fireEvent.press(screen.getByLabelText('Subir Segundos'));
    expect(screen.getByLabelText('Segundos').props.value).toBe('10');
    await fireEvent.changeText(screen.getByLabelText('Segundos'), '90');
    expect(screen.getByText('1:30')).toBeOnTheScreen();
  });

  it('el peso de un ejercicio con mancuernas dice que es por mancuerna', async () => {
    await abrirElEditor();
    await anadir('Brazo', 'Curl con mancuernas');
    expect(screen.getByLabelText('Peso (kg por mancuerna)')).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText('Subir Peso (kg por mancuerna)'));
    await fireEvent.press(screen.getByLabelText('Subir Peso (kg por mancuerna)'));
    await fireEvent.press(screen.getByLabelText('Bajar Peso (kg por mancuerna)'));
    expect(screen.getByLabelText('Peso (kg por mancuerna)').props.value).toBe('2,5');
  });

  it('con las series marcadas como hechas, la duración se mide sola', async () => {
    const app = await abrirElEditor();
    await apuntarUnPress();
    await fireEvent.press(screen.getByText('Hecha ✓'));
    await fireEvent.press(screen.getByLabelText('Añadir una serie de Press banca'));
    await fireEvent.press(await screen.findByText('Igual que la anterior (60 kg × 8)'));
    await dejarPasar(20 * 60_000);
    await fireEvent.press(screen.getByText('Hecha ✓'));
    await fireEvent.press(screen.getByLabelText('8, duro'));
    expect(screen.getByText('20 minutos entre la primera serie hecha y la última. Si fue más, escríbelo.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Guardar'));

    await waitFor(() => expect(app.getPathname()).toBe('/'));
    expect(mockBase.mirar('SELECT duracion_ms, esfuerzo FROM entreno')).toEqual([{ duracion_ms: 1_200_000, esfuerzo: 8 }]);
    expect(mockBase.mirar('SELECT COUNT(*) AS n FROM serie')).toEqual([{ n: 2 }]);
  });

  it('quitar un ejercicio se puede deshacer', async () => {
    await abrirElEditor();
    await apuntarUnPress();
    await fireEvent.press(screen.getByLabelText('Quitar Press banca'));
    expect(screen.queryByText('60 kg × 8')).toBeNull();
    await fireEvent.press(await screen.findByText('Deshacer'));
    expect(await screen.findByText('60 kg × 8')).toBeOnTheScreen();
  });

  it('desde Apuntar se elige el gimnasio, y las demás disciplinas salen como pronto y no se abren', async () => {
    const app = await renderRouter(RUTAS, { initialUrl: '/apuntar' });
    for (const nombre of ['Hyrox', 'Calistenia', 'Carrera', 'Natación']) {
      expect(await screen.findByLabelText(`${nombre}, pronto`)).toBeOnTheScreen();
    }
    await fireEvent.press(screen.getByLabelText('Hyrox, pronto'));
    await dejarPasar();
    expect(app.getPathname()).toBe('/apuntar');
    await fireEvent.press(screen.getByLabelText('Gimnasio'));
    await waitFor(() => expect(app.getPathname()).toBe('/apuntar/gimnasio'));
  });
});
