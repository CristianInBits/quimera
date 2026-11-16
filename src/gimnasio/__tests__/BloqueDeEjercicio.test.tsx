import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet, useColorScheme } from 'react-native';

import { anchoEnFila } from '@/componentes/CampoConPasos';
import type { Ejercicio } from '@/datos/ejercicios';
import { horaDeInstante } from '@/datos/fechas';
import { BloqueDeEjercicio, resumenSinPartir } from '@/gimnasio/BloqueDeEjercicio';
import type { BloqueDeEjercicios, SerieEnEdicion } from '@/gimnasio/editor';
import { T0 } from '@/pruebas/datos';
import { PALETAS } from '@/tema/colores';
import { espacio } from '@/tema/medidas';

// La escala de la letra del sistema: en Jest vale 2 si no se dice otra cosa.
let mockEscala = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 844, scale: 2, fontScale: mockEscala }),
}));

/** El estilo de un elemento, con sus capas juntas. */
const estilo = (elemento: ReturnType<typeof screen.getByText>) => StyleSheet.flatten(elemento.props.style);
const ocultos = { includeHiddenElements: true };
/** El espacio duro, que no deja partir la línea donde está. */
const DURO = '\u00a0';

const PRESS: Ejercicio = { id: 'press', nombre: 'Press banca', grupo: 'pecho', mide: ['peso', 'repeticiones'], porMancuerna: false };
const REMO: Ejercicio = { id: 'remo', nombre: 'Remo con mancuerna', grupo: 'espalda', mide: ['peso', 'repeticiones'], porMancuerna: true };
const FONDOS: Ejercicio = { id: 'fondos', nombre: 'Fondos en paralelas', grupo: 'pecho', mide: ['repeticiones'], porMancuerna: false };
const PLANCHA: Ejercicio = { id: 'plancha', nombre: 'Plancha', grupo: 'core', mide: ['tiempo'], porMancuerna: false };

const serie = (id: string, datos: Partial<SerieEnEdicion> = {}): SerieEnEdicion => ({
  id,
  repeticiones: '',
  peso: '',
  segundos: '',
  hecha: null,
  ...datos,
});

/** Un press banca como el de la maqueta: dos series hechas, una a medias y otra sin apuntar. */
const PRESS_BANCA: BloqueDeEjercicios = {
  tipo: 'ejercicios',
  id: 'b1',
  ejercicioIds: ['press'],
  vueltas: [
    [serie('s1', { peso: '60', repeticiones: '10', hecha: T0 })],
    [serie('s2', { peso: '70', repeticiones: '8', hecha: T0 + 180_000 })],
    [serie('s3', { peso: '75', repeticiones: '6' })],
    [serie('s4')],
  ],
  descansoEntreSeries: '90',
  descansoDespues: '120',
};

/** Una superserie de remo y fondos: la primera vuelta hecha, y la segunda con los fondos sin apuntar. */
const SUPERSERIE: BloqueDeEjercicios = {
  tipo: 'ejercicios',
  id: 'b2',
  ejercicioIds: ['remo', 'fondos'],
  vueltas: [
    [serie('r1', { peso: '22', repeticiones: '10', hecha: T0 }), serie('f1', { repeticiones: '12', hecha: T0 + 60_000 })],
    [serie('r2', { peso: '22', repeticiones: '10', hecha: T0 + 240_000 }), serie('f2')],
  ],
  descansoEntreSeries: '',
  descansoDespues: '',
};
const NOMBRE_DE_LA_SUPERSERIE = 'la superserie de Remo con mancuerna y Fondos en paralelas';

function bloque(props: Partial<Parameters<typeof BloqueDeEjercicio>[0]> = {}) {
  return (
    <BloqueDeEjercicio
      bloque={PRESS_BANCA}
      nombre={{ enFrase: 'Press banca', alEmpezar: 'Press banca', ejercicios: ['Press banca'] }}
      ejercicios={[PRESS]}
      siguiente={null}
      ultimo={false}
      elegida={null}
      alElegir={() => {}}
      cambiar={() => {}}
      conDeshacer={() => {}}
      asegurarVisible={() => {}}
      nuevoId={() => 'nuevo'}
      {...props}
    />
  );
}

