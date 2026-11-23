import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet, useColorScheme } from 'react-native';

import { TarjetaDeEsfuerzo } from '@/componentes/TarjetaDeEsfuerzo';
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
const PALABRAS = ['muy suave', 'muy suave', 'suave', 'suave', 'moderado', 'moderado', 'duro', 'duro', 'muy duro', 'máximo'];

function tarjeta(valor: number | null, alCambiar: (esfuerzo: number) => void = () => {}) {
  return <TarjetaDeEsfuerzo disciplina="gimnasio" valor={valor} alCambiar={alCambiar} />;
}

describe('La tarjeta del esfuerzo', () => {
  afterEach(() => {
    mockEscala = 1;
  });

  it('es un grupo de diez opciones, del 1 al 10, cada una con la palabra de su tramo, y tocar una la elige', async () => {
    const alCambiar = jest.fn();
    await render(tarjeta(7, alCambiar));
    // El grupo no es un elemento accesible él mismo, para que cada cifra se pueda tocar sola: se busca por su etiqueta.
    const grupo = screen.getByLabelText('Esfuerzo del 1 al 10');
    expect(grupo.props.accessibilityRole).toBe('radiogroup');
    expect(within(grupo).getAllByRole('radio')).toHaveLength(10);
    const opciones = screen.getAllByRole('radio');
    expect(opciones.map((opcion) => opcion.props.accessibilityLabel)).toEqual(
      PALABRAS.map((palabra, i) => `${i + 1}, ${palabra}`),
    );
    expect(screen.getByRole('radio', { name: '7, duro' })).toBeChecked();
    expect(opciones.filter((opcion) => opcion.props.accessibilityState?.checked)).toHaveLength(1);
    await fireEvent.press(screen.getByRole('radio', { name: '3, suave' }));
    expect(alCambiar).toHaveBeenCalledWith(3);
  });

  it('las cifras van en dos filas de cinco, del mismo ancho', async () => {
    await render(tarjeta(null));
    const filas = screen.getAllByTestId('fila-de-cifras');
    expect(filas).toHaveLength(2);
    // Las dos filas, a 8 una de otra.
    expect(screen.getByLabelText('Esfuerzo del 1 al 10')).toHaveStyle({ gap: 8 });
    for (const [f, fila] of filas.entries()) {
      expect(fila).toHaveStyle({ flexDirection: 'row', gap: 8 });
      expect(within(fila).getAllByRole('radio').map((opcion) => opcion.props.accessibilityLabel.split(',')[0])).toEqual(
        [1, 2, 3, 4, 5].map((n) => String(n + 5 * f)),
      );
      for (const opcion of within(fila).getAllByRole('radio')) {
        expect(estilo(opcion)).toMatchObject({ flex: 1, minHeight: 52, borderWidth: 2, borderRadius: 16 });
        // Con la letra enorme, el 10 encoge antes que partirse en dos líneas.
        const cifra = (opcion.children as (typeof opcion)[])[0];
        expect(cifra.props).toMatchObject({ numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.5 });
      }
    }
  });

  it('elegida, la cifra va en grande y en el color del texto, con la palabra de su tramo al lado', async () => {
    await render(tarjeta(7));
    expect(estilo(within(screen.getByTestId('esfuerzo-elegido')).getByText('7'))).toMatchObject({
      fontSize: 68,
      fontWeight: '700',
      letterSpacing: -1,
      fontVariant: ['tabular-nums'],
      color: PALETAS.claro.texto,
    });
    // Con los tamaños de letra de accesibilidad del iPhone, la palabra crece como mucho al 300 %.
    expect(within(screen.getByTestId('esfuerzo-elegido')).getByText('duro').props.maxFontSizeMultiplier).toBe(3);
    expect(estilo(within(screen.getByTestId('esfuerzo-elegido')).getByText('duro'))).toMatchObject({
      fontSize: 20,
      fontWeight: '700',
      color: PALETAS.claro.texto,
    });
    expect(screen.getByTestId('esfuerzo-elegido')).toHaveStyle({
      flexDirection: 'row',
      alignItems: 'baseline',
      flexWrap: 'wrap',
      columnGap: 10,
      marginBottom: 6,
    });
    expect(screen.queryByText('Elige cuánto te ha costado')).toBeNull();
  });

  it('sin elegir, en su sitio pide que se elija, en el color tenue', async () => {
    await render(tarjeta(null));
    expect(estilo(screen.getByText('Elige cuánto te ha costado'))).toMatchObject({ color: PALETAS.claro.textoTenue });
    expect(screen.queryByTestId('esfuerzo-elegido')).toBeNull();
    expect(screen.getAllByRole('radio').every((opcion) => !opcion.props.accessibilityState?.checked)).toBe(true);
  });

  it('el rinoceronte, sobre su escenario de 120, hace el esfuerzo elegido, y sin elegir sale el de presentación', async () => {
    const pantalla = await render(tarjeta(7));
    const dibujo = () => screen.getByTestId('mascota', ocultos).props.source.testUri;
    expect(dibujo()).toMatch(/rinoceronte-4\.png$/);
    // El círculo de fuera mide 120 y baja 16: la caja mide 136 de alto, como en la maqueta.
    expect(screen.getByTestId('escenario', ocultos)).toHaveStyle({ width: 120, height: 136 });
    // En una caja de 128: 4 a cada lado del círculo.
    expect(screen.getByTestId('escenario', ocultos).parent).toHaveStyle({ paddingHorizontal: 4 });
    await pantalla.rerender(tarjeta(null));
    expect(dibujo()).toMatch(/rinoceronte\.png$/);
  });

  it('la cabecera dice «Esfuerzo», y con la letra normal la cifra va a la izquierda, abajo, y el rinoceronte a la derecha', async () => {
    await render(tarjeta(7));
    expect(estilo(screen.getByRole('header', { name: 'Esfuerzo' }))).toMatchObject({
      fontFamily: 'Nunito_800ExtraBold',
      fontSize: 20,
    });
    const fila = screen.getByTestId('fila-del-esfuerzo');
    expect(fila).toHaveStyle({ flexDirection: 'row' });
    expect(screen.getByTestId('columna-del-esfuerzo')).toHaveStyle({ flex: 1, justifyContent: 'space-between' });
    const [columna, escenario] = fila.children as ReturnType<typeof screen.getByText>[];
    expect(columna.props.testID).toBe('columna-del-esfuerzo');
    expect(within(escenario).getByTestId('escenario', ocultos)).toBeTruthy();
  });

  it('con la letra grande, el rinoceronte va arriba y la cifra debajo, a todo el ancho', async () => {
    mockEscala = Math.fround(1.3);
    await render(tarjeta(7));
    expect(screen.getByTestId('fila-del-esfuerzo')).toHaveStyle({ flexDirection: 'column-reverse', alignItems: 'center' });
    expect(screen.getByTestId('columna-del-esfuerzo')).toHaveStyle({ alignSelf: 'stretch' });
    // Y las cifras siguen en dos filas de cinco.
    expect(screen.getAllByTestId('fila-de-cifras')).toHaveLength(2);
  });

  describe.each(['claro', 'oscuro'] as const)('en modo %s', (modo) => {
    const paleta = PALETAS[modo];
    beforeEach(() => jest.mocked(useColorScheme).mockReturnValue(modo === 'oscuro' ? 'dark' : 'light'));
    afterEach(() => jest.mocked(useColorScheme).mockReturnValue('light'));

    it('la tarjeta va teñida del gimnasio, la cifra grande y su palabra en el color del texto, y la elegida de la rejilla, rellena del color de las acciones; las demás, sobre la superficie', async () => {
      await render(tarjeta(7));
      // La cifra grande, en el color del texto del modo: la del claro no se vería sobre el tinte oscuro.
      expect(estilo(within(screen.getByTestId('esfuerzo-elegido')).getByText('7'))).toMatchObject({ color: paleta.texto });
      expect(estilo(within(screen.getByTestId('esfuerzo-elegido')).getByText('duro'))).toMatchObject({ color: paleta.texto });
      const elegida = screen.getByRole('radio', { name: '7, duro' });
      expect(estilo(elegida)).toMatchObject({ backgroundColor: paleta.primario, borderColor: paleta.primario });
      expect(estilo(within(elegida).getByText('7'))).toMatchObject({ color: paleta.sobrePrimario, fontSize: 18 });
      const otra = screen.getByRole('radio', { name: '8, duro' });
      expect(estilo(otra)).toMatchObject({ backgroundColor: paleta.superficie, borderColor: paleta.bordeControl });
      expect(estilo(within(otra).getByText('8'))).toMatchObject({ color: paleta.texto });
      // La tarjeta, con el tinte y el borde del gimnasio, su relleno de 16 y 12 entre sus partes.
      const caja = screen.getByTestId('fila-del-esfuerzo').parent as ReturnType<typeof screen.getByText>;
      expect(caja).toHaveStyle({
        backgroundColor: paleta.disciplina.gimnasio.tinte,
        borderColor: paleta.disciplina.gimnasio.borde,
        borderRadius: 24,
        padding: 16,
        gap: 12,
      });
    });
  });
});
