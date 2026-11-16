import { act, fireEvent, waitFor, within } from '@testing-library/react-native';
import { renderRouter, screen, testRouter } from 'expo-router/testing-library';
import { AccessibilityInfo, Alert, StyleSheet } from 'react-native';

import Historial from '@/app/(pestanas)/historial';
import Pestanas from '@/app/(pestanas)/_layout';
import Inicio from '@/app/(pestanas)/index';
import Raiz from '@/app/_layout';
import Apuntar from '@/app/apuntar';
import ApuntarGimnasio from '@/app/apuntar/gimnasio';
import { p } from '@/datos/base';
import * as entrenos from '@/datos/entrenos';
import type { BaseDePrueba } from '@/pruebas/baseDePrueba';
import { T0, abrirBasePreparada } from '@/pruebas/datos';
import { PALETAS } from '@/tema/colores';

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
  await screen.findByText('Añadir ejercicio');
  return app;
}

async function anadir(grupo: string | null, ejercicio: string) {
  await fireEvent.press(screen.getByText('Añadir ejercicio'));
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
    // Inicio, que ya estaba montado, vuelve a leer la carga: 45 minutos por esfuerzo 7.
    expect(await screen.findByLabelText('Carga de esta semana: 315')).toBeOnTheScreen();
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
    expect(enElBorrador().bloques[0].vueltas[0][0]).toMatchObject({ peso: '60', repeticiones: '8' });
  });

  it('al descartar un entreno retomado, Apuntar deja de decir que hay uno a medias', async () => {
    const alerta = espiar(jest.spyOn(Alert, 'alert'));
    const app = await abrirElEditor();
    await apuntarUnPress();
    await dejarPasar();
    await testRouter.back('/apuntar');
    await fireEvent.press(await screen.findByLabelText('Gimnasio, tienes uno a medias'));
    await screen.findByText('60 kg × 8');
    await fireEvent.press(screen.getByText('Descartar este entreno'));
    const botones = alerta.mock.calls[alerta.mock.calls.length - 1][2] ?? [];
    await act(async () => botones.find((b) => b.text === 'Descartar')?.onPress?.());
    await dejarPasar();
    expect(app.getPathname()).toBe('/apuntar');
    // Apuntar vuelve a leer el borrador al enfocarse: ya no hay ninguno.
    expect(await screen.findByRole('button', { name: 'Gimnasio' })).toBeOnTheScreen();
    expect(screen.queryByText('Tienes uno a medias: sigue donde lo dejaste')).toBeNull();
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
    await fireEvent.press(screen.getByText('Hecha'));
    await fireEvent.press(screen.getByLabelText('Añadir una serie de Press banca'));
    await fireEvent.press(await screen.findByText('Igual que la anterior (60 kg × 8)'));
    await dejarPasar(20 * 60_000);
    await fireEvent.press(screen.getByText('Hecha'));
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

  it('dos ejercicios se enlazan en una superserie, se apuntan vuelta a vuelta y se guardan en un bloque', async () => {
    const anuncio = espiar(jest.spyOn(AccessibilityInfo, 'announceForAccessibility'));
    const app = await abrirElEditor();
    await apuntarUnPress();
    await anadir('Espalda', 'Remo con barra');
    await fireEvent.changeText(await screen.findByLabelText('Peso (kg)'), '50');
    await fireEvent.changeText(screen.getByLabelText('Repeticiones'), '10');
    await fireEvent.press(screen.getByText('Enlazar en superserie con Remo con barra'));
    expect(screen.getByText('SUPERSERIE')).toBeOnTheScreen();
    expect(screen.getByText('Press banca + Remo con barra')).toBeOnTheScreen();

    // Al marcar hecho el press de una vuelta, se abre el remo de la misma vuelta.
    await fireEvent.press(screen.getByLabelText('Añadir una vuelta a la superserie de Press banca y Remo con barra'));
    await fireEvent.press(await screen.findByText('Igual que la anterior (60 kg × 8)'));
    await fireEvent.press(screen.getByText('Hecha'));
    // El botón desaparece: el lector de pantalla dice adónde se ha ido.
    expect(anuncio).toHaveBeenCalledWith('Hecha. Ahora, Remo con barra, vuelta 2.');
    await fireEvent.press(await screen.findByText('Igual que la anterior (50 kg × 10)'));
    expect(screen.getByLabelText('Vuelta 2, Remo con barra: 50 kg × 10')).toBeOnTheScreen();

    await fireEvent.press(screen.getByLabelText(/^Descansos de la superserie de Press banca y Remo con barra/));
    await fireEvent.changeText(
      screen.getByLabelText('Descanso entre vueltas de la superserie de Press banca y Remo con barra, en segundos'),
      '90',
    );
    expect(screen.getByText('1:30')).toBeOnTheScreen();

    await fireEvent.press(screen.getByLabelText('7, duro'));
    await fireEvent.changeText(screen.getByLabelText('Duración en minutos'), '30');
    await fireEvent.press(screen.getByText('Guardar'));

    await waitFor(() => expect(app.getPathname()).toBe('/'));
    expect(mockBase.mirar('SELECT COUNT(*) AS n FROM bloque')).toEqual([{ n: 1 }]);
    expect(
      mockBase.mirar('SELECT ronda, orden, ejercicio_id, peso_g, repeticiones, descanso_ms FROM serie ORDER BY ronda, orden'),
    ).toEqual([
      { ronda: 1, orden: 1, ejercicio_id: 'press-banca', peso_g: 60_000, repeticiones: 8, descanso_ms: 0 },
      { ronda: 1, orden: 2, ejercicio_id: 'remo-barra', peso_g: 50_000, repeticiones: 10, descanso_ms: 90_000 },
      { ronda: 2, orden: 1, ejercicio_id: 'press-banca', peso_g: 60_000, repeticiones: 8, descanso_ms: 0 },
      { ronda: 2, orden: 2, ejercicio_id: 'remo-barra', peso_g: 50_000, repeticiones: 10, descanso_ms: null },
    ]);
  });

  it('el mismo ejercicio con su nota se puede enlazar consigo mismo, y cada uno se nombra con su ordinal', async () => {
    const errores = espiar(jest.spyOn(console, 'error'));
    await abrirElEditor();
    await anadir('Brazo', 'Curl con mancuernas');
    // El segundo: el nombre sale ya en el editor, y el de la lista va detrás.
    await fireEvent.press(screen.getByText('Añadir ejercicio'));
    const enLaLista = await screen.findAllByText('Curl con mancuernas');
    await fireEvent.press(enLaLista[enLaLista.length - 1]);
    await fireEvent.press(screen.getByText('Enlazar en superserie con Curl con mancuernas'));
    expect(screen.getAllByText('Curl con mancuernas: peso por mancuerna')).toHaveLength(2);
    expect(screen.getByLabelText('Vuelta 1, Curl con mancuernas (el 2.º): Sin apuntar')).toBeOnTheScreen();
    // Dos notas iguales no dan claves repetidas.
    expect(errores.mock.calls.flat().join(' ')).not.toMatch(/same key/);
  });

  it('una superserie se separa en sus dos ejercicios sin perder lo apuntado', async () => {
    await abrirElEditor();
    await apuntarUnPress();
    await anadir('Espalda', 'Remo con barra');
    await fireEvent.changeText(await screen.findByLabelText('Repeticiones'), '10');
    await fireEvent.press(screen.getByText('Enlazar en superserie con Remo con barra'));
    await fireEvent.press(screen.getByLabelText('Separar la superserie de Press banca y Remo con barra'));
    expect(screen.queryByText('SUPERSERIE')).toBeNull();
    expect(screen.getByLabelText('Serie 1: 60 kg × 8')).toBeOnTheScreen();
    expect(screen.getByLabelText('Serie 1: 10 reps')).toBeOnTheScreen();
    expect(screen.getByText('Enlazar en superserie con Remo con barra')).toBeOnTheScreen();
  });

  it('la carrera en cinta se apunta con su distancia y sus minutos, y se guarda como un bloque de carrera', async () => {
    const app = await abrirElEditor();
    await fireEvent.press(screen.getByLabelText('Añadir una carrera en cinta, como el calentamiento'));
    await fireEvent.press(screen.getByLabelText('Subir Distancia de la carrera en cinta, en kilómetros'));
    await fireEvent.press(screen.getByLabelText('Subir Distancia de la carrera en cinta, en kilómetros'));
    expect(screen.getByLabelText('Distancia de la carrera en cinta, en kilómetros').props.value).toBe('1');
    await fireEvent.changeText(screen.getByLabelText('Distancia de la carrera en cinta, en kilómetros'), '2,35');
    await fireEvent.changeText(screen.getByLabelText('Tiempo de la carrera en cinta, en minutos'), '12');
    await apuntarUnPress();
    await fireEvent.press(screen.getByLabelText('7, duro'));
    await fireEvent.changeText(screen.getByLabelText('Duración en minutos'), '45');
    await fireEvent.press(screen.getByText('Guardar'));

    await waitFor(() => expect(app.getPathname()).toBe('/'));
    expect(mockBase.mirar('SELECT orden, metros_corridos, tiempo_ms FROM bloque ORDER BY orden')).toEqual([
      { orden: 1, metros_corridos: 2350, tiempo_ms: 720_000 },
      { orden: 2, metros_corridos: null, tiempo_ms: null },
    ]);
  });

  it('una carrera sin distancia no se guarda, y lo dice', async () => {
    await abrirElEditor();
    await fireEvent.press(screen.getByLabelText('Añadir una carrera en cinta, como el calentamiento'));
    await fireEvent.changeText(screen.getByLabelText('Tiempo de la carrera en cinta, en minutos'), '10');
    await fireEvent.press(screen.getByLabelText('3, suave'));
    await fireEvent.changeText(screen.getByLabelText('Duración en minutos'), '15');
    await fireEvent.press(screen.getByText('Guardar'));
    await dejarPasar();
    expect(screen.getByText('Carrera en cinta: falta la distancia.')).toBeOnTheScreen();
    expect(guardados()).toBe(0);
  });

  it('el descanso antes del siguiente se apunta en la carrera y en un ejercicio, y el último bloque no lo enseña', async () => {
    const app = await abrirElEditor();
    await fireEvent.press(screen.getByLabelText('Añadir una carrera en cinta, como el calentamiento'));
    await fireEvent.changeText(screen.getByLabelText('Distancia de la carrera en cinta, en kilómetros'), '2');
    // Sola, la carrera es el último bloque: no tiene descansos que apuntar.
    expect(screen.queryByLabelText(/^Descansos de la carrera en cinta/)).toBeNull();

    await anadir(null, 'Press banca');
    await fireEvent.changeText(await screen.findByLabelText('Repeticiones'), '8');
    await anadir('Espalda', 'Remo con barra');
    await fireEvent.changeText(await screen.findByLabelText('Repeticiones'), '10');

    await fireEvent.press(screen.getByLabelText(/^Descansos de la carrera en cinta/));
    await fireEvent.changeText(screen.getByLabelText('Descanso después de la carrera en cinta, en segundos'), '120');
    expect(screen.getByLabelText('Descansos de la carrera en cinta: 2:00 antes del siguiente')).toBeOnTheScreen();

    await fireEvent.press(screen.getByLabelText(/^Descansos de Press banca/));
    await fireEvent.changeText(screen.getByLabelText('Descanso después de Press banca, en segundos'), '0');
    expect(screen.getByLabelText('Descansos de Press banca: sin parar antes del siguiente')).toBeOnTheScreen();

    // El remo es el último: tiene el descanso entre series, pero no el de después.
    await fireEvent.press(screen.getByLabelText(/^Descansos de Remo con barra/));
    await fireEvent.press(screen.getByLabelText('Subir Descanso entre series de Remo con barra, en segundos'));
    await fireEvent.press(screen.getByLabelText('Subir Descanso entre series de Remo con barra, en segundos'));
    expect(screen.getByLabelText('Descanso entre series de Remo con barra, en segundos').props.value).toBe('30');
    expect(screen.queryByLabelText('Descanso después de Remo con barra, en segundos')).toBeNull();

    await fireEvent.press(screen.getByLabelText('7, duro'));
    await fireEvent.changeText(screen.getByLabelText('Duración en minutos'), '45');
    await fireEvent.press(screen.getByText('Guardar'));
    await waitFor(() => expect(app.getPathname()).toBe('/'));
    expect(mockBase.mirar('SELECT orden, descanso_ms FROM bloque ORDER BY orden')).toEqual([
      { orden: 1, descanso_ms: 120_000 },
      { orden: 2, descanso_ms: 0 },
      { orden: 3, descanso_ms: null },
    ]);
  });

  it('un borrador con una superserie y sus descansos se vuelve a abrir igual', async () => {
    await abrirElEditor();
    await anadir(null, 'Press banca');
    await fireEvent.changeText(await screen.findByLabelText('Repeticiones'), '8');
    await anadir('Espalda', 'Remo con barra');
    await fireEvent.changeText(await screen.findByLabelText('Repeticiones'), '10');
    await fireEvent.press(screen.getByText('Enlazar en superserie con Remo con barra'));
    await fireEvent.press(screen.getByLabelText(/^Descansos de la superserie de Press banca y Remo con barra/));
    await fireEvent.changeText(
      screen.getByLabelText('Descanso entre vueltas de la superserie de Press banca y Remo con barra, en segundos'),
      '90',
    );
    await dejarPasar();
    await testRouter.back('/apuntar');
    await fireEvent.press(await screen.findByLabelText('Gimnasio, tienes uno a medias'));
    expect(await screen.findByText('SUPERSERIE')).toBeOnTheScreen();
    expect(screen.getByLabelText('Descansos de la superserie de Press banca y Remo con barra: 1:30 entre vueltas')).toBeOnTheScreen();
    expect(screen.queryByText(/no sabe leer/)).toBeNull();
  });

  it('enlazar en superserie se puede deshacer, y todo vuelve como estaba', async () => {
    await abrirElEditor();
    await apuntarUnPress();
    await anadir('Espalda', 'Remo con barra');
    await fireEvent.changeText(await screen.findByLabelText('Repeticiones'), '10');
    await fireEvent.press(screen.getByLabelText(/^Descansos de Press banca/));
    await fireEvent.changeText(screen.getByLabelText('Descanso después de Press banca, en segundos'), '120');
    await fireEvent.press(screen.getByText('Enlazar en superserie con Remo con barra'));
    expect(screen.getByText('SUPERSERIE')).toBeOnTheScreen();
    await fireEvent.press(await screen.findByText('Deshacer'));
    expect(screen.queryByText('SUPERSERIE')).toBeNull();
    expect(screen.getByLabelText('Descansos de Press banca: 2:00 antes del siguiente')).toBeOnTheScreen();
    expect(screen.getByLabelText('Serie 1: 10 reps')).toBeOnTheScreen();
  });

  it('quitar la carrera se puede deshacer, y quitar una vuelta de una superserie quita solo esa vuelta', async () => {
    await abrirElEditor();
    await fireEvent.press(screen.getByLabelText('Añadir una carrera en cinta, como el calentamiento'));
    await fireEvent.changeText(screen.getByLabelText('Distancia de la carrera en cinta, en kilómetros'), '2');
    await fireEvent.press(screen.getByLabelText('Quitar la carrera en cinta'));
    expect(screen.queryByLabelText('Distancia de la carrera en cinta, en kilómetros')).toBeNull();
    await fireEvent.press(await screen.findByText('Deshacer'));
    expect(screen.getByLabelText('Distancia de la carrera en cinta, en kilómetros').props.value).toBe('2');

    await anadir(null, 'Press banca');
    await fireEvent.changeText(await screen.findByLabelText('Repeticiones'), '8');
    await anadir('Espalda', 'Remo con barra');
    await fireEvent.changeText(await screen.findByLabelText('Repeticiones'), '10');
    await fireEvent.press(screen.getByText('Enlazar en superserie con Remo con barra'));
    await fireEvent.press(screen.getByLabelText('Añadir una vuelta a la superserie de Press banca y Remo con barra'));
    await fireEvent.press(screen.getByText('Quitar la vuelta 2'));
    expect(screen.queryByLabelText(/^Vuelta 2,/)).toBeNull();
    expect(screen.getByLabelText('Vuelta 1, Press banca: 8 reps')).toBeOnTheScreen();
    expect(screen.getByText('SUPERSERIE')).toBeOnTheScreen();
  });

  it('enlazar no mueve ni quita la carrera de delante ni el ejercicio de detrás', async () => {
    const app = await abrirElEditor();
    await fireEvent.press(screen.getByLabelText('Añadir una carrera en cinta, como el calentamiento'));
    await fireEvent.changeText(screen.getByLabelText('Distancia de la carrera en cinta, en kilómetros'), '2');
    await anadir(null, 'Press banca');
    await fireEvent.changeText(await screen.findByLabelText('Repeticiones'), '8');
    await anadir('Espalda', 'Remo con barra');
    await fireEvent.changeText(await screen.findByLabelText('Repeticiones'), '10');
    await anadir('Core', 'Plancha');
    await fireEvent.changeText(await screen.findByLabelText('Segundos'), '60');
    await fireEvent.press(screen.getByText('Enlazar en superserie con Remo con barra'));
    await fireEvent.press(screen.getByLabelText(/^Separar la superserie/));
    await fireEvent.press(screen.getByText('Enlazar en superserie con Remo con barra'));

    await fireEvent.press(screen.getByLabelText('7, duro'));
    await fireEvent.changeText(screen.getByLabelText('Duración en minutos'), '45');
    await fireEvent.press(screen.getByText('Guardar'));
    await waitFor(() => expect(app.getPathname()).toBe('/'));
    expect(
      mockBase.mirar(
        `SELECT b.orden, b.metros_corridos AS metros, group_concat(s.ejercicio_id, '+') AS ejercicios
         FROM bloque AS b LEFT JOIN serie AS s ON s.bloque_id = b.id GROUP BY b.id ORDER BY b.orden`,
      ),
    ).toEqual([
      { orden: 1, metros: 2000, ejercicios: null },
      { orden: 2, metros: null, ejercicios: expect.stringMatching(/^(press-banca\+remo-barra|remo-barra\+press-banca)$/) },
      { orden: 3, metros: null, ejercicios: 'plancha' },
    ]);
  });

  it('en Apuntar, cada disciplina sale con su mascota: el rinoceronte junto al gimnasio y las demás junto a las suyas', async () => {
    await renderRouter(RUTAS, { initialUrl: '/apuntar' });
    await screen.findByLabelText('Hyrox, pronto');
    // Las mascotas son decorativas: el lector de pantalla las salta, y la prueba las busca igual.
    const dibujoDe = (nombre: string | RegExp) =>
      within(screen.getByRole('button', { name: nombre })).getByTestId('mascota', { includeHiddenElements: true }).props
        .source.testUri;
    expect(dibujoDe(/^Gimnasio/)).toMatch(/rinoceronte\.png$/);
    expect(dibujoDe('Hyrox, pronto')).toMatch(/tigre\.png$/);
    expect(dibujoDe('Calistenia, pronto')).toMatch(/gorila\.png$/);
    expect(dibujoDe('Carrera, pronto')).toMatch(/galgo\.png$/);
    expect(dibujoDe('Natación, pronto')).toMatch(/foca\.png$/);
  });

  it('en el editor, el rinoceronte cambia con el esfuerzo', async () => {
    await renderRouter(RUTAS, { initialUrl: '/apuntar/gimnasio' });
    await screen.findByText('Añadir ejercicio');
    const dibujo = () => screen.getByTestId('mascota').props.source.testUri;
    expect(dibujo()).toMatch(/rinoceronte\.png$/);
    await fireEvent.press(screen.getByLabelText('7, duro'));
    expect(dibujo()).toMatch(/rinoceronte-4\.png$/);
    await fireEvent.press(screen.getByLabelText('10, máximo'));
    expect(dibujo()).toMatch(/rinoceronte-5\.png$/);
  });

  it('un borrador del editor anterior se abre igual, sin perder nada', async () => {
    const deLaForma1 = {
      formato: 1,
      id: '019a6e8c-0000-7000-8000-000000000001',
      selloLeido: null,
      fecha: '2026-11-09',
      hora: '10:00',
      bloques: [
        {
          id: '019a6e8c-0000-7000-8000-000000000002',
          ejercicioId: 'press-banca',
          series: [{ id: '019a6e8c-0000-7000-8000-000000000003', repeticiones: '8', peso: '60', segundos: '', hecha: null }],
        },
      ],
      minutos: '',
      esfuerzo: null,
      notas: '',
    };
    await mockBase.runAsync(
      'INSERT INTO ajuste (clave, valor, modificado) VALUES (:clave, :valor, :modificado)',
      p({ clave: 'local.borrador.gimnasio', valor: JSON.stringify(deLaForma1), modificado: T0 }),
    );
    await renderRouter(RUTAS, { initialUrl: '/apuntar/gimnasio' });
    expect(await screen.findByText('60 kg × 8')).toBeOnTheScreen();
    expect(screen.queryByText(/no sabe leer/)).toBeNull();
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

  it('la serie abierta se distingue de las demás: va en el rosa suave y con el borde rosa', async () => {
    await abrirElEditor();
    await anadir(null, 'Press banca');
    expect(await screen.findByTestId('serie-abierta')).toHaveStyle({
      backgroundColor: PALETAS.claro.tintePrimario,
      borderColor: PALETAS.claro.primario,
      borderWidth: 2,
    });
  });

  it('las tarjetas van juntas, a 8 del día y entre sí, con los botones de añadir debajo, y sin ejercicios no dejan hueco', async () => {
    await abrirElEditor();
    expect(screen.queryByTestId('bloques')).toBeNull();
    await anadir(null, 'Press banca');
    await anadir('Espalda', 'Remo con barra');
    const bloques = await screen.findByTestId('bloques');
    expect(bloques).toHaveStyle({ marginTop: 8, gap: 8 });
    expect(within(bloques).getAllByTestId('bloque')).toHaveLength(2);
    // «Añadir ejercicio» y «Carrera en cinta» van juntos, como pareja, a 12 de la última tarjeta.
    const anadirAlgo = screen.getByTestId('anadir');
    expect(anadirAlgo).toHaveStyle({ marginTop: 12, gap: 4 });
    expect(within(anadirAlgo).getByText('Añadir ejercicio')).toBeOnTheScreen();
    expect(within(anadirAlgo).getByLabelText('Añadir una carrera en cinta, como el calentamiento')).toBeOnTheScreen();
    // Los tres van juntos, en este orden, en una caja sin hueco propio: el de la pantalla, de 16, no les llega.
    const lista = screen.getByTestId('lista');
    expect(StyleSheet.flatten(lista.props.style)?.gap ?? 0).toBe(0);
    const [dia, ...resto] = lista.children as (typeof lista)[];
    expect(within(dia).getByText('Cambiar el día')).toBeOnTheScreen();
    expect(resto.map((hijo) => hijo.props.testID)).toEqual(['bloques', 'anadir']);
  });

  it('arriba, el día va en negrita y un poco hacia dentro, y la pantalla empieza cerca de la cabecera', async () => {
    await abrirElEditor();
    expect(StyleSheet.flatten(screen.getByText(/^Hoy/).props.style)).toMatchObject({ fontWeight: '600', marginLeft: 4 });
    expect(StyleSheet.flatten(screen.getByTestId('editor').props.contentContainerStyle)).toMatchObject({
      padding: 16,
      paddingTop: 8,
    });
  });
});
