import { useSQLiteContext } from 'expo-sqlite';

import { puertaDe, type Puerta } from './base';

/**
 * La puerta de la base del móvil, para las pantallas. Es la única forma que
 * tienen de leerla y escribirla: así nada se cuela fuera de la cola.
 */
export function usePuerta(): Puerta {
  return puertaDe(useSQLiteContext());
}
