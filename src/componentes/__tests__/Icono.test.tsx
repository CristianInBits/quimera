import { render, screen } from '@testing-library/react-native';
import { Dimensions, StyleSheet } from 'react-native';

import { Icono } from '@/componentes/Icono';

describe('Un icono', () => {
  it('crece con la letra del sistema: su caja mide su tamaño por la escala de la letra', async () => {
    const { fontScale } = Dimensions.get('window');
    await render(<Icono nombre="mas" color="#123456" tamano={18} />);
    const icono = screen.getByTestId('icono-mas', { includeHiddenElements: true });
    expect(StyleSheet.flatten(icono.props.style)).toMatchObject({ width: 18 * fontScale, height: 18 * fontScale });
    expect(icono.props.tintColor).toBe('#123456');
  });

  it('el lector de pantalla no lo lee', async () => {
    await render(<Icono nombre="hecha" color="#123456" />);
    expect(screen.queryByTestId('icono-hecha')).toBeNull();
    expect(screen.getByTestId('icono-hecha', { includeHiddenElements: true })).not.toBeVisible();
  });
});
