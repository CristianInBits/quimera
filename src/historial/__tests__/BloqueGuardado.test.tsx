import { render, screen, within } from '@testing-library/react-native';
import { StyleSheet, useColorScheme } from 'react-native';

import type { Ejercicio } from '@/datos/ejercicios';
import type { Bloque, Serie } from '@/datos/entrenos';
import { BloqueGuardado } from '@/historial/BloqueGuardado';
import { PALETAS } from '@/tema/colores';

// La escala de la letra del sistema: en Jest vale 2 si no se dice otra cosa.
let mockEscala = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 844, scale: 2, fontScale: mockEscala }),
}));

type Elemento = ReturnType<typeof screen.getByText>;
/** El estilo de un elemento, con sus capas juntas. */
const estilo = (elemento: Elemento) => StyleSheet.flatten(elemento.props.style);
const ocultos = { includeHiddenElements: true };

const ejercicio = (id: string, nombre: string, cambios: Partial<Ejercicio> = {}): [string, Ejercicio] => [
  id,
  { id, nombre, grupo: 'pierna', mide: ['repeticiones', 'peso'], porMancuerna: false, ...cambios },
];
const EJERCICIOS = new Map<string, Ejercicio>([
  ejercicio('sentadilla-trasera', 'Sentadilla trasera'),
  ejercicio('zancadas', 'Zancadas', { porMancuerna: true }),
  ejercicio('plancha', 'Plancha', { grupo: 'core', mide: ['tiempo'] }),
]);

let ultimoId = 0;
/** Una serie, con lo que no se diga vacío. */
const serie = (ronda: number, orden: number, ejercicioId: string, cambios: Partial<Serie> = {}): Serie => ({
  id: `serie-${++ultimoId}`,
  ronda,
  orden,
  ejercicioId,
  repeticiones: null,
  pesoG: null,
  tiempoMs: null,
  distanciaM: null,
  calorias: null,
  descansoMs: null,
  ...cambios,
});

/** La sentadilla de la maqueta: cuatro series, 2:00 entre series y 2:30 antes del siguiente. */
const SENTADILLA: Bloque = {
  id: 'sentadilla',
  metrosCorridos: null,
  tiempoMs: null,
  descansoMs: 150_000,
  series: [
    [60, 10],
    [80, 8],
    [90, 6],
    [90, 6],
  ].map(([kg, repeticiones], i) =>
    serie(i + 1, 1, 'sentadilla-trasera', { pesoG: kg * 1000, repeticiones, descansoMs: i < 3 ? 120_000 : null }),
  ),
};

/** Las zancadas de la maqueta: tres series de 14 kg por mancuerna, sin descansos. */
const ZANCADAS: Bloque = {
  id: 'zancadas',
  metrosCorridos: null,
  tiempoMs: null,
  descansoMs: null,
  series: [1, 2, 3].map((ronda) => serie(ronda, 1, 'zancadas', { pesoG: 14_000, repeticiones: 12 })),
};

/** La carrera en cinta de la maqueta, con 2:00 de descanso antes del siguiente. */
const CARRERA: Bloque = { id: 'carrera', metrosCorridos: 1500, tiempoMs: 600_000, descansoMs: 120_000, series: [] };

/** Una superserie de zancadas y plancha de dos vueltas, con 1:30 entre vueltas y 1:00 antes del siguiente. */
const SUPERSERIE: Bloque = {
  id: 'superserie',
  metrosCorridos: null,
  tiempoMs: null,
  descansoMs: 60_000,
  series: [1, 2].flatMap((ronda) => [
    serie(ronda, 1, 'zancadas', { pesoG: 14_000, repeticiones: 12, descansoMs: 0 }),
    serie(ronda, 2, 'plancha', { tiempoMs: 60_000, descansoMs: ronda === 1 ? 90_000 : null }),
  ]),
};

const bloque = (b: Bloque) => <BloqueGuardado bloque={b} ejercicios={EJERCICIOS} />;

