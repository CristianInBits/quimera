import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { anchoEnFila } from '@/componentes/CampoConPasos';
import { CarreraEnCinta } from '@/gimnasio/CarreraEnCinta';
import { espacio } from '@/tema/medidas';

// La escala de la letra del sistema: en Jest vale 2 si no se dice otra cosa.
let mockEscala = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 844, scale: 2, fontScale: mockEscala }),
}));

/** El estilo de un elemento, con sus capas juntas. */
const estilo = (elemento: ReturnType<typeof screen.getByText>) => StyleSheet.flatten(elemento.props.style);

function carrera() {
  return (
    <CarreraEnCinta
      bloque={{ tipo: 'carrera', id: 'c1', kilometros: '1,5', minutos: '10', descansoDespues: '' }}
      nombre={{ enFrase: 'la carrera en cinta', alEmpezar: 'Carrera en cinta', ejercicios: [] }}
      ultimo={false}
      cambiar={() => {}}
      conDeshacer={() => {}}
    />
  );
}

describe('La carrera en cinta en el editor', () => {
  afterEach(() => {
    mockEscala = 1;
  });

  it('lleva su nombre y Quitar arriba, la distancia y los minutos en fila, y sus descansos', async () => {
    await render(carrera());
    expect(screen.getByRole('header', { name: 'Carrera en cinta' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Quitar la carrera en cinta' })).toBeOnTheScreen();
    expect(screen.getByTestId('campos')).toHaveStyle({ flexDirection: 'row', flexWrap: 'wrap', gap: 8 });
    const [distancia, tiempo] = screen.getAllByTestId('campo-con-pasos');
    expect(estilo(distancia)).toMatchObject({ flexBasis: anchoEnFila(1) });
    expect(estilo(tiempo)).toMatchObject({ flexBasis: anchoEnFila(1) });
    expect(screen.getByLabelText('Distancia de la carrera en cinta, en kilómetros').props.value).toBe('1,5');
    expect(screen.getByRole('button', { name: 'Descansos de la carrera en cinta: sin apuntar' })).toBeOnTheScreen();
  });

  it('la distancia y los minutos caben uno al lado del otro en un móvil de 390, y en uno de 360 se apilan', async () => {
    await render(carrera());
    // Lo que les queda: el móvil sin el margen de la pantalla, el borde y el relleno de la tarjeta y el de la fila.
    const tarjeta = estilo(screen.getByTestId('bloque'));
    const campos = estilo(screen.getByTestId('campos'));
    const lados = espacio[4] + Number(tarjeta.borderWidth) + Number(tarjeta.padding) + Number(campos.paddingHorizontal);
    const fila = (movil: number) => movil - 2 * lados;
    const [distancia] = screen.getAllByTestId('campo-con-pasos');
    const dos = 2 * Number(estilo(distancia).flexBasis) + Number(campos.gap);
    expect(dos).toBeLessThanOrEqual(fila(390));
    expect(dos).toBeGreaterThan(fila(360));
  });

  it('con la letra grande, cada campo ocupa la línea entera', async () => {
    mockEscala = Math.fround(1.3);
    await render(carrera());
    for (const campo of screen.getAllByTestId('campo-con-pasos')) expect(campo).toHaveStyle({ flexBasis: '100%' });
  });
});
