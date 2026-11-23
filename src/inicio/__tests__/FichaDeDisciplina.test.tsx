import { render, screen, within } from '@testing-library/react-native';
import { StyleSheet, useColorScheme } from 'react-native';

import { FichaDeDisciplina } from '@/inicio/FichaDeDisciplina';
import { PALETAS } from '@/tema/colores';

// La escala de la letra del sistema: 1 con la letra normal.
let mockEscala = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 844, scale: 2, fontScale: mockEscala }),
}));

const icono = (nombre: string) => screen.getByTestId(`icono-${nombre}`, { includeHiddenElements: true });

describe('La ficha de una disciplina', () => {
  const paleta = PALETAS.claro;
  afterEach(() => {
    mockEscala = 1;
  });

  it('es una sola cosa para el lector de pantalla, con el nombre y los minutos', async () => {
    await render(<FichaDeDisciplina disciplina="hyrox" minutos={45} />);
    expect(screen.getByLabelText('Hyrox, 45 minutos')).toBeOnTheScreen();
    expect(screen.getByText('Hyrox')).toBeOnTheScreen();
    expect(screen.getByText('45 minutos')).toBeOnTheScreen();
  });

  it('va teñida de su disciplina, con su marca y el icono encima en su color', async () => {
    await render(<FichaDeDisciplina disciplina="hyrox" minutos={45} />);
    const ficha = screen.getByLabelText('Hyrox, 45 minutos');
    expect(ficha).toHaveStyle({ backgroundColor: paleta.disciplina.hyrox.tinte });
    expect(within(ficha).getByTestId('marca-de-disciplina')).toHaveStyle({ backgroundColor: paleta.disciplina.hyrox.marca });
    expect(icono('hyrox').props.tintColor).toBe(paleta.sobreMarca);
  });

  it('con un minuto, dice minuto', async () => {
    await render(<FichaDeDisciplina disciplina="gimnasio" minutos={1} />);
    expect(screen.getByLabelText('Gimnasio, 1 minuto')).toBeOnTheScreen();
    expect(screen.getByText('1 minuto')).toBeOnTheScreen();
  });

  it('la marca no tiene un lado fijo: crece con su icono, que crece con la letra', async () => {
    await render(<FichaDeDisciplina disciplina="gimnasio" minutos={53} />);
    const marca = StyleSheet.flatten(screen.getByTestId('marca-de-disciplina').props.style);
    expect(marca).toMatchObject({ minWidth: 28, minHeight: 28, padding: 5 });
    expect(marca.width).toBeUndefined();
    expect(marca.height).toBeUndefined();
  });

  it('con la letra normal, dos fichas caben en una fila', async () => {
    await render(<FichaDeDisciplina disciplina="gimnasio" minutos={53} />);
    expect(screen.getByLabelText('Gimnasio, 53 minutos')).toHaveStyle({ flexBasis: 140 });
  });

  it('con la letra al 130 % de Android, cada ficha ocupa todo el ancho', async () => {
    mockEscala = Math.fround(1.3);
    await render(<FichaDeDisciplina disciplina="hyrox" minutos={45} />);
    expect(screen.getByLabelText('Hyrox, 45 minutos')).toHaveStyle({ flexBasis: '100%' });
  });
});

describe('La ficha de una disciplina, en oscuro', () => {
  const paleta = PALETAS.oscuro;
  beforeEach(() => jest.mocked(useColorScheme).mockReturnValue('dark'));
  afterEach(() => jest.mocked(useColorScheme).mockReturnValue('light'));

  it('lleva el borde de su disciplina, que en oscuro se ve, y el icono en la tinta de encima de la marca', async () => {
    await render(<FichaDeDisciplina disciplina="hyrox" minutos={45} />);
    expect(screen.getByLabelText('Hyrox, 45 minutos')).toHaveStyle({ borderColor: paleta.disciplina.hyrox.borde });
    expect(icono('hyrox').props.tintColor).toBe(paleta.sobreMarca);
  });

  it('sobre la marca del gimnasio, que es el color de las acciones, el icono va en la tinta de encima de las acciones', async () => {
    await render(<FichaDeDisciplina disciplina="gimnasio" minutos={53} />);
    expect(icono('gimnasio').props.tintColor).toBe(paleta.sobrePrimario);
  });
});
