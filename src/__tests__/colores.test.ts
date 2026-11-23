import { NOMBRE_DE_DISCIPLINA, type Disciplina } from '@/datos/entrenos';
import {
  PALETAS,
  coloresDeLaBarra,
  sombraDeEntreno,
  sombraDeTarjeta,
  sombraDeTarjetaQueSeAbre,
  sombraDelBotonPrincipal,
  type Paleta,
} from '@/tema/colores';

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

/** Cuánto color tiene un color en OKLab: 0 en los grises, y más de 0,1 en los muy vivos. */
function croma(hex: string): number {
  const [, a, b] = oklab(lineal(hex));
  return Math.hypot(a, b);
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
    paleta.pastilla,
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

  it('el color de las acciones se lee sobre las pantallas, las tarjetas, las filas, lo elegido y el tinte del gimnasio, y lo que va encima de él se lee', () => {
    const alrededor = [
      paleta.fondo,
      paleta.superficie,
      paleta.superficieSuave,
      paleta.tintePrimario,
      paleta.disciplina.gimnasio.tinte,
    ];
    for (const fondo of alrededor) {
      expect(contraste(paleta.primario, fondo)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contraste(paleta.sobrePrimario, paleta.primario)).toBeGreaterThanOrEqual(4.5);
  });

  it('el borde de los controles se ve contra todo lo que tiene alrededor, también sobre los tintes', () => {
    const alrededor = [paleta.fondo, paleta.superficie, paleta.superficieSuave, paleta.campo, paleta.tintePrimario, ...tintes(paleta)];
    for (const fondo of alrededor) {
      expect(contraste(paleta.bordeControl, fondo)).toBeGreaterThanOrEqual(3);
    }
  });

  it('el color de las acciones es el del gimnasio', () => {
    expect(paleta.primario).toBe(paleta.disciplina.gimnasio.marca);
  });

  it('el icono encima de la marca de cada disciplina se ve', () => {
    for (const disciplina of DISCIPLINAS) {
      expect(contraste(paleta.sobreMarca, paleta.disciplina[disciplina].marca)).toBeGreaterThanOrEqual(3);
    }
  });

  it('cada mascota se ve sobre su escenario: el círculo de dentro se separa de la ropa oscura', () => {
    const escenarios = [...DISCIPLINAS.map((d) => paleta.disciplina[d].escenario), paleta.escenarioDeInicio];
    for (const [fuera, dentro] of escenarios) {
      expect(contraste(dentro, '#000000')).toBeGreaterThanOrEqual(2);
      expect(fuera).not.toBe(dentro);
    }
  });

  it('en la gráfica, esta semana va en el color de las acciones, y las demás, en grises', () => {
    const { anteriores, pasada, esta } = paleta.grafica;
    expect(esta).toBe(paleta.primario);
    // Los grises de ahora no pasan de 0,025, y los rosas de antes iban de 0,08 a 0,14.
    expect(croma(anteriores)).toBeLessThan(0.03);
    expect(croma(pasada)).toBeLessThan(0.03);
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

  it('en la barra de pestañas de Android se ve cuál está elegida: su píldora va en el color de las acciones, y las demás, en el tenue', () => {
    const barra = coloresDeLaBarra(paleta, 'android');
    expect(barra).toMatchObject({
      indicador: paleta.primario,
      iconoElegido: paleta.sobrePrimario,
      etiquetaElegida: paleta.texto,
      icono: paleta.textoTenue,
      etiqueta: paleta.textoTenue,
    });
    expect(contraste(barra.indicador, barra.fondo)).toBeGreaterThanOrEqual(3);
    expect(contraste(barra.iconoElegido, barra.indicador)).toBeGreaterThanOrEqual(3);
    expect(contraste(barra.icono, barra.fondo)).toBeGreaterThanOrEqual(3);
    expect(contraste(barra.etiqueta, barra.fondo)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(barra.etiquetaElegida, barra.fondo)).toBeGreaterThanOrEqual(4.5);
  });

  it('en la barra de pestañas del iPhone se leen los iconos y las etiquetas, y el icono elegido va en el color de las acciones, y los demás, en el tenue', () => {
    const barra = coloresDeLaBarra(paleta, 'ios');
    expect(barra).toMatchObject({
      iconoElegido: paleta.primario,
      etiquetaElegida: paleta.texto,
      icono: paleta.textoTenue,
      etiqueta: paleta.textoTenue,
    });
    expect(contraste(barra.iconoElegido, barra.fondo)).toBeGreaterThanOrEqual(3);
    expect(contraste(barra.icono, barra.fondo)).toBeGreaterThanOrEqual(3);
    expect(contraste(barra.etiqueta, barra.fondo)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(barra.etiquetaElegida, barra.fondo)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('Los colores de las disciplinas', () => {
  // Los que aprobó Cristian el 15 de noviembre de 2026, con el café del
  // gimnasio que eligió el 19. Cambiar uno, o cambiar dos de sitio, tiene que
  // ser a propósito.
  it('son los aprobados, en claro y en oscuro', () => {
    const marcas = (modo: 'claro' | 'oscuro') =>
      Object.fromEntries(DISCIPLINAS.map((d) => [d, PALETAS[modo].disciplina[d].marca]));
    expect(marcas('claro')).toEqual({
      gimnasio: '#5d3827',
      hyrox: '#ad7600',
      calistenia: '#5a2bb0',
      carrera: '#166a17',
      natacion: '#226ba0',
    });
    expect(marcas('oscuro')).toEqual({
      gimnasio: '#cf8d60',
      hyrox: '#f7c948',
      calistenia: '#9c6cff',
      carrera: '#4ad89b',
      natacion: '#6fb1ff',
    });
  });
});

describe('Los colores del café', () => {
  // Los que eligió Cristian el 19 de noviembre de 2026, la variante 7 del
  // lienzo «Colores del gimnasio». Las pruebas de contraste no notarían que
  // vuelve el rosa, porque el de antes también las pasaba: cambiar uno de
  // estos tiene que ser a propósito.
  it('el café, los neutros, los tintes, los escenarios y la gráfica son los elegidos, en claro', () => {
    expect(PALETAS.claro).toMatchObject({
      fondo: '#f8f7f5',
      superficieSuave: '#f3f2ef',
      bordeSuave: '#e8e5e0',
      bordeControl: '#86807a',
      texto: '#1f1c1a',
      textoTenue: '#615b55',
      primario: '#5d3827',
      sobrePrimario: '#ffffff',
      tintePrimario: '#f3eee9',
      insignia: '#efedea',
      escenarioDeInicio: ['#f4eee8', '#e9ddd1'],
      grafica: { anteriores: '#b9b3ac', pasada: '#958e87', esta: '#5d3827' },
    });
    expect(PALETAS.claro.disciplina.gimnasio).toEqual({
      marca: '#5d3827',
      texto: '#5d3827',
      tinte: '#f6f0ea',
      borde: '#f6f0ea',
      escenario: ['#efe4da', '#e5d5c7'],
    });
  });

  it('el caramelo, los tintes, los escenarios y la gráfica son los elegidos, en oscuro', () => {
    expect(PALETAS.oscuro).toMatchObject({
      primario: '#cf8d60',
      sobrePrimario: '#1d120c',
      tintePrimario: '#231d1a',
      insignia: '#232838',
      escenarioDeInicio: ['#3b3029', '#55453a'],
      grafica: { anteriores: '#5d6270', pasada: '#7c818f', esta: '#cf8d60' },
    });
    expect(PALETAS.oscuro.disciplina.gimnasio).toEqual({
      marca: '#cf8d60',
      texto: '#cf8d60',
      tinte: '#1f1a17',
      borde: '#312a25',
      escenario: ['#3b3029', '#55453a'],
    });
  });
});

/** Los colores de una sombra, en el orden en que van, escritos como #rrggbb. */
function coloresDeSombra(sombra: string | undefined): string[] {
  return [...(sombra ?? '').matchAll(/rgba\((\d+), (\d+), (\d+), [\d.]+\)/g)].map(
    ([, r, g, b]) => `#${[r, g, b].map((c) => Number(c).toString(16).padStart(2, '0')).join('')}`,
  );
}

describe('Las sombras', () => {
  const { claro, oscuro } = PALETAS;

  it('en claro van en el color del texto, sin tinte, salvo el halo del gimnasio y la del botón principal, en el de las acciones', () => {
    expect(coloresDeSombra(sombraDeTarjeta(claro))).toEqual([claro.texto, claro.texto]);
    expect(coloresDeSombra(sombraDeTarjeta(claro, true))).toEqual([claro.texto, claro.texto]);
    expect(coloresDeSombra(sombraDeEntreno(claro))).toEqual([claro.texto]);
    expect(coloresDeSombra(sombraDeTarjetaQueSeAbre(claro))).toEqual([claro.texto, claro.primario]);
    expect(coloresDeSombra(sombraDelBotonPrincipal(claro))).toEqual([claro.primario]);
  });

  it('en oscuro, la del botón principal va en el color de las acciones', () => {
    expect(coloresDeSombra(sombraDelBotonPrincipal(oscuro))).toEqual([oscuro.primario]);
  });

  // Las del estilo «grafito» de la variante 7, con su opacidad: la del botón
  // principal pesa algo menos que la rosa (de 0,28 a 0,2 en claro y de 0,22 a 0,16
  // en oscuro), como en el lienzo, y el halo del gimnasio, que no salía en él, pesa
  // lo mismo que el rosa con 0,1. Cambiarlas tiene que ser a propósito.
  it('son las elegidas, con su opacidad', () => {
    expect(sombraDeTarjeta(claro)).toBe('0 1px 2px rgba(31, 28, 26, 0.05), 0 6px 20px rgba(31, 28, 26, 0.06)');
    expect(sombraDeTarjeta(claro, true)).toBe('0 1px 2px rgba(31, 28, 26, 0.05), 0 8px 24px rgba(31, 28, 26, 0.07)');
    expect(sombraDeTarjeta(oscuro)).toBeUndefined();
    expect(sombraDeTarjeta(oscuro, true)).toBe('0 12px 32px rgba(0, 0, 0, 0.35)');
    expect(sombraDeEntreno(claro)).toBe('0 1px 2px rgba(31, 28, 26, 0.06)');
    expect(sombraDeEntreno(oscuro)).toBeUndefined();
    expect(sombraDeTarjetaQueSeAbre(claro)).toBe('0 1px 2px rgba(31, 28, 26, 0.05), 0 8px 24px rgba(93, 56, 39, 0.1)');
    expect(sombraDeTarjetaQueSeAbre(oscuro)).toBeUndefined();
    expect(sombraDelBotonPrincipal(claro)).toBe('0 8px 20px rgba(93, 56, 39, 0.2)');
    expect(sombraDelBotonPrincipal(oscuro)).toBe('0 8px 24px rgba(207, 141, 96, 0.16)');
  });
});

describe('Las cuentas de las pruebas de color', () => {
  it('el contraste da los valores conocidos de WCAG', () => {
    expect(contraste('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contraste('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });

  it('la distancia no separa un color de sí mismo y separa el rojo del verde solo con visión normal', () => {
    expect(distancia('#5d3827', '#5d3827')).toBe(0);
    // Un rojo y un verde de la misma claridad: con deuteranopía casi se confunden.
    expect(distancia('#d62728', '#2ca02c')).toBeGreaterThan(30);
    expect(distancia('#d62728', '#2ca02c', 'deuteranopia')).toBeLessThan(distancia('#d62728', '#2ca02c') / 2);
    // Un naranja y un verde que con protanopía se ven casi iguales.
    expect(distancia('#ff7f0e', '#2ca02c')).toBeGreaterThan(25);
    expect(distancia('#ff7f0e', '#2ca02c', 'protanopia')).toBeLessThan(3);
  });
});
