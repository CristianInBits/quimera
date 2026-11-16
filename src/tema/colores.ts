import { useColorScheme } from 'react-native';

import type { Disciplina } from '@/datos/entrenos';

// Los colores de Quimera, los de la maqueta que aprobó Cristian el 15 de
// noviembre de 2026: cálidos, con el rosa del gimnasio para las acciones. El
// modo claro o el oscuro siguen al del móvil, y cada uno está diseñado aparte:
// el claro sobre un blanco rosado y el oscuro sobre un negro azulado.
//
// Como texto pequeño, un color necesita un contraste de 4,5:1 con su fondo, y
// un control o una marca, de 3:1. Lo vigila src/__tests__/colores.test.ts,
// también que los cinco colores de disciplina se distingan con daltonismo. Aun
// así, el color de una disciplina nunca va solo: su nombre lo acompaña siempre.

/** Los colores de una disciplina en un modo. */
export type ColoresDeDisciplina = {
  /** Lo que la señala sin palabras: el punto, la raya o la ficha. */
  marca: string;
  /** Su nombre o sus cifras escritos en su color. */
  texto: string;
  /** El fondo suave de lo suyo, como la tarjeta de un entreno. */
  tinte: string;
  /** La raya de adorno de su tarjeta teñida. En claro es el mismo tinte: no se ve. */
  borde: string;
  /** Los dos círculos que lleva detrás su mascota, el de fuera y el de dentro. */
  escenario: readonly [string, string];
};

export type Paleta = {
  /** El fondo de las pantallas. */
  fondo: string;
  /** Lo que va encima del fondo: tarjetas, listas y paneles. */
  superficie: string;
  /** Un escalón por debajo de la superficie, para filas dentro de una tarjeta. */
  superficieSuave: string;
  /** El fondo de los campos donde se escribe. */
  campo: string;
  /** El borde de adorno de las tarjetas: separa sin pedir nada. */
  bordeSuave: string;
  /** El borde de lo que se toca o se escribe: 3:1 con lo de alrededor. */
  bordeControl: string;
  texto: string;
  textoTenue: string;
  /** El rosa de las acciones: el botón principal y lo elegido. */
  primario: string;
  /** El rosa como texto, también sobre su tinte. */
  primarioTexto: string;
  /** El texto y los iconos encima del rosa. */
  sobrePrimario: string;
  /** El fondo suave de lo que lleva el rosa, como lo que se está apuntando. */
  tintePrimario: string;
  error: string;
  /** El fondo de la insignia SUPERSERIE, escrita en primarioTexto. */
  insignia: string;
  /** Los iconos encima de la marca de una disciplina, como en su ficha. */
  sobreMarca: string;
  /** El fondo de una pastilla de texto sobre un tinte, como «Pronto». */
  pastilla: string;
  /**
   * El escenario del rinoceronte en la tarjeta de Inicio, sobre la superficie:
   * en claro, más suave que el de encima del tinte.
   */
  escenarioDeInicio: readonly [string, string];
  /** El fondo de la barra de pestañas. */
  barraDePestanas: string;
  /** Las barras de la gráfica de la carga, de menos a más marcadas. */
  grafica: {
    /** Las semanas anteriores a la pasada. */
    anteriores: string;
    pasada: string;
    /** Esta semana. */
    esta: string;
  };
  disciplina: Record<Disciplina, ColoresDeDisciplina>;
};

export const PALETAS: Record<'claro' | 'oscuro', Paleta> = {
  claro: {
    fondo: '#fbf6f8',
    superficie: '#ffffff',
    superficieSuave: '#f8f1f4',
    campo: '#ffffff',
    bordeSuave: '#f0e3ea',
    bordeControl: '#8f7a86',
    texto: '#23191f',
    textoTenue: '#6b5862',
    primario: '#c2185b',
    primarioTexto: '#9e1049',
    sobrePrimario: '#ffffff',
    tintePrimario: '#fce9f2',
    error: '#b3261e',
    insignia: '#f9e0eb',
    sobreMarca: '#ffffff',
    pastilla: '#ffffff',
    escenarioDeInicio: ['#fceaf2', '#f8d4e4'],
    barraDePestanas: '#ffffff',
    grafica: { anteriores: '#e6a0ba', pasada: '#d56a8f', esta: '#c2185b' },
    disciplina: {
      carrera: { marca: '#166a17', texto: '#166a17', tinte: '#dff1de', borde: '#dff1de', escenario: ['#cde6ca', '#b9dbb6'] },
      natacion: { marca: '#226ba0', texto: '#226ba0', tinte: '#dbebfa', borde: '#dbebfa', escenario: ['#c5e2fb', '#afd5f7'] },
      gimnasio: { marca: '#c2185b', texto: '#c2185b', tinte: '#f9e0eb', borde: '#f9e0eb', escenario: ['#f5d2e1', '#f0c1d5'] },
      calistenia: { marca: '#5a2bb0', texto: '#5a2bb0', tinte: '#eae3fa', borde: '#eae3fa', escenario: ['#e1d8f9', '#d5c8f4'] },
      // El amarillo del hyrox, como texto, necesita ser más oscuro que su marca.
      hyrox: { marca: '#ad7600', texto: '#7a5300', tinte: '#f9edc8', borde: '#f9edc8', escenario: ['#f3e0ac', '#ecd28a'] },
    },
  },
  oscuro: {
    fondo: '#0b0d13',
    superficie: '#151923',
    superficieSuave: '#1b2030',
    campo: '#10131b',
    bordeSuave: '#252a37',
    bordeControl: '#7c8496',
    texto: '#f1f2f6',
    textoTenue: '#a9afbe',
    primario: '#f06aa8',
    primarioTexto: '#f06aa8',
    sobrePrimario: '#24101b',
    tintePrimario: '#2a1726',
    error: '#ffb4ab',
    insignia: '#3d1f35',
    sobreMarca: '#12141a',
    pastilla: '#0b0d13',
    escenarioDeInicio: ['#492940', '#663859'],
    barraDePestanas: '#131721',
    grafica: { anteriores: '#7a445d', pasada: '#b05a7f', esta: '#f06aa8' },
    // Las mascotas visten de oscuro: en oscuro, su escenario es lo bastante claro para que no se pierdan.
    disciplina: {
      carrera: { marca: '#4ad89b', texto: '#4ad89b', tinte: '#12261a', borde: '#1b3727', escenario: ['#153f29', '#1b5739'] },
      natacion: { marca: '#6fb1ff', texto: '#6fb1ff', tinte: '#121e31', borde: '#213147', escenario: ['#213654', '#2d4b75'] },
      gimnasio: { marca: '#f06aa8', texto: '#f06aa8', tinte: '#2a1726', borde: '#3e2236', escenario: ['#492940', '#663859'] },
      calistenia: { marca: '#9c6cff', texto: '#9c6cff', tinte: '#1e1833', borde: '#312c45', escenario: ['#372f51', '#4d4171'] },
      hyrox: { marca: '#f7c948', texto: '#f7c948', tinte: '#29230f', borde: '#3b3319', escenario: ['#40340a', '#5a4808'] },
    },
  },
};

