import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text, useColorScheme } from 'react-native';

import { Bocadillo } from '@/componentes/Bocadillo';
import { PALETAS } from '@/tema/colores';

const pico = () => StyleSheet.flatten(screen.getByTestId('pico', { includeHiddenElements: true }).props.style);

describe('Un bocadillo', () => {
  it('lleva lo que dice, en el fondo suave de las filas, con el pico arriba del mismo color', async () => {
    await render(
      <Bocadillo>
        <Text>Hola</Text>
      </Bocadillo>,
    );
    expect(screen.getByTestId('bocadillo')).toContainElement(screen.getByText('Hola'));
    expect(screen.getByTestId('bocadillo')).toHaveStyle({ backgroundColor: PALETAS.claro.superficieSuave });
    expect(pico()).toMatchObject({ backgroundColor: PALETAS.claro.superficieSuave, top: -7 });
  });

  it('sin más, el pico va en el centro', async () => {
    await render(<Bocadillo>{null}</Bocadillo>);
    expect(pico()).toMatchObject({ left: '50%', marginLeft: -7 });
  });

  it('con «pico», el pico va a esa distancia del borde derecho, medida hasta su centro', async () => {
    await render(<Bocadillo pico={78}>{null}</Bocadillo>);
    expect(pico()).toMatchObject({ right: 71 });
    expect(pico().left).toBeUndefined();
  });

  it('en oscuro, va en el fondo suave de las filas del modo oscuro', async () => {
    jest.mocked(useColorScheme).mockReturnValue('dark');
    try {
      await render(<Bocadillo>{null}</Bocadillo>);
      expect(screen.getByTestId('bocadillo')).toHaveStyle({ backgroundColor: PALETAS.oscuro.superficieSuave });
      expect(pico()).toMatchObject({ backgroundColor: PALETAS.oscuro.superficieSuave });
    } finally {
      jest.mocked(useColorScheme).mockReturnValue('light');
    }
  });
});
