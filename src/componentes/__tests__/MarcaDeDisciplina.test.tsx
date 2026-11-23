import { render, screen, within } from '@testing-library/react-native';
import { Dimensions, Platform, StyleSheet, useColorScheme } from 'react-native';

import { MarcaDeDisciplina } from '@/componentes/MarcaDeDisciplina';
import { TituloConMarca } from '@/componentes/TituloConMarca';
import { PALETAS } from '@/tema/colores';
import { ESCALA_DE_LA_CABECERA } from '@/tema/medidas';

/** El estilo de un elemento, con sus capas juntas. */
const estilo = (elemento: ReturnType<typeof screen.getByText>) => StyleSheet.flatten(elemento.props.style);
const ocultos = { includeHiddenElements: true };

describe('La marca de una disciplina', () => {
  it('la de las fichas mide 28 como poco, con su icono de 18, y no tiene un lado fijo', async () => {
    await render(<MarcaDeDisciplina disciplina="gimnasio" />);
    const marca = estilo(screen.getByTestId('marca-de-disciplina'));
    expect(marca).toMatchObject({ minWidth: 28, minHeight: 28, padding: 5, borderRadius: 9 });
    expect(marca.width).toBeUndefined();
    expect(estilo(screen.getByTestId('icono-gimnasio', ocultos)).width).toBe(18 * Dimensions.get('window').fontScale);
  });

  it('la del historial mide 24 como poco, con su icono de 16, que crece con la letra sin tope', async () => {
    await render(<MarcaDeDisciplina disciplina="hyrox" tamano="historial" />);
    const marca = estilo(screen.getByTestId('marca-de-disciplina'));
    expect(marca).toMatchObject({ minWidth: 24, minHeight: 24, padding: 4, borderRadius: 8 });
    expect(marca.width).toBeUndefined();
    expect(estilo(screen.getByTestId('icono-hyrox', ocultos)).width).toBe(16 * Dimensions.get('window').fontScale);
  });

  it('la de la cabecera mide 32 como poco, con su icono de 20, que crece como mucho como el título', async () => {
    await render(<MarcaDeDisciplina disciplina="gimnasio" tamano="cabecera" />);
    expect(estilo(screen.getByTestId('marca-de-disciplina'))).toMatchObject({
      minWidth: 32,
      minHeight: 32,
      padding: 6,
      borderRadius: 10,
    });
    // En Jest la letra va al 200 %: el icono de la cabecera se queda en su tope.
    const { fontScale } = Dimensions.get('window');
    expect(fontScale).toBeGreaterThan(ESCALA_DE_LA_CABECERA);
    expect(estilo(screen.getByTestId('icono-gimnasio', ocultos)).width).toBe(20 * ESCALA_DE_LA_CABECERA);
  });

  it('en la cabecera, el título y su marca crecen como mucho al 130 %, y en el iPhone van sin margen tras la flecha', async () => {
    await render(<TituloConMarca disciplina="gimnasio" titulo="Gimnasio" />);
    const titulo = screen.getByRole('header', { name: 'Gimnasio' });
    expect(titulo.props.maxFontSizeMultiplier).toBe(1.3);
    const marca = screen.getByTestId('marca-de-disciplina');
    expect(marca).toHaveStyle({ minWidth: 32, minHeight: 32, padding: 6, borderRadius: 10 });
    expect(estilo(within(marca).getByTestId('icono-gimnasio', ocultos)).width).toBe(26);
    // En el iPhone, sin margen: la cabecera nativa ya lo pone.
    expect(estilo(titulo.parent as typeof titulo).marginStart).toBeUndefined();
  });

  it('en Android, el título con su marca empieza 4 después de la flecha de volver', async () => {
    const android = jest.replaceProperty(Platform, 'OS', 'android');
    try {
      await render(<TituloConMarca disciplina="gimnasio" titulo="Gimnasio" />);
      expect(screen.getByRole('header', { name: 'Gimnasio' }).parent).toHaveStyle({ marginStart: 4 });
    } finally {
      android.restore();
    }
  });

  describe.each(['claro', 'oscuro'] as const)('en modo %s', (modo) => {
    const paleta = PALETAS[modo];
    beforeEach(() => jest.mocked(useColorScheme).mockReturnValue(modo === 'oscuro' ? 'dark' : 'light'));
    afterEach(() => jest.mocked(useColorScheme).mockReturnValue('light'));

    it('va en el color de su disciplina; sobre el del gimnasio, que es el de las acciones, el icono va en la tinta de encima de las acciones', async () => {
      await render(
        <>
          <MarcaDeDisciplina disciplina="gimnasio" />
          <MarcaDeDisciplina disciplina="hyrox" />
        </>,
      );
      const [gimnasio, hyrox] = screen.getAllByTestId('marca-de-disciplina');
      expect(gimnasio).toHaveStyle({ backgroundColor: paleta.disciplina.gimnasio.marca });
      expect(within(gimnasio).getByTestId('icono-gimnasio', ocultos).props.tintColor).toBe(paleta.sobrePrimario);
      expect(hyrox).toHaveStyle({ backgroundColor: paleta.disciplina.hyrox.marca });
      expect(within(hyrox).getByTestId('icono-hyrox', ocultos).props.tintColor).toBe(paleta.sobreMarca);
    });

    it('en la cabecera, el título va detrás de la marca, en el color del texto y en una línea', async () => {
      await render(<TituloConMarca disciplina="gimnasio" titulo="Corregir entreno" />);
      const titulo = screen.getByRole('header', { name: 'Corregir entreno' });
      expect(estilo(titulo)).toMatchObject({ color: paleta.texto, fontFamily: 'Nunito_800ExtraBold', fontSize: 22 });
      expect(titulo.props.numberOfLines).toBe(1);
      const fila = titulo.parent as ReturnType<typeof screen.getByText>;
      const [marca, texto] = fila.children as ReturnType<typeof screen.getByText>[];
      expect(marca.props.testID).toBe('marca-de-disciplina');
      expect(texto.props.children).toBe('Corregir entreno');
      expect(fila).toHaveStyle({ flexDirection: 'row', alignItems: 'center', gap: 8 });
    });
  });
});