/**
 * La sombra de las tarjetas. Las de cada bloque llevan en claro una leve,
 * teñida de rosa, y en oscuro ninguna: la tarjeta ya se separa por su
 * superficie. La destacada, como la de la semana en Inicio, lleva una más
 * marcada en los dos modos.
 */
export function sombraDeTarjeta(paleta: Paleta, destacada = false): string | undefined {
  const clara = paleta === PALETAS.claro;
  if (destacada) {
    return clara ? '0 1px 2px rgba(35, 25, 31, 0.05), 0 8px 24px rgba(194, 24, 91, 0.08)' : '0 12px 32px rgba(0, 0, 0, 0.35)';
  }
  return clara ? '0 1px 2px rgba(35, 25, 31, 0.05), 0 6px 20px rgba(194, 24, 91, 0.07)' : undefined;
}

/**
 * La sombra de la tarjeta de una disciplina que se puede abrir, como el
 * gimnasio en Apuntar: en claro, un halo rosa que la levanta de las que aún
 * no se abren; en oscuro, ninguna.
 */
export function sombraDeTarjetaQueSeAbre(paleta: Paleta): string | undefined {
  return paleta === PALETAS.claro ? '0 1px 2px rgba(35, 25, 31, 0.05), 0 8px 24px rgba(194, 24, 91, 0.1)' : undefined;
}

/**
 * La sombra de cada entreno del historial, una tarjeta teñida que se toca: en
 * claro, una muy leve que la despega del fondo; en oscuro, ninguna, porque ya
 * la separa su borde.
 */
export function sombraDeEntreno(paleta: Paleta): string | undefined {
  return paleta === PALETAS.claro ? '0 1px 2px rgba(35, 25, 31, 0.06)' : undefined;
}

/** La sombra del botón principal, del color del rosa de cada modo. */
export function sombraDelBotonPrincipal(paleta: Paleta): string {
  return paleta === PALETAS.claro ? '0 8px 20px rgba(194, 24, 91, 0.28)' : '0 8px 24px rgba(240, 106, 168, 0.22)';
}

/** La paleta del modo que tiene el móvil ahora. */
export function usePaleta(): Paleta {
  return PALETAS[useColorScheme() === 'dark' ? 'oscuro' : 'claro'];
}

export type ColoresDeLaBarra = {
  fondo: string;
  icono: string;
  iconoElegido: string;
  etiqueta: string;
  etiquetaElegida: string;
  /** La píldora de Android detrás del icono elegido. iOS no la pinta. */
  indicador: string;
  /** La onda al tocar una pestaña en Android. */
  onda: string;
};

/**
 * Los colores de la barra de pestañas. La pestaña elegida se distingue por
 * más que el color: en Android, por una píldora rosa con el icono encima; en
 * el iPhone, por el icono en rosa y la etiqueta en negrita. En Android las
 * dos etiquetas llevan el mismo peso, porque NativeTabs no deja otro para la
 * elegida. Sin estos colores, Android usaría los que saca del fondo de
 * pantalla.
 */
export function coloresDeLaBarra(paleta: Paleta, sistema: 'android' | 'ios'): ColoresDeLaBarra {
  return {
    fondo: paleta.barraDePestanas,
    icono: paleta.textoTenue,
    iconoElegido: sistema === 'android' ? paleta.sobrePrimario : paleta.primario,
    etiqueta: paleta.textoTenue,
    etiquetaElegida: paleta.texto,
    indicador: paleta.primario,
    onda: paleta.tintePrimario,
  };
}
