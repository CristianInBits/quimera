import { NOMBRE_DE_DISCIPLINA, type Disciplina } from '@/datos/entrenos';
import { PALETAS, coloresDeLaBarra, type Paleta } from '@/tema/colores';

const DISCIPLINAS = Object.keys(NOMBRE_DE_DISCIPLINA) as Disciplina[];

// El contraste de las pautas de accesibilidad WCAG 2: de 1:1 a 21:1. El texto
// pequeño necesita 4,5:1, y los controles y las marcas, 3:1.

/** Un color #rrggbb en RGB lineal, de 0 a 1. */
function lineal(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const canal = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return [canal(n >> 16), canal((n >> 8) & 255), canal(n & 255)];
}

function luminancia(hex: string): number {
  const [r, g, b] = lineal(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: string, b: string): number {
  const [clara, oscura] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (clara + 0.05) / (oscura + 0.05);
}

// Cómo ve los colores quien no distingue bien el rojo (protanopía) o el verde
// (deuteranopía): las matrices de Machado, Oliveira y Fernandes (2009) con la
// gravedad máxima, sobre RGB lineal.
const DALTONISMO = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
} as const;

function simular([r, g, b]: [number, number, number], matriz: (typeof DALTONISMO)[keyof typeof DALTONISMO]) {
  const fila = (i: 0 | 1 | 2) => Math.min(1, Math.max(0, matriz[i][0] * r + matriz[i][1] * g + matriz[i][2] * b));
  return [fila(0), fila(1), fila(2)] as [number, number, number];
}

