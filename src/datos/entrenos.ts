import { p, type Lectura, type Transaccion } from './base';
import type { Medida } from './catalogo';
import { leerEjerciciosPorClave } from './ejercicios';
import { nuevoSello } from './sellos';

// Guardar, corregir, borrar y restaurar entrenos. Un entreno se guarda siempre
// entero, con todos sus bloques y sus series, y lleva un solo sello: es la
// unidad que se fusionará al importar, así que nunca queda mezcla de dos
// versiones. Al corregir, los bloques y las series se borran y se vuelven a
// escribir con los mismos identificadores; las series que se quitan
// desaparecen.

export type Disciplina = 'gimnasio' | 'hyrox' | 'calistenia' | 'carrera' | 'natacion';

/** Una cosa hecha en una vuelta: lo que mide su ejercicio y el descanso que vino después. */
export type Serie = {
  id: string;
  ronda: number;
  orden: number;
  ejercicioId: string;
  repeticiones: number | null;
  pesoG: number | null;
  tiempoMs: number | null;
  distanciaM: number | null;
  calorias: number | null;
  descansoMs: number | null;
};

/** Una parte del entreno. Con metrosCorridos es un bloque de carrera. */
export type Bloque = {
  id: string;
  metrosCorridos: number | null;
  tiempoMs: number | null;
  descansoMs: number | null;
  series: Serie[];
};

export type Entreno = {
  id: string;
  disciplina: Disciplina;
  fecha: string;
  hora: string | null;
  duracionMs: number;
  esfuerzo: number;
  notas: string | null;
  bloques: Bloque[];
};

export type EntrenoGuardado = Entreno & { modificado: number };

/** El entreno cambió, o se borró, desde que el editor lo leyó. */
export class EntrenoCambiado extends Error {
  constructor(id: string) {
    super(`El entreno ${id} ha cambiado desde que se abrió.`);
    this.name = 'EntrenoCambiado';
  }
}

/** Una serie lleva algo que su ejercicio no mide. */
export class EntrenoNoValido extends Error {
  constructor(readonly problemas: string[]) {
    super(`El entreno no se puede guardar: ${problemas.join(' ')}`);
    this.name = 'EntrenoNoValido';
  }
}

const MEDIDAS_DE_LA_SERIE: [keyof Serie, Medida, string][] = [
  ['repeticiones', 'repeticiones', 'repeticiones'],
  ['pesoG', 'peso', 'peso'],
  ['tiempoMs', 'tiempo', 'tiempo'],
  ['distanciaM', 'distancia', 'distancia'],
  ['calorias', 'calorias', 'calorías'],
];

/**
 * Cada serie lleva solo lo que mide su ejercicio: una plancha no lleva
 * repeticiones ni un press banca segundos. La base no lo puede comprobar sola,
 * porque está en dos tablas. Un ejercicio que no existe lo rechaza después la
 * clave foránea.
 */
async function comprobarMedidas(tx: Transaccion, entreno: Entreno): Promise<void> {
  const series = entreno.bloques.flatMap((bloque) => bloque.series);
  const ejercicios = await leerEjerciciosPorClave(
    tx,
    series.map((serie) => serie.ejercicioId),
  );
  const problemas = new Set<string>();
  for (const serie of series) {
    const ejercicio = ejercicios.get(serie.ejercicioId);
    if (ejercicio === undefined) {
      continue;
    }
    for (const [campo, medida, nombre] of MEDIDAS_DE_LA_SERIE) {
      if (serie[campo] !== null && !ejercicio.mide.includes(medida)) {
        problemas.add(`${ejercicio.nombre} no lleva ${nombre}.`);
      }
    }
  }
  if (problemas.size > 0) {
    throw new EntrenoNoValido([...problemas]);
  }
}

export type OpcionesDeGuardar = {
  ahora: number;
  /**
   * El sello del entreno cuando el editor lo leyó, o null si es nuevo. Si la
   * base no lo tiene igual, el entreno cambió o se borró mientras tanto (por
   * ejemplo, con una importación) y no se pisa: se lanza EntrenoCambiado. Sin
   * este dato no se comprueba nada.
   */
  selloLeido?: number | null;
};

