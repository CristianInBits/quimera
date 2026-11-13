import { Platform, type TextStyle } from 'react-native';

// Los tamaños de Quimera, los de Quimera-web. Se usa de pie, con una mano y
// sudando: nada que se toque mide menos de 48 puntos.

export const espacio = { 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32 } as const;

export const radio = 8;

export const toqueMinimo = 48;

export const texto = { xs: 12, s: 14, m: 16, l: 20, xl: 28, datoXl: 40 } as const;

/**
 * Los números son el contenido. Van en una letra de ancho fijo y con cifras
 * tabulares, para que las columnas de pesos y tiempos queden alineadas.
 */
export const datos: TextStyle = {
  fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  fontVariant: ['tabular-nums'],
};
