import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet, useColorScheme } from 'react-native';

import type { EntradaDelHistorial } from '@/datos/historial';
import { TarjetaDeEntreno } from '@/historial/TarjetaDeEntreno';
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

/** El domingo de la maqueta. */
const HOY = '2026-11-15';

/** El primero de la maqueta: gimnasio, ayer a las 10:15. */
const DE_AYER: EntradaDelHistorial = {
  id: 'de-ayer',
  disciplina: 'gimnasio',
  fecha: '2026-11-14',
  hora: '10:15',
  lunes: '2026-11-09',
  minutos: 55,
  esfuerzo: 8,
  carga: 440,
  ejercicios: ['Sentadilla trasera', 'Peso muerto rumano', 'Zancadas'],
  metros: 1500,
};
const CONTENIDO = 'Sentadilla trasera, Peso muerto rumano y Zancadas · 1,5 km';

/** El segundo de la maqueta: un hyrox del jueves, sin ejercicios ni carrera apuntados. */
const DE_HYROX: EntradaDelHistorial = {
  id: 'de-hyrox',
  disciplina: 'hyrox',
  fecha: '2026-11-12',
  hora: '19:05',
  lunes: '2026-11-09',
  minutos: 45,
  esfuerzo: 8,
  carga: 360,
  ejercicios: [],
  metros: 0,
};

const tarjeta = (entrada: EntradaDelHistorial, alPulsar: () => void = () => {}) => (
  <TarjetaDeEntreno entrada={entrada} hoy={HOY} alPulsar={alPulsar} />
);

