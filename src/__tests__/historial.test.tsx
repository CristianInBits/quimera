import { act, fireEvent, waitFor, within } from '@testing-library/react-native';
import { renderRouter, screen, testRouter } from 'expo-router/testing-library';
import { Alert } from 'react-native';

import Historial from '@/app/(pestanas)/historial';
import Pestanas from '@/app/(pestanas)/_layout';
import Inicio from '@/app/(pestanas)/index';
import * as Raiz from '@/app/_layout';
import Apuntar from '@/app/apuntar';
import ApuntarGimnasio from '@/app/apuntar/gimnasio';
import DetalleDelEntreno from '@/app/entreno/[id]';
import { p, puertaDe } from '@/datos/base';
import { borrarEntrenoEn, guardarEntrenoEn, type Entreno } from '@/datos/entrenos';
import { fechaLocal, sumarDias } from '@/datos/fechas';
import { CLAVE_DEL_BORRADOR, claveDeCorreccion } from '@/gimnasio/editor';
import { recogerElBorrado } from '@/historial/ultimoBorrado';
import type { BaseDePrueba } from '@/pruebas/baseDePrueba';
import { abrirBasePreparada, generadorDeIds } from '@/pruebas/datos';

// Las pantallas de verdad sobre la base de prueba, como en
// apuntar-gimnasio.test.tsx: allí están las trampas de los temporizadores.
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
  // Con su ancla: las pestañas van siempre debajo.
  _layout: Raiz,
  '(pestanas)/_layout': Pestanas,
  '(pestanas)/index': Inicio,
  '(pestanas)/historial': Historial,
  'apuntar/index': Apuntar,
  'apuntar/gimnasio': ApuntarGimnasio,
  'entreno/[id]': DetalleDelEntreno,
};

const espias: jest.SpyInstance[] = [];
const espiar = <T extends jest.SpyInstance>(espia: T): T => {
  espias.push(espia);
  return espia;
};
const dejarPasar = (ms = 2000) => act(() => jest.advanceTimersByTimeAsync(ms));
const ids = generadorDeIds();
const hoy = () => fechaLocal(new Date());

/** Una serie de gimnasio, con lo que no se diga vacío. */
const serie = (ronda: number, orden: number, ejercicioId: string, cambios: Partial<Entreno['bloques'][number]['series'][number]>) => ({
  id: ids(),
  ronda,
  orden,
  ejercicioId,
  repeticiones: null,
  pesoG: null,
  tiempoMs: null,
  distanciaM: null,
  calorias: null,
  descansoMs: null,
  ...cambios,
});

/**
 * El entreno de hoy a las 18:30: 2,35 km de cinta con 2 minutos de descanso,
 * una superserie de press banca y remo de dos vueltas, con 1:30 entre vueltas
 * y un minuto antes de la plancha, y la plancha.
 */
function deHoy(): Entreno {
  return {
    id: ids(),
    disciplina: 'gimnasio',
    fecha: hoy(),
    hora: '18:30',
    duracionMs: 45 * 60_000,
    esfuerzo: 7,
    notas: 'Buen día',
    bloques: [
      { id: ids(), metrosCorridos: 2350, tiempoMs: 720_000, descansoMs: 120_000, series: [] },
      {
        id: ids(),
        metrosCorridos: null,
        tiempoMs: null,
        descansoMs: 60_000,
        series: [1, 2].flatMap((ronda) => [
          serie(ronda, 1, 'press-banca', { repeticiones: 8, pesoG: 60_000, descansoMs: 0 }),
          serie(ronda, 2, 'remo-barra', { repeticiones: 10, pesoG: 50_000, descansoMs: ronda === 1 ? 90_000 : null }),
        ]),
      },
      { id: ids(), metrosCorridos: null, tiempoMs: null, descansoMs: null, series: [serie(1, 1, 'plancha', { tiempoMs: 60_000 })] },
    ],
  };
}

