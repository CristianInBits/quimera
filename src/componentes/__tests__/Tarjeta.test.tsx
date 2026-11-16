import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text, useColorScheme } from 'react-native';

import { Tarjeta } from '@/componentes/Tarjeta';
import { PALETAS, sombraDeTarjeta } from '@/tema/colores';

const estilo = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style);

describe('Una tarjeta, en claro', () => {
  const paleta = PALETAS.claro;

  it('va sobre la superficie, con el borde suave, la sombra leve y su relleno', async () => {
    await render(
      <Tarjeta testID="tarjeta" relleno={20}>
        <Text>Dentro</Text>
      </Tarjeta>,
    );
    expect(screen.getByText('Dentro')).toBeOnTheScreen();
    expect(estilo('tarjeta')).toMatchObject({
      backgroundColor: paleta.superficie,
      borderColor: paleta.bordeSuave,
      borderWidth: 1,
      borderRadius: 24,
      padding: 20,
      boxShadow: sombraDeTarjeta(paleta),
    });
  });

  it('la destacada lleva más sombra', async () => {
    await render(<Tarjeta testID="tarjeta" destacada />);
    expect(estilo('tarjeta').boxShadow).toBe(sombraDeTarjeta(paleta, true));
    expect(sombraDeTarjeta(paleta, true)).not.toBe(sombraDeTarjeta(paleta));
  });

  it('con una disciplina, va teñida de su color y sin sombra', async () => {
    await render(<Tarjeta testID="tarjeta" disciplina="hyrox" />);
    expect(estilo('tarjeta')).toMatchObject({
      backgroundColor: paleta.disciplina.hyrox.tinte,
      borderColor: paleta.disciplina.hyrox.borde,
    });
    expect(estilo('tarjeta').boxShadow).toBeUndefined();
  });

  it('un estilo propio va encima del de la tarjeta', async () => {
    await render(<Tarjeta testID="tarjeta" style={{ padding: 0, gap: 4 }} />);
    expect(estilo('tarjeta')).toMatchObject({ padding: 0, gap: 4 });
  });
});

describe('Una tarjeta, en oscuro', () => {
  const paleta = PALETAS.oscuro;
  beforeEach(() => jest.mocked(useColorScheme).mockReturnValue('dark'));
  afterEach(() => jest.mocked(useColorScheme).mockReturnValue('light'));

  it('va sobre la superficie oscura, con su borde y sin sombra', async () => {
    await render(<Tarjeta testID="tarjeta" />);
    expect(estilo('tarjeta')).toMatchObject({ backgroundColor: paleta.superficie, borderColor: paleta.bordeSuave });
    expect(estilo('tarjeta').boxShadow).toBeUndefined();
  });

  it('la destacada sí lleva sombra, la oscura', async () => {
    await render(<Tarjeta testID="tarjeta" destacada />);
    expect(estilo('tarjeta').boxShadow).toBe(sombraDeTarjeta(paleta, true));
    expect(sombraDeTarjeta(paleta, true)).toMatch(/rgba\(0, 0, 0/);
  });

  it('la teñida lleva el borde de su disciplina, que en oscuro no es su tinte', async () => {
    await render(<Tarjeta testID="tarjeta" disciplina="hyrox" />);
    expect(paleta.disciplina.hyrox.borde).not.toBe(paleta.disciplina.hyrox.tinte);
    expect(estilo('tarjeta')).toMatchObject({
      backgroundColor: paleta.disciplina.hyrox.tinte,
      borderColor: paleta.disciplina.hyrox.borde,
    });
  });
});
