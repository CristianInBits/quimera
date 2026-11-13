import { getRandomValues } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { crearGeneradorDeIds } from './ids';
import { prepararBase } from './preparar';

// Lo que une los módulos de datos con el móvil: su reloj, su azar y la base de
// expo-sqlite.

/**
 * Los identificadores nuevos de este móvil. El azar sale de getRandomValues,
 * que va siempre al generador del sistema. getRandomBytes no sirve: en
 * desarrollo, con React Native 0.88, usa Math.random (expo-crypto 58.0.8,
 * src/Crypto.ts).
 */
export const nuevoId = crearGeneradorDeIds(
  () => Date.now(),
  (n) => getRandomValues(new Uint8Array(n)),
);

/**
 * El onInit del SQLiteProvider. Tiene que ser siempre la misma función: si
 * cambia, el SQLiteProvider vuelve a abrir la base.
 */
export async function prepararBaseDelMovil(db: SQLiteDatabase): Promise<void> {
  const estado = await prepararBase(db, { ahora: () => Date.now() });
  if (__DEV__) {
    console.log(
      `Quimera: base en la versión ${estado.version}, SQLite ${estado.sqlite}, ` +
        `${estado.ejercicios} ejercicios del catálogo, identificador de prueba ${nuevoId()}`,
    );
  }
}
