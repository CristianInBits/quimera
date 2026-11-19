import { render, screen, within } from '@testing-library/react-native';
import { StyleSheet, useColorScheme } from 'react-native';

import type { EntrenoGuardado } from '@/datos/entrenos';
import { ResumenDelEntreno } from '@/historial/ResumenDelEntreno';
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

/** El de la maqueta: gimnasio, ayer a las 10:15, 55 minutos con esfuerzo 8. */
const DE_AYER: EntrenoGuardado = {
  id: 'de-ayer',
  disciplina: 'gimnasio',
  fecha: '2026-11-14',
  hora: '10:15',
  duracionMs: 55 * 60_000,
  esfuerzo: 8,
  notas: null,
  bloques: [],
  modificado: 0,
};

describe('El resumen de un entreno', () => {
  afterEach(() => {
    mockEscala = 1;
  });

  it('dice cuándo fue, cuánto duró, en grande, y cuánto costó', async () => {
    await render(<ResumenDelEntreno entreno={DE_AYER} hoy={HOY} />);
    const cuando = screen.getByText('Ayer, 10:15');
    expect(cuando.props.accessibilityLabel).toBe('Ayer, a las 10:15');
    expect(estilo(cuando)).toMatchObject({ fontSize: 20, fontWeight: '600', fontVariant: ['tabular-nums'] });
    // La duración se lee de una vez: «55 minutos».
    const duracion = screen.getByTestId('duracion');
    expect(duracion.props.accessible).toBe(true);
    expect(duracion.props.accessibilityLabel).toBe('55 minutos');
    expect(duracion).toHaveStyle({ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 6 });
    const [cifra, unidad] = duracion.children as ReturnType<typeof screen.getByText>[];
    expect(cifra).toHaveTextContent('55');
    expect(estilo(cifra)).toMatchObject({ fontSize: 44, fontWeight: '700', letterSpacing: -0.5, fontVariant: ['tabular-nums'] });
    // Un reloj largo, con la letra grande, encoge antes que partirse.
    expect(cifra.props).toMatchObject({ numberOfLines: 1, adjustsFontSizeToFit: true });
    expect(unidad).toHaveTextContent('minutos');
    expect(estilo(unidad)).toMatchObject({ fontSize: 16 });
    expect(estilo(screen.getByText('Esfuerzo 8, duro'))).toMatchObject({ fontSize: 16, fontWeight: '500' });
  });

  it('sin hora, dice solo el día; con un minuto, «minuto»', async () => {
    await render(<ResumenDelEntreno entreno={{ ...DE_AYER, hora: null, duracionMs: 60_000 }} hoy={HOY} />);
    expect(screen.getByText('Ayer').props.accessibilityLabel).toBe('Ayer');
    expect(screen.getByTestId('duracion').props.accessibilityLabel).toBe('1 minuto');
    expect(screen.getByText('minuto')).toBeOnTheScreen();
  });

  it('una duración con segundos va como reloj, sola, sin la palabra', async () => {
    await render(<ResumenDelEntreno entreno={{ ...DE_AYER, duracionMs: 45 * 60_000 + 30_000 }} hoy={HOY} />);
    const duracion = screen.getByTestId('duracion');
    expect(duracion.props.accessibilityLabel).toBe('45:30');
    expect(duracion.children).toHaveLength(1);
    expect(within(duracion).getByText('45:30')).toBeOnTheScreen();
  });

  it('al lado va el rinoceronte haciendo ese esfuerzo, sobre su escenario de 120, en una caja de 128', async () => {
    await render(<ResumenDelEntreno entreno={DE_AYER} hoy={HOY} />);
    // El 7 y el 8 comparten dibujo, el cuarto.
    expect(screen.getByTestId('mascota', ocultos).props.source.testUri).toMatch(/rinoceronte-4\.png$/);
    const escenario = screen.getByTestId('escenario', ocultos);
    expect(escenario).toHaveStyle({ width: 120, height: 136 });
    expect(escenario.parent).toHaveStyle({ paddingHorizontal: 4 });
    // Con la letra normal, en fila: los textos a la izquierda y el rinoceronte a la derecha, centrados.
    const fila = screen.getByTestId('fila-del-resumen');
    expect(fila).toHaveStyle({ flexDirection: 'row', alignItems: 'center', gap: 8 });
    const [columna, caja] = fila.children as ReturnType<typeof screen.getByText>[];
    expect(columna.props.testID).toBe('columna-del-resumen');
    expect(columna).toHaveStyle({ flex: 1, gap: 4 });
    expect(within(caja).getByTestId('escenario', ocultos)).toBeTruthy();
  });

  it('con la letra grande, el rinoceronte va arriba y lo demás debajo, a todo el ancho', async () => {
    // El 130 % de Android llega como 1,2999999.
    mockEscala = Math.fround(1.3);
    await render(<ResumenDelEntreno entreno={DE_AYER} hoy={HOY} />);
    expect(screen.getByTestId('fila-del-resumen')).toHaveStyle({ flexDirection: 'column-reverse', alignItems: 'center' });
    expect(screen.getByTestId('columna-del-resumen')).toHaveStyle({ flex: 0, alignSelf: 'stretch' });
  });

  it('con la letra por debajo del 130 %, sigue en fila', async () => {
    mockEscala = 1.29;
    await render(<ResumenDelEntreno entreno={DE_AYER} hoy={HOY} />);
    expect(screen.getByTestId('fila-del-resumen')).toHaveStyle({ flexDirection: 'row' });
    expect(estilo(screen.getByTestId('columna-del-resumen')).alignSelf).toBeUndefined();
  });

  describe.each(['claro', 'oscuro'] as const)('en modo %s', (modo) => {
    const paleta = PALETAS[modo];
    beforeEach(() => jest.mocked(useColorScheme).mockReturnValue(modo === 'oscuro' ? 'dark' : 'light'));
    afterEach(() => jest.mocked(useColorScheme).mockReturnValue('light'));

    it('va en una tarjeta teñida de su disciplina, con lo de dentro a 16 del borde', async () => {
      await render(<ResumenDelEntreno entreno={DE_AYER} hoy={HOY} />);
      const tarjeta = screen.getByTestId('resumen');
      const { gimnasio } = paleta.disciplina;
      expect(tarjeta).toHaveStyle({ backgroundColor: gimnasio.tinte, borderColor: gimnasio.borde, borderRadius: 24 });
      const { padding, borderWidth } = estilo(tarjeta);
      expect(Number(padding) + Number(borderWidth)).toBe(16);
      expect(estilo(tarjeta).boxShadow).toBeUndefined();
    });

    it('lo que dice va en el color del texto, y la palabra de la duración, en el tenue', async () => {
      await render(<ResumenDelEntreno entreno={DE_AYER} hoy={HOY} />);
      expect(screen.getByText('Ayer, 10:15')).toHaveStyle({ color: paleta.texto });
      expect(screen.getByText('55')).toHaveStyle({ color: paleta.texto });
      expect(screen.getByText('minutos')).toHaveStyle({ color: paleta.textoTenue });
      expect(screen.getByText('Esfuerzo 8, duro')).toHaveStyle({ color: paleta.texto });
    });

    it('el escenario lleva los círculos de su disciplina', async () => {
      await render(<ResumenDelEntreno entreno={DE_AYER} hoy={HOY} />);
      const [fuera, dentro] = screen.getByTestId('escenario', ocultos).children as ReturnType<typeof screen.getByText>[];
      expect(fuera).toHaveStyle({ backgroundColor: paleta.disciplina.gimnasio.escenario[0] });
      expect(dentro).toHaveStyle({ backgroundColor: paleta.disciplina.gimnasio.escenario[1] });
    });
  });
});
