import { render, screen } from '@testing-library/react-native';

import { Mascota, tramoDeLaMascota } from '@/componentes/Mascota';

// En las pruebas, una imagen es { testUri: ruta del fichero }.
describe('La mascota', () => {
  it('va por los tramos de las palabras del esfuerzo, con el 9 y el 10 en el mismo dibujo', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(tramoDeLaMascota)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });

  it('sin esfuerzo sale el dibujo de presentación, que Android decodifica ya reducido', async () => {
    await render(<Mascota disciplina="gimnasio" tamano={96} />);
    const mascota = screen.getByTestId('mascota');
    expect(mascota.props.source.testUri).toMatch(/rinoceronte\.png$/);
    expect(mascota.props.resizeMethod).toBe('resize');
  });

  it.each([
    [1, 'rinoceronte-1.png'],
    [4, 'rinoceronte-2.png'],
    [6, 'rinoceronte-3.png'],
    [8, 'rinoceronte-4.png'],
    [10, 'rinoceronte-5.png'],
  ])('con un esfuerzo de %i sale %s', async (esfuerzo, dibujo) => {
    await render(<Mascota disciplina="gimnasio" esfuerzo={esfuerzo} tamano={96} />);
    expect(screen.getByTestId('mascota').props.source.testUri.endsWith(dibujo)).toBe(true);
  });

  it('una disciplina que aún no tiene sus dibujos no saca nada', async () => {
    await render(<Mascota disciplina="hyrox" esfuerzo={5} tamano={96} />);
    expect(screen.queryByTestId('mascota')).toBeNull();
  });

  it('con alto, la caja deja de ser cuadrada, y el estilo propio va encima', async () => {
    await render(<Mascota disciplina="gimnasio" tamano={90} alto={116} style={{ position: 'absolute', top: -3 }} />);
    expect(screen.getByTestId('mascota')).toHaveStyle({ width: 90, height: 116, position: 'absolute', top: -3 });
  });
});
