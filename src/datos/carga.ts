import { p, type Lectura } from './base';
import type { Disciplina } from './entrenos';
import { sumarDias } from './fechas';

/** Lo que suma una semana, de lunes a domingo. */
export type Semana = {
  lunes: string;
  /** Los minutos de cada entreno por su esfuerzo, sumados. */
  carga: number;
  minutos: number;
  entrenos: number;
  /** Los minutos de cada disciplina con algún entreno, de más a menos. */
  porDisciplina: { disciplina: Disciplina; minutos: number }[];
};

export type CargaDeInicio = {
  estaSemana: Semana;
  laPasada: Semana;
  /** Si hay algún entreno guardado, de cualquier semana. */
  hayEntrenos: boolean;
};

type Fila = { lunes: string; disciplina: Disciplina; carga: number; minutos: number; entrenos: number };

const vacia = (lunes: string): Semana => ({ lunes, carga: 0, minutos: 0, entrenos: 0, porDisciplina: [] });

/**
 * La carga de la semana del lunes dado y la de la anterior, aunque no tengan
 * entrenos. Lee de la vista entreno_hecho, como todas las sumas: los minutos
 * de cada entreno van redondeados y los borrados no cuentan.
 */
export async function leerCargaDeInicio(l: Lectura, lunes: string): Promise<CargaDeInicio> {
  const pasada = sumarDias(lunes, -7);
  const filas = await l.getAllAsync<Fila>(
    `SELECT lunes, disciplina, SUM(carga) AS carga, SUM(minutos) AS minutos, COUNT(*) AS entrenos
       FROM entreno_hecho
      WHERE fecha BETWEEN :desde AND :hasta
      GROUP BY lunes, disciplina`,
    p({ desde: pasada, hasta: sumarDias(lunes, 6) }),
  );
  const hay = await l.getFirstAsync<{ hay: number }>('SELECT EXISTS (SELECT 1 FROM entreno_hecho) AS hay', {});
  const semana = (deLunes: string): Semana => {
    const suyas = filas.filter((fila) => fila.lunes === deLunes);
    if (suyas.length === 0) return vacia(deLunes);
    return {
      lunes: deLunes,
      carga: suyas.reduce((suma, fila) => suma + fila.carga, 0),
      minutos: suyas.reduce((suma, fila) => suma + fila.minutos, 0),
      entrenos: suyas.reduce((suma, fila) => suma + fila.entrenos, 0),
      porDisciplina: suyas
        .map(({ disciplina, minutos }) => ({ disciplina, minutos }))
        .sort((a, b) => b.minutos - a.minutos || a.disciplina.localeCompare(b.disciplina)),
    };
  };
  return { estaSemana: semana(lunes), laPasada: semana(pasada), hayEntrenos: hay?.hay === 1 };
}