function superserie(props: Partial<Parameters<typeof BloqueDeEjercicio>[0]> = {}) {
  return bloque({
    bloque: SUPERSERIE,
    nombre: {
      enFrase: NOMBRE_DE_LA_SUPERSERIE,
      alEmpezar: 'La superserie de Remo con mancuerna y Fondos en paralelas',
      ejercicios: ['Remo con mancuerna', 'Fondos en paralelas'],
    },
    ejercicios: [REMO, FONDOS],
    ...props,
  });
}

const fila = (nombre: string) => screen.getByRole('button', { name: nombre });
/** Lo último que pinta una fila de serie: su marca, la flecha o el hueco. */
const alFinal = (nombre: string) => {
  const hijos = fila(nombre).children;
  return hijos[hijos.length - 1] as ReturnType<typeof screen.getByText>;
};

/**
 * El ancho que les queda a los campos de la serie abierta en un móvil de este
 * ancho, con lo que pinta el bloque: el margen de la pantalla del editor, el
 * borde y el relleno de la tarjeta, el borde de la serie abierta y el relleno
 * de su panel, a cada lado.
 */
function anchoDeLaFilaDeCampos(movil: number) {
  const tarjeta = estilo(screen.getByTestId('bloque'));
  const abierta = estilo(screen.getByTestId('serie-abierta'));
  const panel = estilo(screen.getByTestId('panel'));
  const lados = espacio[4] + Number(tarjeta.borderWidth) + Number(tarjeta.padding) + Number(abierta.borderWidth);
  return movil - 2 * (lados + Number(panel.paddingHorizontal));
}