/** Guarda un entreno nuevo o corregido, entero, y devuelve su sello nuevo. */
export async function guardarEntrenoEn(
  tx: Transaccion,
  entreno: Entreno,
  { ahora, selloLeido }: OpcionesDeGuardar,
): Promise<number> {
  const actual = await tx.getFirstAsync<{ modificado: number; borrado: number }>(
    'SELECT modificado, borrado FROM entreno WHERE id = :id',
    p({ id: entreno.id }),
  );
  if (selloLeido !== undefined) {
    // Un entreno nuevo no puede existir ya, ni siquiera borrado; uno corregido
    // tiene que seguir sin borrar y con el sello que se leyó.
    const comoSeLeyo =
      selloLeido === null
        ? actual === null
        : actual !== null && actual.borrado === 0 && actual.modificado === selloLeido;
    if (!comoSeLeyo) {
      throw new EntrenoCambiado(entreno.id);
    }
  }
  await comprobarMedidas(tx, entreno);
  const modificado = nuevoSello(ahora, actual?.modificado);
  const notas = entreno.notas !== null && entreno.notas.trim().length > 0 ? entreno.notas : null;

  await tx.runAsync(
    `INSERT INTO entreno (id, disciplina, fecha, hora, duracion_ms, esfuerzo, notas, modificado, borrado)
     VALUES (:id, :disciplina, :fecha, :hora, :duracionMs, :esfuerzo, :notas, :modificado, 0)
     ON CONFLICT (id) DO UPDATE SET
       disciplina = excluded.disciplina, fecha = excluded.fecha, hora = excluded.hora,
       duracion_ms = excluded.duracion_ms, esfuerzo = excluded.esfuerzo, notas = excluded.notas,
       modificado = excluded.modificado, borrado = 0`,
    p({
      id: entreno.id,
      disciplina: entreno.disciplina,
      fecha: entreno.fecha,
      hora: entreno.hora,
      duracionMs: entreno.duracionMs,
      esfuerzo: entreno.esfuerzo,
      notas,
      modificado,
    }),
  );
  // La cascada borra también sus series.
  await tx.runAsync('DELETE FROM bloque WHERE entreno_id = :id', p({ id: entreno.id }));

  for (const [i, bloque] of entreno.bloques.entries()) {
    await tx.runAsync(
      `INSERT INTO bloque (id, entreno_id, orden, metros_corridos, tiempo_ms, descanso_ms, modificado)
       VALUES (:id, :entrenoId, :orden, :metrosCorridos, :tiempoMs, :descansoMs, :modificado)`,
      p({
        id: bloque.id,
        entrenoId: entreno.id,
        orden: i + 1,
        metrosCorridos: bloque.metrosCorridos,
        tiempoMs: bloque.tiempoMs,
        descansoMs: bloque.descansoMs,
        modificado,
      }),
    );
    for (const serie of bloque.series) {
      await tx.runAsync(
        `INSERT INTO serie (id, bloque_id, ronda, orden, ejercicio_id, repeticiones, peso_g, tiempo_ms,
                            distancia_m, calorias, descanso_ms, modificado)
         VALUES (:id, :bloqueId, :ronda, :orden, :ejercicioId, :repeticiones, :pesoG, :tiempoMs,
                 :distanciaM, :calorias, :descansoMs, :modificado)`,
        p({
          id: serie.id,
          bloqueId: bloque.id,
          ronda: serie.ronda,
          orden: serie.orden,
          ejercicioId: serie.ejercicioId,
          repeticiones: serie.repeticiones,
          pesoG: serie.pesoG,
          tiempoMs: serie.tiempoMs,
          distanciaM: serie.distanciaM,
          calorias: serie.calorias,
          descansoMs: serie.descansoMs,
          modificado,
        }),
      );
    }
  }
  return modificado;
}

/** Un entreno sin borrar, con sus bloques y sus series en orden, o null. */
export async function leerEntreno(l: Lectura, id: string): Promise<EntrenoGuardado | null> {
  const entreno = await l.getFirstAsync<Omit<EntrenoGuardado, 'bloques'>>(
    `SELECT id, disciplina, fecha, hora, duracion_ms AS duracionMs, esfuerzo, notas, modificado
     FROM entreno WHERE id = :id AND borrado = 0`,
    p({ id }),
  );
  if (entreno === null) {
    return null;
  }
  const bloques = await l.getAllAsync<Omit<Bloque, 'series'>>(
    `SELECT id, metros_corridos AS metrosCorridos, tiempo_ms AS tiempoMs, descanso_ms AS descansoMs
     FROM bloque WHERE entreno_id = :id AND borrado = 0 ORDER BY orden`,
    p({ id }),
  );
  const series = await l.getAllAsync<Serie & { bloqueId: string }>(
    `SELECT s.bloque_id AS bloqueId, s.id, s.ronda, s.orden, s.ejercicio_id AS ejercicioId,
            s.repeticiones, s.peso_g AS pesoG, s.tiempo_ms AS tiempoMs, s.distancia_m AS distanciaM,
            s.calorias, s.descanso_ms AS descansoMs
     FROM serie AS s JOIN bloque AS b ON b.id = s.bloque_id
     WHERE b.entreno_id = :id AND b.borrado = 0 AND s.borrado = 0
     ORDER BY b.orden, s.ronda, s.orden`,
    p({ id }),
  );
  return {
    ...entreno,
    bloques: bloques.map((bloque) => ({
      ...bloque,
      series: series
        .filter((serie) => serie.bloqueId === bloque.id)
        .map(({ bloqueId: _, ...serie }) => serie),
    })),
  };
}

/** Borra un entreno: lo marca, y el disparador de la base marca sus bloques y sus series. */
export async function borrarEntrenoEn(tx: Transaccion, id: string, ahora: number): Promise<void> {
  await cambiarMarca(tx, id, 1, ahora);
}

/** Deshace el borrado de un entreno, con sus bloques y sus series. */
export async function restaurarEntrenoEn(tx: Transaccion, id: string, ahora: number): Promise<void> {
  await cambiarMarca(tx, id, 0, ahora);
}

async function cambiarMarca(tx: Transaccion, id: string, borrado: 0 | 1, ahora: number): Promise<void> {
  const actual = await tx.getFirstAsync<{ modificado: number }>(
    'SELECT modificado FROM entreno WHERE id = :id AND borrado = :antes',
    p({ id, antes: 1 - borrado }),
  );
  if (actual === null) {
    throw new Error(
      borrado === 1 ? `No hay ningún entreno sin borrar con el id ${id}.` : `No hay ningún entreno borrado con el id ${id}.`,
    );
  }
  const { changes } = await tx.runAsync(
    'UPDATE entreno SET borrado = :borrado, modificado = :modificado WHERE id = :id',
    p({ id, borrado, modificado: nuevoSello(ahora, actual.modificado) }),
  );
  if (changes !== 1) {
    throw new Error(`No se pudo cambiar la marca de borrado del entreno ${id}.`);
  }
}
