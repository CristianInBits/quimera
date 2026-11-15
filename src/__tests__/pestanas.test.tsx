import { renderRouter, screen as pantallaDelRouter, testRouter } from 'expo-router/testing-library';

import Historial from '@/app/(pestanas)/historial';
import Pestanas from '@/app/(pestanas)/_layout';
import Inicio from '@/app/(pestanas)/index';
import Raiz from '@/app/_layout';
import type { BaseDePrueba } from '@/pruebas/baseDePrueba';
import { abrirBasePreparada } from '@/pruebas/datos';

// Inicio y el historial leen la base: la de expo-sqlite es aquí la base de prueba, vacía.
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

// Las pruebas viven fuera de src/app: ahí cada fichero es una pantalla. El
// aspecto de la barra de pestañas, que es nativa, solo se ve en el móvil.
describe('Las pestañas', () => {
  // Como en apuntar-gimnasio.test.tsx: renderRouter pone los temporizadores
  // falsos, y la base de cada prueba se cierra al empezar la siguiente.
  beforeEach(async () => {
    mockBase?.cerrar();
    mockBase = await abrirBasePreparada();
  });
  afterEach(() => {
    jest.useRealTimers();
  });
  afterAll(() => mockBase.cerrar());

  // Lo que enseña Inicio se prueba en inicio.test.tsx.

  it('Historial avisa de que aún no hay entrenos', async () => {
    await renderRouter(RUTAS, { initialUrl: '/historial' });

    expect(await pantallaDelRouter.findByText('Aquí saldrán tus entrenos cuando apuntes el primero.')).toBeOnTheScreen();
    expect(pantallaDelRouter.getByRole('header', { name: 'Historial' })).toBeOnTheScreen();
  });

  it('la app abre en Inicio y la pestaña Historial lleva al historial', async () => {
    const avisos: string[] = [];
    const espia = jest.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      avisos.push(args.map(String).join(' '));
    });
    try {
      const app = await renderRouter(RUTAS, { initialUrl: '/' });
      expect(app.getPathname()).toBe('/');
      expect(pantallaDelRouter.getByText('Tus entrenos, en tu móvil.')).toBeOnTheScreen();

      // Si el Trigger de una pestaña no casara con su fichero, expo-router
      // volvería a Inicio y solo avisaría en la consola.
      await testRouter.navigate('/historial');
      expect(app.getPathname()).toBe('/historial');
      expect(avisos.filter((aviso) => aviso.includes('[Layout children]'))).toEqual([]);
    } finally {
      espia.mockRestore();
    }
  });
});
