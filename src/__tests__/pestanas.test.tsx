import { render, screen } from '@testing-library/react-native';
import { renderRouter, screen as pantallaDelRouter, testRouter } from 'expo-router/testing-library';

import Historial from '@/app/(pestanas)/historial';
import Pestanas from '@/app/(pestanas)/_layout';
import Inicio from '@/app/(pestanas)/index';
import Raiz from '@/app/_layout';

// La base no hace falta para navegar: el SQLiteProvider se queda en sus hijos.
jest.mock('expo-sqlite', () => ({
  SQLiteProvider: ({ children }: { children: unknown }) => children,
}));

// Las pruebas viven fuera de src/app: ahí cada fichero es una pantalla. El
// aspecto de la barra de pestañas, que es nativa, solo se ve en el móvil.
describe('Las pestañas', () => {
  it('Inicio dice qué es Quimera', async () => {
    await render(<Inicio />);

    expect(screen.getByText('Quimera')).toBeOnTheScreen();
    expect(screen.getByText('Tus entrenos, en tu móvil.')).toBeOnTheScreen();
  });

  it('Historial avisa de que aún no hay entrenos', async () => {
    await render(<Historial />);

    expect(screen.getByText('Historial')).toBeOnTheScreen();
    expect(screen.getByText('Aquí saldrán tus entrenos cuando apuntes el primero.')).toBeOnTheScreen();
  });

  it('la app abre en Inicio y la pestaña Historial lleva al historial', async () => {
    const avisos: string[] = [];
    const espia = jest.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      avisos.push(args.map(String).join(' '));
    });
    try {
      const app = await renderRouter(
        {
          _layout: Raiz,
          '(pestanas)/_layout': Pestanas,
          '(pestanas)/index': Inicio,
          '(pestanas)/historial': Historial,
        },
        { initialUrl: '/' },
      );
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