describe('Un ejercicio en el editor', () => {
  afterEach(() => {
    mockEscala = 1;
  });

  it('cada serie es una fila con su número y su resumen en cifras tabulares, y abrirla la elige', async () => {
    const alElegir = jest.fn();
    await render(bloque({ alElegir }));
    const segunda = within(fila('Serie 2: 70 kg × 8, hecha'));
    expect(estilo(segunda.getByText('70 kg × 8'))).toMatchObject({
      fontSize: 18,
      fontWeight: '500',
      fontVariant: ['tabular-nums'],
    });
    expect(estilo(segunda.getByText('2'))).toMatchObject({ fontSize: 16, fontVariant: ['tabular-nums'] });
    await fireEvent.press(fila('Serie 3: 75 kg × 6'));
    expect(alElegir).toHaveBeenCalledWith('s3');
  });

  it('las series de un ejercicio van seguidas, sin hueco entre ellas', async () => {
    await render(bloque());
    expect(estilo(screen.getByTestId('vueltas'))?.gap ?? 0).toBe(0);
  });

  it('la serie sin apuntar lo dice un poco más pequeño y en el color tenue', async () => {
    await render(bloque());
    expect(estilo(within(fila('Serie 4: Sin apuntar')).getByText('Sin apuntar'))).toMatchObject({
      fontSize: 16,
      color: PALETAS.claro.textoTenue,
    });
  });

  it('una serie hecha acaba en un círculo rosa con la marca, y una sin hacer, en un hueco del mismo ancho', async () => {
    await render(bloque());
    const hecha = alFinal('Serie 1: 60 kg × 10, hecha');
    expect(hecha.props.testID).toBe('marca-de-hecha');
    expect(hecha).toHaveStyle({ width: 26, height: 26, borderRadius: 13, backgroundColor: PALETAS.claro.primario });
    expect(within(hecha).getByTestId('icono-hecha', ocultos).props.tintColor).toBe(PALETAS.claro.sobrePrimario);
    const vacia = alFinal('Serie 4: Sin apuntar');
    expect(vacia.props.testID).toBe('marca-vacia');
    expect(vacia).toHaveStyle({ width: 26 });
    expect(within(fila('Serie 4: Sin apuntar')).queryByTestId('icono-plegar', ocultos)).toBeNull();
  });

  it('la serie abierta va en el rosa suave con el borde rosa, su número en el rosa del texto y acaba en la flecha de plegar', async () => {
    const alElegir = jest.fn();
    await render(bloque({ elegida: 's3', alElegir }));
    expect(screen.getByTestId('serie-abierta')).toHaveStyle({
      backgroundColor: PALETAS.claro.tintePrimario,
      borderColor: PALETAS.claro.primario,
      borderWidth: 2,
      borderRadius: 18,
    });
    const abierta = fila('Serie 3: 75 kg × 6');
    expect(abierta).toBeExpanded();
    const flecha = alFinal('Serie 3: 75 kg × 6');
    expect(flecha.props.testID).toBe('marca-abierta');
    expect(within(flecha).getByTestId('icono-plegar', ocultos).props.tintColor).toBe(PALETAS.claro.primario);
    expect(estilo(within(abierta).getByText('3'))).toMatchObject({ color: PALETAS.claro.primarioTexto, fontWeight: '700' });
    expect(estilo(within(fila('Serie 1: 60 kg × 10, hecha')).getByText('1'))).toMatchObject({
      color: PALETAS.claro.textoTenue,
      fontWeight: '600',
    });
    // Tocarla otra vez la pliega.
    await fireEvent.press(abierta);
    expect(alElegir).toHaveBeenCalledWith(null);
  });

  it('el panel: repetir la anterior con su icono, los campos en fila y Hecha, con la marca detrás, al lado de Quitar esta serie', async () => {
    await render(bloque({ elegida: 's3' }));
    const igual = screen.getByRole('button', { name: 'Igual que la anterior (70 kg × 8)' });
    expect(within(igual).getByTestId('icono-repetir', ocultos)).toBeTruthy();
    // El resumen va con espacios duros: con la letra hasta el 200 %, la línea no se parte dentro de «70 kg × 8».
    const titulo = within(igual).getByText('Igual que la anterior (70 kg × 8)');
    expect(titulo.props.children).toBe(`Igual que la anterior (70${DURO}kg${DURO}×${DURO}8)`);

    // Los campos van en fila, y se apilan si no caben.
    expect(screen.getByTestId('campos')).toHaveStyle({ flexDirection: 'row', flexWrap: 'wrap', gap: 8 });
    const campos = within(screen.getByTestId('serie-abierta')).getAllByTestId('campo-con-pasos');
    expect(campos.map((campo) => estilo(campo).flexBasis)).toEqual([anchoEnFila(1), anchoEnFila(1)]);

    // Hecha y Quitar esta serie van en una fila que se parte, con Hecha creciendo desde 140.
    const acciones = screen.getByTestId('acciones');
    expect(acciones).toHaveStyle({ flexDirection: 'row', flexWrap: 'wrap', gap: 8 });
    expect(screen.getByTestId('hecha')).toHaveStyle({ flexGrow: 1, flexShrink: 1, flexBasis: 140 });
    expect(within(acciones).getByRole('button', { name: 'Quitar esta serie' })).toBeOnTheScreen();

    const hecha = screen.getByRole('button', { name: 'Hecha' });
    expect(estilo(hecha)).toMatchObject({ backgroundColor: PALETAS.claro.primario, minHeight: 52 });
    expect(estilo(hecha).boxShadow).toBeUndefined();
    const marca = within(hecha).getByTestId('icono-hecha', ocultos);
    const texto = within(hecha).getByText('Hecha');
    expect(hecha.children.indexOf(texto)).toBeGreaterThanOrEqual(0);
    expect(hecha.children.indexOf(marca)).toBeGreaterThan(hecha.children.indexOf(texto));
  });

  it.each([
    ['264 %, el tercer tamaño de accesibilidad del iPhone', 2.643, `Igual que la anterior (70${DURO}kg ×${DURO}8)`],
    ['357 %, el más grande', 3.571, 'Igual que la anterior (70 kg × 8)'],
  ])('con la letra al %s, Igual que la anterior se parte donde no rompe ninguna cifra', async (_escala, escala, titulo) => {
    mockEscala = escala;
    await render(bloque({ elegida: 's3' }));
    const igual = screen.getByRole('button', { name: 'Igual que la anterior (70 kg × 8)' });
    expect(within(igual).getByText('Igual que la anterior (70 kg × 8)').props.children).toBe(titulo);
  });

  it('el resumen sin partir une cada cifra con lo suyo según la letra, y un tiempo no cambia', () => {
    const repeticiones = serie('x', { repeticiones: '12' });
    const peso = serie('x', { peso: '60' });
    const tiempo = serie('x', { segundos: '90' });
    expect(resumenSinPartir(repeticiones, 1)).toBe(`12${DURO}reps`);
    expect(resumenSinPartir(repeticiones, 2.643)).toBe(`12${DURO}reps`);
    expect(resumenSinPartir(repeticiones, 3.571)).toBe('12 reps');
    expect(resumenSinPartir(peso, 2.643)).toBe(`60${DURO}kg`);
    for (const escala of [1, 2.643, 3.571]) expect(resumenSinPartir(tiempo, escala)).toBe('1:30');
  });

  it('dos campos con 62,5 caben uno al lado del otro en un móvil de 390, como en la maqueta, y en uno de 360 se apilan', async () => {
    await render(bloque({ elegida: 's3' }));
    const [peso] = within(screen.getByTestId('serie-abierta')).getAllByTestId('campo-con-pasos');
    const dos = 2 * Number(estilo(peso).flexBasis) + Number(estilo(screen.getByTestId('campos')).gap);
    expect(dos).toBeLessThanOrEqual(anchoDeLaFilaDeCampos(390));
    expect(dos).toBeGreaterThan(anchoDeLaFilaDeCampos(360));
  });

  it('abierta una serie hecha, acaba en la flecha y dice a qué hora se marcó, en un botón que ocupa su línea', async () => {
    await render(bloque({ elegida: 's1' }));
    expect(alFinal('Serie 1: 60 kg × 10, hecha').props.testID).toBe('marca-abierta');
    expect(within(fila('Serie 1: 60 kg × 10, hecha')).queryByTestId('marca-de-hecha')).toBeNull();

    const quitarLaMarca = screen.getByRole('button', { name: `Hecha a las ${horaDeInstante(T0)}: quitar la marca` });
    expect(estilo(quitarLaMarca)).toMatchObject({ backgroundColor: 'transparent', borderColor: PALETAS.claro.primario });
    // El texto es largo: el botón ocupa su línea y Quitar esta serie baja a la siguiente.
    expect(screen.getByTestId('hecha')).toHaveStyle({ flexBasis: '100%' });
    // Aquí la marca va delante: dice que está hecha antes de decir que se puede quitar.
    const marca = within(quitarLaMarca).getByTestId('icono-hecha', ocultos);
    const texto = within(quitarLaMarca).getByText(/^Hecha a las/);
    expect(quitarLaMarca.children.indexOf(texto)).toBeGreaterThanOrEqual(0);
    expect(quitarLaMarca.children.indexOf(marca)).toBeLessThan(quitarLaMarca.children.indexOf(texto));
  });

  it('la cabecera lleva el nombre y Quitar, y debajo del nombre lo que conviene saber, como «En segundos»', async () => {
    await render(
      bloque({
        bloque: { ...PRESS_BANCA, ejercicioIds: ['plancha'], vueltas: [[serie('p1', { segundos: '45' })]] },
        nombre: { enFrase: 'Plancha', alEmpezar: 'Plancha', ejercicios: ['Plancha'] },
        ejercicios: [PLANCHA],
      }),
    );
    expect(screen.getByRole('header', { name: 'Plancha' })).toBeOnTheScreen();
    expect(estilo(screen.getByText('En segundos'))).toMatchObject({ fontSize: 14, color: PALETAS.claro.textoTenue });
    expect(screen.getByRole('button', { name: 'Serie 1: 0:45' })).toBeOnTheScreen();
    // En la fila de arriba, el nombre primero, creciendo, y Quitar al final, en el borde derecho.
    const cabecera = screen.getByTestId('cabecera');
    expect(cabecera).toHaveStyle({ flexDirection: 'row' });
    const [nombre, quitar] = cabecera.children as ReturnType<typeof screen.getByText>[];
    expect(estilo(nombre)).toMatchObject({ flex: 1 });
    expect(within(nombre).getByRole('header', { name: 'Plancha' })).toBeOnTheScreen();
    expect(quitar.props.accessibilityLabel).toBe('Quitar Plancha');
    expect(cabecera.children).toHaveLength(2);
  });

  it('Serie va al principio de la línea, sin ocuparla; Enlazar la ocupa, con el texto al principio', async () => {
    await render(bloque({ siguiente: 'Remo con mancuerna + Fondos en paralelas' }));
    expect(screen.getByTestId('anadir-serie')).toHaveStyle({ alignItems: 'flex-start' });
    expect(
      within(screen.getByTestId('anadir-serie')).getByRole('button', { name: 'Añadir una serie de Press banca' }),
    ).toBeOnTheScreen();
    // El botón de enlazar se estira a lo ancho: su caja no le pone otra alineación.
    expect(estilo(screen.getByTestId('enlazar')).alignItems ?? 'stretch').toBe('stretch');
    const enlazar = within(screen.getByTestId('enlazar')).getByRole('button', {
      name: 'Enlazar en superserie con Remo con mancuerna + Fondos en paralelas',
    });
    expect(estilo(enlazar)).toMatchObject({ justifyContent: 'flex-start' });
    expect(within(enlazar).getByTestId('icono-enlazar', ocultos).props.tintColor).toBe(PALETAS.claro.primario);
  });

  it('con la letra grande, el número y la marca de cada fila crecen con ella, y Hecha ocupa su línea', async () => {
    mockEscala = Math.fround(1.3);
    await render(bloque({ elegida: 's3' }));
    const hecha = fila('Serie 1: 60 kg × 10, hecha');
    expect(estilo(within(hecha).getByTestId('marca-de-hecha')).width).toBeCloseTo(26 * 1.3, 4);
    expect(estilo(within(hecha).getByText('1')).width).toBeCloseTo(24 * 1.3, 4);
    expect(estilo(alFinal('Serie 4: Sin apuntar')).width).toBeCloseTo(26 * 1.3, 4);
    // «Hecha» y «Quitar esta serie» pasan a dos filas, como en la maqueta.
    expect(screen.getByTestId('hecha')).toHaveStyle({ flexBasis: '100%' });
  });
});