/** Un press banca suelto de hace una semana, sin hora, de 45 minutos y medio. */
function deLaSemanaPasada(): Entreno {
  return {
    id: ids(),
    disciplina: 'gimnasio',
    fecha: sumarDias(hoy(), -7),
    hora: null,
    duracionMs: 45 * 60_000 + 30_000,
    esfuerzo: 5,
    notas: null,
    bloques: [
      {
        id: ids(),
        metrosCorridos: null,
        tiempoMs: null,
        descansoMs: null,
        series: [serie(1, 1, 'press-banca', { repeticiones: 8, pesoG: 60_000 })],
      },
    ],
  };
}

const guardar = (entreno: Entreno) =>
  puertaDe(mockBase).escribir((tx) => guardarEntrenoEn(tx, entreno, { ahora: Date.now(), selloLeido: null }));
/** Los borradores del editor que hay en el móvil: el del entreno nuevo y los de las correcciones. */
const borradores = () =>
  mockBase.mirar<{ clave: string }>(
    "SELECT clave FROM ajuste WHERE clave LIKE 'local.borrador.%' OR clave LIKE 'local.correccion.%' ORDER BY clave",
  );

/** Deja un entreno nuevo a medias en el móvil, como si se hubiera empezado a apuntar. */
async function entrenoNuevoAMedias() {
  const borrador = {
    formato: 2,
    id: '019a6e8c-0000-7000-8000-0000000000aa',
    selloLeido: null,
    fecha: hoy(),
    hora: '10:00',
    bloques: [],
    minutos: '',
    duracionLeida: null,
    huellaLeida: null,
    esfuerzo: 6,
    notas: 'A medias',
  };
  await mockBase.runAsync(
    'INSERT INTO ajuste (clave, valor, modificado) VALUES (:clave, :valor, :modificado)',
    p({ clave: CLAVE_DEL_BORRADOR, valor: JSON.stringify(borrador), modificado: Date.now() }),
  );
}

/** Abre el historial y, en él, el detalle del entreno de hoy. */
async function abrirElDeHoy() {
  const app = await renderRouter(RUTAS, { initialUrl: '/historial' });
  await fireEvent.press(await screen.findByLabelText(/^Gimnasio, hoy, a las 18:30/));
  await screen.findByText('Borrar entreno');
  return app;
}

