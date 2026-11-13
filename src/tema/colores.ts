import { useColorScheme } from 'react-native';

import type { Disciplina } from '@/datos/entrenos';

// Los colores de Quimera, los mismos de Quimera-web (frontend/src/estilos/
// tokens.css). El modo claro o el oscuro siguen al del móvil.
//
// Los de cada disciplina se eligieron allí para distinguirse también con
// daltonismo: en claro son oscuros y en oscuro, claros y vivos. Aun así, el
// color nunca va solo: el nombre de la disciplina lo acompaña siempre.
//
// Como texto pequeño, un color necesita un contraste de 4,5:1. El texto y el
// error lo tienen sobre los tres fondos, y los de las disciplinas sobre el
// fondo. Sobre fondoElevado y fondoHundido, los de las disciplinas solo sirven
// para marcas o texto grande: carrera en claro y calistenia en oscuro bajan de
// 4,5:1. Lo vigila src/__tests__/colores.test.ts.

export type Paleta = {
  fondo: string;
  fondoElevado: string;
  fondoHundido: string;
  borde: string;
  texto: string;
  textoTenue: string;
  error: string;
  disciplina: Record<Disciplina, string>;
};

export const PALETAS: Record<'claro' | 'oscuro', Paleta> = {
  claro: {
    fondo: '#ffffff',
    fondoElevado: '#f4f5f7',
    fondoHundido: '#eceef1',
    borde: '#d7dbe0',
    texto: '#14161a',
    textoTenue: '#5b6472',
    error: '#b3261e',
    disciplina: {
      carrera: '#15803d',
      natacion: '#12579b',
      gimnasio: '#a81f66',
      calistenia: '#6d28d9',
      hyrox: '#7d5100',
    },
  },
  oscuro: {
    fondo: '#0f1115',
    fondoElevado: '#171a20',
    fondoHundido: '#0a0c0f',
    borde: '#2a2f38',
    texto: '#e9ecf1',
    textoTenue: '#99a2b0',
    error: '#f2b8b5',
    disciplina: {
      carrera: '#6ee7a7',
      natacion: '#6ab4ff',
      gimnasio: '#ec4899',
      calistenia: '#a855f7',
      hyrox: '#fbbf24',
    },
  },
};

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
 * más que el color, como en Quimera-web: en Android, por una píldora del color
 * del texto con el icono encima en el color del fondo; en los dos sistemas,
 * por la etiqueta en negrita. Sin estos colores, Android usaría los que saca
 * del fondo de pantalla del móvil.
 */
export function coloresDeLaBarra(paleta: Paleta, sistema: 'android' | 'ios'): ColoresDeLaBarra {
  return {
    fondo: paleta.fondoElevado,
    icono: paleta.textoTenue,
    iconoElegido: sistema === 'android' ? paleta.fondo : paleta.texto,
    etiqueta: paleta.textoTenue,
    etiquetaElegida: paleta.texto,
    indicador: paleta.texto,
    onda: paleta.fondoHundido,
  };
}