describe('Un entreno en el historial', () => {
  afterEach(() => {
    mockEscala = 1;
  });

  it('dice qué, cuándo, lo que se hizo y cuánto, y el lector de pantalla lo lee entero, con la fecha en frase', async () => {
    await render(tarjeta(DE_AYER));
    const entreno = screen.getByRole('button', {
      name: 'Gimnasio, ayer, a las 10:15. Sentadilla trasera, Peso muerto rumano y Zancadas, 1,5 km. 55 minutos, esfuerzo 8, duro',
    });
    expect(within(entreno).getByText('Gimnasio · Ayer, 10:15')).toBeOnTheScreen();
    expect(within(entreno).getByText(CONTENIDO)).toBeOnTheScreen();
    expect(within(entreno).getByText('55 minutos · esfuerzo 8, duro')).toBeOnTheScreen();
  });

  it('al tocarla en cualquier sitio, la abre', async () => {
    const alPulsar = jest.fn();
    await render(tarjeta(DE_AYER, alPulsar));
    await fireEvent.press(screen.getByText(CONTENIDO));
    expect(alPulsar).toHaveBeenCalledTimes(1);
  });

  it('sin ejercicios ni carrera no hay línea de lo que se hizo, y el lector de pantalla tampoco la dice', async () => {
    await render(tarjeta(DE_HYROX));
    expect(
      screen.getByRole('button', { name: 'Hyrox, jueves 12 de noviembre, a las 19:05. 45 minutos, esfuerzo 8, duro' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Hyrox · jue 12 nov, 19:05')).toBeOnTheScreen();
    // Solo quedan dos líneas: la de cuándo y la de cuánto.
    const lineas = screen.getByTestId('cabecera-del-entreno').parent?.children as ReturnType<typeof screen.getByText>[];
    expect(lineas).toHaveLength(2);
    expect(lineas[1]).toHaveTextContent('45 minutos · esfuerzo 8, duro');
  });

  it('sin hora, dice solo el día', async () => {
    await render(tarjeta({ ...DE_AYER, hora: null }));
    expect(screen.getByText('Gimnasio · Ayer')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /^Gimnasio, ayer\. Sentadilla/ })).toBeOnTheScreen();
  });

  it('va redondeada, con lo de dentro a 14, 16 y 12 del borde, como en la maqueta, y nunca mide menos de 48', async () => {
    await render(tarjeta(DE_AYER));
    const entreno = screen.getByTestId('entreno');
    expect(estilo(entreno)).toMatchObject({
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderRadius: 20,
      minHeight: 48,
    });
    // El borde, de 1, va por dentro del relleno.
    const { paddingVertical, paddingLeft, paddingRight, borderWidth } = estilo(entreno);
    expect([paddingVertical, paddingLeft, paddingRight].map((relleno) => Number(relleno) + Number(borderWidth))).toEqual([
      14, 16, 12,
    ]);
    expect(within(entreno).getByTestId('cabecera-del-entreno').parent).toHaveStyle({ flex: 1, gap: 2 });
  });

  it('lleva delante la marca pequeña de su disciplina, y la flecha al final', async () => {
    await render(tarjeta(DE_AYER));
    const cabecera = screen.getByTestId('cabecera-del-entreno');
    const [primero, segundo] = cabecera.children as ReturnType<typeof screen.getByText>[];
    expect(primero.props.testID).toBe('marca-de-disciplina');
    expect(segundo).toHaveTextContent('Gimnasio · Ayer, 10:15');
    expect(primero).toHaveStyle({ minWidth: 24, minHeight: 24, padding: 4, borderRadius: 8 });
    expect(estilo(within(primero).getByTestId('icono-gimnasio', ocultos))).toMatchObject({ width: 16, height: 16 });
    expect(cabecera).toHaveStyle({ flexDirection: 'row', gap: 8 });
    const flecha = within(screen.getByTestId('entreno')).getByTestId('icono-siguiente', ocultos);
    expect(estilo(flecha)).toMatchObject({ width: 20, height: 20 });
    const hijos = screen.getByTestId('entreno').children as (typeof flecha)[];
    expect(hijos[hijos.length - 1].props.testID).toBe('icono-siguiente');
  });

  it('el nombre y la fecha van en líneas del alto de la marca, que va arriba: en una línea, centrados con ella; partidos, con la primera', async () => {
    await render(tarjeta(DE_AYER));
    expect(screen.getByTestId('cabecera-del-entreno')).toHaveStyle({ alignItems: 'flex-start' });
    const { minHeight } = estilo(screen.getByTestId('marca-de-disciplina'));
    expect(minHeight).toBe(24);
    expect(screen.getByText('Gimnasio · Ayer, 10:15')).toHaveStyle({ lineHeight: minHeight });
  });

  it('el nombre de la disciplina va en negrita, y la fecha, en seminegrita; las cifras, tabulares', async () => {
    await render(tarjeta(DE_AYER));
    expect(estilo(screen.getByText('Gimnasio · Ayer, 10:15'))).toMatchObject({
      fontSize: 16,
      fontWeight: '500',
      fontVariant: ['tabular-nums'],
      // Encoge para partirse junto a la marca, en vez de salirse por debajo de la flecha.
      flexShrink: 1,
    });
    expect(estilo(screen.getByText('Gimnasio'))).toMatchObject({ fontWeight: '700' });
    expect(estilo(screen.getByText(CONTENIDO))).toMatchObject({ fontSize: 15 });
    expect(estilo(screen.getByText('55 minutos · esfuerzo 8, duro'))).toMatchObject({
      fontSize: 14,
      fontVariant: ['tabular-nums'],
    });
  });

  it.each([
    ['100 %', 'en dos líneas como mucho', 1, 2],
    ['129 %', 'en dos líneas como mucho', 1.29, 2],
    // El 130 % de Android llega como 1,2999999.
    ['130 %', 'en las líneas que haga falta', 1.2999999, undefined],
    ['200 %', 'en las líneas que haga falta', 2, undefined],
  ] as const)('con la letra al %s, lo que se hizo va %s', async (_porcentaje, _como, escala, lineas) => {
    mockEscala = escala;
    await render(tarjeta(DE_AYER));
    expect(screen.getByText(CONTENIDO).props.numberOfLines).toBe(lineas);
    // El nombre y la fecha, y cuánto, se parten si no caben: nunca se cortan.
    expect(screen.getByText('Gimnasio · Ayer, 10:15').props.numberOfLines).toBeUndefined();
    expect(screen.getByText('55 minutos · esfuerzo 8, duro').props.numberOfLines).toBeUndefined();
    // La marca sigue arriba, con la primera línea, y la flecha, centrada en la tarjeta.
    expect(screen.getByTestId('cabecera-del-entreno')).toHaveStyle({ alignItems: 'flex-start' });
    expect(screen.getByTestId('entreno')).toHaveStyle({ alignItems: 'center' });
    // La marca y la flecha crecen con la letra.
    expect(estilo(screen.getByTestId('icono-gimnasio', ocultos)).width).toBeCloseTo(16 * escala);
    expect(estilo(screen.getByTestId('icono-siguiente', ocultos)).width).toBeCloseTo(20 * escala);
  });

  describe.each(['claro', 'oscuro'] as const)('en modo %s', (modo) => {
    const paleta = PALETAS[modo];
    beforeEach(() => jest.mocked(useColorScheme).mockReturnValue(modo === 'oscuro' ? 'dark' : 'light'));
    afterEach(() => jest.mocked(useColorScheme).mockReturnValue('light'));

    it('va teñida del color de su disciplina, con su borde y su marca', async () => {
      await render(
        <>
          {tarjeta(DE_AYER)}
          {tarjeta(DE_HYROX)}
        </>,
      );
      const [gimnasio, hyrox] = screen.getAllByTestId('entreno');
      for (const [entreno, disciplina] of [
        [gimnasio, 'gimnasio'],
        [hyrox, 'hyrox'],
      ] as const) {
        const colores = paleta.disciplina[disciplina];
        expect(entreno).toHaveStyle({ backgroundColor: colores.tinte, borderColor: colores.borde });
        expect(within(entreno).getByTestId('marca-de-disciplina')).toHaveStyle({ backgroundColor: colores.marca });
      }
    });

    it(`${modo === 'claro' ? 'lleva una sombra muy leve' : 'no lleva sombra: la separa su borde'}`, async () => {
      await render(tarjeta(DE_AYER));
      expect(estilo(screen.getByTestId('entreno')).boxShadow).toBe(
        modo === 'claro' ? '0 1px 2px rgba(35, 25, 31, 0.06)' : undefined,
      );
    });

    it('lo que dice va en el color del texto, y cuánto y la flecha, en el tenue', async () => {
      await render(tarjeta(DE_AYER));
      expect(screen.getByText('Gimnasio · Ayer, 10:15')).toHaveStyle({ color: paleta.texto });
      expect(screen.getByText(CONTENIDO)).toHaveStyle({ color: paleta.texto });
      expect(screen.getByText('55 minutos · esfuerzo 8, duro')).toHaveStyle({ color: paleta.textoTenue });
      expect(screen.getByTestId('icono-siguiente', ocultos).props.tintColor).toBe(paleta.textoTenue);
    });
  });
});