describe('Un bloque de un entreno guardado', () => {
  afterEach(() => {
    mockEscala = 1;
  });

  it('va en su tarjeta, con lo de dentro a 15 arriba y a 17 a los lados y abajo, contando el borde, y 4 entre lo de dentro', async () => {
    await render(bloque(SENTADILLA));
    const tarjeta = screen.getByTestId('bloque');
    expect(estilo(tarjeta)).toMatchObject({ padding: 16, paddingTop: 14, borderWidth: 1, borderRadius: 24, gap: 4 });
  });

  it('un ejercicio: su nombre y una fila por serie, con su número y lo que se hizo', async () => {
    await render(bloque(SENTADILLA));
    expect(estilo(screen.getByRole('header', { name: 'Sentadilla trasera' }))).toMatchObject({
      fontFamily: 'Nunito_800ExtraBold',
      fontSize: 19,
    });
    const filas = screen.getAllByTestId('serie');
    expect(filas.map((fila) => fila.props.accessibilityLabel)).toEqual([
      'Serie 1: 60 kg × 10',
      'Serie 2: 80 kg × 8',
      'Serie 3: 90 kg × 6',
      'Serie 4: 90 kg × 6',
    ]);
    expect(screen.getByTestId('series')).toHaveStyle({ marginTop: 2 });
    for (const fila of filas) {
      expect(fila.props.accessible).toBe(true);
      expect(fila).toHaveStyle({ minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 12 });
    }
    const [numero, resumen] = filas[1].children as Elemento[];
    expect(numero).toHaveTextContent('2');
    expect(estilo(numero)).toMatchObject({
      width: 24,
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
    });
    expect(resumen).toHaveTextContent('80 kg × 8');
    expect(estilo(resumen)).toMatchObject({ flexShrink: 1, fontSize: 18, fontWeight: '500', fontVariant: ['tabular-nums'] });
  });

  it('abajo, tras una raya, sus descansos, con el icono del cronómetro centrado con su primera línea', async () => {
    await render(bloque(SENTADILLA));
    const descansos = screen.getByTestId('descansos');
    expect(descansos).toHaveStyle({
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginTop: 6,
      paddingTop: 10,
      borderTopWidth: 1,
    });
    const [caja, frase] = descansos.children as Elemento[];
    const icono = within(caja).getByTestId('icono-cronometro', ocultos);
    expect(estilo(icono)).toMatchObject({ width: 18, height: 18 });
    // Líneas de 20 y un icono de 18: 1 arriba para quedar en medio de la primera.
    expect(caja).toHaveStyle({ marginTop: 1 });
    expect(frase).toHaveTextContent('Descansos: 2:00 entre series · 2:30 antes del siguiente');
    expect(estilo(frase)).toMatchObject({ flexShrink: 1, fontSize: 14, lineHeight: 20, fontVariant: ['tabular-nums'] });
  });

  it('sin descansos apuntados no hay raya, y la nota del ejercicio va debajo de su nombre', async () => {
    await render(bloque(ZANCADAS));
    expect(screen.queryByTestId('descansos')).toBeNull();
    const [titulo, nota] = screen.getByTestId('nombre-y-notas').children as Elemento[];
    expect(titulo).toHaveTextContent('Zancadas');
    expect(nota).toHaveTextContent('Peso por mancuerna');
    expect(estilo(nota)).toMatchObject({ fontSize: 14 });
    expect(screen.getAllByTestId('serie').map((fila) => fila.props.accessibilityLabel)).toEqual([
      'Serie 1: 14 kg × 12',
      'Serie 2: 14 kg × 12',
      'Serie 3: 14 kg × 12',
    ]);
  });

  it('un ejercicio de segundos lleva la nota «En segundos», y un ejercicio que no se encuentra, su clave', async () => {
    await render(
      <>
        {bloque({ ...ZANCADAS, id: 'plancha', series: [serie(1, 1, 'plancha', { tiempoMs: 60_000 })] })}
        {bloque({ ...ZANCADAS, id: 'otro', series: [serie(1, 1, 'ejercicio-perdido', { repeticiones: 5 })] })}
      </>,
    );
    expect(screen.getByText('En segundos')).toBeOnTheScreen();
    expect(screen.getByLabelText('Serie 1: 1:00')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'ejercicio-perdido' })).toBeOnTheScreen();
    expect(screen.getAllByTestId('nombre-y-notas')[1].children).toHaveLength(1);
  });

  it('la carrera en cinta: su distancia y su tiempo y, tras la raya, su descanso', async () => {
    await render(bloque(CARRERA));
    expect(screen.getByRole('header', { name: 'Carrera en cinta' })).toBeOnTheScreen();
    expect(estilo(screen.getByText('1,5 km en 10 minutos'))).toMatchObject({
      marginTop: 2,
      fontSize: 18,
      fontWeight: '500',
      fontVariant: ['tabular-nums'],
    });
    const descansos = screen.getByTestId('descansos');
    expect(descansos).toHaveTextContent('Descanso: 2:00 antes del siguiente');
    expect(within(descansos).getByTestId('icono-cronometro', ocultos)).toBeTruthy();
    expect(screen.getByTestId('bloque')).toHaveStyle({ paddingTop: 14, gap: 4 });
  });

  it('la carrera sin tiempo ni descanso dice solo su distancia, sin raya', async () => {
    await render(bloque({ ...CARRERA, tiempoMs: null, descansoMs: null }));
    expect(screen.getByText('1,5 km')).toBeOnTheScreen();
    expect(screen.queryByTestId('descansos')).toBeNull();
  });

  it('una superserie: la insignia, los nombres unidos, la nota de cada uno, y en cada vuelta una línea por ejercicio', async () => {
    await render(bloque(SUPERSERIE));
    const insignia = screen.getByText('SUPERSERIE');
    expect(estilo(insignia)).toMatchObject({
      alignSelf: 'flex-start',
      paddingVertical: 3,
      paddingHorizontal: 10,
      borderRadius: 999,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 1,
    });
    const [titulo, primera, segunda] = screen.getByTestId('nombre-y-notas').children as Elemento[];
    expect(titulo).toHaveTextContent('Zancadas + Plancha');
    expect(primera).toHaveTextContent('Zancadas: peso por mancuerna');
    expect(segunda).toHaveTextContent('Plancha: en segundos');
    const filas = screen.getAllByTestId('serie');
    expect(filas.map((fila) => fila.props.accessibilityLabel)).toEqual([
      'Vuelta 1, Zancadas: 14 kg × 12',
      'Vuelta 1, Plancha: 1:00',
      'Vuelta 2, Zancadas: 14 kg × 12',
      'Vuelta 2, Plancha: 1:00',
    ]);
    // El número, solo en la primera línea de cada vuelta; el nombre de cada ejercicio, en una línea.
    const [numero, nombre, resumen] = filas[0].children as Elemento[];
    expect(numero).toHaveTextContent('1');
    expect(nombre).toHaveTextContent('Zancadas');
    expect(nombre.props.numberOfLines).toBe(1);
    expect(estilo(nombre)).toMatchObject({ flex: 1, fontSize: 14 });
    expect(resumen).toHaveTextContent('14 kg × 12');
    expect((filas[1].children as Elemento[])[0]).toHaveTextContent('');
    // Las vueltas, separadas: la segunda, a 8 de la primera.
    const vueltas = screen.getByTestId('series').children as Elemento[];
    expect(vueltas[0].props.style).toBeUndefined();
    expect(vueltas[1]).toHaveStyle({ marginTop: 8 });
    expect(screen.getByTestId('descansos')).toHaveTextContent('Descansos: 1:30 entre vueltas · 1:00 antes del siguiente');
  });

  it('con la letra grande, en una superserie, el nombre de cada ejercicio va entero encima de lo que se hizo', async () => {
    mockEscala = Math.fround(1.3);
    await render(bloque(SUPERSERIE));
    const [numero, columna] = screen.getAllByTestId('serie')[0].children as Elemento[];
    expect(estilo(numero).width).toBeCloseTo(24 * 1.3);
    expect(columna.props.testID).toBe('ejercicio-y-resumen');
    expect(columna).toHaveStyle({ flex: 1, paddingVertical: 4 });
    const [nombre, resumen] = columna.children as Elemento[];
    expect(nombre).toHaveTextContent('Zancadas');
    expect(nombre.props.numberOfLines).toBeUndefined();
    expect(nombre).toHaveStyle({ fontSize: 14, color: PALETAS.claro.textoTenue });
    expect(resumen).toHaveTextContent('14 kg × 12');
  });

  it('con la letra grande, un ejercicio suelto sigue con su número y lo que se hizo en la fila', async () => {
    mockEscala = Math.fround(1.3);
    await render(bloque(SENTADILLA));
    expect(screen.queryByTestId('ejercicio-y-resumen')).toBeNull();
    const hijos = screen.getAllByTestId('serie')[0].children as Elemento[];
    expect(hijos).toHaveLength(2);
    expect(hijos[0]).toHaveTextContent('1');
    expect(hijos[1]).toHaveTextContent('60 kg × 10');
  });

  it('con la letra por debajo del 130 %, el nombre sigue en la fila', async () => {
    mockEscala = 1.29;
    await render(bloque(SUPERSERIE));
    expect(screen.queryByTestId('ejercicio-y-resumen')).toBeNull();
    expect(estilo((screen.getAllByTestId('serie')[0].children as Elemento[])[0]).width).toBeCloseTo(24 * 1.29);
  });

  describe.each(['claro', 'oscuro'] as const)('en modo %s', (modo) => {
    const paleta = PALETAS[modo];
    beforeEach(() => jest.mocked(useColorScheme).mockReturnValue(modo === 'oscuro' ? 'dark' : 'light'));
    afterEach(() => jest.mocked(useColorScheme).mockReturnValue('light'));

    it('la tarjeta va sobre la superficie, con su borde suave', async () => {
      await render(bloque(SENTADILLA));
      expect(screen.getByTestId('bloque')).toHaveStyle({ backgroundColor: paleta.superficie, borderColor: paleta.bordeSuave });
    });

    it('lo que se hizo va en el color del texto, y el número, la nota, los descansos y su raya, en los tenues', async () => {
      await render(
        <>
          {bloque(SENTADILLA)}
          {bloque(ZANCADAS)}
        </>,
      );
      expect(screen.getByRole('header', { name: 'Sentadilla trasera' })).toHaveStyle({ color: paleta.texto });
      const [numero, resumen] = screen.getAllByTestId('serie')[0].children as Elemento[];
      expect(numero).toHaveStyle({ color: paleta.textoTenue });
      expect(resumen).toHaveStyle({ color: paleta.texto });
      expect(screen.getByText('Peso por mancuerna')).toHaveStyle({ color: paleta.textoTenue });
      const descansos = screen.getByTestId('descansos');
      expect(descansos).toHaveStyle({ borderTopColor: paleta.bordeSuave });
      expect((descansos.children as Elemento[])[1]).toHaveStyle({ color: paleta.textoTenue });
      expect(within(descansos).getByTestId('icono-cronometro', ocultos).props.tintColor).toBe(paleta.textoTenue);
    });

    it('la carrera en cinta: su nombre y lo que se hizo, en el color del texto', async () => {
      await render(bloque(CARRERA));
      expect(screen.getByRole('header', { name: 'Carrera en cinta' })).toHaveStyle({ color: paleta.texto });
      expect(screen.getByText('1,5 km en 10 minutos')).toHaveStyle({ color: paleta.texto });
      expect(screen.getByTestId('bloque')).toHaveStyle({ backgroundColor: paleta.superficie, borderColor: paleta.bordeSuave });
    });

    it('la insignia de la superserie va en el rosa sobre su fondo, y el nombre de cada ejercicio, en el tenue', async () => {
      await render(bloque(SUPERSERIE));
      expect(screen.getByText('SUPERSERIE')).toHaveStyle({ backgroundColor: paleta.insignia, color: paleta.primarioTexto });
      expect((screen.getAllByTestId('serie')[0].children as Elemento[])[1]).toHaveStyle({ color: paleta.textoTenue });
    });
  });
});
