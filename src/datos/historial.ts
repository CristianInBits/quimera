import type { Lectura } from './base';
import type { Disciplina } from './entrenos';

/** Lo que enseña el historial de cada entreno. */
export type EntradaDelHistorial = {
  id: string;
  disciplina: Disciplina;
  fecha: string;
  hora: string | null;
  /** El lunes de su semana. */
  lunes: string;
  /** La duración en minutos redondeados, la de las sumas. */
  minutos: number;
  esfuerzo: number;
  /** Los minutos por el esfuerzo. */
  carga: number;
  /** Los nombres de sus ejercicios, en el orden en que salen por primera vez y sin repetir. */
  ejercicios: string[];
  /** Los metros de sus bloques de carrera. */
  metros: number;
};

type Fila = Omit<EntradaDelHistorial, 'ejercicios'> & { ejercicios: string };

/**
 * Los entrenos sin borrar, del más reciente al más antiguo. Dentro de un día,
 * primero el de hora más tardía, y al final los que no tienen hora. Los
 * minutos, la carga y el lunes salen de la vista entreno_hecho, que es de
 * donde leen todas las sumas.
 */
export async function leerHistorial(l: Lectura): Promise<EntradaDelHistorial[]> {
  const filas = await l.getAllAsync<Fila>(
    `SELECT e.id, e.disciplina, e.fecha, e.hora, e.lunes, e.minutos, e.esfuerzo, e.carga,
            (SELECT json_group_array(nombre ORDER BY primera)
               FROM (SELECT j.nombre AS nombre, MIN(s.bloque_orden * 1000000 + s.ronda * 1000 + s.orden) AS primera
                       FROM serie_hecha AS s JOIN ejercicio AS j ON j.id = s.ejercicio_id
                      WHERE s.entreno_id = e.id
                      GROUP BY s.ejercicio_id)) AS ejercicios,
            (SELECT COALESCE(SUM(b.metros_corridos), 0) FROM bloque_hecho AS b WHERE b.entreno_id = e.id) AS metros
       FROM entreno_hecho AS e
      ORDER BY e.fecha DESC, e.hora DESC, e.id DESC`,
    {},
  );
  return filas.map((fila) => ({ ...fila, ejercicios: JSON.parse(fila.ejercicios) as string[] }));
}
