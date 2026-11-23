import { useColorScheme } from 'react-native';

import type { Disciplina } from '@/datos/entrenos';

// Los colores de Quimera: los de la maqueta que aprobó Cristian el 15 de
// noviembre de 2026, con el café que eligió el 19 de noviembre en vez del
// rosa. El café del gimnasio es también el de las acciones, y solo va en lo
// que importa: la acción principal de cada pantalla, lo elegido, la marca del
// gimnasio y la barra de esta semana en la gráfica de Inicio; lo demás va en
// neutros. El modo claro o el oscuro siguen al del móvil, y cada uno está
// diseñado aparte: el claro sobre un blanco cálido y el oscuro sobre un negro
// azulado.
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
  /** El color de las acciones, el del gimnasio: la acción principal de cada pantalla y lo elegido. */
  primario: string;
  /** El texto y los iconos encima del color de las acciones. */
  sobrePrimario: string;
  /** El fondo suave de lo elegido, como la serie que se está apuntando. */
  tintePrimario: string;
  error: string;
  /** El fondo de la insignia SUPERSERIE, escrita en el color del texto. */
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
    fondo: '#f8f7f5',
    superficie: '#ffffff',
    superficieSuave: '#f3f2ef',
    campo: '#ffffff',
    bordeSuave: '#e8e5e0',
    bordeControl: '#86807a',
    texto: '#1f1c1a',
    textoTenue: '#615b55',
    primario: '#5d3827',
    sobrePrimario: '#ffffff',
    tintePrimario: '#f3eee9',
    error: '#b3261e',
    insignia: '#efedea',
    sobreMarca: '#ffffff',
    pastilla: '#ffffff',
    escenarioDeInicio: ['#f4eee8', '#e9ddd1'],
    barraDePestanas: '#ffffff',
    // Las semanas anteriores, en grises; esta, en el color de las acciones.
    grafica: { anteriores: '#b9b3ac', pasada: '#958e87', esta: '#5d3827' },
    disciplina: {
      carrera: { marca: '#166a17', texto: '#166a17', tinte: '#dff1de', borde: '#dff1de', escenario: ['#cde6ca', '#b9dbb6'] },
      natacion: { marca: '#226ba0', texto: '#226ba0', tinte: '#dbebfa', borde: '#dbebfa', escenario: ['#c5e2fb', '#afd5f7'] },
      // En claro, el café es oscuro: uno más claro, como el cobre, se confundiría con el ámbar del hyrox.
      gimnasio: { marca: '#5d3827', texto: '#5d3827', tinte: '#f6f0ea', borde: '#f6f0ea', escenario: ['#efe4da', '#e5d5c7'] },
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
    primario: '#cf8d60',
    sobrePrimario: '#1d120c',
    tintePrimario: '#231d1a',
    error: '#ffb4ab',
    insignia: '#232838',
    sobreMarca: '#12141a',
    pastilla: '#0b0d13',
    escenarioDeInicio: ['#3b3029', '#55453a'],
    barraDePestanas: '#131721',
    grafica: { anteriores: '#5d6270', pasada: '#7c818f', esta: '#cf8d60' },
    // Las mascotas visten de oscuro: en oscuro, su escenario es lo bastante claro para que no se pierdan.
    disciplina: {
      carrera: { marca: '#4ad89b', texto: '#4ad89b', tinte: '#12261a', borde: '#1b3727', escenario: ['#153f29', '#1b5739'] },
      natacion: { marca: '#6fb1ff', texto: '#6fb1ff', tinte: '#121e31', borde: '#213147', escenario: ['#213654', '#2d4b75'] },
      // En oscuro, el café se aclara hasta el caramelo.
      gimnasio: { marca: '#cf8d60', texto: '#cf8d60', tinte: '#1f1a17', borde: '#312a25', escenario: ['#3b3029', '#55453a'] },
      calistenia: { marca: '#9c6cff', texto: '#9c6cff', tinte: '#1e1833', borde: '#312c45', escenario: ['#372f51', '#4d4171'] },
      hyrox: { marca: '#f7c948', texto: '#f7c948', tinte: '#29230f', borde: '#3b3319', escenario: ['#40340a', '#5a4808'] },
    },
  },
};

/**
 * La sombra de las tarjetas. Las de cada bloque llevan en claro una leve, en
 * gris cálido, y en oscuro ninguna: la tarjeta ya se separa por su
 * superficie. La destacada, como la de la semana en Inicio, lleva una más
 * marcada en los dos modos.
 */
export function sombraDeTarjeta(paleta: Paleta, destacada = false): string | undefined {
  const clara = paleta === PALETAS.claro;
  if (destacada) {
    return clara ? '0 1px 2px rgba(31, 28, 26, 0.05), 0 8px 24px rgba(31, 28, 26, 0.07)' : '0 12px 32px rgba(0, 0, 0, 0.35)';
  }
  return clara ? '0 1px 2px rgba(31, 28, 26, 0.05), 0 6px 20px rgba(31, 28, 26, 0.06)' : undefined;
}

/**
 * La sombra de la tarjeta de una disciplina que se puede abrir, como el
 * gimnasio en Apuntar: en claro, un halo café que la levanta de las que aún
 * no se abren; en oscuro, ninguna.
 */
export function sombraDeTarjetaQueSeAbre(paleta: Paleta): string | undefined {
  return paleta === PALETAS.claro ? '0 1px 2px rgba(31, 28, 26, 0.05), 0 8px 24px rgba(93, 56, 39, 0.1)' : undefined;
}

/**
 * La sombra de cada entreno del historial, una tarjeta teñida que se toca: en
 * claro, una muy leve que la despega del fondo; en oscuro, ninguna, porque ya
 * la separa su borde.
 */
export function sombraDeEntreno(paleta: Paleta): string | undefined {
  return paleta === PALETAS.claro ? '0 1px 2px rgba(31, 28, 26, 0.06)' : undefined;
}

/** La sombra del botón principal, del color de las acciones de cada modo. */
export function sombraDelBotonPrincipal(paleta: Paleta): string {
  return paleta === PALETAS.claro ? '0 8px 20px rgba(93, 56, 39, 0.2)' : '0 8px 24px rgba(207, 141, 96, 0.16)';
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
 * más que el color: en Android, por una píldora del color de las acciones con
 * el icono encima; en el iPhone, por el icono en ese color y la etiqueta en
 * negrita. En Android las dos etiquetas llevan el mismo peso, porque
 * NativeTabs no deja otro para la elegida. Sin estos colores, Android usaría
 * los que saca del fondo de pantalla.
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