/** El color en OKLab, un espacio donde las distancias se parecen a las que ve el ojo. */
function oklab([r, g, b]: [number, number, number]): [number, number, number] {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** La distancia entre dos colores en OKLab, por 100: con 8 se distinguen bien, y con 15, de un vistazo. */
function distancia(a: string, b: string, vision?: keyof typeof DALTONISMO): number {
  const ver = (hex: string) => oklab(vision === undefined ? lineal(hex) : simular(lineal(hex), DALTONISMO[vision]));
  const [x, y] = [ver(a), ver(b)];
  return 100 * Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

/** Todos los colores de una paleta, también los de cada disciplina. */
function todos(valor: unknown): string[] {
  if (typeof valor === 'string') return [valor];
  return Object.values(valor as object).flatMap(todos);
}

/** Los tintes de las cinco disciplinas. */
function tintes(paleta: Paleta): string[] {
  return DISCIPLINAS.map((d) => paleta.disciplina[d].tinte);
}

/** Los fondos sobre los que va el texto: los de las pantallas, las tarjetas, los campos, la insignia y los tintes. */
function fondosDeTexto(paleta: Paleta): string[] {
  return [
    paleta.fondo,
    paleta.superficie,
    paleta.superficieSuave,
    paleta.campo,
    paleta.tintePrimario,
    paleta.insignia,
    paleta.barraDePestanas,
    ...tintes(paleta),
  ];
}

describe.each(['claro', 'oscuro'] as const)('Los colores en modo %s', (modo) => {
  const paleta = PALETAS[modo];

  it('son colores escritos como #rrggbb', () => {
    expect(todos(paleta).length).toBeGreaterThan(20);
    for (const color of todos(paleta)) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('el texto, el texto tenue y el error se leen sobre todos los fondos', () => {
    for (const color of [paleta.texto, paleta.textoTenue, paleta.error]) {
      for (const fondo of fondosDeTexto(paleta)) {
        expect(contraste(color, fondo)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('el rosa se lee como texto, también sobre los tintes y en la insignia, y lo que va encima del rosa se lee', () => {
    for (const fondo of [paleta.fondo, paleta.superficie]) {
      expect(contraste(paleta.primario, fondo)).toBeGreaterThanOrEqual(4.5);
    }
    for (const fondo of [paleta.fondo, paleta.superficie, paleta.tintePrimario, paleta.insignia, ...tintes(paleta)]) {
      expect(contraste(paleta.primarioTexto, fondo)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contraste(paleta.sobrePrimario, paleta.primario)).toBeGreaterThanOrEqual(4.5);
  });

  it('el borde de los controles se ve contra todo lo que tiene alrededor, también sobre los tintes', () => {
    const alrededor = [paleta.fondo, paleta.superficie, paleta.superficieSuave, paleta.campo, paleta.tintePrimario, ...tintes(paleta)];
    for (const fondo of alrededor) {
      expect(contraste(paleta.bordeControl, fondo)).toBeGreaterThanOrEqual(3);
    }
  });

  it('el rosa de las acciones es el del gimnasio', () => {
    expect(paleta.primario).toBe(paleta.disciplina.gimnasio.marca);
  });

  it('cada mascota se ve sobre su escenario: el círculo de dentro se separa de la ropa oscura', () => {
    for (const disciplina of DISCIPLINAS) {
      const [fuera, dentro] = paleta.disciplina[disciplina].escenario;
      expect(contraste(dentro, '#000000')).toBeGreaterThanOrEqual(2);
      expect(fuera).not.toBe(dentro);
    }
  });

  it('las barras de la gráfica van de menos a más marcadas, y la más suave se ve en la tarjeta', () => {
    const { anteriores, pasada, esta } = paleta.grafica;
    const pasos = [anteriores, pasada, esta].map((color) => contraste(color, paleta.superficie));
    expect(pasos[0]).toBeGreaterThanOrEqual(2);
    expect(pasos[1]).toBeGreaterThanOrEqual(3);
    expect(pasos[2]).toBeGreaterThanOrEqual(4.5);
    expect(pasos[0]).toBeLessThan(pasos[1]);
    expect(pasos[1]).toBeLessThan(pasos[2]);
    // Entre un paso y el siguiente, la claridad de OKLab cambia al menos 0,06.
    const claridades = [anteriores, pasada, esta].map((color) => oklab(lineal(color))[0]);
    expect(Math.abs(claridades[1] - claridades[0])).toBeGreaterThanOrEqual(0.06);
    expect(Math.abs(claridades[2] - claridades[1])).toBeGreaterThanOrEqual(0.06);
  });

  it.each(DISCIPLINAS)('%s: su texto se lee y su marca se ve en el fondo, en las tarjetas y en su tinte', (disciplina) => {
    const { marca, texto, tinte } = paleta.disciplina[disciplina];
    for (const fondo of [paleta.fondo, paleta.superficie, tinte]) {
      expect(contraste(texto, fondo)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(marca, fondo)).toBeGreaterThanOrEqual(3);
    }
  });

  it('las cinco marcas de disciplina se distinguen entre sí, también con daltonismo', () => {
    const marcas = DISCIPLINAS.map((d) => paleta.disciplina[d].marca);
    for (const [i, a] of marcas.entries()) {
      for (const b of marcas.slice(i + 1)) {
        expect(distancia(a, b)).toBeGreaterThanOrEqual(15);
        expect(distancia(a, b, 'protanopia')).toBeGreaterThanOrEqual(8);
        expect(distancia(a, b, 'deuteranopia')).toBeGreaterThanOrEqual(8);
      }
    }
  });

  it('en la barra de pestañas de Android se ve cuál está elegida', () => {
    const barra = coloresDeLaBarra(paleta, 'android');
    expect(contraste(barra.indicador, barra.fondo)).toBeGreaterThanOrEqual(3);
    expect(contraste(barra.iconoElegido, barra.indicador)).toBeGreaterThanOrEqual(3);
    expect(contraste(barra.icono, barra.fondo)).toBeGreaterThanOrEqual(3);
    expect(contraste(barra.etiqueta, barra.fondo)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(barra.etiquetaElegida, barra.fondo)).toBeGreaterThanOrEqual(4.5);
  });

  it('en la barra de pestañas del iPhone se leen los iconos y las etiquetas', () => {
    const barra = coloresDeLaBarra(paleta, 'ios');
    expect(contraste(barra.iconoElegido, barra.fondo)).toBeGreaterThanOrEqual(3);
    expect(contraste(barra.icono, barra.fondo)).toBeGreaterThanOrEqual(3);
    expect(contraste(barra.etiqueta, barra.fondo)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(barra.etiquetaElegida, barra.fondo)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('Los colores de las disciplinas', () => {
  // Los que aprobó Cristian el 15 de noviembre de 2026. Cambiar uno, o
  // cambiar dos de sitio, tiene que ser a propósito.
  it('son los aprobados, en claro y en oscuro', () => {
    const marcas = (modo: 'claro' | 'oscuro') =>
      Object.fromEntries(DISCIPLINAS.map((d) => [d, PALETAS[modo].disciplina[d].marca]));
    expect(marcas('claro')).toEqual({
      gimnasio: '#c2185b',
      hyrox: '#ad7600',
      calistenia: '#5a2bb0',
      carrera: '#166a17',
      natacion: '#226ba0',
    });
    expect(marcas('oscuro')).toEqual({
      gimnasio: '#f06aa8',
      hyrox: '#f7c948',
      calistenia: '#9c6cff',
      carrera: '#4ad89b',
      natacion: '#6fb1ff',
    });
  });
});

describe('Las cuentas de las pruebas de color', () => {
  it('el contraste da los valores conocidos de WCAG', () => {
    expect(contraste('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contraste('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });

  it('la distancia no separa un color de sí mismo y separa el rojo del verde solo con visión normal', () => {
    expect(distancia('#c2185b', '#c2185b')).toBe(0);
    // Un rojo y un verde de la misma claridad: con deuteranopía casi se confunden.
    expect(distancia('#d62728', '#2ca02c')).toBeGreaterThan(30);
    expect(distancia('#d62728', '#2ca02c', 'deuteranopia')).toBeLessThan(distancia('#d62728', '#2ca02c') / 2);
    // Un naranja y un verde que con protanopía se ven casi iguales.
    expect(distancia('#ff7f0e', '#2ca02c')).toBeGreaterThan(25);
    expect(distancia('#ff7f0e', '#2ca02c', 'protanopia')).toBeLessThan(3);
  });
});
