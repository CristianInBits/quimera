import { render, screen } from '@testing-library/react-native';
import { Dimensions, Platform, StyleSheet } from 'react-native';

import { Icono } from '@/componentes/Icono';

// La escala de la letra del sistema: la de Jest, 2, salvo donde una prueba diga otra.
let mockEscala: number | null = null;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ ...jest.requireActual('react-native').Dimensions.get('window'), ...(mockEscala === null ? {} : { fontScale: mockEscala }) }),
}));

describe('Un icono', () => {
  it('crece con la letra del sistema: su caja mide su tamaño por la escala de la letra', async () => {
    const { fontScale } = Dimensions.get('window');
    await render(<Icono nombre="mas" color="#123456" tamano={18} />);
    const icono = screen.getByTestId('icono-mas', { includeHiddenElements: true });
    expect(StyleSheet.flatten(icono.props.style)).toMatchObject({ width: 18 * fontScale, height: 18 * fontScale });
    expect(icono.props.tintColor).toBe('#123456');
  });

  it('con un tope, no crece más que eso con la letra del sistema', async () => {
    const { fontScale } = Dimensions.get('window');
    expect(fontScale).toBeGreaterThan(1.3);
    await render(<Icono nombre="mas" color="#123456" tamano={20} escalaMaxima={1.3} />);
    const icono = screen.getByTestId('icono-mas', { includeHiddenElements: true });
    expect(StyleSheet.flatten(icono.props.style)).toMatchObject({ width: 26, height: 26 });
    // En el iPhone, el símbolo se dibuja ya a ese tamaño.
    expect(icono.props.size).toBe(26);
  });

  it('en Android, donde la letra del icono ya crece sola con el sistema, se le pide lo que falta para su lado', async () => {
    const { fontScale } = Dimensions.get('window');
    const android = jest.replaceProperty(Platform, 'OS', 'android');
    try {
      await render(
        <>
          <Icono nombre="mas" color="#123456" tamano={20} />
          <Icono nombre="menos" color="#123456" tamano={20} escalaMaxima={1.3} />
        </>,
      );
      expect(screen.getByTestId('icono-mas', { includeHiddenElements: true }).props.size).toBe(20);
      const conTope = screen.getByTestId('icono-menos', { includeHiddenElements: true });
      // El sistema lo multiplica por su escala: así queda en 26, como su caja.
      expect(conTope.props.size * fontScale).toBeCloseTo(26, 9);
      expect(StyleSheet.flatten(conTope.props.style)).toMatchObject({ width: 26, height: 26 });
    } finally {
      android.restore();
    }
  });

  it('con un tope, y la letra por debajo de él, crece con la letra como siempre', async () => {
    mockEscala = 1;
    try {
      await render(<Icono nombre="mas" color="#123456" tamano={20} escalaMaxima={1.3} />);
      const icono = screen.getByTestId('icono-mas', { includeHiddenElements: true });
      expect(StyleSheet.flatten(icono.props.style)).toMatchObject({ width: 20, height: 20 });
      expect(icono.props.size).toBe(20);
    } finally {
      mockEscala = null;
    }
  });

  it('en Android, con un tope y la letra por debajo de él, pide su tamaño de siempre', async () => {
    mockEscala = 1;
    const android = jest.replaceProperty(Platform, 'OS', 'android');
    try {
      await render(<Icono nombre="mas" color="#123456" tamano={20} escalaMaxima={1.3} />);
      const icono = screen.getByTestId('icono-mas', { includeHiddenElements: true });
      expect(StyleSheet.flatten(icono.props.style)).toMatchObject({ width: 20, height: 20 });
      expect(icono.props.size).toBe(20);
    } finally {
      android.restore();
      mockEscala = null;
    }
  });

  it('el lector de pantalla no lo lee', async () => {
    await render(<Icono nombre="hecha" color="#123456" />);
    expect(screen.queryByTestId('icono-hecha')).toBeNull();
    expect(screen.getByTestId('icono-hecha', { includeHiddenElements: true })).not.toBeVisible();
  });
});
