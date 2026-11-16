import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet, useColorScheme } from 'react-native';

import { Descansos } from '@/gimnasio/Descansos';
import { PALETAS } from '@/tema/colores';

// La escala de la letra del sistema: en Jest vale 2 si no se dice otra cosa.
let mockEscala = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 844, scale: 2, fontScale: mockEscala }),
}));

/** El estilo de un elemento, con sus capas juntas. */
const estilo = (elemento: ReturnType<typeof screen.getByText>) => StyleSheet.flatten(elemento.props.style);
const ocultos = { includeHiddenElements: true };
const LINEA = 'Descansos de Press banca: 1:30 entre series · 2:00 antes del siguiente';
const RESUMEN = '1:30 entre series · 2:00 antes del siguiente';
const ENTRE_SERIES = 'Descanso entre series de Press banca, en segundos';

function descansos(props: Partial<Parameters<typeof Descansos>[0]> = {}) {
  return (
    <Descansos
      bloqueId="b1"
      nombre="Press banca"
      entreSeries={{ titulo: 'Entre series', valor: '90' }}
      despues="120"
      cambiar={() => {}}
      {...props}
    />
  );
}

/** Lo que pinta la línea, en su orden: el cronómetro, el título, el resumen y la flecha. */
const hijosDeLaLinea = () =>
  screen.getByRole('button', { name: LINEA }).children as ReturnType<typeof screen.getByText>[];

describe('Los descansos de un bloque', () => {
  afterEach(() => {
    mockEscala = 1;
  });

  it('plegados, son una línea que dice los que hay, con cifras tabulares, y no enseñan sus campos', async () => {
    await render(descansos());
    const linea = screen.getByRole('button', { name: LINEA });
    expect(linea).toBeCollapsed();
    expect(estilo(screen.getByText(RESUMEN))).toMatchObject({
      fontVariant: ['tabular-nums'],
      fontSize: 14,
      textAlign: 'right',
    });
    expect(screen.queryByLabelText(ENTRE_SERIES)).toBeNull();
    expect(within(linea).getByTestId('icono-desplegar', ocultos)).toBeTruthy();
    expect(within(linea).queryByTestId('icono-plegar', ocultos)).toBeNull();
  });

  it('la línea va como en la maqueta: el cronómetro, el título, el resumen y la flecha al final', async () => {
    await render(descansos());
    const hijos = hijosDeLaLinea();
    expect(hijos[0].props.testID).toBe('icono-cronometro');
    expect(hijos[1].props.children).toBe('Descansos');
    expect(hijos[2].props.children).toBe(RESUMEN);
    expect(hijos[hijos.length - 1].props.testID).toBe('icono-desplegar');
    expect(estilo(screen.getByText('Descansos'))).toMatchObject({ fontSize: 15, fontWeight: '600' });
  });

  it('al tocarlos se abren, con sus campos debajo y sobre el mismo fondo, y al tocarlos otra vez se pliegan', async () => {
    await render(descansos());
    await fireEvent.press(screen.getByRole('button', { name: LINEA }));
    const linea = screen.getByRole('button', { name: LINEA });
    expect(linea).toBeExpanded();
    expect(within(linea).getByTestId('icono-plegar', ocultos)).toBeTruthy();
    expect(within(screen.getByTestId('descansos')).getByLabelText(ENTRE_SERIES)).toBeOnTheScreen();
    expect(screen.getByLabelText('Descanso después de Press banca, en segundos')).toBeOnTheScreen();

    await fireEvent.press(linea);
    expect(screen.queryByLabelText(ENTRE_SERIES)).toBeNull();
  });

  it('sin nada que apuntar, en el último bloque de una carrera, no salen', async () => {
    await render(descansos({ entreSeries: null, despues: null }));
    expect(screen.queryByTestId('descansos')).toBeNull();
  });

  it('con la letra normal, la línea no se parte', async () => {
    await render(descansos());
    expect(estilo(screen.getByRole('button', { name: LINEA })).flexWrap).toBeUndefined();
  });

  it('con la letra grande, el resumen baja debajo del título y ocupa la línea entera, al principio', async () => {
    mockEscala = Math.fround(1.3);
    await render(descansos());
    expect(screen.getByRole('button', { name: LINEA })).toHaveStyle({ flexWrap: 'wrap' });
    const hijos = hijosDeLaLinea();
    // El título crece hasta la flecha, y el resumen va detrás de ella, en la línea de abajo.
    expect(estilo(screen.getByText('Descansos'))).toMatchObject({ flex: 1 });
    expect(hijos[hijos.length - 2].props.testID).toBe('icono-desplegar');
    expect(hijos[hijos.length - 1].props.children).toBe(RESUMEN);
    expect(estilo(screen.getByText(RESUMEN))).toMatchObject({ flexBasis: '100%', textAlign: 'left' });
  });

  describe.each(['claro', 'oscuro'] as const)('en modo %s', (modo) => {
    const paleta = PALETAS[modo];
    beforeEach(() => jest.mocked(useColorScheme).mockReturnValue(modo === 'oscuro' ? 'dark' : 'light'));
    afterEach(() => jest.mocked(useColorScheme).mockReturnValue('light'));

    it('van sobre el fondo suave, con el cronómetro, el resumen y la flecha en el color tenue y el título en el del texto', async () => {
      await render(descansos());
      expect(screen.getByTestId('descansos')).toHaveStyle({ backgroundColor: paleta.superficieSuave, borderRadius: 16 });
      expect(screen.getByTestId('icono-cronometro', ocultos).props.tintColor).toBe(paleta.textoTenue);
      expect(screen.getByTestId('icono-desplegar', ocultos).props.tintColor).toBe(paleta.textoTenue);
      expect(estilo(screen.getByText(RESUMEN))).toMatchObject({ color: paleta.textoTenue });
      expect(estilo(screen.getByText('Descansos'))).toMatchObject({ color: paleta.texto, fontWeight: '600' });
    });
  });
});
