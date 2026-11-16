import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { useEffect } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';

import { CampoConPasos, anchoEnFila, letraQueCabe } from '@/componentes/CampoConPasos';
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

function campo(props: Partial<Parameters<typeof CampoConPasos>[0]> = {}) {
  return (
    <CampoConPasos
      etiqueta="Peso (kg)"
      valor="60"
      alCambiar={() => {}}
      alDarUnPaso={() => {}}
      {...props}
    />
  );
}

/** Lo que mide la caja del número cuando la pinta el móvil: el evento de onLayout. */

/**
 * Apunta cuándo han corrido los efectos de después de pintar (useEffect). Va
 * delante del campo, y React corre los suyos antes que los del campo; los de
 * antes de pintar (useLayoutEffect) corren todos antes que cualquiera de estos.
 */
let pintado = false;
function YaPintado() {
  useEffect(() => {
    pintado = true;
  }, []);
  return null;
}
const medir = (ancho: number) => ({ nativeEvent: { layout: { x: 0, y: 0, width: ancho, height: 52 } } });

describe('Un campo con pasos', () => {
  afterEach(() => {
    mockEscala = 1;
  });

  it('el menos y el más dan un paso hacia su lado, y el lector de pantalla dice de qué campo son', async () => {
    const alDarUnPaso = jest.fn();
    await render(campo({ etiquetaAccesible: 'Peso de Press banca', alDarUnPaso }));
    await fireEvent.press(screen.getByRole('button', { name: 'Bajar Peso de Press banca' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Subir Peso de Press banca' }));
    expect(alDarUnPaso.mock.calls).toEqual([[-1], [1]]);
  });

  it('el número se escribe en su caja, con el teclado de números', async () => {
    const alCambiar = jest.fn();
    await render(campo({ decimales: true, alCambiar }));
    await fireEvent.changeText(screen.getByLabelText('Peso (kg)'), '62,5');
    expect(alCambiar).toHaveBeenCalledWith('62,5');
    expect(screen.getByLabelText('Peso (kg)').props.keyboardType).toBe('decimal-pad');
  });

  it('la etiqueta va encima, en el color tenue y un poco hacia dentro, y la ayuda debajo, centrada', async () => {
    await render(campo({ etiqueta: 'Entre series (segundos)', valor: '90', ayuda: '1:30' }));
    expect(estilo(screen.getByText('Entre series (segundos)'))).toMatchObject({
      color: PALETAS.claro.textoTenue,
      fontSize: 14,
      marginLeft: 4,
    });
    expect(estilo(screen.getByText('1:30'))).toMatchObject({ color: PALETAS.claro.textoTenue, textAlign: 'center' });
  });

  describe.each(['claro', 'oscuro'] as const)('en modo %s', (modo) => {
    const paleta = PALETAS[modo];
    beforeEach(() => jest.mocked(useColorScheme).mockReturnValue(modo === 'oscuro' ? 'dark' : 'light'));
    afterEach(() => jest.mocked(useColorScheme).mockReturnValue('light'));

    it('el menos y el más son redondos, de 48, en el rosa suave y con el borde rosa, y su icono en rosa', async () => {
      await render(campo());
      for (const [accion, icono] of [
        ['Bajar', 'icono-menos'],
        ['Subir', 'icono-mas'],
      ]) {
        const boton = screen.getByRole('button', { name: `${accion} Peso (kg)` });
        expect(estilo(boton)).toMatchObject({
          width: 48,
          height: 48,
          borderRadius: 24,
          borderWidth: 2,
          backgroundColor: paleta.tintePrimario,
          borderColor: paleta.primario,
        });
        expect(within(boton).getByTestId(icono, ocultos).props.tintColor).toBe(paleta.primario);
      }
    });

    it('el número va grande y en negrita, centrado, con cifras tabulares, en una caja con el borde de los controles', async () => {
      await render(campo());
      expect(estilo(screen.getByLabelText('Peso (kg)'))).toMatchObject({
        fontSize: 22,
        fontWeight: '700',
        textAlign: 'center',
        fontVariant: ['tabular-nums'],
        minHeight: 52,
        borderWidth: 2,
        borderRadius: 16,
        color: paleta.texto,
        backgroundColor: paleta.campo,
        borderColor: paleta.bordeControl,
      });
    });
  });

  it('la caja del número no lleva relleno a los lados, que en Android le quitaría sitio al número', async () => {
    await render(campo());
    expect(estilo(screen.getByLabelText('Peso (kg)'))).toMatchObject({ paddingHorizontal: 0, paddingVertical: 0 });
  });

  it('suelto, ocupa toda la línea; en una fila, crece desde su ancho mínimo, con el número abajo', async () => {
    await render(
      <>
        {campo({ etiqueta: 'Suelto' })}
        {campo({ etiqueta: 'En fila', valor: '62,5', enFila: true })}
      </>,
    );
    const [suelto, enFila] = screen.getAllByTestId('campo-con-pasos');
    expect(estilo(suelto).flexBasis).toBeUndefined();
    expect(estilo(enFila)).toMatchObject({ flexGrow: 1, flexShrink: 1, flexBasis: anchoEnFila(1) });
    // Si al lado hay una etiqueta de dos líneas, los números siguen a la misma altura.
    expect(estilo(enFila)).toMatchObject({ justifyContent: 'flex-end' });
  });

  it('en una fila, el más estrecho deja sitio a «62,5» en su letra de siempre, contando lo que se pinta', async () => {
    await render(campo({ valor: '62,5', enFila: true }));
    const base = estilo(screen.getByTestId('campo-con-pasos')).flexBasis as number;
    const boton = estilo(screen.getByRole('button', { name: 'Bajar Peso (kg)' })).width as number;
    const hueco = estilo(screen.getByTestId('controles')).gap as number;
    const caja = base - 2 * boton - 2 * hueco;
    expect(letraQueCabe('62,5', caja, 1)).toBe(22);
    // Y no sobra: con un punto menos, ya no cabría.
    expect(letraQueCabe('62,5', caja - 1, 1)).toBeLessThan(22);
  });

  it('su ancho en la fila no cambia con el número: al pasar de 100 a 102,5, los botones siguen en su sitio', async () => {
    const pantalla = await render(campo({ valor: '100', enFila: true }));
    const antes = estilo(screen.getByTestId('campo-con-pasos')).flexBasis;
    await pantalla.rerender(campo({ valor: '102,5', enFila: true }));
    expect(estilo(screen.getByTestId('campo-con-pasos')).flexBasis).toBe(antes);
  });

  it('un número largo encoge su letra lo justo para caber en su caja, y vuelve a la de siempre si hay sitio', async () => {
    await render(campo({ valor: '102,5', enFila: true }));
    const numero = () => estilo(screen.getByLabelText('Peso (kg)')).fontSize as number;
    // Antes de medirse, cuenta con la caja más estrecha de una fila.
    expect(numero()).toBeLessThan(22);
    // En un móvil de 390, con los dos campos en fila, la caja mide 52.
    await fireEvent(screen.getByLabelText('Peso (kg)'), 'layout', medir(52));
    expect(numero()).toBeLessThan(22);
    // Lo justo: 102,5 (cuatro cifras y media) llena el hueco de dentro de la caja, sin su borde de 2.
    expect(4.5 * 0.58 * numero()).toBeCloseTo(52 - 4, 9);
    // En uno de 412, la caja mide 63 y cabe en su letra de siempre.
    await fireEvent(screen.getByLabelText('Peso (kg)'), 'layout', medir(63));
    expect(numero()).toBe(22);
  });

  it('con la letra al 130 %, en una fila, cada campo ocupa la línea entera, como en la maqueta', async () => {
    mockEscala = Math.fround(1.3);
    await render(campo({ valor: '62,5', enFila: true }));
    expect(estilo(screen.getByTestId('campo-con-pasos')).flexBasis).toBe('100%');
  });

  it('con la letra un poco más grande, al 115 %, cada campo pide más sitio en la fila', async () => {
    mockEscala = Math.fround(1.15);
    await render(campo({ valor: '62,5', enFila: true }));
    expect(estilo(screen.getByTestId('campo-con-pasos')).flexBasis).toBe(anchoEnFila(Math.fround(1.15)));
    expect(anchoEnFila(Math.fround(1.15))).toBeGreaterThan(anchoEnFila(1));
  });

  it('al encoger un número largo, cuenta con la letra del sistema: al 115 %, 102,5 llena justo una caja de 63', async () => {
    // Un Android de 412 con la letra al 115 %: los dos campos caben en fila y cada caja mide 63.
    mockEscala = Math.fround(1.15);
    await render(campo({ valor: '102,5', enFila: true }));
    await fireEvent(screen.getByLabelText('Peso (kg)'), 'layout', medir(63));
    const letra = estilo(screen.getByLabelText('Peso (kg)')).fontSize as number;
    expect(4.5 * 0.58 * Math.fround(1.15) * letra).toBeCloseTo(63 - 4, 9);
  });

  it('con decimales, por encima de 100 el número no cambia de tamaño al dar pasos: 100, 102,5 y 105 van igual', async () => {
    const letra = () => estilo(screen.getByLabelText('Peso (kg)')).fontSize as number;
    const pantalla = await render(campo({ valor: '100', decimales: true, enFila: true }));
    await fireEvent(screen.getByLabelText('Peso (kg)'), 'layout', medir(52));
    const conCien = letra();
    expect(conCien).toBeLessThan(22);
    for (const valor of ['102,5', '105', '107,5']) {
      await pantalla.rerender(campo({ valor, decimales: true, enFila: true }));
      expect(letra()).toBe(conCien);
    }
    // Por debajo de 100, como 97,5, va en su letra de siempre.
    await pantalla.rerender(campo({ valor: '97,5', decimales: true, enFila: true }));
    expect(letra()).toBe(22);
  });

  it('mide su caja antes de pintarse, sin esperar a onLayout, y el número sale ya con su letra', async () => {
    // El TextInput de las pruebas mide con un jest.fn que no contesta: aquí contesta lo que mediría el móvil.
    const metodos = jest.requireActual<{ default: { measure: jest.Mock } }>(
      '@react-native/jest-preset/jest/MockNativeMethods',
    ).default;
    const alMedir: boolean[] = [];
    pintado = false;
    metodos.measure.mockImplementation((responder: (x: number, y: number, ancho: number, alto: number) => void) => {
      alMedir.push(pintado);
      responder(0, 0, 63, 52);
    });
    try {
      await render(
        <>
          <YaPintado />
          {campo({ valor: '102,5', enFila: true })}
        </>,
      );
      expect(estilo(screen.getByLabelText('Peso (kg)')).fontSize).toBe(22);
      // Midió una vez, y antes de pintar: los efectos de después todavía no habían corrido.
      expect(alMedir).toEqual([false]);
    } finally {
      metodos.measure.mockReset();
    }
  });

  it('con la letra enorme de los tamaños de accesibilidad del iPhone, el menos y el más crecen con su icono', async () => {
    mockEscala = 3.571;
    await render(campo());
    for (const [accion, icono] of [
      ['Bajar', 'icono-menos'],
      ['Subir', 'icono-mas'],
    ]) {
      const boton = estilo(screen.getByRole('button', { name: `${accion} Peso (kg)` }));
      const lado = estilo(screen.getByTestId(icono, ocultos)).width as number;
      // El icono cabe dentro del círculo, con su borde de 2 a cada lado.
      expect(boton.width as number).toBeGreaterThanOrEqual(lado + 4);
      expect(boton).toMatchObject({ height: boton.width, borderRadius: (boton.width as number) / 2 });
    }
  });
});

describe('La letra que cabe', () => {
  it('sin número, o con uno corto, es la de siempre', () => {
    expect(letraQueCabe('', null, 1)).toBe(22);
    expect(letraQueCabe('8', null, 1)).toBe(22);
    expect(letraQueCabe('62,5', null, 1)).toBe(22);
  });

  it('cuanto más largo el número, más pequeña, y nunca menos de 12', () => {
    expect(letraQueCabe('102,5', null, 1)).toBeLessThan(22);
    expect(letraQueCabe('1002,5', null, 1)).toBeLessThan(letraQueCabe('102,5', null, 1));
    expect(letraQueCabe('123456789012', null, 1)).toBe(12);
  });

  it('la coma y el punto cuentan lo mismo, y menos que una cifra', () => {
    expect(letraQueCabe('102.5', null, 1)).toBe(letraQueCabe('102,5', null, 1));
    expect(letraQueCabe('102,5', null, 1)).toBeGreaterThan(letraQueCabe('10255', null, 1));
  });

  it('con la letra del sistema más grande, el número ocupa más y encoge antes', () => {
    expect(letraQueCabe('102,5', 52, 1.3)).toBeLessThan(letraQueCabe('102,5', 52, 1));
  });

  it('con decimales, deja sitio para la coma y una cifra: 100 va como 102,5, y 62,5 o 75, en la de siempre', () => {
    expect(letraQueCabe('100', 52, 1, true)).toBe(letraQueCabe('102,5', 52, 1, true));
    expect(letraQueCabe('100', 52, 1, true)).toBeLessThan(22);
    expect(letraQueCabe('100', 52, 1)).toBe(22);
    expect(letraQueCabe('62,5', 52, 1, true)).toBe(22);
    expect(letraQueCabe('75', 52, 1, true)).toBe(22);
    expect(letraQueCabe('', 52, 1, true)).toBe(22);
    // El peso también se puede escribir con punto.
    expect(letraQueCabe('102.5', 52, 1, true)).toBe(letraQueCabe('102,5', 52, 1, true));
    expect(letraQueCabe('100.', 52, 1, true)).toBe(letraQueCabe('100,', 52, 1, true));
    expect(letraQueCabe('100.', 52, 1, true)).toBe(letraQueCabe('100', 52, 1, true));
  });
});
