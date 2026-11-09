import { render, screen } from '@testing-library/react-native';

import Inicio from '@/app/index';

// Las pruebas viven fuera de src/app: ahí cada fichero es una pantalla.
describe('La pantalla de inicio', () => {
  it('dice qué es Quimera', async () => {
    await render(<Inicio />);

    expect(screen.getByText('Quimera')).toBeOnTheScreen();
    expect(screen.getByText('Tus entrenos, en tu móvil.')).toBeOnTheScreen();
  });
});
