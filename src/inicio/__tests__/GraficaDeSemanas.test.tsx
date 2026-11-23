import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet, useColorScheme } from 'react-native';

import { GraficaDeSemanas } from '@/inicio/GraficaDeSemanas';
import { PALETAS } from '@/tema/colores';

// La escala de la letra del sistema: 1 con la letra normal y 2 con la grande.
let mockEscala = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 844, scale: 2, fontScale: mockEscala }),
}));

const paleta = PALETAS.claro;
const conCargas = (cargas: number[]) => cargas.map((carga, i) => ({ lunes: `2026-09-${21 + i}`, carga }));
const SEMANAS = conCargas([620, 0, 840, 910, 760, 1105, 980, 1241]);
const estilo = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID, { includeHiddenElements: true }).props.style);
/** Coloca la gráfica con el ancho dado, como el móvil al dibujarla. */
const colocar = async (ancho: number) =>
  fireEvent(screen.getByRole('image'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: ancho, height: 120 } } });

describe('La gráfica de las últimas semanas', () => {
  afterEach(() => {
    mockEscala = 1;
  });

  it('es una sola imagen que dice todas las cifras, de la más antigua a esta', async () => {
    await render(<GraficaDeSemanas semanas={SEMANAS} />);
    expect(
      screen.getByRole('image', {
        name: 'Carga de las 8 últimas semanas, de la más antigua a esta: 620, 0, 840, 910, 760, 1105, 980 y 1241.',
      }),
    ).toBeOnTheScreen();
  });

  it('las barras van en fila, de la más antigua a esta', async () => {
    await render(<GraficaDeSemanas semanas={SEMANAS} />);
    expect(estilo('barras')).toMatchObject({ flexDirection: 'row' });
  });

  it('la barra más alta es la de más carga, y las demás van en proporción', async () => {
    await render(<GraficaDeSemanas semanas={SEMANAS} />);
    expect(estilo('semana-7').height).toBe(64);
    expect(estilo('semana-6').height).toBe(Math.round((980 / 1241) * 64));
    expect(estilo('semana-0').height).toBe(Math.round((620 / 1241) * 64));
  });

  it('la escala sale de la semana de más carga, aunque no sea esta', async () => {
    await render(<GraficaDeSemanas semanas={conCargas([620, 0, 840, 910, 760, 1105, 980, 0])} />);
    expect(estilo('semana-5').height).toBe(64);
    expect(estilo('semana-6').height).toBe(Math.round((980 / 1105) * 64));
    expect(estilo('semana-7')).toMatchObject({ width: 8, height: 8 });
  });

  it('esta semana va en el color de las acciones, la pasada en un gris y las demás en un gris más suave', async () => {
    await render(<GraficaDeSemanas semanas={SEMANAS} />);
    expect(estilo('semana-7')).toMatchObject({ backgroundColor: paleta.grafica.esta });
    expect(estilo('semana-7')).toMatchObject({ backgroundColor: paleta.primario });
    expect(estilo('semana-6')).toMatchObject({ backgroundColor: paleta.grafica.pasada });
    expect(estilo('semana-5')).toMatchObject({ backgroundColor: paleta.grafica.anteriores });
  });

  it('una semana sin entrenos es un punto con su 0, no una barra que falta', async () => {
    await render(<GraficaDeSemanas semanas={SEMANAS} />);
    expect(estilo('semana-1')).toMatchObject({ width: 8, height: 8, borderRadius: 4 });
    expect(within(screen.getByRole('image')).getByText('0')).toBeOnTheScreen();
  });

  it('una semana muy pequeña sigue viéndose', async () => {
    await render(<GraficaDeSemanas semanas={conCargas([0, 0, 0, 0, 0, 0, 1, 10_000])} />);
    expect(estilo('semana-6').height).toBe(2);
  });

  it('sin ninguna carga, todas son puntos: no se divide por cero', async () => {
    await render(<GraficaDeSemanas semanas={conCargas([0, 0, 0, 0, 0, 0, 0, 0])} />);
    expect(estilo('semana-7')).toMatchObject({ width: 8, height: 8 });
  });

  it('con la letra normal, las cifras de esta y de la pasada van encima, y sus nombres debajo de sus barras', async () => {
    await render(<GraficaDeSemanas semanas={SEMANAS} />);
    await colocar(308);
    const grafica = within(screen.getByRole('image'));
    expect(grafica.getByText('1241')).toBeOnTheScreen();
    expect(grafica.getByText('980')).toBeOnTheScreen();
    expect(grafica.queryByText('620')).toBeNull();
    // Los centros de las columnas 7 y 8 de 8.
    expect(grafica.getByText('Pasada')).toHaveStyle({ left: '81.25%', marginLeft: -32 });
    expect(grafica.getByText('Esta')).toHaveStyle({ left: '93.75%', marginLeft: -32 });
    expect(grafica.queryByText(/^Pasada: /)).toBeNull();
  });

  it('con la letra al 130 % de Android, que llega como 1,2999999, las cifras van en una línea debajo', async () => {
    mockEscala = Math.fround(1.3);
    await render(<GraficaDeSemanas semanas={SEMANAS} />);
    const grafica = within(screen.getByRole('image'));
    expect(grafica.getByText('Pasada: 980 · Esta: 1241')).toBeOnTheScreen();
    expect(grafica.queryByText('1241')).toBeNull();
    expect(grafica.queryByText('Pasada')).toBeNull();
  });

  it('en una gráfica estrecha, los nombres no caben debajo y también van en una línea', async () => {
    await render(<GraficaDeSemanas semanas={SEMANAS} />);
    await colocar(250);
    expect(within(screen.getByRole('image')).getByText('Pasada: 980 · Esta: 1241')).toBeOnTheScreen();
  });

  it('una cifra que no cabe encima de su barra también va en la línea de debajo', async () => {
    await render(<GraficaDeSemanas semanas={conCargas([620, 0, 840, 910, 760, 1105, 980, 12_540])} />);
    await colocar(308);
    expect(within(screen.getByRole('image')).getByText('Pasada: 980 · Esta: 12 540')).toBeOnTheScreen();
  });

  it('en oscuro, las barras llevan los colores del modo oscuro', async () => {
    jest.mocked(useColorScheme).mockReturnValue('dark');
    try {
      await render(<GraficaDeSemanas semanas={SEMANAS} />);
      expect(estilo('semana-7')).toMatchObject({ backgroundColor: PALETAS.oscuro.grafica.esta });
      expect(estilo('semana-7')).toMatchObject({ backgroundColor: PALETAS.oscuro.primario });
      expect(estilo('semana-6')).toMatchObject({ backgroundColor: PALETAS.oscuro.grafica.pasada });
      expect(estilo('semana-0')).toMatchObject({ backgroundColor: PALETAS.oscuro.grafica.anteriores });
    } finally {
      jest.mocked(useColorScheme).mockReturnValue('light');
    }
  });
});
