import { act } from '@testing-library/react-native';
import { useFonts } from 'expo-font';
import { renderRouter, screen } from 'expo-router/testing-library';
import * as SplashScreen from 'expo-splash-screen';

import Historial from '@/app/(pestanas)/historial';
import Pestanas from '@/app/(pestanas)/_layout';
import Inicio from '@/app/(pestanas)/index';
import Raiz from '@/app/_layout';
import type { BaseDePrueba } from '@/pruebas/baseDePrueba';
import { abrirBasePreparada } from '@/pruebas/datos';

// La raíz carga las fuentes de los títulos con la pantalla de carga puesta. En
// las demás pruebas las fuentes cargan siempre; aquí useFonts dice lo que haga
// falta, y la pantalla de carga es un simulacro que apunta si se esconde.
let mockBase: BaseDePrueba;
jest.mock('expo-sqlite', () => ({
  SQLiteProvider: ({ children }: { children: unknown }) => children,
  useSQLiteContext: () => mockBase,
}));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve(true)),
  hideAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }));

const RUTAS = {
  _layout: Raiz,
  '(pestanas)/_layout': Pestanas,
  '(pestanas)/index': Inicio,
  '(pestanas)/historial': Historial,
};

const LEMA = 'Tus entrenos, en tu móvil.';

describe('La raíz de la app', () => {
  beforeEach(async () => {
    mockBase?.cerrar();
    mockBase = await abrirBasePreparada();
    jest.mocked(SplashScreen.hideAsync).mockClear();
  });
  afterEach(() => {
    jest.useRealTimers();
  });
  afterAll(() => mockBase.cerrar());

  it('deja puesta la pantalla de carga desde que se carga el código', () => {
    expect(SplashScreen.preventAutoHideAsync).toHaveBeenCalled();
  });

  it('con las fuentes cargadas, enseña Inicio y quita la pantalla de carga', async () => {
    jest.mocked(useFonts).mockReturnValue([true, null]);
    await renderRouter(RUTAS, { initialUrl: '/' });
    expect(await screen.findByText(LEMA)).toBeOnTheScreen();
    expect(SplashScreen.hideAsync).toHaveBeenCalled();
  });

  it('si las fuentes no cargan, la app sigue con la letra del sistema y quita la pantalla de carga', async () => {
    jest.mocked(useFonts).mockReturnValue([false, new Error('sin fuentes')]);
    await renderRouter(RUTAS, { initialUrl: '/' });
    expect(await screen.findByText(LEMA)).toBeOnTheScreen();
    expect(SplashScreen.hideAsync).toHaveBeenCalled();
  });

  it('mientras cargan las fuentes, no enseña nada y la pantalla de carga sigue', async () => {
    jest.mocked(useFonts).mockReturnValue([false, null]);
    await renderRouter(RUTAS, { initialUrl: '/' });
    // Antes de mirar que no hay nada, se deja pasar el tiempo.
    await act(() => jest.advanceTimersByTimeAsync(2000));
    expect(screen.queryByText(LEMA)).toBeNull();
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
  });
});
