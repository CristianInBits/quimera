import type { TextStyle } from 'react-native';

// Los tamaños de Quimera. Se usa de pie, con una mano y sudando: nada que se
// toque mide menos de 48 puntos.

export const espacio = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32 } as const;

/** Las esquinas, más redondas cuanto más grande es la pieza. */
export const radio = {
  /** Botones de solo texto y filas que se tocan. */
  pequeno: 14,
  /** Campos, cifras del esfuerzo y botones pequeños. */
  control: 16,
  /** Botones con borde, avisos y grupos dentro de una tarjeta. */
  boton: 18,
  /** El botón principal. */
  grande: 20,
  /** Tarjetas. */
  tarjeta: 24,
} as const;

export const toqueMinimo = 48;

/**
 * Si la letra del sistema va al 130 % o más: entonces lo que va en fila se
 * apila, porque no cabe. Android pasa su escala como un número de coma
 * flotante de 32 bits, y su 130 % llega como 1,2999999…: por eso se compara
 * en tantos por ciento redondeados y no con 1,3.
 */
export function esLetraGrande(fontScale: number): boolean {
  return Math.round(fontScale * 100) >= 130;
}

export const texto = { xs: 12, s: 14, m: 16, l: 20, xl: 28, datoXl: 40 } as const;

/**
 * Los números son el contenido. Van en la letra del sistema con cifras
 * tabulares, todas del mismo ancho, para que las columnas de pesos y tiempos
 * queden alineadas.
 */
export const datos: TextStyle = {
  fontVariant: ['tabular-nums'],
};

/**
 * Los nombres de las dos fuentes de los títulos, Nunito en sus pesos 800 y
 * 900. Las carga src/app/_layout.tsx antes de enseñar nada. En Android cada
 * peso es su propia familia, así que los títulos no llevan fontWeight: con él,
 * Android buscaría otro peso de la familia y caería en la letra del sistema.
 */
export const NUNITO = {
  extraNegrita: 'Nunito_800ExtraBold',
  negra: 'Nunito_900Black',
} as const;

/** Los títulos, en Nunito; todo lo demás va en la letra del sistema. */
export const titulos = {
  /** El de cada pantalla: «Quimera», «Historial». */
  pantalla: { fontFamily: NUNITO.negra, fontSize: 30 },
  /** El de la cabecera de una pantalla abierta encima, como «Gimnasio». */
  cabecera: { fontFamily: NUNITO.extraNegrita, fontSize: 22 },
  /** El de cada sección: «Esta semana», «Duración», «Esfuerzo», «Notas». */
  seccion: { fontFamily: NUNITO.extraNegrita, fontSize: 20 },
  /** El nombre de un ejercicio o de una disciplina. */
  bloque: { fontFamily: NUNITO.extraNegrita, fontSize: 19 },
  /** El de cada semana del historial. */
  semana: { fontFamily: NUNITO.extraNegrita, fontSize: 18 },
} as const satisfies Record<string, TextStyle>;