describe('El historial y el detalle de un entreno', () => {
  beforeEach(async () => {
    mockBase?.cerrar();
    mockBase = await abrirBasePreparada();
    // Lo que dejara pendiente una prueba anterior no sale en la siguiente.
    recogerElBorrado();
  });
  afterEach(() => {
    jest.useRealTimers();
    espias.forEach((espia) => espia.mockRestore());
    espias.length = 0;
  });
  afterAll(() => mockBase.cerrar());

  it('enseña los entrenos por semanas, con lo que se hizo en cada uno', async () => {
    await guardar(deHoy());
    await guardar(deLaSemanaPasada());
    await renderRouter(RUTAS, { initialUrl: '/historial' });

    // Inicio está montado debajo y también dice «Esta semana»: se mira solo el historial.
    const historial = within(await screen.findByTestId('historial'));
    expect(await historial.findByText('1 entreno · 45 minutos')).toBeOnTheScreen();
    expect(historial.getByText('Esta semana')).toBeOnTheScreen();
    expect(historial.getByText('La semana pasada')).toBeOnTheScreen();
    expect(historial.getByText('1 entreno · 46 minutos')).toBeOnTheScreen();
    expect(screen.getByText('Press banca, Remo con barra y Plancha · 2,35 km')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Gimnasio, hoy, a las 18:30. Press banca, Remo con barra y Plancha, 2,35 km. 45 minutos, esfuerzo 7, duro'),
    ).toBeOnTheScreen();
  });

  it('el detalle enseña la carrera, la superserie con sus vueltas, los descansos y las notas', async () => {
    await guardar(deHoy());
    await abrirElDeHoy();

    expect(screen.getByText('Carrera en cinta')).toBeOnTheScreen();
    expect(screen.getByText('2,35 km en 12 minutos')).toBeOnTheScreen();
    expect(screen.getByText('Descanso: 2:00 antes del siguiente')).toBeOnTheScreen();
    expect(screen.getByText('SUPERSERIE')).toBeOnTheScreen();
    expect(screen.getByText('Press banca + Remo con barra')).toBeOnTheScreen();
    expect(screen.getByLabelText('Vuelta 2, Remo con barra: 50 kg × 10')).toBeOnTheScreen();
    expect(screen.getByText('Descansos: 1:30 entre vueltas · 1:00 antes del siguiente')).toBeOnTheScreen();
    expect(screen.getByLabelText('Serie 1: 1:00')).toBeOnTheScreen();
    expect(screen.getByText('Buen día')).toBeOnTheScreen();
    expect(screen.getByText('Esfuerzo 7, duro')).toBeOnTheScreen();
  });

  it('borrar no pregunta: vuelve al historial con el aviso, y Deshacer lo devuelve', async () => {
    const entreno = deHoy();
    await guardar(entreno);
    const app = await abrirElDeHoy();
    await fireEvent.press(screen.getByText('Borrar entreno'));

    await waitFor(() => expect(app.getPathname()).toBe('/historial'));
    expect(await screen.findByText('Entreno de hoy borrado')).toBeOnTheScreen();
    expect(await screen.findByText('Aquí saldrán tus entrenos cuando apuntes el primero.')).toBeOnTheScreen();
    expect(mockBase.mirar('SELECT borrado FROM entreno')).toEqual([{ borrado: 1 }]);

    await fireEvent.press(screen.getByText('Deshacer'));
    expect(await screen.findByLabelText(/^Gimnasio, hoy, a las 18:30/)).toBeOnTheScreen();
    expect(mockBase.mirar('SELECT borrado FROM entreno')).toEqual([{ borrado: 0 }]);
    expect(mockBase.mirar('SELECT DISTINCT borrado FROM serie')).toEqual([{ borrado: 0 }]);
  });

  it('corregir abre el editor con el entreno, y guardar los cambios vuelve al detalle con ellos', async () => {
    const entreno = deLaSemanaPasada();
    await guardar(entreno);
    const app = await renderRouter(RUTAS, { initialUrl: `/entreno/${entreno.id}` });
    await fireEvent.press(await screen.findByText('Corregir'));

    expect(await screen.findByText('Guardar los cambios')).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText('Serie 1: 60 kg × 8'));
    await fireEvent.changeText(screen.getByLabelText('Repeticiones'), '10');
    // Que el borrador de la corrección llegue a escribirse, para ver que guardar lo quita.
    await dejarPasar();
    expect(borradores()).toEqual([{ clave: claveDeCorreccion(entreno.id) }]);
    await fireEvent.press(screen.getByText('Guardar los cambios'));

    await waitFor(() => expect(app.getPathname()).toBe(`/entreno/${entreno.id}`));
    expect(await screen.findByText('60 kg × 10')).toBeOnTheScreen();
    expect(await screen.findByText('Corregir')).toBeOnTheScreen();
    expect(mockBase.mirar('SELECT repeticiones FROM serie')).toEqual([{ repeticiones: 10 }]);
    // La duración no se tocó: se queda con su medio minuto, y así se ve.
    expect(mockBase.mirar('SELECT duracion_ms FROM entreno')).toEqual([{ duracion_ms: 45 * 60_000 + 30_000 }]);
    expect(screen.getByText('45:30')).toBeOnTheScreen();
    expect(borradores()).toEqual([]);
  });

  it('el detalle abierto directamente tiene las pestañas debajo, y su vuelta atrás dice Historial', async () => {
    const entreno = deHoy();
    await guardar(entreno);
    const app = await renderRouter(RUTAS, { initialUrl: `/entreno/${entreno.id}` });
    await screen.findByText('Borrar entreno');
    expect(app.getRouterState()?.routes[0]?.state?.routes.map((ruta) => ruta.name)).toEqual(['(pestanas)', 'entreno/[id]']);
  });

  it('borrar y deshacer un entreno con una corrección a medias la deja guardarse encima, sin duplicarlo', async () => {
    const entreno = deLaSemanaPasada();
    await guardar(entreno);
    const app = await renderRouter(RUTAS, { initialUrl: '/historial' });
    await fireEvent.press(await screen.findByLabelText(/^Gimnasio, /));
    await fireEvent.press(await screen.findByText('Corregir'));
    await fireEvent.press(await screen.findByLabelText('Serie 1: 60 kg × 8'));
    await fireEvent.changeText(screen.getByLabelText('Repeticiones'), '6');
    await dejarPasar();
    await testRouter.back(`/entreno/${entreno.id}`);

    // Al borrar, la corrección a medias se aparta con el entreno…
    await fireEvent.press(await screen.findByText('Borrar entreno'));
    await waitFor(() => expect(app.getPathname()).toBe('/historial'));
    expect(borradores()).toEqual([]);
    // …y vuelve al deshacer.
    expect(await screen.findByText(/^Entreno del .* borrado$/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Deshacer'));
    await waitFor(() => expect(borradores()).toEqual([{ clave: claveDeCorreccion(entreno.id) }]));

    await fireEvent.press(await screen.findByLabelText(/^Gimnasio, /));
    await fireEvent.press(await screen.findByText('Seguir corrigiendo'));
    await fireEvent.press(await screen.findByText('Guardar los cambios'));
    await waitFor(() => expect(app.getPathname()).toBe(`/entreno/${entreno.id}`));
    expect(mockBase.mirar('SELECT COUNT(*) AS n, MIN(borrado) AS borrado FROM entreno')).toEqual([{ n: 1, borrado: 0 }]);
    expect(mockBase.mirar('SELECT repeticiones FROM serie')).toEqual([{ repeticiones: 6 }]);
  });

  it('dos entrenos de la misma semana van juntos, con la suma de la semana', async () => {
    const temprano = { ...deLaSemanaPasada(), fecha: hoy(), hora: '08:00', duracionMs: 40 * 60_000 };
    const tarde = { ...deLaSemanaPasada(), fecha: hoy(), hora: '18:30', duracionMs: 50 * 60_000 };
    await guardar(temprano);
    await guardar(tarde);
    await renderRouter(RUTAS, { initialUrl: '/historial' });
    const historial = within(await screen.findByTestId('historial'));
    expect(await historial.findByText('2 entrenos · 90 minutos')).toBeOnTheScreen();
    expect(historial.getAllByText('Esta semana')).toHaveLength(1);
  });

  it('un entreno guardado desde otra pestaña sale en el historial al volver a él', async () => {
    await renderRouter(RUTAS, { initialUrl: '/historial' });
    expect(await screen.findByText('Aquí saldrán tus entrenos cuando apuntes el primero.')).toBeOnTheScreen();
    await testRouter.navigate('/');
    const guardado = guardar(deHoy());
    await dejarPasar();
    await guardado;
    await testRouter.navigate('/historial');
    expect(await screen.findByLabelText(/^Gimnasio, hoy, a las 18:30/)).toBeOnTheScreen();
  });

  it('el aviso de un borrado se va solo, y no vuelve a salir', async () => {
    await guardar(deHoy());
    await renderRouter(RUTAS, { initialUrl: '/historial' });
    await fireEvent.press(await screen.findByLabelText(/^Gimnasio, hoy, a las 18:30/));
    await fireEvent.press(await screen.findByText('Borrar entreno'));
    expect(await screen.findByText('Entreno de hoy borrado')).toBeOnTheScreen();
    // A los 6 segundos se va solo.
    await dejarPasar(7000);
    expect(screen.queryByText('Entreno de hoy borrado')).toBeNull();
    // Y al volver al historial no sale otra vez.
    await testRouter.navigate('/');
    await testRouter.navigate('/historial');
    await dejarPasar(100);
    expect(screen.queryByText('Entreno de hoy borrado')).toBeNull();
  });

  it('guardar o descartar una corrección no toca el entreno nuevo a medias', async () => {
    const alerta = espiar(jest.spyOn(Alert, 'alert'));
    await entrenoNuevoAMedias();
    const entreno = deLaSemanaPasada();
    await guardar(entreno);
    const app = await renderRouter(RUTAS, { initialUrl: `/entreno/${entreno.id}` });
    await fireEvent.press(await screen.findByText('Corregir'));
    await fireEvent.press(await screen.findByLabelText('Serie 1: 60 kg × 8'));
    await fireEvent.changeText(screen.getByLabelText('Repeticiones'), '6');
    await dejarPasar();
    expect(borradores()).toEqual([{ clave: CLAVE_DEL_BORRADOR }, { clave: claveDeCorreccion(entreno.id) }]);

    await fireEvent.press(screen.getByText('Descartar los cambios'));
    const botones = alerta.mock.calls[0][2] ?? [];
    await act(async () => botones.find((b) => b.text === 'Descartar')?.onPress?.());
    await dejarPasar();
    expect(app.getPathname()).toBe(`/entreno/${entreno.id}`);
    expect(borradores()).toEqual([{ clave: CLAVE_DEL_BORRADOR }]);

    await fireEvent.press(await screen.findByText('Corregir'));
    await fireEvent.press(await screen.findByLabelText('Serie 1: 60 kg × 8'));
    await fireEvent.changeText(screen.getByLabelText('Repeticiones'), '6');
    await dejarPasar();
    await fireEvent.press(screen.getByText('Guardar los cambios'));
    await waitFor(() => expect(app.getPathname()).toBe(`/entreno/${entreno.id}`));
    await dejarPasar();
    expect(borradores()).toEqual([{ clave: CLAVE_DEL_BORRADOR }]);
  });

  it('una corrección ilegible se aparta en su propia clave, sin tocar la del entreno nuevo', async () => {
    const entreno = deLaSemanaPasada();
    await guardar(entreno);
    await entrenoNuevoAMedias();
    await mockBase.runAsync(
      'INSERT INTO ajuste (clave, valor, modificado) VALUES (:clave, :valor, :modificado)',
      p({ clave: claveDeCorreccion(entreno.id), valor: JSON.stringify({ formato: 99 }), modificado: Date.now() }),
    );
    await renderRouter(RUTAS, { initialUrl: `/apuntar/gimnasio?corregir=${entreno.id}` });
    expect(await screen.findByText(/no sabe leer/)).toBeOnTheScreen();
    expect(screen.getByLabelText('Serie 1: 60 kg × 8')).toBeOnTheScreen();
    await dejarPasar();
    expect(borradores()).toEqual([{ clave: CLAVE_DEL_BORRADOR }, { clave: `${claveDeCorreccion(entreno.id)}.ilegible` }]);
  });

  it('abrir la corrección y salir sin tocar nada no deja borrador', async () => {
    const entreno = deLaSemanaPasada();
    await guardar(entreno);
    await renderRouter(RUTAS, { initialUrl: `/entreno/${entreno.id}` });
    await fireEvent.press(await screen.findByText('Corregir'));
    await screen.findByText('Guardar los cambios');
    await dejarPasar();
    await testRouter.back(`/entreno/${entreno.id}`);
    await dejarPasar();

    expect(await screen.findByText('Corregir')).toBeOnTheScreen();
    expect(borradores()).toEqual([]);
  });

  it('una corrección a medias se guarda aparte del entreno nuevo, y se sigue donde se dejó', async () => {
    const entreno = deLaSemanaPasada();
    await guardar(entreno);
    await renderRouter(RUTAS, { initialUrl: `/entreno/${entreno.id}` });
    await fireEvent.press(await screen.findByText('Corregir'));
    await fireEvent.press(await screen.findByLabelText('Serie 1: 60 kg × 8'));
    await fireEvent.changeText(screen.getByLabelText('Repeticiones'), '6');
    await dejarPasar();
    await testRouter.back(`/entreno/${entreno.id}`);

    expect(borradores()).toEqual([{ clave: claveDeCorreccion(entreno.id) }]);
    await fireEvent.press(await screen.findByText('Seguir corrigiendo'));
    expect(await screen.findByText('60 kg × 6')).toBeOnTheScreen();
    // El entreno guardado sigue como estaba.
    expect(mockBase.mirar('SELECT repeticiones FROM serie')).toEqual([{ repeticiones: 8 }]);
  });

  it('descartar los cambios deja el entreno como estaba y quita el borrador', async () => {
    const alerta = espiar(jest.spyOn(Alert, 'alert'));
    const entreno = deLaSemanaPasada();
    await guardar(entreno);
    const app = await renderRouter(RUTAS, { initialUrl: `/entreno/${entreno.id}` });
    await fireEvent.press(await screen.findByText('Corregir'));
    await fireEvent.press(await screen.findByLabelText('Serie 1: 60 kg × 8'));
    await fireEvent.changeText(screen.getByLabelText('Repeticiones'), '6');
    await dejarPasar();

    await fireEvent.press(screen.getByText('Descartar los cambios'));
    expect(alerta.mock.calls[0].slice(0, 2)).toEqual(['¿Descartar los cambios?', 'El entreno guardado se queda como estaba.']);
    const botones = alerta.mock.calls[0][2] ?? [];
    await act(async () => botones.find((b) => b.text === 'Descartar')?.onPress?.());
    await dejarPasar();

    expect(app.getPathname()).toBe(`/entreno/${entreno.id}`);
    expect(borradores()).toEqual([]);
    expect(mockBase.mirar('SELECT repeticiones FROM serie')).toEqual([{ repeticiones: 8 }]);
  });

  it('si el entreno se borró mientras se corregía, lo corregido se puede guardar como un entreno nuevo', async () => {
    const entreno = deLaSemanaPasada();
    await guardar(entreno);
    const app = await renderRouter(RUTAS, { initialUrl: `/entreno/${entreno.id}` });
    await fireEvent.press(await screen.findByText('Corregir'));
    await fireEvent.press(await screen.findByLabelText('Serie 1: 60 kg × 8'));
    await fireEvent.changeText(screen.getByLabelText('Repeticiones'), '6');
    await dejarPasar();
    // Mientras tanto, el entreno se borra. Con los temporizadores falsos, la base
    // de prueba solo avanza si se deja pasar el tiempo.
    const borrado = puertaDe(mockBase).escribir((tx) => borrarEntrenoEn(tx, entreno.id, Date.now()));
    await dejarPasar();
    await borrado;
    await fireEvent.press(screen.getByText('Guardar los cambios'));
    await dejarPasar();

    expect(screen.getByText(/Este entreno se ha borrado mientras lo corregías/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Guardarlo como un entreno nuevo'));
    await waitFor(() => expect(app.getPathname()).toBe('/historial'));
    expect(
      mockBase.mirar('SELECT e.id = :viejo AS viejo, e.borrado, s.repeticiones FROM entreno AS e JOIN bloque AS b ON b.entreno_id = e.id JOIN serie AS s ON s.bloque_id = b.id ORDER BY viejo', {
        ':viejo': entreno.id,
      }),
    ).toEqual([
      { viejo: 0, borrado: 0, repeticiones: 6 },
      { viejo: 1, borrado: 1, repeticiones: 8 },
    ]);
    expect(borradores()).toEqual([]);
  });

  it('un entreno borrado ya no se abre para corregir', async () => {
    const entreno = deLaSemanaPasada();
    await guardar(entreno);
    await puertaDe(mockBase).escribir((tx) => borrarEntrenoEn(tx, entreno.id, Date.now()));
    await renderRouter(RUTAS, { initialUrl: `/apuntar/gimnasio?corregir=${entreno.id}` });
    expect(await screen.findByText('Este entreno ya no está: se ha borrado.')).toBeOnTheScreen();
  });

  it('un entreno que el editor no sabría enseñar sin perder datos no se abre para corregir', async () => {
    const entreno = deLaSemanaPasada();
    const [bloque] = entreno.bloques;
    // Un descanso de un segundo y medio detrás de la última serie no lo escribe el editor.
    await guardar({ ...entreno, bloques: [{ ...bloque, series: [{ ...bloque.series[0], descansoMs: 1500 }] }] });
    await renderRouter(RUTAS, { initialUrl: `/apuntar/gimnasio?corregir=${entreno.id}` });
    expect(await screen.findByText(/todavía no sabe enseñar/)).toBeOnTheScreen();
  });
});
