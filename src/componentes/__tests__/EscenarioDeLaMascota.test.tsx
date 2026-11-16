import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { EscenarioDeLaMascota } from '@/componentes/EscenarioDeLaMascota';
import { PALETAS } from '@/tema/colores';

const ocultos = { includeHiddenElements: true } as const;

/** Los estilos de los hijos del escenario: el círculo de fuera, el de dentro y el dibujo. */
const piezas = () =>
  screen
    .getByTestId('escenario', ocultos)
    .children.map((hijo) => (typeof hijo === 'string' ? {} : StyleSheet.flatten(hijo.props.style)));

describe('El escenario de una mascota', () => {
  it('lleva los dos círculos de su disciplina, de fuera a dentro, y el dibujo encima', async () => {
    await render(<EscenarioDeLaMascota disciplina="gimnasio" tamano={156} />);
    const [fuera, dentro] = piezas();
    expect(fuera).toMatchObject({ backgroundColor: PALETAS.claro.disciplina.gimnasio.escenario[0], width: 156 });
    expect(dentro).toMatchObject({ backgroundColor: PALETAS.claro.disciplina.gimnasio.escenario[1] });
    expect(screen.getByTestId('mascota', ocultos)).toBeOnTheScreen();
  });

  it('los círculos son los de la disciplina que se le da, y sin dibujo de ese esfuerzo no sale ninguno', async () => {
    // El hyrox ya tiene su tigre de presentación, pero aún no los de cada esfuerzo.
    await render(<EscenarioDeLaMascota disciplina="hyrox" esfuerzo={5} tamano={156} />);
    const [fuera, dentro] = piezas();
    expect(fuera).toMatchObject({ backgroundColor: PALETAS.claro.disciplina.hyrox.escenario[0] });
    expect(dentro).toMatchObject({ backgroundColor: PALETAS.claro.disciplina.hyrox.escenario[1] });
    expect(screen.queryByTestId('mascota', ocultos)).toBeNull();
  });

  it('con otros colores, los usa en vez de los de la disciplina', async () => {
    await render(<EscenarioDeLaMascota disciplina="gimnasio" tamano={156} colores={['#111111', '#222222']} />);
    const [fuera, dentro] = piezas();
    expect(fuera).toMatchObject({ backgroundColor: '#111111' });
    expect(dentro).toMatchObject({ backgroundColor: '#222222' });
  });

  it('el dibujo de presentación es cuadrado, centrado sobre el círculo y asomando por arriba', async () => {
    await render(<EscenarioDeLaMascota disciplina="gimnasio" tamano={100} />);
    expect(StyleSheet.flatten(screen.getByTestId('mascota', ocultos).props.style)).toMatchObject({
      width: 115,
      height: 115,
      position: 'absolute',
      left: -7.5,
      top: -3,
    });
  });

  it('el dibujo de un esfuerzo es más alto que ancho', async () => {
    await render(<EscenarioDeLaMascota disciplina="gimnasio" esfuerzo={7} tamano={100} />);
    expect(StyleSheet.flatten(screen.getByTestId('mascota', ocultos).props.style)).toMatchObject({ width: 90, height: 116 });
  });

  it('con otras proporciones, el círculo, el interior y el dibujo las siguen', async () => {
    await render(
      <EscenarioDeLaMascota disciplina="gimnasio" tamano={200} proporciones={{ arriba: 0.08, interior: 0.7, dibujo: 1.12, alzado: 0.035 }} />,
    );
    const [fuera, dentro] = piezas();
    expect(fuera).toMatchObject({ top: 16, width: 200 });
    expect(dentro).toMatchObject({ width: 140, top: 46, left: 30 });
    expect(StyleSheet.flatten(screen.getByTestId('mascota', ocultos).props.style)).toMatchObject({ width: 224, top: -7 });
  });

  it('es decorativo: el lector de pantalla lo salta', async () => {
    await render(<EscenarioDeLaMascota disciplina="gimnasio" tamano={156} />);
    expect(screen.queryByTestId('escenario')).toBeNull();
  });
});
