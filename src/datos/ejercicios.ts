import { p, type Lectura } from './base';
import { CATALOGO, type Medida } from './catalogo';

// Los ejercicios que se pueden elegir: los del catálogo que no se han retirado
// y, más adelante, los propios. Salen de la base, que es la que manda; lo que
// no está en la base, como la marca de peso por mancuerna, sale del catálogo.

export type Ejercicio = {
  id: string;
  nombre: string;
  grupo: string;
  mide: Medida[];
  porMancuerna: boolean;
};

type FilaDeEjercicio = {
  id: string;
  nombre: string;
  grupo: string;
  usa_repeticiones: number;
  usa_peso: number;
  usa_tiempo: number;
  usa_distancia: number;
  usa_calorias: number;
};

const MEDIDAS: [keyof FilaDeEjercicio, Medida][] = [
  ['usa_repeticiones', 'repeticiones'],
  ['usa_peso', 'peso'],
  ['usa_tiempo', 'tiempo'],
  ['usa_distancia', 'distancia'],
  ['usa_calorias', 'calorias'],
];

const conMancuernas = new Set(CATALOGO.filter((e) => e.porMancuerna).map((e) => e.id));

function deFila(fila: FilaDeEjercicio): Ejercicio {
  return {
    id: fila.id,
    nombre: fila.nombre,
    grupo: fila.grupo,
    mide: MEDIDAS.filter(([columna]) => fila[columna] === 1).map(([, medida]) => medida),
    porMancuerna: conMancuernas.has(fila.id),
  };
}

const COLUMNAS = 'id, nombre, grupo, usa_repeticiones, usa_peso, usa_tiempo, usa_distancia, usa_calorias';

/** Los ejercicios sin retirar, por orden alfabético como lo lee una persona. */
export async function leerEjercicios(l: Lectura): Promise<Ejercicio[]> {
  const filas = await l.getAllAsync<FilaDeEjercicio>(`SELECT ${COLUMNAS} FROM ejercicio WHERE borrado = 0`, {});
  return filas.map(deFila).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/**
 * Los ejercicios con estas claves, también los retirados: un entreno viejo
 * sigue nombrando un ejercicio aunque ya no se pueda elegir.
 */
export async function leerEjerciciosPorClave(l: Lectura, ids: readonly string[]): Promise<Map<string, Ejercicio>> {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) {
    return new Map();
  }
  const filas = await l.getAllAsync<FilaDeEjercicio>(
    `SELECT ${COLUMNAS} FROM ejercicio WHERE id IN (SELECT value FROM json_each(:ids))`,
    p({ ids: JSON.stringify(unicos) }),
  );
  return new Map(filas.map((fila) => [fila.id, deFila(fila)]));
}