describe('Una superserie en el editor', () => {
  afterEach(() => {
    mockEscala = 1;
  });

  it('lleva arriba la insignia SUPERSERIE, con Separar y Quitar al lado, y debajo el nombre entero con su nota', async () => {
    await render(superserie());
    expect(estilo(screen.getByText('SUPERSERIE'))).toMatchObject({
      backgroundColor: PALETAS.claro.insignia,
      color: PALETAS.claro.primarioTexto,
      borderRadius: 999,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 1,
    });
    // Arriba, una fila que con la letra grande se parte: la insignia a la izquierda y los botones,
    // uno al lado del otro, a la derecha. Debajo, el nombre y su nota.
    const cabecera = screen.getByTestId('cabecera');
    expect(cabecera).toHaveStyle({ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' });
    expect(within(cabecera).getByText('SUPERSERIE')).toBeOnTheScreen();
    expect(within(cabecera).queryByRole('header')).toBeNull();
    const botones = screen.getByTestId('botones-de-la-cabecera');
    expect(botones).toHaveStyle({ flexDirection: 'row' });
    expect(within(botones).getByRole('button', { name: `Separar ${NOMBRE_DE_LA_SUPERSERIE}` })).toBeOnTheScreen();
    expect(within(botones).getByRole('button', { name: `Quitar ${NOMBRE_DE_LA_SUPERSERIE}` })).toBeOnTheScreen();
    const [arriba, debajo] = screen.getByTestId('encabezado').children as ReturnType<typeof screen.getByText>[];
    expect(arriba.props.testID).toBe('cabecera');
    // En orden: la insignia y después los botones; entre los botones, Separar y después Quitar, al borde.
    expect((cabecera.children as (typeof cabecera)[]).map((hijo) => hijo.props.testID ?? hijo.props.children)).toEqual([
      'SUPERSERIE',
      'botones-de-la-cabecera',
    ]);
    expect((botones.children as (typeof botones)[]).map((boton) => boton.props.accessibilityLabel)).toEqual([
      `Separar ${NOMBRE_DE_LA_SUPERSERIE}`,
      `Quitar ${NOMBRE_DE_LA_SUPERSERIE}`,
    ]);
    // Con la letra enorme, los botones se apilan a la derecha antes que salirse de la pantalla.
    expect(botones).toHaveStyle({ flexWrap: 'wrap', flexShrink: 1, justifyContent: 'flex-end' });
    expect(within(debajo).getByRole('header', { name: 'Remo con mancuerna + Fondos en paralelas' })).toBeOnTheScreen();
    expect(within(debajo).getByText('Remo con mancuerna: peso por mancuerna')).toBeOnTheScreen();
  });

  it('cada fila dice de qué ejercicio es, en una línea y en el color tenue, y el número solo va en la primera de la vuelta', async () => {
    await render(superserie());
    const remo = fila('Vuelta 2, Remo con mancuerna: 22 kg × 10, hecha');
    const fondos = fila('Vuelta 2, Fondos en paralelas: Sin apuntar');
    const deQue = within(remo).getByText('Remo con mancuerna');
    expect(deQue.props.numberOfLines).toBe(1);
    expect(estilo(deQue)).toMatchObject({ fontSize: 14, color: PALETAS.claro.textoTenue, flex: 1 });
    // Un resumen muy largo se parte antes que salirse de la fila.
    expect(estilo(within(remo).getByText('22 kg × 10'))).toMatchObject({ fontSize: 17, flexShrink: 1 });
    expect(within(remo).getByText('2')).toBeOnTheScreen();
    expect(within(fondos).queryByText('2')).toBeNull();
    expect(alFinal('Vuelta 2, Fondos en paralelas: Sin apuntar').props.testID).toBe('marca-vacia');
    expect(within(remo).queryByTestId('ejercicio-y-resumen')).toBeNull();
  });

  it('con la letra grande, el nombre del ejercicio va entero y el resumen debajo', async () => {
    mockEscala = Math.fround(1.3);
    await render(superserie());
    const remo = within(fila('Vuelta 2, Remo con mancuerna: 22 kg × 10, hecha'));
    const columna = remo.getByTestId('ejercicio-y-resumen');
    const deQue = within(columna).getByText('Remo con mancuerna');
    const resumen = within(columna).getByText('22 kg × 10');
    expect(deQue.props.numberOfLines).toBeUndefined();
    expect(columna.children.indexOf(deQue)).toBe(0);
    expect(columna.children.indexOf(resumen)).toBe(1);
    expect(columna).toHaveStyle({ flex: 1 });
    // Y la marca sigue al final de la fila.
    expect(alFinal('Vuelta 2, Remo con mancuerna: 22 kg × 10, hecha').props.testID).toBe('marca-de-hecha');
  });

  it('las vueltas van un poco separadas entre sí', async () => {
    await render(superserie());
    expect(screen.getAllByRole('button', { name: /^Vuelta \d/ })).toHaveLength(4);
    expect(screen.getByTestId('vueltas')).toHaveStyle({ marginTop: 2, gap: 6 });
  });
});

describe.each(['claro', 'oscuro'] as const)('Los colores del editor en modo %s', (modo) => {
  const paleta = PALETAS[modo];
  beforeEach(() => jest.mocked(useColorScheme).mockReturnValue(modo === 'oscuro' ? 'dark' : 'light'));
  afterEach(() => jest.mocked(useColorScheme).mockReturnValue('light'));

  it('la marca de hecha, la serie abierta con su número y su flecha, y la insignia van con los colores de su modo', async () => {
    await render(superserie({ elegida: 'r2' }));
    const hecha = alFinal('Vuelta 1, Remo con mancuerna: 22 kg × 10, hecha');
    expect(hecha).toHaveStyle({ backgroundColor: paleta.primario });
    expect(within(hecha).getByTestId('icono-hecha', ocultos).props.tintColor).toBe(paleta.sobrePrimario);
    expect(screen.getByTestId('serie-abierta')).toHaveStyle({
      backgroundColor: paleta.tintePrimario,
      borderColor: paleta.primario,
    });
    const abierta = 'Vuelta 2, Remo con mancuerna: 22 kg × 10, hecha';
    expect(within(alFinal(abierta)).getByTestId('icono-plegar', ocultos).props.tintColor).toBe(paleta.primario);
    expect(estilo(within(fila(abierta)).getByText('2'))).toMatchObject({ color: paleta.primarioTexto });
    expect(estilo(screen.getByText('SUPERSERIE'))).toMatchObject({
      backgroundColor: paleta.insignia,
      color: paleta.primarioTexto,
    });
  });
});
